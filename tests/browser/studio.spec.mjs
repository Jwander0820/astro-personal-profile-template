import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createSettingsZip, readSettingsZip } from '../../src/scripts/settings-package.js';
import { applyProfileProjectUpdate, planProfileProjectUpdate } from '../../scripts/profile-project.mjs';
import {
  STUDIO_PREVIEW_QUERY_PARAM,
  STUDIO_PREVIEW_QUERY_VALUE,
} from '../../scripts/studio-preview-mode.mjs';

const minimalAnswers = path.resolve('docs', 'ai', 'examples', 'minimal.json');
const exampleAnswers = JSON.parse(await readFile(path.resolve('profile.answers.example.json'), 'utf8'));
const browserFixtureAnswers = {
  ...exampleAnswers,
  links: [
    {
      id: 'first-link',
      title: 'First link',
      url: 'https://example.com/first',
      description: 'First fixture link.',
      icon: 'arrow',
      style: 'primary',
      tags: [],
    },
    {
      id: 'second-link',
      title: 'Second link',
      url: 'https://example.com/second',
      description: 'Second fixture link.',
      icon: 'arrow',
      style: 'normal',
      tags: [],
    },
  ],
  embedBlocks: [],
  playlist: {
    youtubePlaylistId: 'PL1234567890abcdef',
    title: 'Test playlist',
    description: 'Browser fixture playlist.',
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((draft) => {
    if (!window.localStorage.getItem('profile-online-studio-draft-v2')) {
      window.localStorage.setItem('profile-online-studio-draft-v2', JSON.stringify(draft));
    }
  }, browserFixtureAnswers);
});

async function storedDraft(page) {
  return page.evaluate(() => {
    const bootstrap = JSON.parse(document.querySelector('#online-studio-data, #fortune-studio-data').textContent);
    return JSON.parse(localStorage.getItem(`profile-studio-draft-v3:${bootstrap.draftScope}`));
  });
}

async function downloadSettings(page) {
  await page.getByRole('tab', { name: '完成設定' }).click();
  const download = page.waitForEvent('download');
  await page.locator('#download-answers').click();
  return readSettingsZip(new Uint8Array(await readFile(await (await download).path())));
}

test('一般首頁不下載預覽 renderer，Studio iframe 仍能即時更新', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  expect(requests.some((url) => url.includes('profile-preview-bridge'))).toBe(false);
  await page.goto('/studio/');
  await page.locator('[data-bind="identity.displayName"]').fill('動態預覽載入測試');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('動態預覽載入測試');
  expect(requests.some((url) => url.includes('profile-preview-bridge'))).toBe(true);
});

test('字型預覽與正式頁一致且切換時載入所選字型', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('/');
  const formalFont = await page.locator('html').evaluate((el) => el.style.getPropertyValue('--font-display'));
  await page.goto('/studio/');
  const root = page.frameLocator('#profile-preview').locator('html');
  await page.getByRole('tab', { name: '外觀' }).click();
  await page.getByRole('combobox', { name: '標題字型', exact: true }).selectOption('system');
  await expect.poll(() => root.evaluate((el) => el.style.getPropertyValue('--font-display'))).toBe(formalFont);
  await page.getByRole('combobox', { name: '標題字型', exact: true }).selectOption('lxgw-wenkai-tc');
  const fonts = page.frameLocator('#profile-preview').locator('link[href*="fonts.googleapis.com/css2"]');
  await expect(fonts).toHaveAttribute('href', /LXGW(?:\+|%20)WenKai(?:\+|%20)TC/);
  await page.getByRole('combobox', { name: '內文字型', exact: true }).selectOption('noto-serif-tc');
  await expect(fonts).toHaveAttribute('href', /Noto(?:\+|%20)Serif(?:\+|%20)TC/);
  await page.getByRole('combobox', { name: '標題字型', exact: true }).selectOption('system');
  await expect(fonts).not.toHaveAttribute('href', /LXGW/);
  await page.getByRole('combobox', { name: '內文字型', exact: true }).selectOption('system');
  await expect(fonts).toHaveCount(0);
});

