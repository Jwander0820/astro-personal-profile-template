import { rm } from 'node:fs/promises';
import path from 'node:path';

export default async function globalTeardown() {
  const host = process.env.STUDIO_BROWSER_TEST_HOST || '127.0.0.1';
  const port = Number(process.env.STUDIO_BROWSER_TEST_PORT || 4399);
  try {
    await fetch(`http://${host}:${port}/__playwright_shutdown__`, {
      method: 'POST',
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // The server may already be stopped after an early startup failure.
  }
  await rm(path.resolve('.astro', 'studio-browser-test'), { recursive: true, force: true });
}
