// Compatibility helper retained for older downstream imports. The legacy
// Studio user interface has been removed; the active UI lives under /studio/.
export function createValueChangeTracker(initialValue) {
  let previousValue = initialValue;
  return (nextValue) => {
    if (nextValue === previousValue) return false;
    previousValue = nextValue;
    return true;
  };
}

export function createSaveCoordinator({
  delayMs = 5000,
  mode: initialMode = 'manual',
  canSave = () => true,
  save,
  refresh = async () => {},
  onStatus = () => {},
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  if (typeof save !== 'function') throw new Error('save coordinator 需要 save 函式。');
  if (!['manual', 'auto'].includes(initialMode)) throw new Error('儲存模式必須是 manual 或 auto。');

  const entries = new Map();
  let mode = initialMode;
  let disposed = false;

  function entryFor(key) {
    if (!entries.has(key)) {
      entries.set(key, {
        revision: 0,
        savedRevision: 0,
        status: 'clean',
        timer: null,
        inFlight: null,
        submitAfterFlight: false,
        lastSaveResult: null,
      });
    }
    return entries.get(key);
  }

  function emit(key, status, details = {}) {
    const entry = entryFor(key);
    entry.status = status;
    onStatus({
      key,
      status,
      mode,
      revision: entry.revision,
      savedRevision: entry.savedRevision,
      pending: entry.revision > entry.savedRevision,
      ...details,
    });
  }

  function clearScheduled(entry) {
    if (entry.timer === null) return;
    clearTimeoutFn(entry.timer);
    entry.timer = null;
  }

  function schedule(key) {
    const entry = entryFor(key);
    clearScheduled(entry);
    if (disposed || mode !== 'auto' || entry.inFlight || entry.revision <= entry.savedRevision || !canSave({ key })) {
      if (entry.revision > entry.savedRevision && !entry.inFlight) emit(key, 'dirty');
      return;
    }
    emit(key, 'scheduled');
    entry.timer = setTimeoutFn(() => {
      entry.timer = null;
      submitAll({ savableOnly: true }).catch(() => {});
    }, delayMs);
  }

  function markDirty(key) {
    if (disposed) return 0;
    const entry = entryFor(key);
    entry.revision += 1;
    if (entry.inFlight) emit(key, 'saving', { hasNewerChanges: true });
    else if (mode === 'auto' && canSave({ key })) schedule(key);
    else emit(key, 'dirty');
    return entry.revision;
  }

  async function submit(key, { refresh: shouldRefresh = true, deferClean = false } = {}) {
    if (disposed) return undefined;
    const entry = entryFor(key);
    clearScheduled(entry);
    if (entry.inFlight) {
      entry.submitAfterFlight = true;
      return entry.inFlight.then(() => {
        if (entry.submitAfterFlight) {
          entry.submitAfterFlight = false;
          return submit(key);
        }
        return entry.lastSaveResult;
      });
    }
    if (entry.revision <= entry.savedRevision) {
      emit(key, 'clean');
      return entry.lastSaveResult;
    }

    const targetRevision = entry.revision;
    emit(key, 'saving');
    const operation = (async () => {
      let result;
      try {
        result = await save({ key, revision: targetRevision });
        entry.savedRevision = Math.max(entry.savedRevision, targetRevision);
        entry.lastSaveResult = result;
      } catch (error) {
        emit(key, 'error', { phase: 'save', error });
        throw error;
      }

      try {
        if (shouldRefresh) {
          emit(key, 'refreshing');
          await refresh({ key, revision: targetRevision, result });
        }
      } catch (error) {
        emit(key, 'error', { phase: 'refresh', error, contentSaved: true });
        throw error;
      }

      if (!deferClean && entry.revision === targetRevision) emit(key, 'clean');
      return result;
    })();
    entry.inFlight = operation;
    try {
      return await operation;
    } finally {
      entry.inFlight = null;
      if (entry.revision > entry.savedRevision && mode === 'auto' && !entry.submitAfterFlight) schedule(key);
    }
  }

  function pendingKeys({ savableOnly = false } = {}) {
    return [...entries.entries()]
      .filter(([key, entry]) => entry.revision > entry.savedRevision && (!savableOnly || canSave({ key })))
      .map(([key]) => key);
  }

  async function submitAll({ savableOnly = false } = {}) {
    const keys = pendingKeys({ savableOnly });
    const results = [];
    for (const key of keys) {
      const result = await submit(key, { refresh: false, deferClean: true });
      results.push({ key, revision: entryFor(key).savedRevision, result });
    }
    if (results.length === 0) return results;

    const latest = results.at(-1);
    emit(latest.key, 'refreshing', { batch: true, count: results.length });
    try {
      await refresh({ ...latest, results, batch: true });
    } catch (error) {
      emit(latest.key, 'error', { phase: 'refresh', error, contentSaved: true, batch: true });
      throw error;
    }
    results.forEach(({ key, revision }) => {
      if (entryFor(key).revision === revision) emit(key, 'clean', { batch: true });
    });
    return results;
  }

  function setMode(nextMode) {
    if (!['manual', 'auto'].includes(nextMode)) throw new Error('儲存模式必須是 manual 或 auto。');
    mode = nextMode;
    entries.forEach((entry, key) => {
      if (mode === 'manual') {
        clearScheduled(entry);
        if (entry.revision > entry.savedRevision && !entry.inFlight) emit(key, 'dirty');
      } else if (entry.revision > entry.savedRevision && !entry.inFlight) schedule(key);
    });
    return mode;
  }

  function hasPending() {
    return [...entries.values()].some((entry) => entry.revision > entry.savedRevision);
  }

  function getStatus(key) {
    const entry = entryFor(key);
    return { status: entry.status, revision: entry.revision, savedRevision: entry.savedRevision };
  }

  function reset(key) {
    const entry = entryFor(key);
    clearScheduled(entry);
    entry.savedRevision = entry.revision;
    entry.submitAfterFlight = false;
    emit(key, 'clean');
  }

  function dispose() {
    disposed = true;
    entries.forEach(clearScheduled);
  }

  return { markDirty, submit, submitAll, pendingKeys, reset, setMode, hasPending, getStatus, dispose };
}