test('Markdown 預覽保留清單、斜體、引用及安全文字', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByLabel('自我介紹', { exact: true }).fill('- 第一項\n- 第二項\n\n*斜體*與**粗體**\n\n> 引用\n\n<script>alert(1)</script>\n\n[異常字元連結](https://example.com?q=&#9999999999;)');
  const bio = page.frameLocator('#profile-preview').locator('.bio');
  await expect(bio.locator('ul > li')).toHaveText(['第一項', '第二項']);
  await expect(bio.locator('em')).toHaveText('斜體');
  await expect(bio.locator('strong')).toHaveText('粗體');
  await expect(bio.locator('blockquote')).toHaveText('引用');
  await expect(bio.locator('script')).toHaveCount(0);
  await expect(bio).toContainText('<script>alert(1)</script>');
  await expect(bio.getByRole('link', { name: '異常字元連結' })).toBeVisible();
});

test('Markdown 註腳可來回跳轉且含圖片標題錨點與正式頁一致', async ({ page }) => {
  await page.route('https://example.com/a.png', (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.goto('/studio/');
  await page.getByLabel('自我介紹', { exact: true }).fill('### *A* ![Cat](https://example.com/a.png) `x`\n\n[前往標題](#a--x)\n\n第一次[^note]，第二次[^note]。\n\n[^note]: **註腳內容**');
  const preview = page.frameLocator('#profile-preview');
  const bio = preview.locator('.bio');
  await expect(bio.locator('h3')).toHaveAttribute('id', 'a--x');
  await expect(bio.locator('[data-footnote-ref]')).toHaveCount(2);
  await expect(bio.locator('[data-footnotes] strong')).toHaveText('註腳內容');
  await bio.locator('[data-footnote-ref]').nth(1).click();
  await expect.poll(() => preview.locator('html').evaluate(() => location.hash)).toBe('#user-content-fn-note');
  await bio.locator('[data-footnote-backref]').nth(1).click();
  await expect.poll(() => preview.locator('html').evaluate(() => location.hash)).toBe('#user-content-fnref-note-2');
  await bio.getByRole('link', { name: '前往標題' }).click();
  await expect.poll(() => preview.locator('html').evaluate(() => location.hash)).toBe('#a--x');
  await expect(preview.locator('h1')).toHaveText(browserFixtureAnswers.identity.displayName);
});

test('ZIP 圖片驗證失敗時保留原本草稿與圖片', async ({ page }) => {
  await page.goto('/studio/');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText(browserFixtureAnswers.identity.displayName);
  const draftBefore = await storedDraft(page);
  const imported = { ...browserFixtureAnswers, identity: { ...browserFixtureAnswers.identity, displayName: '不可寫入的草稿' } };
  const bytes = createSettingsZip([
    { name: 'profile.answers.json', data: Buffer.from(JSON.stringify(imported)) },
    { name: 'images/first.png', data: Buffer.from('first') },
    { name: 'images/too-large.png', data: new Uint8Array(5 * 1024 * 1024 + 1) },
  ]);
  await page.getByRole('tab', { name: '完成設定' }).click();
  await page.locator('#import-answers').setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  await expect(page.locator('#online-toast')).toContainText('5 MB');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText(browserFixtureAnswers.identity.displayName);
  expect(await storedDraft(page)).toEqual(draftBefore);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-answers').click();
  const download = await downloadPromise;
  const entries = readSettingsZip(new Uint8Array(await readFile(await download.path())));
  expect([...entries.keys()]).toEqual(['profile.answers.json']);
});

test('ZIP 圖片交易中斷會回復資料庫，成功匯入可再次匯出圖片', async ({ page }) => {
  await page.goto('/studio/');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.locator('[data-image-target="media.avatar"]').setInputFiles({ name: 'kept.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/kept.png');
  const imported = { ...browserFixtureAnswers, identity: { ...browserFixtureAnswers.identity, displayName: '交易成功' }, media: { ...browserFixtureAnswers.media, avatar: '/images/next.png' } };
  const files = [
    { name: 'profile.answers.json', data: Buffer.from(JSON.stringify(imported)) },
    { name: 'images/kept.png', data: png },
    { name: 'images/next.png', data: png },
  ];
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (entry, ...args) {
      if (entry.path === '/images/next.png') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('測試交易失敗', 'QuotaExceededError');
      }
      return original.call(this, entry, ...args);
    };
  });
  await page.getByRole('tab', { name: '完成設定' }).click();
  const file = { name: 'settings.zip', mimeType: 'application/zip', buffer: Buffer.from(createSettingsZip(files)) };
  await page.locator('#import-answers').setInputFiles(file);
  await expect(page.locator('#online-toast')).toContainText('測試交易失敗');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText(browserFixtureAnswers.identity.displayName);
  const storedPaths = await page.evaluate(() => new Promise((resolve, reject) => {
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
  expect(storedPaths).toEqual(['/images/kept.png']);
  await page.locator('#import-answers').setInputFiles(file);
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('交易成功');
  await expect.poll(() => page.frameLocator('#profile-preview').locator('.avatar').evaluate((el) => el.complete && el.naturalWidth)).toBeTruthy();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-answers').click();
  const entries = readSettingsZip(new Uint8Array(await readFile(await (await downloadPromise).path())));
  expect(Buffer.from(entries.get('images/next.png'))).toEqual(png);
  expect(JSON.parse(new TextDecoder().decode(entries.get('profile.answers.json'))).media.avatar).toBe('/images/next.png');
});

test('正式首頁保留入口，但 Studio 預覽只顯示使用者內容', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-studio-link-card]')).toBeVisible();
  await expect(page.locator('.footer-studio-link')).toBeVisible();

  await page.goto('/studio/');
  const previewFrame = page.locator('#profile-preview');
  await expect(previewFrame).toHaveAttribute(
    'src',
    new RegExp(`${STUDIO_PREVIEW_QUERY_PARAM}=${STUDIO_PREVIEW_QUERY_VALUE}`),
  );
  const preview = page.frameLocator('#profile-preview');
  await expect(preview.locator('[data-profile-renderer]')).toHaveAttribute('data-studio-enabled', 'false');
  await expect(preview.locator('[data-studio-link-card]')).toHaveCount(0);
  await expect(preview.locator('.footer-studio-link')).toHaveCount(0);
});

for (const width of [390, 1440]) {
test(`${width} px Studio 工具列捲動後仍可撤銷重做且不會水平溢出`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/studio/');
  await expect(page.locator('#profile-preview')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.clientWidth).toBe(width);
  expect(dimensions.scrollWidth).toBe(width);
  expect(dimensions.bodyWidth).toBe(width);

  const undo = page.getByRole('button', { name: '撤銷', exact: true });
  const redo = page.getByRole('button', { name: '重做', exact: true });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  const location = page.locator('[data-bind="identity.location"]');
  const original = await location.inputValue();
  await location.fill('工具列位置測試');
  await expect(undo).toBeEnabled();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('toolbar-top.png') });
  await page.locator('[data-bind="media.background"]').scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(100);
  await expect(undo).toBeInViewport();
  await expect(redo).toBeInViewport();
  await undo.focus();
  await undo.press('Enter');
  await expect(location).toHaveValue(original);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(location).toHaveValue('工具列位置測試');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.screenshot({ path: testInfo.outputPath('toolbar-scrolled.png') });
});
}

