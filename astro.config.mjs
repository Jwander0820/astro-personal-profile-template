import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createContentSafetyMdastPlugin } from './scripts/content-safety.mjs';

const [repositoryOwner, repositoryName] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
const normalizedOwner = repositoryOwner?.toLowerCase();
const normalizedRepository = repositoryName?.toLowerCase();
const isUserSite = Boolean(
  normalizedOwner && normalizedRepository === `${normalizedOwner}.github.io`,
);
const site = process.env.SITE_URL
  || (repositoryOwner ? `https://${repositoryOwner}.github.io` : 'http://localhost:4321');
const base = repositoryName && !isUserSite ? `/${repositoryName}` : '/';
const onlineStudioMode = String(process.env.ONLINE_STUDIO_MODE || 'public').toLowerCase();
if (!['public', 'off'].includes(onlineStudioMode)) {
  throw new Error('ONLINE_STUDIO_MODE 必須是 public 或 off。');
}

const onlineStudioGate = {
  name: 'profile-online-studio-gate',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      if (onlineStudioMode !== 'off') return;
      await rm(fileURLToPath(new URL('studio/', dir)), { recursive: true, force: true });
    },
  },
};

export default defineConfig({
  site,
  base,
  output: 'static',
  cacheDir: './.astro/cache',
  vite: {
    // Keep Vite's disposable cache with Astro output so Windows dev servers
    // cannot lock node_modules/.vite while a separate validation build runs.
    cacheDir: '.astro/vite-cache',
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [createContentSafetyMdastPlugin()],
    }),
  },
  integrations: [onlineStudioGate],
});
