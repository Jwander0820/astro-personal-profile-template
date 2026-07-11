import { readFile } from 'node:fs/promises';

const [css, indexPage, linkCard, themeToggle, turntablePlayer] = await Promise.all([
  readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/LinkCard.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/ThemeToggle.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/TurntablePlayer.astro', import.meta.url), 'utf8'),
]);

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
const nameRule = ruleBody('h1');
const sectionHeadingRule = ruleBody('.content-section h2');
const sectionCardTitleRule = ruleBody('.section-copy h3');
const embedCardTitleRule = ruleBody('.custom-block__embed-preview strong');
const linksIndex = indexPage.indexOf('id="links-heading"');
const aboutIndex = indexPage.indexOf('id="about-heading"');
const afterSectionsIndex = indexPage.indexOf("blocksAt('after-sections')");

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
  ['obsolete undefined page background token is absent', !css.includes('var(--page-bg)')],
  ['Links render before About and after-sections blocks', linksIndex >= 0 && aboutIndex > linksIndex && afterSectionsIndex > aboutIndex],
  ['link cards remain unnumbered', !linkCard.includes('link-track') && !linkCard.includes('position?:') && !indexPage.includes('position={index + 1}')],
  ['expanded YouTube player is not clipped to the old 380px limit', css.includes('max-height: 700px') && !css.includes('max-height: 380px')],
  ['track and status rows reserve stable two-line space', titleRule.includes('block-size: 2.7em') && statusRule.includes('block-size: 3em')],
  ['YouTube frame joins the black player surface without a pale border', videoRule.includes('width: 100%') && videoRule.includes('border: 0') && videoRule.includes('background: #000')],
  ['name keeps the serif display face', nameRule.includes('font-family: var(--font-display)')],
  ['section and card titles use the readable sans face', sectionHeadingRule.includes('font-family: var(--font-body)') && sectionCardTitleRule.includes('font-family: var(--font-body)') && embedCardTitleRule.includes('font-family: var(--font-body)')],
  ['theme toggle exposes and synchronizes pressed state', themeToggle.includes('aria-pressed="false"') && themeToggle.includes('syncToggleState')],
];

const failures = contracts.filter(([, passed]) => !passed);

if (failures.length > 0) {
  console.error('UI contract check failed:');
  failures.forEach(([name]) => console.error(`- ${name}`));
  process.exitCode = 1;
} else {
  console.log(`UI contract check passed (${contracts.length} checks).`);
}
