import { readFile } from 'node:fs/promises';
import { FORTUNE_GRADES, validateFortuneBucket } from './fortune-content.mjs';

const [css, indexPage, linkCard, themeToggle, turntablePlayer, fortuneDraw, contentConfig, fortuneContent, studioApp, studioIndex, studioStyle, studioThemeColorUtils, themeColorModule] = await Promise.all([
  readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/LinkCard.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThemeToggle.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TurntablePlayer.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/FortuneDraw.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/content.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/content/fortunes.json', import.meta.url), 'utf8'),
  readFile(new URL('../studio/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../studio/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../studio/style.css', import.meta.url), 'utf8'),
  readFile(new URL('../studio/theme-color-utils.js', import.meta.url), 'utf8'),
  readFile(new URL('./theme-color.mjs', import.meta.url), 'utf8'),
]);

const fortunes = JSON.parse(fortuneContent);
const fortuneIds = fortunes.map((fortune) => fortune.id);
let fortuneBucketIsValid = true;
try { validateFortuneBucket(fortunes); } catch { fortuneBucketIsValid = false; }


const ruleBody = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
};

const machineRule = ruleBody('.turntable-player__machine');
const tonearmRule = ruleBody('.turntable-player__tonearm');
const titleRule = ruleBody('.turntable-player__track-title');
const statusRule = ruleBody('.turntable-player__status');
const videoRule = ruleBody('.turntable-player__video');
const buttonRule = ruleBody('.turntable-player__button');
const recordLabelRule = ruleBody('.turntable-player__record::after');
const nameRule = ruleBody('h1');
const sectionHeadingRule = ruleBody('.content-section h2');
const sectionCardTitleRule = ruleBody('.section-copy h3');
const embedCardTitleRule = ruleBody('.custom-block__embed-preview strong');

