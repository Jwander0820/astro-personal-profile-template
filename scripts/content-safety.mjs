const SAFE_PROFILE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const SAFE_HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function decodeUrlEntities(value) {
  return value
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);?/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function compactUrl(value) {
  return decodeUrlEntities(String(value ?? '').trim()).replace(/[\u0000-\u0020\u007f]+/g, '');
}

function normalizedUrl(value) {
  return decodeUrlEntities(String(value ?? '').trim()).replace(/[\u0000-\u001f\u007f]+/g, '');
}

function protocolOf(value) {
  return compactUrl(value).match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
}

function isSafeMailtoUrl(value) {
  const url = normalizedUrl(value);
  return url.toLowerCase().startsWith('mailto:') && url.length > 'mailto:'.length && !/\s/.test(url);
}

export function isSafeProfileUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return false;
  if (url.startsWith('#')) return url.length > 1;
  const protocol = protocolOf(url);
  if (!protocol || !SAFE_PROFILE_PROTOCOLS.has(`${protocol}:`)) return false;
  if (protocol === 'mailto') return isSafeMailtoUrl(url);
  return isSafeHttpUrl(url);
}

export function isSafeHttpUrl(value) {
  const url = normalizedUrl(value);
  if (!url || url.startsWith('//')) return false;
  try {
    const parsed = new URL(url);
    return SAFE_HTTP_PROTOCOLS.has(parsed.protocol.toLowerCase()) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function isSafeMarkdownUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return true;
  if (url.startsWith('#')) return url.length > 1;
  if (url.startsWith('//')) return false;
  const protocol = protocolOf(url);
  if (!protocol) return true;
  if (!SAFE_PROFILE_PROTOCOLS.has(`${protocol}:`)) return false;
  if (protocol === 'mailto') return isSafeMailtoUrl(url);
  return isSafeHttpUrl(url);
}

export function isSafeImagePath(value) {
  const imagePath = String(value ?? '').trim();
  return /^\/images\/[A-Za-z0-9._/-]+$/.test(imagePath) && !imagePath.includes('..');
}

function unsafeUrlError(url, source = '') {
  return new Error(`Markdown URL uses a blocked or invalid protocol: ${url}${source}`);
}

export function enforceContentSafety(tree, file) {
  const source = file?.path ? ` (${file.path})` : '';
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'html') {
      const value = String(node.value ?? '');
      Object.keys(node).forEach((key) => delete node[key]);
      node.type = 'text';
      node.value = value;
      return;
    }
    if (['link', 'image', 'definition'].includes(node.type) && !isSafeMarkdownUrl(node.url)) {
      throw unsafeUrlError(node.url, source);
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(tree);
  return tree;
}

export function createContentSafetyMdastPlugin() {
  const assertSafeUrl = (node, context) => {
    if (!isSafeMarkdownUrl(node.url)) {
      const source = context.fileURL ? ` (${context.fileURL.pathname})` : '';
      throw unsafeUrlError(node.url, source);
    }
  };
  return {
    name: 'content-safety',
    html(node, context) {
      context.replaceNode(node, { type: 'text', value: String(node.value ?? '') });
    },
    link: assertSafeUrl,
    image: assertSafeUrl,
    definition: assertSafeUrl,
  };
}
