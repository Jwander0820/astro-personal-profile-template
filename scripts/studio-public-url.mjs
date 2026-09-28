import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizePublicUrl } from './profile-sharing.mjs';

export function githubPagesUrlFromRemote(remote) {
  try {
    const source = String(remote).trim().replace(/^git@github\.com:/i, 'ssh://git@github.com/');
    const url = new URL(source);
    if (url.hostname.toLowerCase() !== 'github.com' || !['https:', 'ssh:'].includes(url.protocol)
      || url.search || url.hash || url.port) return '';
    const parts = url.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, '').split('/');
    if (parts.length !== 2) return '';
    const [owner, repository] = parts;
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner)
      || !/^[\w.-]+$/.test(repository) || ['.', '..'].includes(repository)) return '';
    const host = `${owner.toLowerCase()}.github.io`;
    return normalizePublicUrl(`https://${host}/${repository.toLowerCase() === host ? '' : `${repository}/`}`);
  } catch { return ''; }
}

export async function resolveStudioPublicUrl({ isDev, projectRoot, site, base = '/' }) {
  try {
    const publicUrl = normalizePublicUrl(new URL(base.endsWith('/') ? base : `${base}/`, site).href);
    if (publicUrl) return publicUrl;
  } catch { /* Local Astro origins are not public deployment URLs. */ }
  if (!isDev) return '';
  try {
    // Read only the current project's origin. Never include remote credentials
    // or the local project path in the browser bootstrap.
    const { stdout } = await promisify(execFile)('git', ['remote', 'get-url', 'origin'], {
      cwd: projectRoot, encoding: 'utf8', timeout: 3000, windowsHide: true, maxBuffer: 16 * 1024,
    });
    return githubPagesUrlFromRemote(stdout);
  } catch { return ''; }
}
