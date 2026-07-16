import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applyProfileAnswers,
  createStudioSection,
  createStudioLink,
  loadStudioContent,
  previewProfileAnswers,
  saveHomeSettings,
  saveStudioBlock,
  saveStudioLink,
  saveStudioSocialOrder,
  saveStudioProfile,
  saveStudioSection,
} from './profile-content.mjs';
import { FortuneConflictError, loadFortuneBucket, restoreFortuneBucket, saveFortuneBucket } from './fortune-content.mjs';
import { resolvePackageBin } from './package-bin.mjs';
import { StudioRequestError, validateStudioRequest } from './studio-request-security.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioRoot = path.join(projectRoot, 'studio');
const studioPort = Number(process.env.STUDIO_PORT || 4322);
const previewPort = Number(process.env.PORT || 4321);
const MAX_BODY_SIZE = 7 * 1024 * 1024;
let iconCatalogPromise;
let contentRevision = 0;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function sendMutation(response, status, mutation) {
  const body = await mutation;
  contentRevision += 1;
  sendJson(response, status, { ...body, contentRevision });
}

async function loadIconCatalog() {
  if (!iconCatalogPromise) {
    iconCatalogPromise = readFile(path.join(projectRoot, 'src', 'lib', 'icons.ts'), 'utf8').then((source) => {
      const constants = new Map([...source.matchAll(/const\s+(\w+)\s*=\s*'([^']*)';/g)].map((match) => [match[1], match[2]]));
      const objectSource = source.match(/export const icons:[^{]+\{([\s\S]*?)\n\};/)?.[1] ?? '';
      const entries = [...objectSource.matchAll(/^\s*([a-z0-9]+):\s*(?:'([^']*)'|(\w+)),?$/gm)]
        .map((match) => [match[1], match[2] ?? constants.get(match[3])])
        .filter((entry) => entry[1]);
      return Object.fromEntries(entries);
    });
  }
  return iconCatalogPromise;
}

function sendSvg(response, body) {
  response.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" color="#574967" fill="currentColor">${body}</svg>`);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) throw new Error('資料超過 7 MB 上限。');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('送出的 JSON 格式不正確。');
  }
}

async function saveImage(input) {
  if (!input || typeof input.name !== 'string' || typeof input.dataUrl !== 'string') throw new Error('圖片資料不完整。');
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('僅支援 PNG、JPG、WebP、GIF 或 SVG。');
  const extensionByType = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
  const originalBase = path.basename(input.name, path.extname(input.name));
  const safeBase = originalBase.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'profile-image';
  const fileName = `${safeBase}${extensionByType[match[1]]}`;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('圖片不可超過 5 MB。');
  await writeFile(path.join(projectRoot, 'public', 'images', fileName), buffer);
  return `/images/${fileName}`;
}

async function serveStatic(pathname, response) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = path.resolve(studioRoot, relative);
  if (resolved !== studioRoot && !resolved.startsWith(`${studioRoot}${path.sep}`)) {
    sendJson(response, 403, { error: '拒絕存取。' });
    return;
  }
  try {
    const content = await readFile(resolved);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(resolved)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') sendJson(response, 404, { error: '找不到頁面。' });
    else throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    validateStudioRequest(request, studioPort);
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/api/content') {
      const [content, icons] = await Promise.all([loadStudioContent(projectRoot), loadIconCatalog()]);
      sendJson(response, 200, { ...content, icons: Object.keys(icons), previewUrl: `http://localhost:${previewPort}/`, contentRevision });
      return;
    }
    const iconMatch = url.pathname.match(/^\/api\/icons\/([a-z0-9]+)\.svg$/);
    if (request.method === 'GET' && iconMatch) {
      const icon = (await loadIconCatalog())[iconMatch[1]];
      if (!icon) {
        sendJson(response, 404, { error: '找不到 Icon。' });
        return;
      }
      sendSvg(response, icon);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/fortunes') {
      sendJson(response, 200, await loadFortuneBucket(projectRoot));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/fortunes') {
      await sendMutation(response, 200, saveFortuneBucket(projectRoot, await readJson(request)));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/fortunes/restore') {
      await sendMutation(response, 200, restoreFortuneBucket(projectRoot, await readJson(request)));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/profile') {
      await sendMutation(response, 200, saveStudioProfile(projectRoot, await readJson(request)).then((profile) => ({ profile })));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/home') {
      await sendMutation(response, 200, saveHomeSettings(projectRoot, await readJson(request)).then((home) => ({ home })));
      return;
    }
    const blockMatch = url.pathname.match(/^\/api\/blocks\/([a-z0-9-]+)$/);
    if (request.method === 'PUT' && blockMatch) {
      await sendMutation(response, 200, saveStudioBlock(projectRoot, blockMatch[1], await readJson(request)).then((block) => ({ block })));
      return;
    }
    const sectionMatch = url.pathname.match(/^\/api\/sections\/([a-z0-9-]+)$/);
    if (request.method === 'PUT' && sectionMatch) {
      await sendMutation(response, 200, saveStudioSection(projectRoot, sectionMatch[1], await readJson(request)).then((section) => ({ section })));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/sections') {
      await sendMutation(response, 201, createStudioSection(projectRoot, await readJson(request)).then((section) => ({ section })));
      return;
    }
    const linkMatch = url.pathname.match(/^\/api\/links\/([a-z0-9-]+)$/);
    if (request.method === 'PUT' && linkMatch) {
      await sendMutation(response, 200, saveStudioLink(projectRoot, linkMatch[1], await readJson(request)).then((link) => ({ link })));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/social-order') {
      await sendMutation(response, 200, saveStudioSocialOrder(projectRoot, await readJson(request)).then((links) => ({ links })));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/links') {
      await sendMutation(response, 201, createStudioLink(projectRoot, await readJson(request)).then((link) => ({ link })));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/images') {
      sendJson(response, 201, { path: await saveImage(await readJson(request)) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/answers/validate') {
      sendJson(response, 200, previewProfileAnswers(await readJson(request)));
      return;
    }
    if (request.method === 'POST' && (url.pathname === '/api/answers/apply' || url.pathname === '/api/apply')) {
      await sendMutation(response, 200, applyProfileAnswers(projectRoot, await readJson(request)));
      return;
    }
    if (request.method !== 'GET') {
      sendJson(response, 404, { error: '找不到操作。' });
      return;
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    if (!(error instanceof StudioRequestError)) console.error(error);
    const status = error instanceof StudioRequestError || error instanceof FortuneConflictError ? error.status : 400;
    sendJson(response, status, { error: error.message || '操作失敗。' });
  }
});

const astroCli = await resolvePackageBin('astro');
const astro = spawn(process.execPath, [astroCli, 'dev', '--host', '127.0.0.1', '--port', String(previewPort)], {
  cwd: projectRoot,
  stdio: 'inherit',
  // Astro 7 auto-backgrounds dev servers in coding-agent environments. The
  // Studio owns this child process, so suppress auto-detection and keep it attached.
  env: { ...process.env, ASTRO_DEV_BACKGROUND: 'studio-managed' },
});

astro.on('exit', (code) => {
  if (code && code !== 0) console.error(`Astro 預覽服務已停止（code ${code}）。`);
});

server.listen(studioPort, '127.0.0.1', () => {
  console.log('');
  console.log(`Profile Studio：http://localhost:${studioPort}`);
  console.log(`網站預覽：http://localhost:${previewPort}`);
  console.log('按 Ctrl+C 停止兩個服務。');
});

function shutdown() {
  astro.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
