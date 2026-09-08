import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { dev } from 'astro';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { saveStudioBlock } from './profile-content.mjs';
import { FortuneConflictError, loadFortuneBucket, saveFortuneBucket } from './fortune-content.mjs';
import { findLocalPort, listenLocalServer, studioPort as parsePort } from './studio-network.mjs';
import { applyProfileProjectUpdate, planProfileProjectUpdate } from './profile-project.mjs';
import { StudioRequestError, validateStudioRequest } from './studio-request-security.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let studioPort;
let previewPort;
const MAX_BODY_SIZE = 70 * 1024 * 1024;
let contentRevision = 0;

function corsHeaders(request) {
  const origin = String(request.headers.origin || '').toLowerCase();
  const allowed = new Set([`http://localhost:${previewPort}`, `http://127.0.0.1:${previewPort}`]);
  return allowed.has(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  } : {};
}

function sendJson(request, response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(request),
  });
  response.end(JSON.stringify(body));
}

async function sendMutation(request, response, status, mutation) {
  const body = await mutation;
  contentRevision += 1;
  sendJson(request, response, status, { ...body, contentRevision });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) throw new Error('資料超過 70 MB 上限。');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('送出的 JSON 格式不正確。');
  }
}

const server = createServer(async (request, response) => {
  try {
    validateStudioRequest(request, studioPort, previewPort);
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(302, { Location: `http://localhost:${previewPort}/studio/`, 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      sendJson(request, response, 200, { local: true, previewUrl: `http://localhost:${previewPort}/`, contentRevision });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/fortunes') {
      sendJson(request, response, 200, await loadFortuneBucket(projectRoot));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/fortunes') {
      await sendMutation(request, response, 200, saveFortuneBucket(projectRoot, await readJson(request)));
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/blocks/fortune') {
      await sendMutation(
        request,
        response,
        200,
        saveStudioBlock(projectRoot, 'fortune', await readJson(request)).then((block) => ({ block })),
      );
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/project/plan') {
      sendJson(request, response, 200, { plan: await planProfileProjectUpdate(projectRoot, await readJson(request)) });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/project/apply') {
      await sendMutation(request, response, 200, applyProfileProjectUpdate(projectRoot, await readJson(request)));
      return;
    }
    sendJson(request, response, 404, { error: '找不到此本機 Studio API。' });
  } catch (error) {
    if (!(error instanceof StudioRequestError)) console.error(error);
    const status = error instanceof StudioRequestError || error instanceof FortuneConflictError ? error.status : 400;
    sendJson(request, response, status, { error: error.message || '未知的錯誤。' });
  }
});

let astro;
let isClosing = false;
async function shutdown(code = 0) {
  if (isClosing) return;
  isClosing = true;
  const timeout = setTimeout(() => process.exit(code), 5_000);
  timeout.unref();
  try {
    await astro?.stop();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    clearTimeout(timeout);
    process.exit(code);
  }
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

const reportFallback = (label) => (preferred, actual, reason) => {
  console.log(`${label}連接埠 ${preferred} 無法使用（${reason}），改用 ${actual}。`);
};

try {
  const requestedStudioPort = parsePort(process.env.STUDIO_PORT, 4322);
  const requestedPreviewPort = parsePort(process.env.PORT, 4321);
  studioPort = await listenLocalServer(server, requestedStudioPort, reportFallback('本機寫入服務'));
  previewPort = await findLocalPort(requestedPreviewPort, reportFallback('網站預覽'));
  process.env.STUDIO_PORT = String(studioPort);
  server.on('error', (error) => { console.error(`本機寫入服務失敗：${error.message}`); shutdown(1); });
  // Own the dev server in this process so startup failure or Ctrl+C cannot
  // leave an orphaned Astro child. Strict port binding keeps CORS in sync.
  astro = await dev({
    root: projectRoot,
    server: { host: '127.0.0.1', port: previewPort },
    vite: { server: { strictPort: true } },
  });
  previewPort = astro.address.port;
  console.log('');
  console.log(`Profile Studio：http://localhost:${previewPort}/studio/`);
  console.log(`本機寫入服務：http://localhost:${studioPort}（背景使用）`);
  console.log('按 Ctrl+C 停止兩個服務。');
} catch (error) {
  console.error(`Profile Studio 啟動失敗：${error.message}`);
  await shutdown(1);
}
