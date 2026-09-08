import { createServer } from 'node:net';

export function studioPort(value, fallback) {
  const port = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Studio 連接埠必須是 0～65535 的整數。');
  }
  return port;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(server.address().port); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ port, host: '127.0.0.1', exclusive: true });
  });
}

export async function listenLocalServer(server, preferredPort, onFallback = () => {}) {
  try {
    return await listen(server, preferredPort);
  } catch (error) {
    if (!['EACCES', 'EADDRINUSE'].includes(error.code) || preferredPort === 0) throw error;
    // Prefer a stable alternate origin so browser-local drafts survive restarts.
    const alternate = preferredPort <= 55535 ? preferredPort + 10000 : preferredPort - 10000;
    let actualPort;
    try {
      actualPort = await listen(server, alternate);
    } catch (alternateError) {
      if (!['EACCES', 'EADDRINUSE'].includes(alternateError.code)) throw alternateError;
      actualPort = await listen(server, 0);
    }
    onFallback(preferredPort, actualPort, error.code);
    return actualPort;
  }
}

export async function findLocalPort(preferredPort, onFallback) {
  const probe = createServer();
  const port = await listenLocalServer(probe, preferredPort, onFallback);
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

export function studioApiUrl(isDev, env = {}) {
  // Runtime adapter selection is local-only; never bake it into public builds.
  const port = isDev ? studioPort(env.STUDIO_PORT, 4322) : 4322;
  return `http://localhost:${port}`;
}
