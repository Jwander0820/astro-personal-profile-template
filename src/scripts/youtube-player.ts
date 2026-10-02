const PLAYER_ORIGIN = 'https://www.youtube.com';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_EVENTS = ['onReady', 'onStateChange', 'onError', 'onAutoplayBlocked'];

export interface YouTubePlayer {
  cuePlaylist(options: { listType: 'playlist'; list: string; index: number }): void;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  getPlaylist(): string[];
  getPlayerState(): number;
  getVideoData(): { title: string; author: string };
  loadVideoById(videoId: string): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

type PlayerEvent = { target: YouTubePlayer; data: number };
type PlayerOptions = {
  playlistId: string;
  title: string;
  events: {
    onReady(event: PlayerEvent): void;
    onStateChange(event: PlayerEvent): void;
    onError(event: PlayerEvent): void;
    onAutoplayBlocked(event: PlayerEvent): void;
    onInfoUpdate(): void;
    onLoadError(): void;
    onDispose(): void;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);
const isTime = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2_592_000
);
const isState = (value: unknown): value is number => (
  typeof value === 'number' && [-1, 0, 1, 2, 3, 5].includes(value)
);

/** Provider code stays in YouTube's origin. Only player data crosses this boundary.
 * The wire format follows YouTube's widget messages; keep browser coverage for
 * handshake, snapshots and controls because it is not a versioned public API.
 */
export function createYouTubePlayer(host: HTMLElement, options: PlayerOptions): YouTubePlayer {
  if (!/^[A-Za-z0-9_-]{10,}$/.test(options.playlistId)) throw new Error('Invalid playlist ID');
  const iframe = document.createElement('iframe');
  const id = crypto.randomUUID();
  const url = new URL('/embed/', PLAYER_ORIGIN);
  url.search = new URLSearchParams({
    enablejsapi: '1', origin: window.location.origin,
    list: options.playlistId, listType: 'playlist', controls: '1', playsinline: '1', rel: '0',
  }).toString();
  iframe.src = url.href;
  iframe.title = options.title;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  // allow-same-origin preserves YouTube's own origin, not the profile origin.
  // Never use this combination for a same-origin or srcdoc player wrapper.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
  iframe.allowFullscreen = true;

  let ready = false;
  let handshaken = false;
  let disposed = false;
  let state = -1;
  let currentTime = 0;
  let duration = 0;
  let playlist: string[] = [];
  let videoData = { title: '', author: '' };

  const send = (message: Record<string, unknown>) => {
    if (!disposed) iframe.contentWindow?.postMessage(JSON.stringify({ ...message, id, channel: 'widget' }), PLAYER_ORIGIN);
  };
  const command = (func: string, args: unknown[] = []) => send({ event: 'command', func, args });
  const player: YouTubePlayer = {
    cuePlaylist(value) {
      if (value.list !== options.playlistId || !Number.isInteger(value.index) || value.index < 0 || value.index > 3) return;
      command('cuePlaylist', [{ listType: 'playlist', list: value.list, index: value.index }]);
    },
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    getIframe: () => iframe,
    getPlaylist: () => playlist.slice(),
    getPlayerState: () => state,
    getVideoData: () => ({ ...videoData }),
    loadVideoById(videoId) {
      if (!VIDEO_ID.test(videoId) || !playlist.includes(videoId)) return;
      currentTime = 0;
      duration = 0;
      videoData = { title: '', author: '' };
      command('loadVideoById', [videoId]);
    },
    pauseVideo: () => command('pauseVideo'),
    playVideo: () => command('playVideo'),
    seekTo(seconds, allowSeekAhead) {
      if (isTime(seconds)) command('seekTo', [Math.min(seconds, duration), Boolean(allowSeekAhead)]);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      window.clearInterval(handshake);
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      removalObserver.disconnect();
      iframe.remove();
      options.events.onDispose();
    },
  };

  const updateSnapshot = (info: Record<string, unknown>) => {
    if (isTime(info.currentTime)) currentTime = info.currentTime;
    if (isTime(info.duration)) duration = info.duration;
    if (isState(info.playerState)) state = info.playerState;
    // Loading an individual video may clear YouTube's playlist snapshot. Keep
    // the configured list so the turntable can still choose the next song.
    if (Array.isArray(info.playlist) && info.playlist.length > 0 && info.playlist.length <= 10_000 && info.playlist.every((item) => typeof item === 'string' && VIDEO_ID.test(item))) {
      playlist = [...info.playlist];
    }
    if (isRecord(info.videoData)) {
      const { title, author } = info.videoData;
      if (typeof title === 'string' && title.length <= 1000) videoData.title = title;
      if (typeof author === 'string' && author.length <= 1000) videoData.author = author;
    }
  };
  const receive = (event: MessageEvent) => {
    if (disposed || event.origin !== PLAYER_ORIGIN || event.source !== iframe.contentWindow) return;
    if (typeof event.data !== 'string' || event.data.length > 256_000) return;
    let message: unknown;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!isRecord(message) || message.id !== id || message.channel !== 'widget') return;
    if (message.event === 'initialDelivery' || message.event === 'infoDelivery') {
      if (!isRecord(message.info)) return;
      updateSnapshot(message.info);
      if (message.event === 'initialDelivery' && !handshaken) {
        handshaken = true;
        window.clearInterval(handshake);
        PLAYER_EVENTS.forEach((name) => command('addEventListener', [name]));
      }
      if (ready) options.events.onInfoUpdate();
    } else if (handshaken && !ready && message.event === 'onReady') {
      ready = true;
      window.clearTimeout(timeout);
      options.events.onReady({ target: player, data: state });
    } else if (ready && message.event === 'onStateChange' && isState(message.info)) {
      state = message.info;
      options.events.onStateChange({ target: player, data: state });
    } else if (ready && message.event === 'onError' && typeof message.info === 'number' && Number.isInteger(message.info) && message.info >= 0 && message.info <= 1000) {
      options.events.onError({ target: player, data: message.info });
    } else if (ready && message.event === 'onAutoplayBlocked') {
      options.events.onAutoplayBlocked({ target: player, data: state });
    }
  };
  const listen = () => send({ event: 'listening' });
  const handshake = window.setInterval(listen, 250);
  const timeout = window.setTimeout(() => {
    player.destroy();
    options.events.onLoadError();
  }, 15_000);
  const removalObserver = new MutationObserver(() => {
    if (!iframe.isConnected) player.destroy();
  });
  window.addEventListener('message', receive);
  host.replaceChildren(iframe);
  removalObserver.observe(document.documentElement, { childList: true, subtree: true });
  iframe.addEventListener('load', listen);
  listen();
  return player;
}
