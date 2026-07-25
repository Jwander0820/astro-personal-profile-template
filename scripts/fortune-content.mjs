import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteText, withFileWriteLock } from './file-writes.mjs';
import {
  FORTUNE_GRADES,
  summarizeFortuneBucket,
  validateFortuneBucket,
} from './fortune-schema.mjs';

export { FORTUNE_GRADES, summarizeFortuneBucket, validateFortuneBucket };

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
  return withFileWriteLock(currentPath, async () => {
    const currentSource = await readFile(currentPath, 'utf8');
    if (typeof input?.expectedRevision !== 'string' || input.expectedRevision !== revisionFor(currentSource)) throw new FortuneConflictError();
    const fortunes = validateFortuneBucket(input.fortunes);
    const nextSource = `${JSON.stringify(fortunes, null, 2)}\n`;
    const backup = backupPath(projectRoot);
    await mkdir(path.dirname(backup), { recursive: true });
    await writeFile(backup, currentSource, 'utf8');
    await atomicWriteText(currentPath, nextSource);
    return { fortunes, revision: revisionFor(nextSource), summary: summarizeFortuneBucket(fortunes) };
  });
}

export async function replaceFortuneBucket(projectRoot, input) {
  const currentPath = fortunePath(projectRoot);
  return withFileWriteLock(currentPath, async () => {
    const currentSource = await readFile(currentPath, 'utf8');
    const fortunes = validateFortuneBucket(input);
    const nextSource = `${JSON.stringify(fortunes, null, 2)}\n`;
    if (nextSource === currentSource) {
      return { fortunes, revision: revisionFor(currentSource), summary: summarizeFortuneBucket(fortunes) };
    }
    const backup = backupPath(projectRoot);
    await mkdir(path.dirname(backup), { recursive: true });
    await writeFile(backup, currentSource, 'utf8');
    await atomicWriteText(currentPath, nextSource);
    return { fortunes, revision: revisionFor(nextSource), summary: summarizeFortuneBucket(fortunes) };
  });
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
