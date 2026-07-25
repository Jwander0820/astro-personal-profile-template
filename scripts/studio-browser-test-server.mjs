import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { access, readFile, rm, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolvePackageBin } from './package-bin.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, '.astro', 'studio-browser-test');
const relativeOutput = path.relative(projectRoot, outputDirectory);
const host = process.env.STUDIO_BROWSER_TEST_HOST || '127.0.0.1';
const port = Number(process.env.STUDIO_BROWSER_TEST_PORT || 4399);
const astroBin = await resolvePackageBin('astro');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function browserTestEnvironment() {
  const env = { ...process.env, NO_COLOR: '1', ONLINE_STUDIO_MODE: 'public' };
  for (const name of [
    'GITHUB_REPOSITORY',
    'ONLINE_STUDIO_ALLOWED_REPOSITORIES',
    'ONLINE_STUDIO_ALLOWED_SITES',
    'SITE_URL',
  ]) {
    delete env[name];
  }
  return env;
}

async function buildFixture() {
  await rm(outputDirectory, { recursive: true, force: true });
  try {
    await execFileAsync(
      process.execPath,
      [astroBin, 'build', '--outDir', relativeOutput],
      {
        cwd: projectRoot,
        env: browserTestEnvironment(),
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      },
    );
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
    throw new Error(`Studio browser fixture 建置失敗。\n${output}`, { cause: error });
  }
  await access(path.join(outputDirectory, 'studio', 'index.html'));
}

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relativePath = decoded.replace(/^\/+/, '');
  const withIndex = !relativePath || relativePath.endsWith('/')
    ? `${relativePath}index.html`
    : relativePath;
  const filePath = path.resolve(outputDirectory, withIndex);
  const expectedPrefix = `${outputDirectory}${path.sep}`;
  return filePath.startsWith(expectedPrefix) ? filePath : null;
}

await buildFixture();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`);
    if (request.method === 'POST' && url.pathname === '/__playwright_shutdown__') {
      response.writeHead(204).end();
      setImmediate(closeServer);
      return;
    }
    let filePath = safeFilePath(url.pathname);
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end(error?.code === 'ENOENT' ? 'Not Found' : 'Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Studio browser test server: http://${host}:${port}`);
});

let isClosing = false;
function closeServer() {
  if (isClosing) return;
  isClosing = true;
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_000).unref();
}

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
