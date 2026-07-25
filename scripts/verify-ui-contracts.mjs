import { readFile } from 'node:fs/promises';
import { FORTUNE_GRADES, validateFortuneBucket } from './fortune-schema.mjs';

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
  baseLayout,
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
  studioPreviewMode,
  studioRouteNav,
  studioExampleLink,
  fortuneStudioPage,
  fortuneStudioPreviewPage,
  fortuneStudioApp,
  iconStudioPage,
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
  readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8'),
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
  readFile(new URL('./studio-preview-mode.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/StudioRouteNav.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/StudioExampleLink.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/studio/fortune-poem.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/studio/fortune-poem/preview.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/scripts/fortune-studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/studio/icons.astro', import.meta.url), 'utf8'),
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
  ['Studio entry is a gated Links card with matching formal and preview copy', profileRenderer.includes('<StudioLinkCard') && studioLinkCard.includes('data-studio-link-card') && studioLinkCard.includes('建立你的自介網站') && liveRenderer.includes('建立你的自介網站') && !studioLinkCard.includes('免安裝') && !liveRenderer.includes("node('small', '', '免安裝')")],
  ['theme toggle synchronizes pressed state', themeToggle.includes('aria-pressed="false"') && themeToggle.includes('syncToggleState')],
  ['turntable keeps responsive geometry and API retry', css.includes('--tonearm-length') && turntablePlayer.includes('youtubeApiPromise = undefined')],
  ['Studio preview rebinds and retains the playable turntable', profileRenderer.includes('studio-turntable-template') && liveRenderer.includes('configureTurntableFeature') && liveRenderer.includes('retainedTurntable') && liveRenderer.includes("profile-renderer:updated") && turntablePlayer.includes("profile-renderer:updated")],
  ['Studio preview rebinds and retains the interactive fortune draw', profileRenderer.includes('studio-fortune-template') && liveRenderer.includes('configureFortuneFeature') && liveRenderer.includes('retainedFortune') && fortuneDraw.includes("profile-renderer:updated") && fortuneDraw.includes('fortuneBound')],
  ['fortune data and interaction remain valid', fortuneBucketIsValid && fortunes.length > 0 && fortuneDraw.includes('aria-live="polite"') && JSON.stringify(FORTUNE_GRADES) === JSON.stringify(['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'])],
  ['fortune draw avoids immediate repeats without persistence', fortuneDraw.includes('fortune.id !== currentId') && !fortuneDraw.includes('localStorage')],
  ['primary controls keep usable touch targets', ruleBody('.turntable-player__button').includes('min-height: 44px') && ruleBody('.fortune-draw__button').includes('min-height: 48px')],
  ['Studio preview is the actual site in an iframe', /<iframe[\s\S]*id="profile-preview"/.test(onlineStudioPage) && onlineStudioPage.includes('正式網站 renderer')],
  ['Studio preview mode is centralized and omits its own promotional entry points', onlineStudioPage.includes('withStudioPreviewQuery') && baseLayout.includes('STUDIO_PREVIEW_QUERY_PARAM') && previewBridge.includes('isStudioPreviewSearch') && studioPreviewMode.includes("STUDIO_PREVIEW_QUERY_PARAM = 'studioPreview'") && profileRenderer.includes('data-studio-only-section') && css.includes('html[data-studio-preview="true"] [data-studio-link-card]') && css.includes('html[data-studio-preview="true"] .footer-studio-link')],
  ['Studio uses actual SVG icon bodies', liveRenderer.includes("document.createElementNS('http://www.w3.org/2000/svg', 'svg')") && liveRenderer.includes('icons[name]')],
  ['Studio sends validated documents into the formal page', previewBridge.includes("profile-studio:render") && previewBridge.includes('renderProfileDocument')],
  ['simulated icon-name preview is gone', !onlineStudioApp.includes('sim-social') && !onlineStudioApp.includes('LIVE SIMULATION')],
  ['Studio exposes six sequential editor areas with a final settings step', (onlineStudioPage.match(/role="tab"/g) ?? []).length === 6 && onlineStudioPage.includes('其它功能') && onlineStudioPage.includes('完成設定') && onlineStudioPage.includes('panel-finish')],
  ['basic identity omits the redundant required-field legend', !onlineStudioPage.includes('只有顯示名稱必填')],
  ['playlist and fortune live under other features', onlineStudioPage.indexOf('panel-features') < onlineStudioPage.indexOf('id="playlist-enabled"') && onlineStudioPage.indexOf('panel-features') < onlineStudioPage.indexOf('features.fortune')],
  ['Studio intro is concise and removes the decorative installation label', onlineStudioPage.includes('自訂你的自介。') && !onlineStudioPage.includes('先在這裡') && !onlineStudioPage.includes('NO INSTALLATION')],
  ['final step integrates full package, JSON, import, local save, and reset actions', onlineStudioPage.includes('id="download-answers"') && onlineStudioPage.includes('id="download-json"') && onlineStudioPage.includes('id="copy-answers"') && onlineStudioPage.includes('id="import-answers"') && onlineStudioPage.includes('id="save-project"') && onlineStudioPage.includes('>還原成預設</button>')],
  ['social add uses an icon service chooser and custom website', onlineStudioPage.includes('social-picker-options') && onlineStudioApp.includes("['website', '自訂網站'") && onlineStudioApp.includes('SOCIAL_OPTIONS')],
  ['random main color is compact and cryptographically generated', onlineStudioPage.includes('沒想法？抽！') && onlineStudioApp.includes('crypto.getRandomValues')],
  ['image inputs cover uploads and HTTPS sources across all image areas', onlineStudioPage.includes('data-image-target="media.avatar"') && onlineStudioPage.includes('data-bind="media.avatar"') && onlineStudioPage.includes('data-image-target="media.background"') && onlineStudioPage.includes('data-bind="media.background"') && onlineStudioApp.includes('公開 HTTPS 網址') && contentConfig.includes('isSafeImageSource')],
  ['settings ZIP includes JSON and media round-trip', onlineStudioApp.includes('createSettingsZip') && onlineStudioApp.includes('readSettingsZip') && onlineStudioApp.includes("'profile.answers.json'")],
  ['standalone JSON download warns that uploaded image files are excluded', onlineStudioApp.includes("link.download = 'profile.answers.json'") && onlineStudioPage.includes('不會包含你從裝置選取的圖片檔')],
  ['AI-generated JSON remains importable', onlineStudioPage.includes('ai-answers-json') && onlineStudioApp.includes('importJsonText')],
  ['local mode exposes explicit save-to-project without leaking its hidden online action', onlineStudioPage.includes('id="save-project"') && onlineStudioApp.includes('/api/answers/apply') && onlineStudioApp.includes('/api/images') && onlineStudioStyle.includes('[hidden] { display: none !important; }')],
  ['answer contract carries avatar and background', answersModule.includes("assertAllowedKeys(mediaInput, ['avatar', 'background']") && answersModule.includes('media: {')],
  ['answer contract carries fortune copy and the editable bucket', answersModule.includes("assertAllowedKeys(input.fortune, ['title', 'description', 'fortunes']") && answersModule.includes('validateFortuneBucket(input.fortune.fortunes)') && liveRenderer.includes('answers.fortune?.title')],
  ['fortune title and description are editable from the main Studio', onlineStudioPage.includes('data-bind="fortune.title"') && onlineStudioPage.includes('data-bind="fortune.description"') && onlineStudioPage.includes('/studio/fortune-poem/')],
  ['fortune route edits the shared draft through an isolated formal fortune block', fortuneStudioPage.includes('/studio/fortune-poem/preview/') && fortuneStudioPage.includes('npm run studio') && fortuneStudioPreviewPage.includes('<CustomBlock') && fortuneStudioApp.includes(`const STORAGE_KEY = 'profile-online-studio-draft-v2'`) && fortuneStudioApp.includes("type: 'fortune-studio:render'") && fortuneStudioApp.includes('if (frameReady || !frame.contentWindow) return;')],
  ['fortune cards can force the formal draw component to show one result', fortuneStudioApp.includes('抽到這張了') && fortuneStudioApp.includes('selectedFortune') && fortuneStudioPreviewPage.includes("'fortune-draw:show'") && fortuneDraw.includes("'fortune-draw:show'") && fortuneDraw.includes("'fortune-draw:update'")],
  ['fortune route keeps direct project writes local and explicit', fortuneStudioPage.includes('id="save-fortune-project"') && fortuneStudioPage.includes('hidden') && fortuneStudioApp.includes('/api/fortunes') && fortuneStudioApp.includes('/api/blocks/fortune') && onlineStudioApp.includes("['localhost', '127.0.0.1'].includes(window.location.hostname)") && fortuneStudioApp.includes("['localhost', '127.0.0.1'].includes(window.location.hostname)")],
  ['Icon copy returns the Studio token with concise instructions', iconStudioPage.includes('data-copy={name}') && !iconStudioPage.includes('data-copy={`icon:') && iconStudioPage.includes('Studio 的 Icon 欄位只需要代號。按下「複製」會取得該代號') && !iconStudioPage.includes('不會再附加')],
  ['Studio tools share one same-tab navigation with a rightmost example-page button', studioExampleLink.includes('class="studio-example-link"') && studioExampleLink.includes('範例網頁') && !studioExampleLink.includes('target="_blank"') && studioRouteNav.includes('/studio/fortune-poem/') && studioRouteNav.includes('/studio/icons/') && !studioRouteNav.includes('原網站') && onlineStudioPage.indexOf('id="draft-status"') < onlineStudioPage.indexOf('<StudioExampleLink') && fortuneStudioPage.indexOf('id="fortune-status"') < fortuneStudioPage.indexOf('<StudioExampleLink') && iconStudioPage.indexOf('id="copy-status"') < iconStudioPage.indexOf('<StudioExampleLink')],
  ['Studio production allowlist removes all Studio routes and navigation together', astroConfig.includes('resolveOnlineStudioAccess') && astroConfig.includes("new URL('studio/', dir)") && studioAccess.includes("VALID_STUDIO_MODES = new Set(['auto', 'public', 'off'])") && footer.includes('studioEnabled')],
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