test('更新無關欄位會保留唱盤節點與抽籤結果', async ({ page }) => {
  await page.goto('/studio/');
  const preview = page.frameLocator('#profile-preview');
  const turntable = preview.locator('[data-turntable-player]');
  const fortune = preview.locator('[data-fortune-draw]');
  await expect(turntable).toBeVisible();
  await expect(fortune).toBeVisible();

  await turntable.evaluate((element) => {
    element.dataset.playwrightRetained = 'true';
  });
  await fortune.getByRole('button', { name: '抽一支' }).click();
  const grade = fortune.locator('[data-fortune-grade]');
  const message = fortune.locator('[data-fortune-message]');
  await expect(grade).not.toHaveText('等待開籤');
  const drawnGrade = await grade.textContent();
  const drawnMessage = await message.textContent();

  await page.locator('[data-bind="identity.title"]').fill('自動化預覽保留測試');
  await expect(preview.locator('.role')).toHaveText('自動化預覽保留測試');
  await expect(turntable).toHaveAttribute('data-playwright-retained', 'true');
  await expect(grade).toHaveText(drawnGrade || '');
  await expect(message).toHaveText(drawnMessage || '');
  await expect(fortune).toHaveClass(/is-revealed/);
});

test('外觀字級控制會同步到正式預覽', async ({ page }) => {
  await page.goto('/studio/');
  await page.locator('#tab-appearance').click();
  await page.locator('[data-bind="appearance.fontScale"]').fill('1.2');
  await page.locator('[data-bind="appearance.smallTextScale"]').fill('1.35');

  const previewRoot = page.frameLocator('#profile-preview').locator('html');
  await expect(previewRoot).toHaveCSS('font-size', '19.2px');
  await expect.poll(() => previewRoot.evaluate((element) => (
    element.style.getPropertyValue('--small-text-base')
  ))).toBe('1.35rem');
});

