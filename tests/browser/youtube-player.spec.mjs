import { expect, test } from '@playwright/test';

// An actual cross-origin document, with deterministic YouTube widget messages.
// Provider code must be unable to see the editor even when its response is hostile.
const mockPlayer = `<!doctype html><html><body><script>
window.instance = crypto.randomUUID();
window.commands = [];
window.security = {};
try { window.security.parentRead = parent.document.body.textContent; } catch { window.security.parentBlocked = true; }
try { window.security.draftRead = parent.localStorage.getItem('private-studio-sentinel'); } catch { window.security.draftBlocked = true; }
window.security.ownDraft = localStorage.getItem('private-studio-sentinel');
let receiver, origin, id, state = -1, currentTime = 12, duration = 120, title = 'Mock track';
const playlist = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'];
const send = (event, info) => receiver?.postMessage(JSON.stringify({event, info, id, channel: 'widget'}), origin);
const snapshot = () => send('infoDelivery', {playerState:state, currentTime, duration, playlist, videoData:{title, author:'Test'}});
const change = (next) => { state = next; snapshot(); send('onStateChange', next); };
window.emit = send;
window.finishTrack = () => change(0);
window.blockAutoplay = () => { state = 2; snapshot(); send('onAutoplayBlocked'); };
window.failTrack = () => send('onError', 150);
window.addEventListener('message', (event) => {
  if (event.source !== parent || typeof event.data !== 'string') return;
  const message = JSON.parse(event.data);
  receiver = event.source; origin = event.origin; id = message.id; window.widgetId = id;
  if (message.event === 'listening') {
    send('initialDelivery', {playerState: state, currentTime, duration, playlist, videoData: {title, author:'Test'}});
    send('onReady');
  } else if (message.event === 'command') {
    window.commands.push({func:message.func, args:message.args});
    if (message.func === 'cuePlaylist') change(5);
    if (message.func === 'loadVideoById') {
      title = message.args[0]; currentTime = 12;
      if (window.stateFirst) { state = 1; send('onStateChange', 1); setTimeout(snapshot, 20); }
      else change(1);
    }
    if (message.func === 'playVideo') change(1);
    if (message.func === 'pauseVideo') change(2);
    if (message.func === 'seekTo') { currentTime = message.args[0]; snapshot(); }
  }
});
</script></body></html>`;

async function setup(page) {
  const scriptRequests = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script' && /youtube\.com|ytimg\.com/.test(request.url())) scriptRequests.push(request.url());
  });
  await page.route('https://www.youtube.com/embed/**', (route) => route.fulfill({ contentType: 'text/html', body: mockPlayer }));
  await page.goto('/studio/');
  await page.evaluate(() => localStorage.setItem('private-studio-sentinel', 'UNPUBLISHED'));
  const preview = page.frameLocator('#profile-preview');
  const turntable = preview.locator('[data-turntable-player]');
  await turntable.locator('[data-turntable-toggle]').click();
  const iframe = turntable.locator('[data-youtube-player] iframe');
  await expect(iframe).toBeVisible();
  await expect(turntable.locator('[data-turntable-toggle]')).toBeEnabled();
  await expect(turntable.locator('[data-turntable-status]')).toContainText('播放器已展開');
  await turntable.locator('[data-turntable-toggle]').click();
  await expect(turntable).toHaveClass(/is-playing/);
  const frame = await (await iframe.elementHandle()).contentFrame();
  return { preview, turntable, iframe, frame, scriptRequests };
}

