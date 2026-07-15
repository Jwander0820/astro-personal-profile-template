import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

export async function resolvePackageBin(packageName, binaryName = packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const relativeBin = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.[binaryName];
  if (!relativeBin) throw new Error(`${packageName} 沒有提供 ${binaryName} CLI。`);
  return path.resolve(path.dirname(packageJsonPath), relativeBin);
}
