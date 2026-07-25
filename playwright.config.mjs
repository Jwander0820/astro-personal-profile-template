import { defineConfig } from '@playwright/test';

const host = process.env.STUDIO_BROWSER_TEST_HOST || '127.0.0.1';
const port = Number(process.env.STUDIO_BROWSER_TEST_PORT || 4399);
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.astro/playwright-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  globalTeardown: './tests/browser/global-teardown.mjs',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/studio-browser-test-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
