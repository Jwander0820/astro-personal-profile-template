import { expect, test } from '@playwright/test';
import { createSettingsZip } from '../../src/scripts/settings-package.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const bootstrapAnswers = (page) => page.evaluate(() => JSON.parse(document.querySelector('#online-studio-data').textContent).initialAnswers);
const storedPaths = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const { draftScope } = JSON.parse(document.querySelector('#online-studio-data').textContent);
  const request = indexedDB.open(`profile-studio-media-v2:${draftScope}`, 1);
  request.onsuccess = () => {
    const database = request.result;
    const query = database.transaction('media').objectStore('media').getAllKeys();
    query.onsuccess = () => { database.close(); resolve(query.result); };
    query.onerror = () => { database.close(); reject(query.error); };
  };
  request.onerror = () => reject(request.error);
}));

test('本機啟動憑證不進入 HTML，重新整理與籤詩頁保留連線，舊憑證失效', async ({ page }) => {
  let capability = 'a'.repeat(64);
  const requests = [];
  await page.route('http://localhost:4322/api/**', (route) => {
    const request = route.request();
    requests.push({ path: new URL(request.url()).pathname, method: request.method(), auth: request.headers().authorization });
    if (request.headers().authorization !== `Bearer ${capability}`) return route.fulfill({ status: 401, json: { error: 'Expired' } });
    return route.fulfill({ json: { local: true, revision: 'fixture' } });
  });
  await page.goto('/studio/');
  await expect(page.locator('#save-project')).toHaveAttribute('hidden', '');
  expect(requests).toEqual([]);
  await page.goto(`/studio/#studio-token=${capability}`);
  await expect(page.locator('#save-project')).not.toHaveAttribute('hidden', '');
  await expect(page).toHaveURL(/\/studio\/$/);
  expect(await page.content()).not.toContain(capability);
  await page.reload();
  await expect(page.locator('#save-project')).not.toHaveAttribute('hidden', '');
  await page.getByRole('navigation', { name: 'Studio 功能' }).getByRole('link', { name: '籤詩', exact: true }).click();
  await expect(page.locator('#save-fortune-project')).toBeVisible();
  await page.locator('#fortune-heading-input').fill('安全連線測試');
  await page.locator('#save-fortune-project').click();
  await expect(page.locator('#fortune-status')).toHaveText('已同步到本機專案');
  expect(requests.filter((request) => request.method === 'PUT').map((request) => request.path)).toEqual(['/api/fortunes', '/api/blocks/fortune']);
  expect(requests.every((request) => request.auth === `Bearer ${capability}`)).toBe(true);
  capability = 'b'.repeat(64);
  await page.goto('/studio/');
  await expect(page.locator('#save-project')).toHaveAttribute('hidden', '');
  await page.goto(`/studio/#studio-token=${capability}`);
  await expect(page.locator('#save-project')).not.toHaveAttribute('hidden', '');
  expect(requests.at(-1).auth).toBe(`Bearer ${capability}`);
});

test('設定包超過還原預算時停止下載並提示縮小圖片', async ({ page }) => {
  await page.goto('/studio/');
  const initial = await bootstrapAnswers(page);
  const paths = Array.from({ length: 9 }, (_, index) => `/images/budget-${index}.png`);
  await page.evaluate(async (paths) => {
    const { draftScope } = JSON.parse(document.querySelector('#online-studio-data').textContent);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(`profile-studio-media-v2:${draftScope}`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'path' });
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('media', 'readwrite');
        for (const path of paths) transaction.objectStore('media').put({ path, blob: new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'image/png' }) });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
      request.onerror = () => reject(request.error);
    });
  }, paths);
  await page.reload();
  const answers = { ...initial, links: paths.map((image, index) => ({ id: `budget-${index}`, title: `Budget ${index}`, description: 'Settings package budget fixture', url: 'https://example.com/', icon: 'link', image })) };
  await page.getByRole('tab', { name: '完成設定' }).click();
  await page.locator('#import-answers').setInputFiles({ name: 'settings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(answers)) });
  await expect(page.locator('#online-toast')).toContainText('已匯入');
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.locator('#download-answers').click();
  await expect(page.locator('#online-toast')).toContainText('圖片總量不可超過 40 MB');
  expect(downloads).toEqual([]);
});

test('ZIP 只保存引用圖片，拒絕損壞與重複檔名並保留草稿及撤銷', async ({ page }) => {
  await page.goto('/studio/');
  const initial = await bootstrapAnswers(page);
  const imported = { ...initial, identity: { ...initial.identity, displayName: '有效設定包' }, media: { ...initial.media, avatar: '/images/used.png' } };
  const files = [
    { name: 'profile.answers.json', data: Buffer.from(JSON.stringify(imported)) },
    { name: 'images/used.png', data: png },
    { name: 'images/orphan.png', data: png },
  ];
  await page.getByRole('tab', { name: '完成設定' }).click();
  const upload = (buffer) => page.locator('#import-answers').setInputFiles({ name: 'settings.zip', mimeType: 'application/zip', buffer: Buffer.from(buffer) });
  await upload(createSettingsZip(files));
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('有效設定包');
  expect(await storedPaths(page)).toEqual(['/images/used.png']);
  const corrupt = createSettingsZip(files);
  corrupt[30 + 'profile.answers.json'.length] ^= 1;
  await upload(corrupt);
  await expect(page.locator('#online-toast')).toContainText('校驗失敗');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('有效設定包');
  await upload(createSettingsZip([...files, files[0]]));
  await expect(page.locator('#online-toast')).toContainText('重複檔名');
  expect(await storedPaths(page)).toEqual(['/images/used.png']);
  await page.locator('#undo-draft').click();
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText(initial.identity.displayName);
  expect(await storedPaths(page)).toEqual(['/images/used.png']);
});

test('未經答案驗證的即時預覽也不建立本機或私人位址 iframe', async ({ page }) => {
  const privateRequests = [];
  page.on('request', (request) => { if (request.url().startsWith('http://127.0.0.1:4322/')) privateRequests.push(request.url()); });
  await page.route('https://example.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Public embed</p>' }));
  await page.goto('/studio/');
  const preview = page.frameLocator('#profile-preview');
  await expect(preview.locator('h1')).toBeVisible();
  const sendEmbed = (url) => page.evaluate((destination) => {
    const answers = JSON.parse(document.querySelector('#online-studio-data').textContent).initialAnswers;
    answers.embedBlocks = [{ id: 'guard-test', title: 'Guard test', url: destination, embedMode: 'inline', provider: 'website', height: 600, tags: [], description: '' }];
    answers.features.notion = true;
    document.querySelector('#profile-preview').contentWindow.postMessage({ type: 'profile-studio:render', answers }, location.origin);
  }, url);
  for (const url of ['http://127.0.0.1:4322/api/fortunes', 'http://2130706433:4322/', 'http://[::ffff:127.0.0.1]:4322/', 'http://192.168.1.1/']) {
    await sendEmbed(url);
    const embed = preview.locator('.custom-block--embed');
    await expect(embed.getByRole('heading', { name: 'Guard test' })).toBeVisible();
    await expect(embed.locator('iframe')).toHaveCount(0);
    await expect(embed.locator('a')).toHaveAttribute('href', url);
  }
  expect(privateRequests).toEqual([]);
  await sendEmbed('https://example.com/public');
  await expect(preview.locator('.custom-block--embed iframe')).toHaveAttribute('src', 'https://example.com/public');
});
