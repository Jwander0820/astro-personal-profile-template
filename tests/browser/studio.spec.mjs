import { expect, test } from '@playwright/test';
import path from 'node:path';
import {
  STUDIO_PREVIEW_QUERY_PARAM,
  STUDIO_PREVIEW_QUERY_VALUE,
} from '../../scripts/studio-preview-mode.mjs';

const minimalAnswers = path.resolve('docs', 'ai', 'examples', 'minimal.json');

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
