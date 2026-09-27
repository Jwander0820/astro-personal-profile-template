import { isSafeHttpUrl } from './content-safety.mjs';

export const TEMPLATE_REPOSITORY = 'https://github.com/jwander0820/astro-personal-profile-template';
export const SHARING_DEFAULTS = Object.freeze({ enabled: true, publicUrl: '', showTemplateCredit: true });

export function normalizePublicUrl(value) {
  if (typeof value !== 'string') throw new Error('正式網址必須是文字。');
  if (!value.trim()) return '';
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('請填入完整的公開 HTTPS 正式網址。'); }
  const host = url.hostname.toLowerCase();
  if (value.length > 500 || url.protocol !== 'https:' || !isSafeHttpUrl(url.href)
    || url.username || url.password || url.search || url.hash
    || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || !host.includes('.') || /^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error('請使用公開 HTTPS 網址（最多 500 字），不含登入資訊、查詢參數或 # 錨點；不能使用本機網址。');
  }
  return url.href;
}

export function validateSharing(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('sharing 格式不正確。');
  for (const key of Object.keys(input)) if (!Object.hasOwn(SHARING_DEFAULTS, key)) throw new Error(`sharing 不支援 ${key}。`);
  for (const key of ['enabled', 'showTemplateCredit']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`sharing.${key} 必須是布林值。`);
  return { enabled: input.enabled !== false, publicUrl: normalizePublicUrl(input.publicUrl ?? ''), showTemplateCredit: input.showTemplateCredit !== false };
}

export function createShareProfile(answers, assetHref = (value) => value) {
  return {
    name: String(answers.identity?.displayName || ''), title: String(answers.identity?.title || ''), bio: String(answers.identity?.bio || ''),
    tags: answers.identity?.tagline || [], avatar: assetHref(answers.media?.avatar || ''),
    mainColor: answers.appearance?.mainColor || '#7A58A6', bodyFont: answers.appearance?.bodyFont || 'system', displayFont: answers.appearance?.displayFont || 'system',
    sharing: { ...SHARING_DEFAULTS, ...answers.sharing },
    github: (answers.socials || []).find((item) => {
      try { return new URL(item.url).hostname.toLowerCase() === 'github.com' && isSafeHttpUrl(item.url); } catch { return false; }
    })?.url || '',
  };
}
