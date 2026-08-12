import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
    window.localStorage.setItem('profile-online-studio-draft-v2', JSON.stringify(draft));
  }, browserFixtureAnswers);
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

test('390 px Studio 不會產生水平溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio/');
  await expect(page.locator('#profile-preview')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.clientWidth).toBe(390);
  expect(dimensions.scrollWidth).toBe(390);
  expect(dimensions.bodyWidth).toBe(390);
});

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