test('播放器只在 YouTube iframe 執行並拒絕越界與偽造訊息', async ({ page }) => {
  const { preview, turntable, iframe, frame, scriptRequests } = await setup(page);
  expect(scriptRequests).toEqual([]);
  await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube\.com\/embed\/\?/);
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  expect(await frame.evaluate(() => window.security)).toEqual({ parentBlocked: true, draftBlocked: true, ownDraft: null });
  await expect(preview.locator('script[src*="youtube.com"]')).toHaveCount(0);
  const title = turntable.locator('[data-turntable-track-title]');
  const originalTitle = await title.textContent();
  await frame.evaluate(() => {
    parent.postMessage({ type: 'profile-studio:render', answers: { identity: { displayName: 'ATTACK' } } }, '*');
    window.emit('infoDelivery', { videoData: { title: { html: 'ATTACK' } }, playlist: ['javascript:ATTACK'], duration: 'ATTACK' });
    window.emit('execute', { func: 'fetch', url: 'http://localhost:4322/api/project/apply' });
  });
  await expect(title).toHaveText(originalTitle);
  await expect(preview.locator('h1')).not.toHaveText('ATTACK');

  // A matching origin alone is insufficient: a different YouTube frame cannot
  // impersonate the active player even with its exact widget identifier.
  const playerId = await frame.evaluate(() => window.widgetId);
  const parentFrame = page.frames().find((candidate) => candidate.url().includes('studioPreview=1'));
  await parentFrame.evaluate(() => {
    const sibling = document.createElement('iframe'); sibling.id = 'forged-player';
    sibling.src = 'https://www.youtube.com/embed/aaaaaaaaaaa'; document.body.append(sibling);
  });
  const sibling = await (await preview.locator('#forged-player').elementHandle()).contentFrame();
  await sibling.waitForLoadState();
  await sibling.evaluate((id) => parent.postMessage(JSON.stringify({ id, channel:'widget', event:'infoDelivery', info:{videoData:{title:'FORGED'}} }), '*'), playerId);
  await parentFrame.evaluate((id) => window.postMessage(JSON.stringify({ id, channel:'widget', event:'infoDelivery', info:{videoData:{title:'WRONG ORIGIN'}} }), '*'), playerId);
  await expect(title).toHaveText(originalTitle);
});

test('隔離播放器保留暫停、換曲、唱針進度與編輯中的播放狀態', async ({ page }) => {
  const { preview, turntable, iframe, frame } = await setup(page);
  const toggle = turntable.locator('[data-turntable-toggle]');
  const title = turntable.locator('[data-turntable-track-title]');
  const first = await title.textContent();
  await toggle.click();
  await expect(turntable).toHaveClass(/is-paused/);
  await toggle.click();
  await expect(turntable).toHaveClass(/is-playing/);
  const scrubber = turntable.locator('[data-turntable-scrubber]');
  await scrubber.press('ArrowRight');
  await expect.poll(() => frame.evaluate(() => window.commands.filter((item) => item.func === 'seekTo').at(-1)?.args[0])).toBe(17);
  await frame.evaluate(() => { window.emit('infoDelivery', { playlist: [] }); window.stateFirst = true; });
  await turntable.locator('[data-turntable-next]').click();
  await expect(title).not.toHaveText(first);
  await expect(scrubber).toHaveAttribute('aria-disabled', 'false');
  const instance = await frame.evaluate(() => window.instance);
  const playingTitle = await title.textContent();
  await page.locator('[data-bind="identity.title"]').fill('播放不中斷');
  await expect(preview.locator('.role')).toHaveText('播放不中斷');
  expect(await frame.evaluate(() => window.instance)).toBe(instance);
  await expect(turntable).toHaveClass(/is-playing/);
  await expect(title).toHaveText(playingTitle);
  await expect(iframe).toBeVisible();
  await frame.evaluate(() => window.blockAutoplay());
  await expect(turntable.locator('[data-turntable-status]')).toContainText('請再按一次播放');
  await toggle.click();
  await expect(turntable).toHaveClass(/is-playing/);
  const beforeError = await title.textContent();
  await frame.evaluate(() => window.failTrack());
  await expect(title).not.toHaveText(beforeError);
  await expect(turntable).toHaveClass(/is-playing/);
});

test('iframe 啟動逾時可重試且不重複綁定操作', async ({ page }) => {
  await page.clock.install();
  let attempts = 0;
  await page.route('https://www.youtube.com/embed/**', (route) => {
    attempts += 1;
    return route.fulfill({ contentType: 'text/html', body: attempts === 1 ? '<!doctype html><body>Unavailable</body>' : mockPlayer });
  });
  await page.goto('/studio/');
  const turntable = page.frameLocator('#profile-preview').locator('[data-turntable-player]');
  const toggle = turntable.locator('[data-turntable-toggle]');
  await toggle.click();
  await page.clock.fastForward(16_000);
  await expect(toggle).toHaveText('再試一次');
  await toggle.click();
  await page.clock.resume();
  await expect(turntable).toHaveClass(/is-playing/);
  const frame = await (await turntable.locator('iframe').elementHandle()).contentFrame();
  await toggle.click();
  await expect.poll(() => frame.evaluate(() => window.commands.filter((item) => item.func === 'pauseVideo').length)).toBe(1);
});

