import { createHash } from 'node:crypto';

// Do not expose the local filesystem path in the browser or static output.
export function studioDraftScope(isDev, projectRoot, siteUrl) {
  return createHash('sha256').update(isDev ? projectRoot : siteUrl).digest('hex').slice(0, 24);
}
