import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fileWriteQueues = new Map();

export async function withFileWriteLock(filePath, operation) {
  const previous = fileWriteQueues.get(filePath) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  fileWriteQueues.set(filePath, current);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (fileWriteQueues.get(filePath) === current) fileWriteQueues.delete(filePath);
  }
}

export async function atomicWriteFile(filePath, content) {
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
  try {
    if ((await readFile(filePath)).equals(next)) return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, next);
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
      await unlink(temporaryPath).catch(() => {});
      throw error;
    }
    try {
      await writeFile(filePath, next);
    } finally {
      await unlink(temporaryPath).catch(() => {});
    }
  }
  return true;
}

export async function atomicWriteText(filePath, content) {
  return atomicWriteFile(filePath, Buffer.from(content, 'utf8'));
}