test('HTTPS 頭像網址會進入正式預覽', async ({ page }) => {
  const imageUrl = 'https://images.example/avatar.png';
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.route(imageUrl, (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: onePixelPng,
  }));

  await page.goto('/studio/');
  await page.locator('[data-bind="media.avatar"]').fill(imageUrl);
  const avatar = page.frameLocator('#profile-preview').locator('.avatar');
  await expect(avatar).toHaveAttribute('src', imageUrl);
  await expect.poll(() => avatar.evaluate((image) => image.complete && image.naturalWidth)).toBeTruthy();
});

test('Links 卡片可排序並個別選擇樣式', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByRole('tab', { name: '公開連結' }).click();

  const editors = page.locator('#featured-link-list .collection-item');
  await expect(editors).toHaveCount(browserFixtureAnswers.links.length);
  const firstTitle = await editors.nth(0).locator('.collection-item__title strong').textContent();
  const secondTitle = await editors.nth(1).locator('.collection-item__title strong').textContent();

  await editors.nth(0).locator('summary').click();
  await expect(editors.nth(0)).toHaveAttribute('open', '');
  await editors.nth(0).locator('[data-field="style"]').selectOption('normal');
  await expect(page.frameLocator('#profile-preview').locator('.link-list .link-card').nth(0)).toHaveClass(/is-normal/);
  await expect(page.frameLocator('#profile-preview').locator('.link-list .link-card').nth(0)).not.toHaveClass(/is-primary/);

  await editors.nth(0).locator('[data-move-collection="down"]').click();
  await expect(editors.nth(0).locator('.collection-item__title strong')).toHaveText(secondTitle || '');
  await expect(editors.nth(1).locator('.collection-item__title strong')).toHaveText(firstTitle || '');
  await expect(page.frameLocator('#profile-preview').locator('.link-list .link-card').nth(1).locator('strong')).toHaveText(firstTitle || '');

  await page.getByRole('tab', { name: '完成設定' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-json').click();
  const download = await downloadPromise;
  const answers = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(answers.links[0].title).toBe(secondTitle);
  expect(answers.links[1]).toEqual(expect.objectContaining({ title: firstTitle, style: 'normal' }));
});

test('其它功能可建立網頁內嵌並匯出設定', async ({ page }) => {
  const notionUrl = 'https://jwander.notion.site/ebd//3910d2e549f980278eadc9533fc7d039?v=2e00d2e549f98237bd5988c12092c07c';
  const notionIframe = `<iframe src="${notionUrl}" width="100%" height="600" frameborder="0" allowfullscreen />`;
  const youtubeUrl = 'https://www.youtube.com/embed/vfQvkPAjmws';
  const youtubeIframe = '<iframe width="560" height="315" src="https://www.youtube.com/embed/vfQvkPAjmws?si=VPAnKV-VC7ugYeN5" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
  await page.goto('/studio/');
  await page.getByRole('tab', { name: '其它功能' }).click();
  await page.getByRole('button', { name: '新增內嵌' }).click();

  const editor = page.locator('#embed-block-list .collection-item').last();
  await editor.getByLabel('標題').fill('我的公開筆記');
  await editor.getByLabel('嵌入網址或 iframe 程式碼').fill(notionIframe);
  await editor.getByLabel('顯示方式').selectOption('inline');

  const embed = page.frameLocator('#profile-preview').locator('.custom-block--embed');
  await expect(embed.getByRole('heading', { name: '我的公開筆記' })).toBeVisible();
  await expect(embed.locator('iframe')).toHaveAttribute('src', notionUrl);
  await expect(embed.locator('iframe')).toHaveAttribute('height', '600');
  await expect(editor.getByLabel('網站類型')).toHaveValue('notion');

  await page.getByRole('button', { name: '新增內嵌' }).click();
  const youtubeEditor = page.locator('#embed-block-list .collection-item').last();
  await youtubeEditor.getByLabel('標題').fill('YouTube 影片');
  await youtubeEditor.getByLabel('嵌入網址或 iframe 程式碼').fill(youtubeIframe);
  await youtubeEditor.getByLabel('顯示方式').selectOption('inline');
  await expect(youtubeEditor.getByLabel('網站類型')).toHaveValue('youtube');
  await expect(youtubeEditor.getByLabel('內嵌高度（320～1200 px）')).toHaveValue('320');

  const youtubeEmbed = page.frameLocator('#profile-preview').locator('.custom-block--embed').last();
  await expect(youtubeEmbed.locator('iframe')).toHaveAttribute('src', youtubeUrl);
  await expect(youtubeEmbed.locator('iframe')).toHaveAttribute('allow', /encrypted-media/);

  await page.getByRole('tab', { name: '完成設定' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-json').click();
  const download = await downloadPromise;
  const answers = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(answers.embedBlocks).toEqual([
    expect.objectContaining({
      title: '我的公開筆記',
      url: notionUrl,
      provider: 'notion',
      embedMode: 'inline',
      height: 600,
    }),
    expect.objectContaining({
      title: 'YouTube 影片',
      url: youtubeUrl,
      provider: 'youtube',
      embedMode: 'inline',
      height: 320,
    }),
  ]);
});

test('匯入 merge 回答檔只更新指定欄位並轉為完整 Studio 草稿', async ({ page }) => {
  await page.goto('/studio/');
  await page.locator('#import-answers').setInputFiles({
    name: 'profile.merge.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      version: 1,
      applyMode: 'merge',
      identity: { title: 'Merged in Studio' },
    })),
  });

  await expect(page.locator('[data-bind="identity.title"]')).toHaveValue('Merged in Studio');
  await expect(page.locator('#featured-link-list .collection-item')).toHaveCount(browserFixtureAnswers.links.length);
  await page.locator('#tab-finish').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-json').click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.applyMode).toBe('replace');
  expect(exported.identity.title).toBe('Merged in Studio');
  expect(exported.links).toHaveLength(browserFixtureAnswers.links.length);
});

