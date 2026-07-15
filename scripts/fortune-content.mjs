import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GRADES = new Set(['大吉', '中吉', '小吉']);
const CATEGORIES = new Set(['blessing', 'joke']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class FortuneConflictError extends Error {
  constructor(message = '籤桶已在其他地方修改，請重新載入後再試。') {
    super(message);
    this.name = 'FortuneConflictError';
    this.status = 409;
  }
}

function fortunePath(projectRoot) {
  return path.join(projectRoot, 'src', 'content', 'fortunes.json');
}

function backupPath(projectRoot) {
  return path.join(projectRoot, '.studio-backups', 'fortunes-latest.json');
}

function revisionFor(source) {
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

function normalizeFortune(fortune, index) {
  if (!fortune || typeof fortune !== 'object' || Array.isArray(fortune)) throw new Error(`第 ${index + 1} 張籤的格式不正確。`);
  const id = typeof fortune.id === 'string' ? fortune.id.trim() : '';
  const message = typeof fortune.message === 'string' ? fortune.message.trim() : '';
  const note = typeof fortune.note === 'string' ? fortune.note.trim() : '';
  if (!ID_PATTERN.test(id)) throw new Error(`第 ${index + 1} 張籤的 ID 必須使用小寫英數字與連字號。`);
  if (!GRADES.has(fortune.grade)) throw new Error(`籤「${id}」的等級必須是大吉、中吉或小吉。`);
  if (!CATEGORIES.has(fortune.category)) throw new Error(`籤「${id}」的分類必須是 blessing 或 joke。`);
  if (message.length < 1 || message.length > 200) throw new Error(`籤「${id}」的訊息長度必須是 1 到 200 個字。`);
  if (note.length > 300) throw new Error(`籤「${id}」的備註不可超過 300 個字。`);
  if (typeof fortune.visible !== 'boolean') throw new Error(`籤「${id}」的 visible 必須是布林值。`);
  return {
    id,
    grade: fortune.grade,
    category: fortune.category,
    message,
    ...(note ? { note } : {}),
    visible: fortune.visible,
  };
}

export function validateFortuneBucket(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('籤桶至少需要一張籤。');
  const fortunes = input.map(normalizeFortune);
  const ids = new Set();
  for (const fortune of fortunes) {
    if (ids.has(fortune.id)) throw new Error(`籤詩 ID 重複：${fortune.id}`);
    ids.add(fortune.id);
  }
  if (!fortunes.some((fortune) => fortune.visible)) throw new Error('籤桶至少需要一張啟用中的籤。');
  return fortunes;
}

export function summarizeFortuneBucket(fortunes) {
  const visibleFortunes = fortunes.filter((fortune) => fortune.visible);
  const grades = Object.fromEntries([...GRADES].map((grade) => [grade, fortunes.filter((fortune) => fortune.grade === grade).length]));
  const categories = Object.fromEntries([...CATEGORIES].map((category) => [category, fortunes.filter((fortune) => fortune.category === category).length]));
  const visibleJokes = visibleFortunes.filter((fortune) => fortune.category === 'joke').length;
  const jokeRatio = visibleFortunes.length ? visibleJokes / visibleFortunes.length : 0;
  const warnings = [];
  if (jokeRatio < 0.2 || jokeRatio > 0.4) warnings.push('目前啟用籤的玩梗比例偏離建議的約 3 成；這是風格提示，不會阻擋儲存。');
  return { total: fortunes.length, visible: visibleFortunes.length, grades, categories, warnings };
}

export async function loadFortuneBucket(projectRoot) {
  const source = await readFile(fortunePath(projectRoot), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('fortunes.json 不是有效的 JSON。');
  }
  const fortunes = validateFortuneBucket(parsed);
  return { fortunes, revision: revisionFor(source), summary: summarizeFortuneBucket(fortunes) };
}

export async function saveFortuneBucket(projectRoot, input) {
  const currentPath = fortunePath(projectRoot);
  const currentSource = await readFile(currentPath, 'utf8');
  if (typeof input?.expectedRevision !== 'string' || input.expectedRevision !== revisionFor(currentSource)) throw new FortuneConflictError();
  const fortunes = validateFortuneBucket(input.fortunes);
  const nextSource = `${JSON.stringify(fortunes, null, 2)}\n`;
  const backup = backupPath(projectRoot);
  await mkdir(path.dirname(backup), { recursive: true });
  await writeFile(backup, currentSource, 'utf8');
  const temporaryPath = path.join(path.dirname(currentPath), `.fortunes-${process.pid}-${Date.now()}.tmp`);
  await writeFile(temporaryPath, nextSource, 'utf8');
  await rename(temporaryPath, currentPath);
  return { fortunes, revision: revisionFor(nextSource), summary: summarizeFortuneBucket(fortunes) };
}

export async function restoreFortuneBucket(projectRoot, input) {
  let source;
  try {
    source = await readFile(backupPath(projectRoot), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('目前沒有可復原的籤桶備份。');
    throw error;
  }
  let fortunes;
  try {
    fortunes = JSON.parse(source);
  } catch {
    throw new Error('籤桶備份格式不正確，無法復原。');
  }
  return saveFortuneBucket(projectRoot, { fortunes, expectedRevision: input?.expectedRevision });
}

