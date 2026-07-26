import { isSafeHttpUrl } from './content-safety.mjs';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_ID = /^[A-Za-z0-9_-]{10,}$/;
const YOUTUBE_HOST = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtube-nocookie\.com)$/i;
const EMBED_HEIGHT_MIN = 320;
const EMBED_HEIGHT_MAX = 1200;

function decodeHtmlAttribute(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);?/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function iframeAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'));
  return decodeHtmlAttribute(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

export function extractIframeSource(value) {
  if (typeof value !== 'string') return null;
  const tag = value.trim().match(/^<iframe\b[\s\S]*?>/i)?.[0];
  if (!tag) return null;
  const src = iframeAttribute(tag, 'src').trim();
  if (!isSafeHttpUrl(src)) throw new Error('iframe 的 src 必須是公開的 http(s) 網址。');
  const rawHeight = iframeAttribute(tag, 'height');
  const parsedHeight = /^\d+$/.test(rawHeight) ? Number(rawHeight) : undefined;
  const height = Number.isInteger(parsedHeight)
    ? Math.min(EMBED_HEIGHT_MAX, Math.max(EMBED_HEIGHT_MIN, parsedHeight))
    : undefined;
  return { url: src, height };
}

function youtubeHost(url) {
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase();
  return hostname === 'youtu.be' || YOUTUBE_HOST.test(hostname);
}

function youtubeVideoId(url) {
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  const candidate = hostname === 'youtu.be'
    ? segments[0]
    : segments[0] === 'watch'
      ? url.searchParams.get('v')
      : ['embed', 'shorts', 'live'].includes(segments[0])
        ? segments[1]
        : url.searchParams.get('v');
  return YOUTUBE_VIDEO_ID.test(candidate ?? '') ? candidate : null;
}

function normalizedYoutubeUrl(source) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !youtubeHost(url)) return null;

  const videoId = youtubeVideoId(url);
  const playlistId = url.searchParams.get('list');
  const embedHost = url.hostname.toLowerCase().endsWith('youtube-nocookie.com')
    ? 'www.youtube-nocookie.com'
    : 'www.youtube.com';
  const base = videoId
    ? new URL(`https://${embedHost}/embed/${videoId}`)
    : YOUTUBE_PLAYLIST_ID.test(playlistId ?? '')
      ? new URL(`https://${embedHost}/embed/videoseries?list=${encodeURIComponent(playlistId)}`)
      : null;
  if (!base) return null;

  for (const name of ['start', 'end', 'autoplay', 'mute', 'loop', 'controls', 'rel']) {
    const value = url.searchParams.get(name);
    if (value !== null) base.searchParams.set(name, value);
  }
  if (videoId && YOUTUBE_PLAYLIST_ID.test(playlistId ?? '')) base.searchParams.set('list', playlistId);
  return base.href;
}

function inferredProvider(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/\.$/, '').toLowerCase();
    if (youtubeHost(parsed)) return 'youtube';
    if (hostname === 'notion.so' || hostname.endsWith('.notion.so') || hostname === 'notion.site' || hostname.endsWith('.notion.site')) {
      return 'notion';
    }
  } catch {
    return 'website';
  }
  return 'website';
}

export function normalizeEmbedSource(value, requestedProvider = 'website') {
  if (typeof value !== 'string' || value.length > 5000) throw new Error('網頁內嵌內容格式不正確。');
  const source = value.trim();
  const iframe = extractIframeSource(source);
  const extractedUrl = iframe?.url ?? source;
  if (!isSafeHttpUrl(extractedUrl)) throw new Error('網頁內嵌網址必須是公開的 http(s) 網址。');

  const detectedProvider = inferredProvider(extractedUrl);
  const provider = requestedProvider === 'website' ? detectedProvider : requestedProvider;
  if (!['website', 'notion', 'youtube'].includes(provider)) throw new Error('網頁內嵌類型不正確。');
  const youtubeUrl = provider === 'youtube' ? normalizedYoutubeUrl(extractedUrl) : null;
  if (provider === 'youtube' && !youtubeUrl) {
    throw new Error('YouTube 內嵌需要影片、Shorts、直播、播放清單網址或官方 iframe 程式碼。');
  }
  return {
    url: youtubeUrl ?? extractedUrl,
    provider,
    ...(iframe?.height ? { height: iframe.height } : {}),
    fromIframe: Boolean(iframe),
  };
}
