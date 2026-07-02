import { defineConfig } from 'astro/config';

const [repositoryOwner, repositoryName] = process.env.GITHUB_REPOSITORY?.split('/') ?? [];
const normalizedOwner = repositoryOwner?.toLowerCase();
const normalizedRepository = repositoryName?.toLowerCase();
const isUserSite = Boolean(
  normalizedOwner && normalizedRepository === `${normalizedOwner}.github.io`,
);
const site = process.env.SITE_URL
  || (repositoryOwner ? `https://${repositoryOwner}.github.io` : 'http://localhost:4321');
const base = repositoryName && !isUserSite ? `/${repositoryName}` : '/';

export default defineConfig({
  site,
  base,
  output: 'static',
});