test('正式唱盤保留拖曳、連續播放與離開畫面時停止接續', async ({ page }) => {
  await page.route('https://www.youtube.com/embed/**', (route) => route.fulfill({ contentType: 'text/html', body: mockPlayer }));
  await page.goto('/');
  const turntable = page.locator('[data-turntable-player]').first();
  await turntable.locator('[data-turntable-toggle]').click();
  const iframe = turntable.locator('iframe');
  await iframe.scrollIntoViewIfNeeded();
  await expect(turntable).toHaveClass(/is-playing/);
  const frame = await (await iframe.elementHandle()).contentFrame();
  const scrubber = turntable.locator('[data-turntable-scrubber]');
  const moveNeedle = async (angle) => {
    await scrubber.hover();
    await page.mouse.down();
    const radians = angle * Math.PI / 180;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const pivot = await turntable.locator('.turntable-player__pivot').boundingBox();
      const pivotX = pivot.x + pivot.width / 2;
      const pivotY = pivot.y + pivot.height / 2;
      await page.mouse.move(pivotX - Math.sin(radians) * 150, pivotY + Math.cos(radians) * 150);
    }
    await page.mouse.up();
  };
  await moveNeedle(33);
  await expect.poll(() => frame.evaluate(() => window.commands.filter((item) => item.func === 'seekTo').at(-1)?.args[0])).toBeCloseTo(60, 0);
  await expect(turntable).toHaveClass(/is-playing/);
  const seeksBeforeRest = await frame.evaluate(() => window.commands.filter((item) => item.func === 'seekTo').length);
  await moveNeedle(5);
  await expect(turntable).toHaveClass(/is-paused/);
  expect(await frame.evaluate(() => window.commands.filter((item) => item.func === 'seekTo').length)).toBe(seeksBeforeRest);
  await turntable.locator('[data-turntable-toggle]').click();
  await iframe.scrollIntoViewIfNeeded();
  await expect(iframe).toBeInViewport({ ratio: 0.5 });
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const title = turntable.locator('[data-turntable-track-title]');
  const before = await title.textContent();
  await frame.evaluate(() => window.finishTrack());
  await expect(title).not.toHaveText(before);
  await expect(turntable).toHaveClass(/is-playing/);
  await iframe.evaluate((element) => { element.closest('.turntable-player__video').style.transform = 'translateX(10000px)'; });
  await expect(iframe).not.toBeInViewport();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await frame.evaluate(() => window.finishTrack());
  await expect(turntable.locator('[data-turntable-status]')).toContainText('回到播放器');
  await expect(turntable).not.toHaveClass(/is-playing/);
});

test('實際 YouTube 播放器交握與清單讀取', async ({ page }) => {
  test.skip(process.env.YOUTUBE_LIVE_SMOKE !== '1', '需要對外網路與可內嵌的公開播放清單');
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.playerMessages = [];
    addEventListener('message', (event) => {
      if (event.origin !== 'https://www.youtube.com' || typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data);
        if (window.playerMessages.length < 30) window.playerMessages.push({ event:message.event, state:message.info?.playerState, playlistLength:message.info?.playlist?.length, error:message.event === 'onError' ? message.info : message.info?.videoData?.errorCode });
      } catch {}
    });
  });
  await page.goto('/');
  const turntable = page.locator('[data-turntable-player]').first();
  await turntable.locator('[data-turntable-toggle]').click();
  await expect(turntable).toHaveAttribute('data-turntable-initialized', 'true', { timeout: 25_000 });
  try {
    await expect(turntable.locator('[data-turntable-next]')).toBeEnabled({ timeout: 20_000 });
  } catch (error) {
    console.log('YouTube diagnostic:', JSON.stringify(await page.evaluate(() => window.playerMessages)));
    throw error;
  }
  await expect(turntable.locator('[data-turntable-status]')).not.toContainText('無法');
  await expect(page.locator('script[src*="youtube.com"]')).toHaveCount(0);
});
