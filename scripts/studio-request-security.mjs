const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class StudioRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'StudioRequestError';
    this.status = status;
  }
}

function getHeader(headers, name) {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

export function validateStudioRequest(request, studioPort) {
  const method = String(request.method ?? 'GET').toUpperCase();
  const host = getHeader(request.headers, 'host').toLowerCase();
  const allowedHosts = new Set([`localhost:${studioPort}`, `127.0.0.1:${studioPort}`]);

  if (!allowedHosts.has(host)) {
    throw new StudioRequestError(403, 'Profile Studio 只接受本機 localhost 請求。');
  }

  if (!MUTATION_METHODS.has(method)) return;

  const origin = getHeader(request.headers, 'origin').toLowerCase();
  if (origin !== `http://${host}`) {
    throw new StudioRequestError(403, 'Profile Studio 拒絕非同源的寫入請求。');
  }

  const mediaType = getHeader(request.headers, 'content-type').split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new StudioRequestError(415, 'Profile Studio 寫入請求必須使用 application/json。');
  }
}
