import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseYoutubePlaylistId } from './youtube-playlist.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = await readFile(path.join(projectRoot, 'src', 'content', 'profile', 'main.md'), 'utf8');
assert.match(profile, /^displayName:\s*你的名字$/m, '上游模板預設顯示名稱必須是通用 placeholder。');
assert.doesNotMatch(profile, /^name:/m, '上游模板不得保留舊的個人名稱欄位。');
assert.doesNotMatch(profile, /^location:/m, '上游模板預設不應公開地區。');
assert.match(profile, /^bodyFont:\s*system$/m, '上游模板預設內文字型不得產生外部請求。');
assert.match(profile, /^displayFont:\s*system$/m, '上游模板預設展示字型不得產生外部請求。');

const turntable = await readFile(path.join(projectRoot, 'src', 'content', 'blocks', 'turntable.md'), 'utf8');
const placeholderPlaylistId = 'PL1234567890abcdef';
const approvedPublicPlaylistIds = new Set(['PLlaN88a7y2_oK0nKMjZSwdU_njxUYWykm']);
const playlistValue = turntable.match(/^playlistId:\s*(.+)$/m)?.[1]?.trim();
const playlistId = parseYoutubePlaylistId(playlistValue);
assert.ok(playlistId, '唱盤必須提供格式正確的 YouTube 播放清單網址或 playlist ID。');
if (playlistId === placeholderPlaylistId) {
  assert.match(turntable, /^visible:\s*false$/m, '使用 placeholder 播放清單時，唱盤預設必須停用。');
} else {
  assert.equal(approvedPublicPlaylistIds.has(playlistId), true, '唱盤只允許 placeholder 或維護者明確核准的公開播放清單。');
}

const linksDirectory = path.join(projectRoot, 'src', 'content', 'links');
for (const entry of await readdir(linksDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || path.extname(entry.name) !== '.md') continue;
  const content = await readFile(path.join(linksDirectory, entry.name), 'utf8');
  const email = content.match(/^url:\s*["']?mailto:([^\s"']+)["']?$/m)?.[1];
  if (email) assert.equal(email.endsWith('@example.com'), true, `${entry.name} 必須使用 example.com email。`);
  for (const url of content.matchAll(/^url:\s*["']?(https?:\/\/[^\s"']+)["']?$/gm)) {
    const parsed = new URL(url[1]);
    const accountPath = ['github.com', 'www.threads.net'].includes(parsed.hostname) && parsed.pathname !== '/';
    if (accountPath) assert.match(parsed.pathname, /yourname/, `${entry.name} 不得包含真實社群帳號。`);
  }
}

console.log('Template default-content check passed.');
