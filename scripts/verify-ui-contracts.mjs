import { readFile } from 'node:fs/promises';
import { FORTUNE_GRADES, validateFortuneBucket } from './fortune-content.mjs';

const [
  css,
  indexPage,
  profileRenderer,
  linkCard,
  studioLinkCard,
  footer,
  themeToggle,
  turntablePlayer,
  fortuneDraw,
  contentConfig,
  fortuneContent,
  onlineStudioPage,
  onlineStudioApp,
  onlineStudioStyle,
  liveRenderer,
  previewBridge,
  answersModule,
  astroConfig,
  studioAccess,
] = await Promise.all([
  readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ProfileRenderer.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/LinkCard.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/StudioLinkCard.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/Footer.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThemeToggle.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TurntablePlayer.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/FortuneDraw.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/content.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/fortunes.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/studio.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/scripts/online-studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/online-studio.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/scripts/profile-renderer.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/scripts/profile-preview-bridge.js', import.meta.url), 'utf8'),
  readFile(new URL('./profile-answers.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./studio-access.mjs', import.meta.url), 'utf8'),
]);

const fortunes = JSON.parse(fortuneContent);
let fortuneBucketIsValid = true;
try { validateFortuneBucket(fortunes); } catch { fortuneBucketIsValid = false; }

const ruleBody = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
};

const contracts = [
  ['desktop content width remains 880px', /main\s*\{[^}]*880px/.test(css)],
  ['desktop grids remain two columns', css.includes('@media (min-width: 720px)') && css.includes('repeat(2, minmax(0, 1fr))')],
  ['mobile layout keeps the 719px breakpoint', /@media \(max-width: 719px\)/.test(css)],
  ['formal page delegates all content rendering to ProfileRenderer', indexPage.includes('<ProfileRenderer') && profileRenderer.includes('data-profile-renderer')],
  ['home order and visibility stay schema-backed', profileRenderer.includes('visibleHomeSections') && contentConfig.includes('homeOrder: z.array') && contentConfig.includes('homeVisibility: z.array')],
  ['custom blocks keep all configured anchors', profileRenderer.includes('blocksBeforeLinks') && profileRenderer.includes('blocksAfterLinks') && profileRenderer.includes('blocksAfterAbout')],
  ['profile typography and main color reach BaseLayout', indexPage.includes('bodyFont={profile.data.bodyFont}') && indexPage.includes('displayFont={profile.data.displayFont}') && indexPage.includes('mainColor={profile.data.mainColor}')],
  ['link cards remain unnumbered', !linkCard.includes('link-track') && !linkCard.includes('position?:')],
  ['Studio entry is a gated Links card', profileRenderer.includes('<StudioLinkCard') && studioLinkCard.includes('data-studio-link-card') && studioLinkCard.includes('建立你的自介網站')],
  ['theme toggle synchronizes pressed state', themeToggle.includes('aria-pressed="false"') && themeToggle.includes('syncToggleState')],
  ['turntable keeps responsive geometry and API retry', css.includes('--tonearm-length') && turntablePlayer.includes('youtubeApiPromise = undefined')],
  ['Studio preview rebinds and retains the playable turntable', profileRenderer.includes('studio-turntable-template') && liveRenderer.includes('configureTurntableFeature') && liveRenderer.includes('retainedTurntable') && liveRenderer.includes("profile-renderer:updated") && turntablePlayer.includes("profile-renderer:updated")],
  ['fortune data and interaction remain valid', fortuneBucketIsValid && fortunes.length > 0 && fortuneDraw.includes('aria-live="polite"') && JSON.stringify(FORTUNE_GRADES) === JSON.stringify(['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'])],
  ['fortune draw avoids immediate repeats without persistence', fortuneDraw.includes('fortune.id !== currentId') && !fortuneDraw.includes('localStorage')],
  ['primary controls keep usable touch targets', ruleBody('.turntable-player__button').includes('min-height: 44px') && ruleBody('.fortune-draw__button').includes('min-height: 48px')],
  ['Studio preview is the actual site in an iframe', /<iframe[\s\S]*id="profile-preview"/.test(onlineStudioPage) && onlineStudioPage.includes('正式網站 renderer')],
  ['Studio uses actual SVG icon bodies', liveRenderer.includes("document.createElementNS('http://www.w3.org/2000/svg', 'svg')") && liveRenderer.includes('icons[name]')],
  ['Studio sends validated documents into the formal page', previewBridge.includes("profile-studio:render") && previewBridge.includes('renderProfileDocument')],
  ['simulated icon-name preview is gone', !onlineStudioApp.includes('sim-social') && !onlineStudioApp.includes('LIVE SIMULATION')],
  ['Studio exposes five editor areas with separate features', (onlineStudioPage.match(/role="tab"/g) ?? []).length === 5 && onlineStudioPage.includes('其它功能') && onlineStudioPage.includes('panel-features')],
  ['playlist and fortune live under other features', onlineStudioPage.indexOf('panel-features') < onlineStudioPage.indexOf('id="playlist-enabled"') && onlineStudioPage.indexOf('panel-features') < onlineStudioPage.indexOf('features.fortune')],
  ['social add uses an icon service chooser and custom website', onlineStudioPage.includes('social-picker-options') && onlineStudioApp.includes("['website', '自訂網站'") && onlineStudioApp.includes('SOCIAL_OPTIONS')],
  ['random main color is compact and cryptographically generated', onlineStudioPage.includes('沒想法？抽！') && onlineStudioApp.includes('crypto.getRandomValues')],
  ['image inputs cover avatar, cover, sections, and image blocks', onlineStudioPage.includes('data-image-target="media.avatar"') && onlineStudioPage.includes('data-image-target="media.background"') && onlineStudioApp.includes("['image', '圖片（選填）', 'image'") && onlineStudioApp.includes("['image', '圖片', 'image'")],
  ['settings ZIP includes JSON and media round-trip', onlineStudioApp.includes('createSettingsZip') && onlineStudioApp.includes('readSettingsZip') && onlineStudioApp.includes("'profile.answers.json'")],
  ['AI-generated JSON remains importable', onlineStudioPage.includes('ai-answers-json') && onlineStudioApp.includes('importJsonText')],
  ['local mode exposes explicit save-to-project', onlineStudioPage.includes('id="save-project"') && onlineStudioApp.includes('/api/answers/apply') && onlineStudioApp.includes('/api/images')],
  ['answer contract carries avatar and background', answersModule.includes("assertAllowedKeys(mediaInput, ['avatar', 'background']") && answersModule.includes('media: {')],
  ['Studio production allowlist removes route and navigation together', astroConfig.includes('resolveOnlineStudioAccess') && astroConfig.includes("new URL('studio/', dir)") && studioAccess.includes("VALID_STUDIO_MODES = new Set(['auto', 'public', 'off'])") && footer.includes('studioEnabled')],
  ['Studio remains responsive and motion-aware', onlineStudioStyle.includes('@media (max-width: 720px)') && onlineStudioStyle.includes('@media (prefers-reduced-motion: reduce)')],
  ['keyboard tab navigation remains cyclic', onlineStudioApp.includes("['ArrowLeft', 'ArrowRight']") && onlineStudioApp.includes('% tabs.length')],
];

const failures = contracts.filter(([, passed]) => !passed);
if (failures.length) {
  console.error('UI contract check failed:');
  failures.forEach(([name]) => console.error(`- ${name}`));
  process.exitCode = 1;
} else {
  console.log(`UI contract check passed (${contracts.length} checks).`);
}