const contracts = [
  ['desktop content width remains 880px', /main\s*\{[^}]*880px/.test(css)],
  ['desktop link and section grids remain two columns', css.includes('@media (min-width: 720px)') && css.includes('.link-list, .section-list--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }')],
  ['mobile layout keeps the 719px breakpoint', /@media \(max-width: 719px\)/.test(css)],
  ['turntable is not constrained back to 520px', !/\.custom-block--turntable\s*\{[^}]*max-width:\s*520px/.test(css)],
  ['record geometry exposes shared size and position tokens', machineRule.includes('--record-size') && machineRule.includes('--record-left')],
  ['tonearm geometry exposes a responsive length token', machineRule.includes('--tonearm-length') && tonearmRule.includes('var(--tonearm-length)') && css.includes('--tonearm-length: clamp(')],
  ['tonearm keeps the rest, outer-groove, and inner-groove angle zones', /tonearmRestAngle\s*=\s*0/.test(turntablePlayer) && /tonearmRestThreshold\s*=\s*18/.test(turntablePlayer) && /tonearmStartAngle\s*=\s*23/.test(turntablePlayer) && /tonearmEndAngle\s*=\s*43/.test(turntablePlayer)],
  ['450px tonearm geometry keeps the fine-tuned arm and lower pivot', css.includes('--tonearm-length: 144px') && css.includes('.turntable-player__tonearm { top: 28px; }')],
  ['tonearm pivot keeps optical spacing from the record edge', tonearmRule.includes('var(--record-size) - 2px')],
  ['tonearm is anchored to the record geometry', tonearmRule.includes('var(--record-left)') && tonearmRule.includes('var(--record-size)')],
  ['tonearm touch target remains 44px wide', /width:\s*44px/.test(tonearmRule)],
  ['turntable buttons remain at least 44px tall', /min-height:\s*44px/.test(buttonRule)],
  ['record label follows the generated main-color palette', recordLabelRule.includes('var(--turntable-record-label-bg)') && themeColorModule.includes("'turntable-record-label-bg'")],
  ['obsolete undefined page background token is absent', !css.includes('var(--page-bg)')],
  ['home section order and visibility are controlled by validated profile content', indexPage.includes('const visibleHomeSections = profile.data.homeOrder.filter') && indexPage.includes('visibleHomeSections.map') && contentConfig.includes("homeOrder: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))") && contentConfig.includes("homeVisibility: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))") && contentConfig.includes("new Set(items).size === items.length")],
  ['custom blocks render at their configured home anchors', indexPage.includes('blocksBeforeLinks') && indexPage.includes('blocksAfterLinks') && indexPage.includes('blocksAfterAbout') && indexPage.includes('fallbackBlocks')],
  ['image blocks expose layout, aspect, focal point, and required image validation', contentConfig.includes("'image'") && contentConfig.includes('imageLayout:') && contentConfig.includes('imageAspect:') && contentConfig.includes('imagePosition:') && contentConfig.includes("data.layout === 'image' && !data.image")],
  ['image blocks have responsive full, split, and poster treatments', css.includes('.custom-block--image .custom-block__body') && css.includes('.image-block--split-left') && css.includes('.image-block--poster') && css.includes('object-position: var(--image-position, center)')],
  ['profile typography is selected from the font allowlist', contentConfig.includes("bodyFont: z.enum(['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc'])") && indexPage.includes('bodyFont={profile.data.bodyFont}') && indexPage.includes('displayFont={profile.data.displayFont}')],
  ['profile main color reaches the generated light and dark palette', contentConfig.includes('mainColor: themeColor') && indexPage.includes('mainColor={profile.data.mainColor}')],
  ['fortune block participates in ordered rendering without falling through', indexPage.includes("section === 'fortune'") && indexPage.includes('...fortuneBlocks') && indexPage.includes('fortunes={fortunes}')],
  ['fortune data uses the validated single-file collection', contentConfig.includes("file('src/content/fortunes.json')") && contentConfig.includes('z.enum(FORTUNE_GRADES)')],
  ['fortune ids are unique and messages are non-empty', fortuneBucketIsValid && new Set(fortuneIds).size === fortuneIds.length],
  ['fortune grade editing exposes all seven ordered levels', JSON.stringify(FORTUNE_GRADES) === JSON.stringify(['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶']) && studioApp.includes("const fortuneGrades = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶']")],
  ['starter fortune grades remain at or above small luck', fortuneBucketIsValid && fortunes.every((fortune) => FORTUNE_GRADES.slice(0, 3).includes(fortune.grade))],
  ['fortune draw exposes a native button and polite live result', fortuneDraw.includes('<button type="button"') && fortuneDraw.includes('aria-live="polite"') && fortuneDraw.includes('aria-atomic="true"')],
  ['fortune draw stamps non-joke fortunes with their actual grade', fortuneDraw.includes("nextFortune.category === 'joke' ? '彩蛋' : nextFortune.grade")],
  ['fortune draw prevents immediate repeats without persistence', fortuneDraw.includes('fortune.id !== currentId') && !fortuneDraw.includes('localStorage') && !fortuneDraw.includes('sessionStorage')],
  ['fortune button remains at least 44px tall and motion can be reduced', /\.fortune-draw__button\s*\{[^}]*min-height:\s*48px/.test(css) && css.includes('.fortune-draw.is-drawing .fortune-draw__urn-area') && css.includes('@media (prefers-reduced-motion: reduce)')],
  ['link cards remain unnumbered', !linkCard.includes('link-track') && !linkCard.includes('position?:') && !indexPage.includes('position={index + 1}')],
  ['expanded YouTube player is not clipped to the old 380px limit', css.includes('max-height: 700px') && !css.includes('max-height: 380px')],
  ['track and status rows reserve stable two-line space', titleRule.includes('block-size: 2.7em') && statusRule.includes('block-size: 3em')],
  ['YouTube frame joins the black player surface without a pale border', videoRule.includes('width: 100%') && videoRule.includes('border: 0') && videoRule.includes('background: #000')],
  ['name uses the selectable display face', nameRule.includes('font-family: var(--font-display)')],
  ['section and card titles use the selectable display face', sectionHeadingRule.includes('font-family: var(--font-display)') && sectionCardTitleRule.includes('font-family: var(--font-display)') && embedCardTitleRule.includes('font-family: var(--font-display)')],
  ['theme toggle exposes and synchronizes pressed state', themeToggle.includes('aria-pressed="false"') && themeToggle.includes('syncToggleState')],
  ['Studio exposes the profile bio as optional', /自我介紹\s*<i>選填<\/i>/.test(studioIndex) && /<textarea name="bio"(?![^>]*\brequired\b)[^>]*>/.test(studioIndex)],
  ['Studio exposes the short title and keywords as optional', /一句話身分\s*<i>選填<\/i>/.test(studioIndex) && /<input name="title"(?![^>]*\brequired\b)[^>]*>/.test(studioIndex) && /關鍵字\s*<i>選填<\/i>/.test(studioIndex) && /<input name="tagline"(?![^>]*\brequired\b)[^>]*>/.test(studioIndex)],
  ['Studio integrates color and typography into balanced appearance groups', studioIndex.includes('<legend>外觀與排版</legend>') && studioIndex.includes('aria-labelledby="theme-color-heading"') && studioIndex.includes('aria-labelledby="typography-heading"') && studioStyle.includes('.appearance-grid { display: grid; grid-template-columns: minmax(242px, .92fr) minmax(0, 1.08fr)') && studioStyle.includes('grid-template: "picker code"') && studioStyle.includes('grid-template-columns: repeat(8, 24px)')],
  ['Studio keeps the random-color action compact and visually secondary', studioStyle.includes('.random-color-action { grid-area: random; min-height: 44px') && studioStyle.includes('background: rgba(255,255,255,.8)')],
  ['Studio shows eight recent saved-color slots and records only successful profile saves', studioIndex.includes('id="color-history-list"') && studioIndex.includes('最近使用') && studioStyle.includes('.color-history-placeholder') && studioApp.includes("const colorHistoryStorageKey = 'profile-studio-main-color-history'") && studioApp.includes('recordSavedThemeColor(values.mainColor)')],
  ['Studio exposes color picker, hex input, presets, and full RGB random choice', studioIndex.includes('id="main-color-picker"') && studioIndex.includes('name="mainColor"') && studioIndex.includes('data-theme-color="#7A58A6"') && studioIndex.includes('id="random-main-color"') && studioIndex.includes('<strong>無法決定嗎?</strong>') && studioIndex.includes('<small>抽一個吧!</small>') && !studioIndex.includes('RGB 全域') && studioApp.includes('randomRgbColor, updateColorHistory') && studioThemeColorUtils.includes('new Uint8Array(3)') && studioThemeColorUtils.includes('randomSource.getRandomValues(channels)') && studioThemeColorUtils.includes("channel.toString(16).padStart(2, '0')") && !studioApp.includes('themeColorPresets')],
];

const failures = contracts.filter(([, passed]) => !passed);

if (failures.length > 0) {
  console.error('UI contract check failed:');
  failures.forEach(([name]) => console.error(`- ${name}`));
  process.exitCode = 1;
} else {
  console.log(`UI contract check passed (${contracts.length} checks).`);
}
