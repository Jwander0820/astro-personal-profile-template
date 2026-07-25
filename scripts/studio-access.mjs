const VALID_STUDIO_MODES = new Set(['auto', 'public', 'off']);

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRepository(value) {
  return String(value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').toLowerCase();
}

function normalizeSite(value) {
  try {
    const url = new URL(String(value || '').trim());
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.origin.toLowerCase()}${pathname}`;
  } catch {
    return '';
  }
}

export function resolveOnlineStudioAccess({
  mode = 'auto',
  isDev = false,
  repository = '',
  allowedRepositories = '',
  siteUrl = '',
  allowedSites = '',
} = {}) {
  const normalizedMode = String(mode || 'auto').trim().toLowerCase();
  if (!VALID_STUDIO_MODES.has(normalizedMode)) {
    throw new Error('ONLINE_STUDIO_MODE 必須是 auto、public 或 off。');
  }

  // Local project mode always keeps the editor available, including when a
  // production deployment deliberately sets ONLINE_STUDIO_MODE=off.
  if (isDev) return true;
  if (normalizedMode === 'off') return false;
  if (normalizedMode === 'public') return true;

  const currentRepository = normalizeRepository(repository);
  const repositoryAllowed = currentRepository && splitList(allowedRepositories)
    .map(normalizeRepository)
    .includes(currentRepository);
  if (repositoryAllowed) return true;

  const currentSite = normalizeSite(siteUrl);
  return Boolean(currentSite && splitList(allowedSites).map(normalizeSite).includes(currentSite));
}
