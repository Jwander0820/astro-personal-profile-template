import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolvePackageBin } from './package-bin.mjs';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, '.astro', 'studio-deployment-matrix');
const astroBin = await resolvePackageBin('astro');
const studioRoutes = [
  'studio/index.html',
  'studio/fortune-poem/index.html',
  'studio/fortune-poem/preview/index.html',
  'studio/icons/index.html',
];

const cases = [
  {
    name: 'auto-denied-fork',
    env: {
      ONLINE_STUDIO_MODE: 'auto',
      GITHUB_REPOSITORY: 'someone/profile',
      ONLINE_STUDIO_ALLOWED_REPOSITORIES: 'Jwander0820/astro-personal-profile-template',
    },
    enabled: false,
  },
  {
    name: 'auto-allowed-repository',
    env: {
      ONLINE_STUDIO_MODE: 'auto',
      GITHUB_REPOSITORY: 'someone/profile',
      ONLINE_STUDIO_ALLOWED_REPOSITORIES: 'someone/profile',
    },
    enabled: true,
  },
  {
    name: 'auto-allowed-site',
    env: {
      ONLINE_STUDIO_MODE: 'auto',
      SITE_URL: 'https://profile.example',
      ONLINE_STUDIO_ALLOWED_SITES: 'https://profile.example',
    },
    enabled: true,
  },
  {
    name: 'public-fork',
    env: {
      ONLINE_STUDIO_MODE: 'public',
      GITHUB_REPOSITORY: 'someone/profile',
    },
    enabled: true,
  },
  {
    name: 'off-allowed-repository',
    env: {
      ONLINE_STUDIO_MODE: 'off',
      GITHUB_REPOSITORY: 'Jwander0820/astro-personal-profile-template',
      ONLINE_STUDIO_ALLOWED_REPOSITORIES: 'Jwander0820/astro-personal-profile-template',
    },
    enabled: false,
  },
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isolatedEnvironment(overrides) {
  const env = { ...process.env, NO_COLOR: '1' };
  for (const name of [
    'GITHUB_REPOSITORY',
    'ONLINE_STUDIO_MODE',
    'ONLINE_STUDIO_ALLOWED_REPOSITORIES',
    'ONLINE_STUDIO_ALLOWED_SITES',
    'SITE_URL',
  ]) {
    delete env[name];
  }
  return { ...env, ...overrides };
}

async function verifyCase(testCase) {
  const outputDirectory = path.join(outputRoot, testCase.name);
  const relativeOutput = path.relative(projectRoot, outputDirectory);
  try {
    await execFileAsync(
      process.execPath,
      [astroBin, 'build', '--outDir', relativeOutput],
      {
        cwd: projectRoot,
        env: isolatedEnvironment(testCase.env),
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
      },
    );
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
    throw new Error(`${testCase.name} 建置失敗。\n${output}`, { cause: error });
  }

  const indexHtml = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const routeStates = await Promise.all(
    studioRoutes.map((route) => exists(path.join(outputDirectory, route))),
  );
  const hasStudioCard = indexHtml.includes('data-studio-link-card');
  const hasStudioFooter = indexHtml.includes('footer-studio-link');

  assert.equal(
    routeStates.every((present) => present),
    testCase.enabled,
    `${testCase.name} 的 Studio 路由輸出不符合預期。`,
  );
  assert.equal(
    routeStates.some((present) => present),
    testCase.enabled,
    `${testCase.name} 不得留下部分 Studio 路由。`,
  );
  assert.equal(hasStudioCard, testCase.enabled, `${testCase.name} 的首頁 Studio 卡片狀態不正確。`);
  assert.equal(hasStudioFooter, testCase.enabled, `${testCase.name} 的頁尾 Studio 入口狀態不正確。`);
  console.log(`✓ ${testCase.name}: Studio ${testCase.enabled ? 'enabled' : 'disabled'}`);
}

try {
  await rm(outputRoot, { recursive: true, force: true });
  for (const testCase of cases) {
    await verifyCase(testCase);
  }
  console.log(`Studio deployment matrix passed (${cases.length} cases).`);
} finally {
  await rm(outputRoot, { recursive: true, force: true });
}
