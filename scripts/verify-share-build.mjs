import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { PNG } from 'pngjs';
import { resolvePackageBin } from './package-bin.mjs';
import { applyProfileProjectUpdate } from './profile-project.mjs';
import { parseMarkdown } from './profile-content.mjs';
import { applyProfilePreset } from './profile-presets.mjs';

// Build an isolated copy; never replace the working profile for verification.
const root = process.cwd();
await mkdir(path.join(root, '.astro'), { recursive: true });
const fixture = await mkdtemp(path.join(root, '.astro', 'share-build-'));
for (const name of ['src', 'public', 'scripts', 'docs', 'package.json', 'tsconfig.json', 'astro.config.mjs']) {
  await cp(path.join(root, name), path.join(fixture, name), { recursive: true });
}
const png = new PNG({ width: 1200, height: 630 });
png.data.fill(255);
const bytes = PNG.sync.write(png);
const answers = applyProfilePreset({ version: 1, identity: { displayName: '分享建置驗證', bio: '公開測試內容' },
  media: { socialImage: '/images/share-build-cover.png' },
  sharing: { publicUrl: 'https://cards.example/profile/', enabled: true, showTemplateCredit: true },
}, 'minimal');
await applyProfileProjectUpdate(fixture, { answers, images: [{ path: '/images/share-build-cover.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }] });
const astro = await resolvePackageBin('astro');
const env = { ...process.env, SITE_URL: 'https://cards.example', GITHUB_REPOSITORY: 'someone/profile', ONLINE_STUDIO_MODE: 'off' };
try {
  await promisify(execFile)(process.execPath, [astro, 'build'], { cwd: fixture, env, maxBuffer: 4 * 1024 * 1024 });
} catch (error) { throw new Error(`${error.stdout || ''}\n${error.stderr || ''}`, { cause: error }); }
const html = await readFile(path.join(fixture, 'dist/index.html'), 'utf8');
assert.match(html, /property="og:image" content="https:\/\/cards\.example\/profile\/images\/share-build-cover\.png"/);
assert.match(html, /id="profile-share-toggle"/);
assert.match(html, /data-share-profile=/);
assert.doesNotMatch(html, /aria-labelledby="about-heading"/);
assert.doesNotMatch(html, /data-studio-link-card/);
assert.deepEqual(await readFile(path.join(fixture, 'dist/images/share-build-cover.png')), bytes);
const profile = parseMarkdown(await readFile(path.join(fixture, 'src/content/profile/main.md'), 'utf8'));
assert.equal(profile.data.sharing.publicUrl, answers.sharing.publicUrl);
await writeFile(path.join(fixture, 'verified.txt'), 'Formal OG metadata, base path, exported PNG and minimal presentation verified.\n');
console.log(`Share build verified in ${path.relative(root, fixture)} (OG image, project base, static media, profile card, hidden sections).`);
