const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

export const SETTINGS_PACKAGE_LIMITS = Object.freeze({
  bytes: 50 * 1024 * 1024,
  entries: 128,
  metadataBytes: 64 * 1024,
  nameBytes: 512,
  answersBytes: 2 * 1024 * 1024,
  images: 64,
  imageBytes: 5 * 1024 * 1024,
  totalImageBytes: 40 * 1024 * 1024,
});

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function concat(parts) {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function validateSettingsPackageExport(files) {
  const limits = SETTINGS_PACKAGE_LIMITS;
  if (!files.length || files.length > limits.entries) throw new Error('設定包項目不可超過 128 個。');
  const names = new Set();
  let metadataBytes = 0;
  let totalBytes = 22;
  let images = 0;
  let imageBytes = 0;
  for (const file of files) {
    const name = file.name;
    const nameBytes = encoder.encode(name).length;
    const size = file.size ?? file.data.byteLength;
    if (!nameBytes || nameBytes > limits.nameBytes || /[\\\x00-\x1f\x7f:]/.test(name)
      || name.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('設定包檔名不合法或過長。');
    if (names.has(name)) throw new Error('設定包不可包含重複檔名。');
    names.add(name);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('設定包檔案大小不正確。');
    metadataBytes += 76 + nameBytes * 2;
    totalBytes += 76 + nameBytes * 2 + size;
    if (name === 'profile.answers.json' && size > limits.answersBytes) throw new Error('設定 JSON 不可超過 2 MB。');
    if (name.startsWith('images/')) {
      images += 1;
      imageBytes += size;
      if (size > limits.imageBytes) throw new Error('每張設定包圖片不可超過 5 MB。');
    }
  }
  if (metadataBytes > limits.metadataBytes) throw new Error('設定包目錄資料過大。');
  if (images > limits.images) throw new Error('設定包圖片不可超過 64 張。');
  if (imageBytes > limits.totalImageBytes) throw new Error('設定包圖片總量不可超過 40 MB，請縮小圖片後再下載。');
  if (totalBytes > limits.bytes) throw new Error('設定包不可超過 50 MB。');
}

export function createSettingsZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name.replaceAll('\\', '/'));
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write32(localView, 14, checksum);
    write32(localView, 18, data.length);
    write32(localView, 22, data.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write32(centralView, 16, checksum);
    write32(centralView, 20, data.length);
    write32(centralView, 24, data.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
  }
  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralDirectory.length);
  write32(endView, 16, localOffset);
  return concat([...localParts, centralDirectory, end]);
}

export function readSettingsZip(bytes) {
  const limits = SETTINGS_PACKAGE_LIMITS;
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw new Error('ZIP 設定包不完整。');
  if (bytes.length > limits.bytes) throw new Error('設定包不可超過 50 MB。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => { throw new Error('ZIP 設定包結構不完整或資料不一致。'); };
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50 && index + 22 + view.getUint16(index + 20, true) === bytes.length) {
      end = index;
      break;
    }
  }
  if (end < 0) invalid();
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralStart = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) invalid();
  if (count === 0) throw new Error('找不到 ZIP 設定內容。');
  if (count > limits.entries) throw new Error('ZIP 最多可包含 128 個檔案。');
  if (centralStart + centralSize !== end) invalid();
  let cursor = centralStart;
  let localOffset = 0;
  let metadataBytes = 22 + view.getUint16(end + 20, true);
  let imageCount = 0;
  let imageBytes = 0;
  const records = [];
  const names = new Set();
  const budgetMetadata = (size) => {
    metadataBytes += size;
    if (metadataBytes > limits.metadataBytes) throw new Error('ZIP 檔名與附加資料不可超過 64 KB。');
  };
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) invalid();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    if (flags & ~0x0800 || method !== 0) throw new Error('這份 ZIP 使用不支援的壓縮或加密格式；請使用 Studio 下載的設定包。');
    if (size !== view.getUint32(cursor + 24, true) || view.getUint16(cursor + 34, true) !== 0) invalid();
    if (!nameLength || nameLength > limits.nameBytes) throw new Error('ZIP 單一檔名不可超過 512 bytes。');
    budgetMetadata(46 + nameLength + extraLength + commentLength);
    const nextCursor = cursor + 46 + nameLength + extraLength + commentLength;
    if (nextCursor > end) invalid();
    let name;
    try { name = strictDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)); }
    catch { throw new Error('ZIP 檔名不是有效的 UTF-8。'); }
    const parts = name.replace(/\/$/, '').split('/');
    if (name.includes('\\') || /[\u0000-\u001f\u007f:]/.test(name) || parts.some((part) => !part || part === '.' || part === '..')) {
      throw new Error('ZIP 包含不安全的檔案路徑。');
    }
    if (names.has(name)) throw new Error(`ZIP 包含重複檔名：${name}`);
    names.add(name);
    if (name.endsWith('/') && size !== 0) invalid();
    if (name === 'profile.answers.json' && size > limits.answersBytes) throw new Error('回答文件不可超過 2 MB。');
    if (/^images\/.*\.(?:png|jpe?g|webp|gif)$/i.test(name)) {
      if (size > limits.imageBytes) throw new Error(`${name} 超過單張圖片 5 MB 上限。`);
      imageCount += 1;
      imageBytes += size;
      if (imageCount > limits.images) throw new Error('ZIP 最多可包含 64 張圖片。');
      if (imageBytes > limits.totalImageBytes) throw new Error('ZIP 圖片總量不可超過 40 MB。');
    }
    if (view.getUint32(cursor + 42, true) !== localOffset || localOffset + 30 > centralStart || view.getUint32(localOffset, true) !== 0x04034b50) invalid();
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    budgetMetadata(30 + localNameLength + localExtraLength);
    const nameStart = localOffset + 30;
    const dataStart = nameStart + localNameLength + localExtraLength;
    const dataEnd = dataStart + size;
    if (dataEnd > centralStart || localNameLength !== nameLength
      || view.getUint16(localOffset + 6, true) !== flags
      || view.getUint16(localOffset + 8, true) !== method
      || view.getUint32(localOffset + 14, true) !== checksum
      || view.getUint32(localOffset + 18, true) !== size
      || view.getUint32(localOffset + 22, true) !== size) invalid();
    const centralName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    if (!centralName.every((byte, position) => byte === bytes[nameStart + position])) invalid();
    if (crc32(bytes.subarray(dataStart, dataEnd)) !== checksum) throw new Error(`ZIP 檔案校驗失敗：${name}`);
    records.push({ name, dataStart, dataEnd });
    localOffset = dataEnd;
    cursor = nextCursor;
  }
  if (cursor !== end || localOffset !== centralStart) invalid();
  // Allocate retained copies only after the complete archive is validated.
  return new Map(records.map(({ name, dataStart, dataEnd }) => [name, bytes.slice(dataStart, dataEnd)]));
}
