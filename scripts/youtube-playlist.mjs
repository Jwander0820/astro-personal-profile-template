const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const YOUTUBE_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|youtube-nocookie\.com)$/i;

export function parseYoutubePlaylistId(value) {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (PLAYLIST_ID_PATTERN.test(source)) return source;

  try {
    const parsed = new URL(source);
    const hostname = parsed.hostname.replace(/\.$/, '');
    const isYoutubeHost = hostname.toLowerCase() === 'youtu.be' || YOUTUBE_HOST_PATTERN.test(hostname);
    if (!['http:', 'https:'].includes(parsed.protocol) || !isYoutubeHost) return null;

    const playlistId = parsed.searchParams.get('list') ?? '';
    return PLAYLIST_ID_PATTERN.test(playlistId) ? playlistId : null;
  } catch {
    return null;
  }
}
