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

function openMediaDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('profile-online-studio-media-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'path' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function writeStoredMedia(path, blob) {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').put({ path, blob });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function readStoredMedia() {
  const database = await openMediaDatabase();
  const entries = await new Promise((resolve, reject) => {
    const request = database.transaction('media').objectStore('media').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return entries;
}

export async function clearStoredMedia() {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function registerStudioImage(file, imageFiles) {
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
  imageFiles.set(path, file);
  await writeStoredMedia(path, file);
  return path;
}

export async function serializeStudioImages(imageFiles) {
  return Promise.all([...imageFiles].map(async ([path, blob]) => ({
    path,
    dataUrl: await blobToDataUrl(blob),
  })));
}
