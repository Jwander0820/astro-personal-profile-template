const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

// The suite must not depend on the public internet: starter content loads
// Google Fonts and a YouTube playlist, which made runs slow and flaky. Tests
// that need a remote response register their own route, which takes priority.
export async function blockExternalNetwork(context) {
  if (process.env.YOUTUBE_LIVE_SMOKE === '1') return;
  await context.route(
    (url) => /^https?:$/.test(url.protocol) && !LOCAL_HOSTS.has(url.hostname),
    (route) => {
      const { hostname } = new URL(route.request().url());
      // An empty stylesheet lets font loading settle immediately.
      if (hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return route.abort('blockedbyclient');
    },
  );
}
