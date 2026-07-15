import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const textExtensions = new Set(['.astro', '.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.yml', '.yaml']);
const scanRoots = ['docs', 'scripts', 'src', 'studio'];
const rootFiles = ['AGENTS.md', 'CHANGELOG.md', 'README.md', 'astro.config.mjs', 'package.json'];

async function exists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectTextFiles(relativeDirectory) {
  const directory = path.join(projectRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(relativePath));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(relativePath);
  }
  return files;
}

for (const privateFile of ['profile.answers.json', '.env', '.env.local', '.env.production']) {
  assert.equal(await exists(privateFile), false, `${privateFile} 不得出現在公開模板工作樹。`);
}

const profile = await readFile(path.join(projectRoot, 'src', 'content', 'profile', 'main.md'), 'utf8');
assert.match(profile, /^displayName:\s*你的名字$/m, '預設顯示名稱必須是通用 placeholder。');
assert.doesNotMatch(profile, /^name:/m, '公開模板不保留舊的個人名稱欄位。');
assert.doesNotMatch(profile, /^location:/m, '公開模板預設不應公開地區。');

const turntable = await readFile(path.join(projectRoot, 'src', 'content', 'blocks', 'turntable.md'), 'utf8');
const placeholderPlaylistId = 'PL1234567890abcdef';
const approvedPublicPlaylistIds = new Set(['PLlaN88a7y2_oK0nKMjZSwdU_njxUYWykm']);
const playlistId = turntable.match(/^playlistId:\s*([A-Za-z0-9_-]+)$/m)?.[1];
assert.ok(playlistId, '唱盤必須提供格式正確的 playlistId。');
if (playlistId === placeholderPlaylistId) {
  assert.match(turntable, /^visible:\s*false$/m, '使用 placeholder 播放清單時，唱盤預設必須停用。');
} else {
  assert.equal(approvedPublicPlaylistIds.has(playlistId), true, '唱盤只允許 placeholder 或維護者明確核准的公開播放清單。');
}

const linksDirectory = path.join(projectRoot, 'src', 'content', 'links');
for (const entry of await readdir(linksDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || path.extname(entry.name) !== '.md') continue;
  const content = await readFile(path.join(linksDirectory, entry.name), 'utf8');
  const email = content.match(/^url:\s*mailto:([^\s]+)$/m)?.[1];
  if (email) assert.equal(email.endsWith('@example.com'), true, `${entry.name} 必須使用 example.com email。`);
  for (const url of content.matchAll(/^url:\s*(https?:\/\/[^\s]+)$/gm)) {
    const parsed = new URL(url[1]);
    const accountPath = ['github.com', 'www.threads.net'].includes(parsed.hostname) && parsed.pathname !== '/';
    if (accountPath) assert.match(parsed.pathname, /yourname/, `${entry.name} 不得包含真實社群帳號。`);
  }
}

const scannedFiles = [...rootFiles, ...(await Promise.all(scanRoots.map(collectTextFiles))).flat()];
const secretPatterns = [
  ['OpenAI API key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];

for (const relativePath of scannedFiles) {
  const content = await readFile(path.join(projectRoot, relativePath), 'utf8');
  for (const [label, pattern] of secretPatterns) {
    assert.doesNotMatch(content, pattern, `${relativePath} 疑似包含 ${label}。`);
  }
}

console.log(`Template safety check passed (${scannedFiles.length} public text files scanned).`);