test('06 完成設定可下載 JSON、ZIP 並匯入既有回答檔', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByRole('tab', { name: '完成設定' }).click();
  await expect(page.locator('#panel-finish')).toBeVisible();
  await expect(page.locator('#save-project')).toBeHidden();

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.locator('#download-json').click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe('profile.answers.json');

  const zipDownloadPromise = page.waitForEvent('download');
  await page.locator('#download-answers').click();
  const zipDownload = await zipDownloadPromise;
  expect(zipDownload.suggestedFilename()).toBe('profile-settings.zip');

  await page.locator('#import-answers').setInputFiles(minimalAnswers);
  await expect(page.locator('[data-bind="identity.displayName"]')).toHaveValue('林小樹');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('林小樹');
});


test('多分頁修改不互相覆蓋，載入或覆蓋均由使用者選擇', async ({ page, context }) => {
  await page.goto('/studio/');
  await expect(page.locator('#online-editor')).not.toHaveAttribute('inert');
  const other = await context.newPage();
  await other.goto('/studio/');
  await expect(other.locator('#online-editor')).not.toHaveAttribute('inert');
  await expect(page.locator('#draft-conflict')).toBeHidden();
  await page.locator('[data-bind="identity.displayName"]').fill('分頁 A 的名稱');
  await expect.poll(async () => (await storedDraft(page)).answers.identity.displayName).toBe('分頁 A 的名稱');
  await expect(other.locator('#draft-conflict')).toBeVisible();
  await other.getByLabel('一句話身分', { exact: true }).fill('分頁 B 的標題');
  await expect(other.locator('#draft-status')).toContainText('衝突');
  expect((await storedDraft(page)).answers.identity.title).toBe(browserFixtureAnswers.identity.title);
  await other.locator('#draft-load-latest').click();
  await expect(other.locator('[data-bind="identity.displayName"]')).toHaveValue('分頁 A 的名稱');
  await expect(other.locator('#draft-conflict')).toBeHidden();
  // The version replaced by an explicit reload remains in local undo history.
  await other.locator('#undo-draft').click();
  await expect(other.getByLabel('一句話身分', { exact: true })).toHaveValue('分頁 B 的標題');
  await expect(page.locator('#draft-conflict')).toBeVisible();
  await page.locator('#draft-keep-local').click();
  await expect.poll(async () => (await storedDraft(page)).answers.identity.displayName).toBe('分頁 A 的名稱');
  await expect(other.locator('#draft-conflict')).toBeVisible();
  await other.close();
});

