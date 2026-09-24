function safeImageName(name) {
  const extension = name.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[0] || '.png';
  const base = name.slice(0, -extension.length).toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'profile-image';
  return `${base}${extension === '.jpeg' ? '.jpg' : extension}`;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function mediaDatabaseName(scope) {
  return scope ? `profile-studio-media-v2:${scope}` : 'profile-online-studio-media-v1';
}

function openMediaDatabase(scope) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(mediaDatabaseName(scope), 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'path' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Reserve and commit names under one origin-wide lock. Existing blobs stay
// immutable so another tab or an undo snapshot can keep using them safely.
export async function storeStudioMedia(entries, scope) {
  return navigator.locks.request(`${mediaDatabaseName(scope)}:write`, async () => {
    const existing = new Map((await readStoredMedia(scope)).map(({ path, blob }) => [path, blob]));
    const resolved = [];
    for (const entry of entries) {
      const bytes = new Uint8Array(await entry.blob.arrayBuffer());
      const dot = entry.path.lastIndexOf('.');
      let path = entry.path;
      let suffix = 2;
      while (existing.has(path)) {
        const previous = new Uint8Array(await existing.get(path).arrayBuffer());
        if (previous.length === bytes.length && previous.every((byte, index) => byte === bytes[index])) break;
        path = `${entry.path.slice(0, dot)}-${suffix++}${entry.path.slice(dot)}`;
      }
      existing.set(path, entry.blob);
      resolved.push({ requestedPath: entry.path, path, blob: entry.blob });
    }
    await writeStoredMediaBatch(resolved.map(({ path, blob }) => ({ path, blob })), scope);
    return resolved;
  });
}

export async function writeStoredMediaBatch(entries, scope) {
  if (entries.length === 0) return;
  const database = await openMediaDatabase(scope);
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('media', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('圖片草稿儲存已取消。'));
      try {
        for (const entry of entries) transaction.objectStore('media').put(entry);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export async function readStoredMedia(scope, migrateLegacy = false) {
  const database = await openMediaDatabase(scope);
  let entries;
  try {
    entries = await new Promise((resolve, reject) => {
      const request = database.transaction('media').objectStore('media').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
  if (scope && migrateLegacy) {
    const existing = new Set(entries.map((entry) => entry.path));
    const legacy = (await readStoredMedia()).filter((entry) => !existing.has(entry.path));
    await writeStoredMediaBatch(legacy, scope);
    entries.push(...legacy);
  }
  return entries;
}

export async function registerStudioImage(file, imageFiles, scope) {
  if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) throw new Error('僅支援 PNG、JPG、WebP 或 GIF。');
  if (file.size > 5 * 1024 * 1024) throw new Error('單張圖片不可超過 5 MB。');
  const name = safeImageName(file.name);
  let path = `/images/${name}`;
  let suffix = 2;
  while (imageFiles.has(path)) {
    const dot = name.lastIndexOf('.');
    path = `/images/${name.slice(0, dot)}-${suffix}${name.slice(dot)}`;
    suffix += 1;
  }
  [{ path }] = await storeStudioMedia([{ path, blob: file }], scope);
  imageFiles.set(path, file);
  return path;
}

export async function serializeStudioImages(imageFiles) {
  return Promise.all([...imageFiles].map(async ([path, blob]) => ({
    path,
    dataUrl: await blobToDataUrl(blob),
  })));
}

export function referencedStudioImages(answers, imageFiles) {
  const paths = new Set([
    answers.media?.avatar, answers.media?.background,
    ...(answers.links || []).map((item) => item.image),
    ...(answers.sections || []).map((item) => item.image),
    ...(answers.imageBlocks || []).map((item) => item.image),
  ]);
  return new Map([...imageFiles].filter(([path]) => paths.has(path)));
}
