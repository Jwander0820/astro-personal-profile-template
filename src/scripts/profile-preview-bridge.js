import { icons } from '../lib/icons';
import { withBase } from '../lib/paths';
import { buildThemeCss, normalizeThemeColor } from '../../scripts/theme-color.mjs';
import { isSafeImageSource } from '../../scripts/content-safety.mjs';
import { renderProfileDocument } from './profile-renderer.js';

const FONT_FAMILIES = {
  system: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
  'noto-sans-tc': '"Noto Sans TC", sans-serif',
  'noto-serif-tc': '"Noto Serif TC", serif',
  'lxgw-wenkai-tc': '"LXGW WenKai TC", cursive',
};

if (window.parent !== window) {
  const rendererRoot = document.querySelector('main');
  const initialProfileRenderer = document.querySelector('[data-profile-renderer]');
  const studioEnabled = initialProfileRenderer?.dataset.studioEnabled === 'true'
    && document.documentElement.dataset.studioPreview !== 'true';
  const studioHref = initialProfileRenderer?.dataset.studioHref || withBase('/studio/');
  const turntableTemplate = document.querySelector('#studio-turntable-template');
  const fortuneTemplate = document.querySelector('#studio-fortune-template');
  const templates = {
    turntable: turntableTemplate?.content?.firstElementChild?.cloneNode(true)
      || document.querySelector('.custom-block--turntable')?.cloneNode(true),
    fortune: fortuneTemplate?.content?.firstElementChild?.cloneNode(true)
      || document.querySelector('.custom-block--fortune')?.cloneNode(true),
    notion: document.querySelector('.custom-block--embed')?.cloneNode(true),
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (event.data?.type !== 'profile-studio:render' || !rendererRoot) return;
    const { answers, assets = {}, notionVisible = false } = event.data;
    const mainColor = normalizeThemeColor(answers?.appearance?.mainColor) || '#7A58A6';
    const themeStyle = document.querySelector('#profile-theme-css');
    if (themeStyle) themeStyle.textContent = buildThemeCss(mainColor);
    document.documentElement.style.setProperty('--font-body', FONT_FAMILIES[answers.appearance.bodyFont] || FONT_FAMILIES.system);
    document.documentElement.style.setProperty('--font-display', FONT_FAMILIES[answers.appearance.displayFont] || FONT_FAMILIES.system);
    renderProfileDocument(rendererRoot, answers, {
      icons,
      assets,
      notionVisible,
      templates,
      studioEnabled,
      studioHref,
      assetHref: (path) => isSafeImageSource(path) ? (assets.objectUrls?.[path] || withBase(path)) : '',
    });
    window.parent.postMessage({ type: 'profile-studio:rendered' }, event.origin);
  });

  window.parent.postMessage({ type: 'profile-studio:ready' }, window.location.origin);
}
