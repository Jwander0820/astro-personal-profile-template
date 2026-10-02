const SAFE_PROFILE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const SAFE_HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function decodeNumericEntity(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  return codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
    ? String.fromCodePoint(codePoint)
    : '\uFFFD';
}

function decodeUrlEntities(value) {
  return value
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => decodeNumericEntity(code, 16))
    .replace(/&#([0-9]+);?/g, (_, code) => decodeNumericEntity(code, 10));
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

// This checks URL literals/local names, not DNS answers or later redirects.
// Keep ordinary links separate: only automatically loaded embeds need this gate.
export function isSafeInlineEmbedUrl(value) {
  if (!isSafeHttpUrl(value)) return false;
  const url = new URL(normalizedUrl(value));
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[')) {
    // WHATWG URL canonicalizes compressed and IPv4-mapped IPv6 addresses.
    // Permit global unicast only, excluding special/documentation allocations.
    const words = host.slice(1, -1).split(':');
    const first = Number.parseInt(words[0], 16) || 0;
    const second = Number.parseInt(words[1], 16) || 0;
    return first >= 0x2000 && first <= 0x3fff
      && !(first === 0x2001 && (second <= 0x01ff || second === 0x0db8))
      && !(first === 0x3fff && second < 0x1000);
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b, c] = host.split('.').map(Number);
    return !(
      [0, 10, 127].includes(a) || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c))))
      || (a === 198 && ([18, 19].includes(b) || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113)
    );
  }
  return host.includes('.') && !host.split('.').some((part) => !part)
    && !/(?:^|\.)(?:localhost|local|localdomain|internal|lan|home|home\.arpa)$/.test(host);
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

export function isSafeImageSource(value) {
  if (isSafeImagePath(value)) return true;
  const imageUrl = normalizedUrl(value);
  if (!imageUrl || imageUrl.startsWith('//') || /['"()\\\s]/.test(imageUrl)) return false;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol.toLowerCase() === 'https:'
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
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