test('籤詩編輯與主 Studio 共用草稿並防止跨頁覆蓋', async ({ page, context }) => {
  await page.goto('/studio/');
  await page.locator('[data-bind="identity.displayName"]').fill('保留主頁名稱');
  await expect.poll(async () => (await storedDraft(page)).answers.identity.displayName).toBe('保留主頁名稱');
  const fortune = await context.newPage();
  await fortune.goto('/studio/fortune-poem/');
  await fortune.locator('#fortune-heading-input').fill('新的籤桶標題');
  await expect.poll(async () => (await storedDraft(fortune)).answers.fortune.title).toBe('新的籤桶標題');
  await expect(page.locator('#draft-conflict')).toBeVisible();
  await page.locator('#draft-load-latest').click();
  await expect(page.locator('[data-bind="identity.displayName"]')).toHaveValue('保留主頁名稱');
  await expect(page.frameLocator('#profile-preview').getByRole('heading', { name: '新的籤桶標題' })).toBeVisible();
  await fortune.close();
});

test('同網域的另一個專案不沿用已遷移的草稿與圖片', async ({ page, context }) => {
  await page.goto('/studio/');
  await page.locator('[data-bind="identity.displayName"]').fill('專案 A');
  await expect.poll(async () => (await storedDraft(page)).answers.identity.displayName).toBe('專案 A');
  const other = await context.newPage();
  await other.route('**/studio/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/"draftScope":"[^"]+"/, '"draftScope":"another-project"');
    await route.fulfill({ response, body: html });
  });
  await other.goto('/studio/');
  await expect(other.locator('[data-bind="identity.displayName"]')).not.toHaveValue('專案 A');
  await other.locator('[data-bind="identity.displayName"]').fill('專案 B');
  await expect.poll(async () => (await storedDraft(other)).answers.identity.displayName).toBe('專案 B');
  expect((await storedDraft(page)).answers.identity.displayName).toBe('專案 A');
  await expect(page.locator('#draft-conflict')).toBeHidden();
  await other.close();
});

