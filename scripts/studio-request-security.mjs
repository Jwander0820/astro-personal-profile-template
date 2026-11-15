import { timingSafeEqual } from 'node:crypto';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class StudioRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'StudioRequestError';
    this.status = status;
  }
}

// Validation failures are plain Errors written for the user. Anything else
// (filesystem codes, TypeError, AggregateError…) is internal: log it locally
// and never echo paths or stack details back to the page.
export function studioErrorResponse(error) {
  if (error instanceof StudioRequestError || (error?.name === 'FortuneConflictError' && Number.isInteger(error.status))) {
    return { status: error.status, message: error.message, internal: false };
  }
  const isValidation = error instanceof Error && error.constructor === Error
    && error.code === undefined && Boolean(error.message);
  return isValidation
    ? { status: 400, message: error.message, internal: false }
    : { status: 500, message: '本機 Studio 發生內部錯誤，請查看終端機訊息後再試一次。', internal: true };
}

function getHeader(headers, name) {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

export function validateStudioRequest(request, studioPort, previewPort = 4321, capability) {
  const method = String(request.method ?? 'GET').toUpperCase();
  const host = getHeader(request.headers, 'host').toLowerCase();
  const allowedHosts = new Set([`localhost:${studioPort}`, `127.0.0.1:${studioPort}`]);

  if (!allowedHosts.has(host)) {
    throw new StudioRequestError(403, 'Profile Studio 只接受本機 localhost 請求。');
  }

  const origin = getHeader(request.headers, 'origin').toLowerCase();
  const allowedOrigins = new Set([
    `http://${host}`,
    `http://localhost:${previewPort}`,
    `http://127.0.0.1:${previewPort}`,
  ]);
  if (method === 'OPTIONS') {
    if (!allowedOrigins.has(origin)) throw new StudioRequestError(403, 'Profile Studio 拒絕非同源的預檢請求。');
    return;
  }
  const supplied = getHeader(request.headers, 'authorization').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!supplied || !/^[a-f0-9]{64}$/.test(capability || '')
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(capability))) {
    throw new StudioRequestError(401, '本機連線已過期或未授權，請使用 npm run studio 最新提供的啟動連結。');
  }
  if (!MUTATION_METHODS.has(method)) return;

  if (!allowedOrigins.has(origin)) {
    throw new StudioRequestError(403, 'Profile Studio 拒絕非同源的寫入請求。');
  }

  const mediaType = getHeader(request.headers, 'content-type').split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new StudioRequestError(415, 'Profile Studio 寫入請求必須使用 application/json。');
  }
}
