import { icons } from '../lib/icons';
import { withBase } from '../lib/paths';
import { getProfileFonts } from '../lib/font-presets';
import { buildThemeCss, normalizeThemeColor } from '../../scripts/theme-color.mjs';
import { isStudioPreviewSearch } from '../../scripts/studio-preview-mode.mjs';
import { isSafeImageSource } from '../../scripts/content-safety.mjs';
import { renderProfileDocument } from './profile-renderer.js';

function updateFonts(appearance) {
  const { bodyFamily, displayFamily, stylesheetUrl } = getProfileFonts(appearance.bodyFont, appearance.displayFont);
  document.documentElement.style.setProperty('--font-body', bodyFamily);
  document.documentElement.style.setProperty('--font-display', displayFamily);
  let stylesheet = document.querySelector('#profile-fonts');
  if (!stylesheetUrl) {
    stylesheet?.remove();
    return;
  }
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.id = 'profile-fonts';
    stylesheet.rel = 'stylesheet';
    document.head.append(stylesheet);
  }
  if (stylesheet.getAttribute('href') !== stylesheetUrl) stylesheet.setAttribute('href', stylesheetUrl);
}

if (window.parent !== window) {
  const rendererRoot = document.querySelector('main');
  const initialProfileRenderer = document.querySelector('[data-profile-renderer]');
  const studioEnabled = initialProfileRenderer?.dataset.studioEnabled === 'true'
    && !isStudioPreviewSearch(window.location.search);
  const studioHref = initialProfileRenderer?.dataset.studioHref || withBase('/studio/');
  const turntableTemplate = document.querySelector('#studio-turntable-template');
  const fortuneTemplate = document.querySelector('#studio-fortune-template');
  const templates = {
    turntable: turntableTemplate?.content?.firstElementChild?.cloneNode(true)
      || document.querySelector('.custom-block--turntable')?.cloneNode(true),
    fortune: fortuneTemplate?.content?.firstElementChild?.cloneNode(true)
      || document.querySelector('.custom-block--fortune')?.cloneNode(true),
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (event.data?.type !== 'profile-studio:render' || !rendererRoot) return;
    const { answers, assets = {} } = event.data;
    const mainColor = normalizeThemeColor(answers?.appearance?.mainColor) || '#7A58A6';
    const themeStyle = document.querySelector('#profile-theme-css');
    if (themeStyle) themeStyle.textContent = buildThemeCss(mainColor);
    document.documentElement.style.fontSize = `${Number(answers.appearance.fontScale || 1) * 100}%`;
    document.documentElement.style.setProperty('--small-text-base', `${Number(answers.appearance.smallTextScale || 1)}rem`);
    updateFonts(answers.appearance);
    const imageSource = answers.media?.socialImage || answers.media?.background;
    const socialImage = isSafeImageSource(imageSource) ? (assets.objectUrls?.[imageSource] || withBase(imageSource)) : '';
    let imageMeta = document.querySelector('meta[property="og:image"]');
    if (socialImage) {
      if (!imageMeta) { imageMeta = document.createElement('meta'); imageMeta.setAttribute('property', 'og:image'); document.head.append(imageMeta); }
      imageMeta.content = new URL(socialImage, location.href).href;
    } else imageMeta?.remove();
    let twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (socialImage) {
      if (!twitterImage) { twitterImage = document.createElement('meta'); twitterImage.name = 'twitter:image'; document.head.append(twitterImage); }
      twitterImage.content = new URL(socialImage, location.href).href;
    } else twitterImage?.remove();
    renderProfileDocument(rendererRoot, answers, {
      icons,
      assets,
      templates,
      studioEnabled,
      studioHref,
      assetHref: (path) => isSafeImageSource(path) ? (assets.objectUrls?.[path] || withBase(path)) : '',
    });
    window.parent.postMessage({ type: 'profile-studio:rendered' }, event.origin);
  });

  window.parent.postMessage({ type: 'profile-studio:ready' }, window.location.origin);
}