test('移除卡片、AI 匯入與重設可撤銷及重做', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByRole('tab', { name: '公開連結' }).click();
  await page.locator('#featured-link-list [data-remove]').first().click();
  await expect(page.locator('#featured-link-list .collection-item')).toHaveCount(1);
  await page.locator('#undo-draft').click();
  await expect(page.locator('#featured-link-list .collection-item__title strong')).toHaveText(['First link', 'Second link']);
  await page.locator('#redo-draft').click();
  await expect(page.locator('#featured-link-list .collection-item__title strong')).toHaveText(['Second link']);
  await page.getByRole('tab', { name: '完成設定' }).click();
  await page.locator('#ai-answers-json').fill(JSON.stringify({ version: 1, identity: { displayName: '匯入的名字' } }));
  await page.locator('#import-ai-answers').click();
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('匯入的名字');
  await page.locator('#undo-draft').click();
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText(browserFixtureAnswers.identity.displayName);
  await page.locator('#redo-draft').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#reset-draft').click();
  await page.locator('#undo-draft').click();
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('匯入的名字');
});

test('替換圖片只匯出目前引用的檔案，撤銷可復原圖片', async ({ page }) => {
  await page.goto('/studio/');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const upload = page.locator('[data-image-target="media.avatar"]');
  await upload.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/first.png');
  await upload.setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/second.png');
  expect([...(await downloadSettings(page)).keys()]).toEqual(['profile.answers.json', 'images/second.png']);
  await page.locator('#undo-draft').click();
  const restored = await downloadSettings(page);
  expect([...restored.keys()]).toEqual(['profile.answers.json', 'images/first.png']);
  expect(Buffer.from(restored.get('images/first.png'))).toEqual(png);
  await expect.poll(() => page.frameLocator('#profile-preview').locator('.avatar').evaluate((image) => image.complete && image.naturalWidth)).toBeTruthy();
});

