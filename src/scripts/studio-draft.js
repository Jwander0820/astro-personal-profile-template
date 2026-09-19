export const LEGACY_DRAFT_KEY = 'profile-online-studio-draft-v2';
const LEGACY_OWNER_KEY = `${LEGACY_DRAFT_KEY}-owner`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const isDraft = (value) => value?.version === 1 && value.identity && value.appearance;

export function createDraftStore(scope, fallback) {
  const key = `profile-studio-draft-v3:${scope}`;
  let baseline = null;
  let queue = Promise.resolve();
  let initial = clone(fallback);
  let legacyMedia = false;
  try {
    baseline = localStorage.getItem(key);
    const saved = baseline && JSON.parse(baseline);
    if (isDraft(saved?.answers)) {
      initial = saved.answers;
      legacyMedia = saved.legacyMedia === true;
    } else if (!baseline) {
      // A legacy draft has no project identity. Claim it once; never copy it
      // automatically into every project hosted at this origin.
      const owner = localStorage.getItem(LEGACY_OWNER_KEY);
      const legacy = JSON.parse(localStorage.getItem(LEGACY_DRAFT_KEY));
      if ((!owner || owner === scope) && isDraft(legacy)) {
        initial = legacy;
        legacyMedia = true;
        localStorage.setItem(LEGACY_OWNER_KEY, scope);
      }
    }
  } catch {
    // Keep the original storage untouched. The editor can still export its
    // in-memory draft, and save() will report storage failures to the UI.
  }

  function read() {
    const raw = localStorage.getItem(key);
    const saved = raw && JSON.parse(raw);
    return { raw, answers: isDraft(saved?.answers) ? saved.answers : clone(fallback) };
  }

  return {
    key, initial, legacyMedia,
    save(answers, { overwrite = false } = {}) {
      const snapshot = clone(answers);
      const operation = async () => {
        if (!navigator.locks) throw new Error('此瀏覽器無法安全同步草稿，請下載設定包保存。');
        return navigator.locks.request(key, () => {
          const current = localStorage.getItem(key);
          if (current && JSON.stringify(JSON.parse(current).answers) === JSON.stringify(snapshot)) {
            baseline = current;
            return true;
          }
          if (!overwrite && current !== baseline) return false;
          const next = JSON.stringify({ revision: crypto.randomUUID(), legacyMedia, answers: snapshot });
          localStorage.setItem(key, next);
          baseline = next;
          return true;
        });
      };
      const result = queue.then(operation);
      queue = result.catch(() => {});
      return result;
    },
    async reload() {
      await queue;
      const current = read();
      baseline = current.raw;
      return clone(current.answers);
    },
    isCurrent() { return localStorage.getItem(key) === baseline; },
    subscribe(callback) {
      window.addEventListener('storage', (event) => {
        if ((event.key === key || event.key === null) && event.storageArea === localStorage && !this.isCurrent()) callback();
      });
    },
  };
}

// Blobs are immutable and shared by snapshots; only the small answer document
// and Map are copied. History is deliberately limited to the current tab.
export function createDraftHistory(answers, images, limit = 50) {
  const snapshot = () => ({ answers: clone(answers), images: new Map(images) });
  let entries = [snapshot()];
  let index = 0;
  let lastGroup;
  let lastTime = 0;
  return {
    get canUndo() { return index > 0; },
    get canRedo() { return index < entries.length - 1; },
    record(nextAnswers, nextImages, group) {
      const previous = entries[index];
      if (JSON.stringify(previous.answers) === JSON.stringify(nextAnswers)
        && previous.images.size === nextImages.size
        && [...nextImages].every(([path, blob]) => previous.images.get(path) === blob)) return;
      answers = nextAnswers;
      images = nextImages;
      const now = Date.now();
      const coalesce = group && group === lastGroup && now - lastTime < 800 && index > 0;
      entries = entries.slice(0, index + 1);
      if (coalesce) entries[index] = snapshot();
      else { entries.push(snapshot()); index += 1; }
      if (entries.length > limit + 1) { entries.shift(); index -= 1; }
      lastGroup = group;
      lastTime = now;
    },
    peek(direction) { return entries[index + direction]; },
    move(direction) { index += direction; lastGroup = undefined; },
  };
}