test('本機儲存排除舊圖片並保留寫入交易及 ZIP 再匯出', async ({ page }) => {
  const root = await mkdtemp(path.resolve('.astro', 'browser-project-'));
  try {
    await cp('src/content', path.join(root, 'src/content'), { recursive: true });
    await cp('public/images', path.join(root, 'public/images'), { recursive: true });
    let savedPayload;
    let releasePlan;
    await page.route('http://localhost:4322/api/**', async (route) => {
      try {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/api/status') return route.fulfill({ json: { ok: true } });
        const payload = request.postDataJSON();
        if (url.pathname === '/api/project/plan') {
          await new Promise((resolve) => { releasePlan = resolve; });
          return route.fulfill({ json: { plan: await planProfileProjectUpdate(root, payload) } });
        }
        savedPayload = payload;
        return route.fulfill({ json: await applyProfileProjectUpdate(root, payload) });
      } catch (error) { return route.fulfill({ status: 400, json: { error: error.message } }); }
    });
    await page.goto('/studio/');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await page.locator('[data-image-target="media.avatar"]').setInputFiles({ name: 'old.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/old.png');
    await page.locator('[data-image-target="media.avatar"]').setInputFiles({ name: 'current.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/current.png');
    await page.getByRole('tab', { name: '完成設定' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#save-project').click();
    await expect.poll(() => Boolean(releasePlan)).toBe(true);
    await expect(page.locator('#online-editor')).toHaveAttribute('inert', '');
    await expect(page.locator('#undo-draft')).toBeDisabled();
    await expect(page.locator('#redo-draft')).toBeDisabled();
    releasePlan();
    await expect(page.locator('#draft-status')).toHaveText('已儲存到本機專案');
    await expect(page.locator('#undo-draft')).toBeEnabled();
    expect(savedPayload.images.map((image) => image.path)).toEqual(['/images/current.png']);
    expect(await readFile(path.join(root, 'public/images/current.png'))).toEqual(png);
    expect([...(await downloadSettings(page)).keys()]).toEqual(['profile.answers.json', 'images/current.png']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('驗證失敗定位第二張卡片的網址，修正後可匯出', async ({ page }) => {
  await page.goto('/studio/');
  await page.getByRole('tab', { name: '公開連結' }).click();
  const second = page.locator('#featured-link-list details').nth(1);
  await second.locator('summary').click();
  await second.locator('[data-field="url"]').fill('invalid-url');
  await second.locator('summary').click();
  await page.getByRole('tab', { name: '完成設定' }).click();
  await page.locator('#download-answers').click();
  await expect(page.getByRole('tab', { name: '公開連結' })).toHaveAttribute('aria-selected', 'true');
  await expect(second).toHaveAttribute('open');
  await expect(second.locator('[data-field="url"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(second.locator('[data-field="url"]')).toBeFocused();
  await expect(page.locator('#validation-summary')).toContainText('精選連結網址');
  await second.locator('[data-field="url"]').fill('https://example.com/fixed');
  await expect(page.locator('#validation-summary')).toBeHidden();
  const entries = await downloadSettings(page);
  expect(JSON.parse(new TextDecoder().decode(entries.get('profile.answers.json'))).links[1].url).toBe('https://example.com/fixed');
});


test('舊版草稿與圖片可遷移並在重新載入後保留修改', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const legacy = JSON.parse(localStorage.getItem('profile-online-studio-draft-v2'));
    legacy.identity.displayName = '舊版草稿';
    legacy.media.avatar = '/images/legacy.png';
    localStorage.setItem('profile-online-studio-draft-v2', JSON.stringify(legacy));
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), (char) => char.charCodeAt(0));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('profile-online-studio-media-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'path' });
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('media', 'readwrite');
        transaction.objectStore('media').put({ path: '/images/legacy.png', blob: new Blob([bytes], { type: 'image/png' }) });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.goto('/studio/');
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('舊版草稿');
  expect([...(await downloadSettings(page)).keys()]).toEqual(['profile.answers.json', 'images/legacy.png']);
  await page.getByRole('tab', { name: '基本資料' }).click();
  await page.locator('[data-bind="identity.displayName"]').fill('遷移後的新名稱');
  await expect.poll(async () => (await storedDraft(page)).answers.identity.displayName).toBe('遷移後的新名稱');
  await page.reload();
  await expect(page.frameLocator('#profile-preview').locator('h1')).toHaveText('遷移後的新名稱');
  expect([...(await downloadSettings(page)).keys()]).toEqual(['profile.answers.json', 'images/legacy.png']);
});

test('同名不同圖片匯入不破壞撤銷記錄', async ({ page }) => {
  await page.goto('/studio/');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const replacement = Buffer.concat([png, Buffer.from([0])]);
  await page.locator('[data-image-target="media.avatar"]').setInputFiles({ name: 'same.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue('/images/same.png');
  const imported = { ...browserFixtureAnswers, media: { ...browserFixtureAnswers.media, avatar: '/images/same.png' } };
  const zip = createSettingsZip([
    { name: 'profile.answers.json', data: Buffer.from(JSON.stringify(imported)) },
    { name: 'images/same.png', data: replacement },
  ]);
  await page.getByRole('tab', { name: '完成設定' }).click();
  await page.locator('#import-answers').setInputFiles({ name: 'collision.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.locator('#online-toast')).toContainText('已匯入');
  const current = await downloadSettings(page);
  expect(Buffer.from(current.get('images/same-2.png'))).toEqual(replacement);
  expect(current.has('images/same.png')).toBe(false);
  await page.locator('#undo-draft').click();
  const previous = await downloadSettings(page);
  expect(Buffer.from(previous.get('images/same.png'))).toEqual(png);
  expect(previous.has('images/same-2.png')).toBe(false);
});

test('圖片儲存失敗不留下可匯出或寫入的失敗圖片', async ({ page }) => {
  await page.goto('/studio/');
  await expect(page.locator('#online-editor')).not.toHaveAttribute('inert');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = put;
      throw new DOMException('測試空間不足', 'QuotaExceededError');
    };
  });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.locator('[data-image-target="media.avatar"]').setInputFiles({ name: 'failed.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#online-toast')).toContainText('測試空間不足');
  await expect(page.locator('[data-bind="media.avatar"]')).toHaveValue(browserFixtureAnswers.media.avatar);
  expect([...(await downloadSettings(page)).keys()]).toEqual(['profile.answers.json']);
});
