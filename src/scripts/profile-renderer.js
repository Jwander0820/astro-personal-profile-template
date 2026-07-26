import { isSafeHttpUrl, isSafeProfileUrl } from '../../scripts/content-safety.mjs';
import { parseYoutubePlaylistId } from '../../scripts/youtube-playlist.mjs';

const HOME_SECTIONS = ['about', 'turntable', 'links', 'fortune', 'notion'];

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function appendTextWithInlineMarkdown(container, source) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let offset = 0;
  for (const match of String(source || '').matchAll(pattern)) {
    container.append(document.createTextNode(source.slice(offset, match.index)));
    const token = match[0];
    if (token.startsWith('**')) container.append(node('strong', '', token.slice(2, -2)));
    else if (token.startsWith('`')) container.append(node('code', '', token.slice(1, -1)));
    else {
      const parts = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      const link = node('a', '', parts?.[1] || token);
      if (parts) {
        link.href = parts[2];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      container.append(link);
    }
    offset = (match.index || 0) + token.length;
  }
  container.append(document.createTextNode(String(source || '').slice(offset)));
}

function markdownFragment(source) {
  const fragment = document.createDocumentFragment();
  const paragraphs = String(source || '').trim().split(/\n\s*\n/).filter(Boolean);
  for (const paragraph of paragraphs) {
    const item = node('p');
    appendTextWithInlineMarkdown(item, paragraph.replace(/\n/g, ' '));
    fragment.append(item);
  }
  return fragment;
}

function svgIcon(name, icons, size = 22) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const body = icons[name] || icons.arrow || '';
  const template = document.createElement('template');
  template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  svg.append(...template.content.firstElementChild.childNodes);
  return svg;
}

function renderHeading(id, title) {
  const heading = node('h2', '', title);
  heading.id = id;
  return heading;
}

function renderProfileHeader(answers, assetHref, assets) {
  const header = node('header', 'profile');
  const background = assetHref(assets.background || '/images/background.svg');
  if (background) header.style.setProperty('--cover-image', `url("${background}")`);
  header.append(node('div', 'cover'));
  header.firstElementChild.setAttribute('aria-hidden', 'true');

  const body = node('div', 'profile-body');
  const avatar = assetHref(assets.avatar || '/images/avatar.svg');
  if (avatar) {
    const image = node('img', 'avatar');
    image.src = avatar;
    image.alt = `${answers.identity.displayName} 的頭像`;
    image.width = 112;
    image.height = 112;
    body.append(image);
  } else {
    body.append(node('span', 'avatar avatar-fallback', answers.identity.displayName.slice(0, 2)));
  }

  const identity = node('div', 'identity');
  identity.append(node('h1', '', answers.identity.displayName));
  if (answers.identity.location) identity.append(node('p', 'location', answers.identity.location));
  body.append(identity);
  if (answers.identity.title) body.append(node('p', 'role', answers.identity.title));
  if (answers.identity.tagline?.length) {
    const list = node('ul', 'tagline-list');
    list.setAttribute('aria-label', '個人標籤');
    answers.identity.tagline.forEach((tag) => list.append(node('li', 'tagline', tag)));
    body.append(list);
  }
  const bio = node('div', 'bio');
  bio.append(markdownFragment(answers.identity.bio));
  body.append(bio);
  header.append(body);
  return header;
}

function renderSocials(items, icons) {
  if (!items?.length) return null;
  const nav = node('nav', 'socials');
  nav.setAttribute('aria-label', '快速連結');
  for (const social of items) {
    const link = node('a');
    link.href = isSafeProfileUrl(social.url) ? social.url : '#';
    link.title = social.title;
    link.setAttribute('aria-label', `前往 ${social.title}`);
    if (social.url.startsWith('http')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.append(svgIcon(social.icon, icons));
    nav.append(link);
  }
  return nav;
}

function renderSectionCard(item, assetHref) {
  const imageUrl = item.image ? assetHref(item.image) : '';
  const article = node('article', `section-card ${imageUrl ? 'section-card--with-image' : 'section-card--text-only'}`);
  if (imageUrl) {
    const image = node('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  }
  const copy = node('div', 'section-copy');
  copy.append(node('h3', '', item.title));
  const description = node('div');
  description.append(markdownFragment(item.description));
  copy.append(description);
  const tags = node('ul');
  (item.tags || []).forEach((tag) => tags.append(node('li', '', tag)));
  copy.append(tags);
  article.append(copy);
  return article;
}

function renderLinkCard(item, icons) {
  const style = ['primary', 'normal', 'subtle'].includes(item.style) ? item.style : 'normal';
  const link = node('a', `link-card is-${style}`);
  link.href = isSafeProfileUrl(item.url) ? item.url : '#';
  if (item.url.startsWith('http')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  const icon = node('span', 'link-icon');
  icon.append(svgIcon(item.icon, icons, 24));
  const copy = node('span', 'link-copy');
  copy.append(node('strong', '', item.title));
  const description = node('span', 'description');
  description.append(markdownFragment(item.description));
  copy.append(description);
  if (item.tags?.length) {
    const tags = node('span', 'tags');
    item.tags.forEach((tag) => tags.append(node('small', '', tag)));
    copy.append(tags);
  }
  link.append(icon, copy, node('span', 'link-arrow', '›'));
  link.lastElementChild.setAttribute('aria-hidden', 'true');
  return link;
}

function renderStudioLinkCard(studioHref, icons) {
  const link = node('a', 'link-card is-studio');
  link.href = studioHref;
  link.dataset.studioLinkCard = '';
  const icon = node('span', 'link-icon');
  icon.append(svgIcon('code', icons, 24));
  const copy = node('span', 'link-copy');
  copy.append(node('strong', '', '建立你的自介網站'));
  copy.append(node('span', 'description', '開啟線上 Studio，邊修改邊預覽，再下載自己的設定檔。'));
  link.append(icon, copy, node('span', 'link-arrow', '›'));
  link.lastElementChild.setAttribute('aria-hidden', 'true');
  return link;
}

function renderImageBlock(item, assetHref) {
  const section = node('section', 'content-section custom-block custom-block--image');
  section.setAttribute('aria-labelledby', `preview-image-${item.id}`);
  section.append(renderHeading(`preview-image-${item.id}`, item.title));
  const body = node('div', `custom-block__body image-block--${item.imageLayout} image-block--${item.imageAspect}`);
  body.style.setProperty('--image-position', String(item.imagePosition || 'center').replace('-', ' '));
  const image = node('img');
  image.src = assetHref(item.image);
  image.alt = item.imageAlt || '';
  image.loading = 'lazy';
  const copy = node('div', 'custom-block__content');
  copy.append(markdownFragment(item.description));
  body.append(image, copy);
  if (item.tags?.length) {
    const tags = node('ul');
    item.tags.forEach((tag) => tags.append(node('li', '', tag)));
    body.append(tags);
  }
  section.append(body);
  return section;
}

function renderEmbedBlock(item) {
  const section = node('section', 'content-section custom-block custom-block--embed');
  const headingId = `preview-embed-${item.id}`;
  section.setAttribute('aria-labelledby', headingId);
  section.append(renderHeading(headingId, item.title));
  const body = node('div', 'custom-block__body');
  const copy = node('div', 'custom-block__content');
  copy.append(markdownFragment(item.description));
  body.append(copy);

  const url = isSafeHttpUrl(item.url) ? item.url : '#';
  const embedLabel = item.provider === 'notion'
    ? '在 Notion 開啟'
    : item.provider === 'youtube'
      ? '在 YouTube 開啟'
      : '開啟完整內容';
  if (item.embedMode === 'inline' && url !== '#') {
    const embed = node('div', 'custom-block__embed');
    const frame = node('iframe');
    frame.src = url;
    frame.title = item.title;
    frame.height = String(item.height || 600);
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = item.provider === 'youtube'
      ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
      : 'clipboard-write; fullscreen';
    frame.allowFullscreen = true;
    embed.append(frame);
    const link = node('a', 'custom-block__embed-link', `${embedLabel} ↗`);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    body.append(embed, link);
  } else {
    const link = node('a', 'custom-block__embed-preview');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${embedLabel}：${item.title}`);
    link.append(
      node('span', 'custom-block__embed-kicker', 'Personal archive'),
      node('strong', '', `查看完整的 ${item.title}`),
      node('span', 'custom-block__embed-cta', `${embedLabel} ↗`),
    );
    body.append(link);
  }
  if (item.tags?.length) {
    const tags = node('ul');
    item.tags.forEach((tag) => tags.append(node('li', '', tag)));
    body.append(tags);
  }
  section.append(body);
  return section;
}

function cloneFeature(template, title, description) {
  if (!template) return null;
  const feature = template.cloneNode(true);
  const heading = feature.querySelector('h2');
  const content = feature.querySelector('.custom-block__content');
  if (heading) heading.textContent = title;
  if (content) {
    content.replaceChildren();
    content.append(markdownFragment(description));
  }
  feature.querySelectorAll('iframe').forEach((iframe) => iframe.removeAttribute('src'));
  return feature;
}

function configureTurntableFeature(feature, playlist) {
  const playlistId = parseYoutubePlaylistId(playlist?.youtubePlaylistId);
  const player = feature?.querySelector('[data-turntable-player]');
  if (!playlistId || !player) return null;

  player.dataset.playlistId = playlistId;
  delete player.dataset.turntableBound;
  delete player.dataset.turntableInitialized;
  delete player.dataset.turntableInitializing;
  player.classList.remove('has-error', 'has-track', 'is-paused', 'is-playing', 'is-scrubbing', 'is-video-revealed');

  const reveal = player.querySelector('[data-turntable-video-reveal]');
  const safeId = `preview-turntable-video-${playlistId.replace(/[^a-z0-9_-]/gi, '').slice(0, 48)}`;
  if (reveal) {
    reveal.id = safeId;
    reveal.setAttribute('aria-hidden', 'true');
  }
  const toggle = player.querySelector('[data-turntable-toggle]');
  toggle?.setAttribute('aria-controls', safeId);
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-pressed', 'false');
  toggle?.removeAttribute('disabled');

  const video = player.querySelector('.turntable-player__video');
  let playerHost = player.querySelector('[data-youtube-player]');
  if (!playerHost || playerHost.tagName === 'IFRAME') {
    const replacement = node('div');
    replacement.dataset.youtubePlayer = '';
    if (playerHost) playerHost.replaceWith(replacement);
    else video?.append(replacement);
    playerHost = replacement;
  } else {
    playerHost.replaceChildren();
  }

  return feature;
}

function configureFortuneFeature(feature, fortune) {
  const draw = feature?.querySelector('[data-fortune-draw]');
  const source = draw?.querySelector('[data-fortune-data]');
  if (source && Array.isArray(fortune?.fortunes)) {
    source.textContent = JSON.stringify(fortune.fortunes.filter((item) => item.visible)).replaceAll('<', '\\u003c');
  }
  if (draw) delete draw.dataset.fortuneBound;
  return feature;
}

function renderPlacedImages(wrapper, answers, placement, assetHref) {
  (answers.imageBlocks || [])
    .filter((item) => item.placement === placement)
    .forEach((item) => wrapper.append(renderImageBlock(item, assetHref)));
}

export function renderProfileDocument(root, answers, options) {
  const {
    icons,
    assetHref,
    assets = {},
    templates = {},
    studioEnabled = false,
    studioHref = '/studio/',
  } = options;
  const retainedTurntable = root.querySelector('[data-turntable-player]');
  const retainedFortune = root.querySelector('[data-fortune-draw]');
  const wrapper = node('div');
  wrapper.dataset.profileRenderer = '';
  wrapper.dataset.studioEnabled = String(studioEnabled);
  wrapper.dataset.studioHref = studioHref;
  wrapper.append(renderProfileHeader(answers, assetHref, assets));
  const socials = renderSocials(answers.socials, icons);
  if (socials) wrapper.append(socials);

  const order = Array.isArray(answers.appearance.homeOrder) ? answers.appearance.homeOrder : HOME_SECTIONS;
  for (const sectionId of order) {
    if (sectionId === 'about' && answers.sections?.length) {
      const section = node('section', 'content-section');
      section.setAttribute('aria-labelledby', 'about-heading');
      section.append(renderHeading('about-heading', 'About me'));
      const list = node('div', `section-list section-list--${answers.appearance.sectionsLayout}`);
      answers.sections.forEach((item) => list.append(renderSectionCard(item, assetHref)));
      section.append(list);
      wrapper.append(section);
    }
    if (sectionId === 'turntable' && answers.playlist) {
      const feature = configureTurntableFeature(
        cloneFeature(templates.turntable, answers.playlist.title || 'PLAY！', answers.playlist.description || ''),
        answers.playlist,
      );
      if (feature) wrapper.append(feature);
    }
    if (sectionId === 'links') {
      renderPlacedImages(wrapper, answers, 'before-links', assetHref);
      if (answers.links?.length || studioEnabled) {
        const section = node('section', 'content-section');
        section.setAttribute('aria-labelledby', 'links-heading');
        section.append(renderHeading('links-heading', 'Links'));
        const list = node('div', 'link-list');
        answers.links.forEach((item) => list.append(renderLinkCard(item, icons)));
        if (studioEnabled) list.append(renderStudioLinkCard(studioHref, icons));
        section.append(list);
        wrapper.append(section);
      }
      renderPlacedImages(wrapper, answers, 'between-links-sections', assetHref);
    }
    if (sectionId === 'fortune' && answers.features?.fortune) {
      const feature = configureFortuneFeature(
        cloneFeature(
          templates.fortune,
          answers.fortune?.title || '今日手氣',
          answers.fortune?.description || '搖一搖，抽走今天的一點好運。',
        ),
        answers.fortune,
      );
      if (feature) wrapper.append(feature);
    }
    if (sectionId === 'notion') {
      (answers.embedBlocks || []).forEach((item) => wrapper.append(renderEmbedBlock(item)));
    }
    if (sectionId === 'about') renderPlacedImages(wrapper, answers, 'after-sections', assetHref);
  }

  const footer = node('footer');
  footer.append(node('span', '', `© ${new Date().getFullYear()} ${answers.identity.displayName}`));
  if (studioEnabled) {
    const studioLink = node('a', 'footer-studio-link');
    studioLink.href = studioHref;
    studioLink.append(node('span', '', '↗'), document.createTextNode(' 線上 Studio'));
    studioLink.firstElementChild.setAttribute('aria-hidden', 'true');
    footer.append(studioLink);
  }
  wrapper.append(footer);

  const nextTurntable = wrapper.querySelector('[data-turntable-player]');
  if (
    retainedTurntable
    && nextTurntable
    && retainedTurntable.dataset.playlistId === nextTurntable.dataset.playlistId
  ) {
    nextTurntable.replaceWith(retainedTurntable);
  }

  const nextFortune = wrapper.querySelector('[data-fortune-draw]');
  const retainedFortuneData = retainedFortune?.querySelector('[data-fortune-data]')?.textContent;
  const nextFortuneData = nextFortune?.querySelector('[data-fortune-data]')?.textContent;
  if (retainedFortune && nextFortune && retainedFortuneData === nextFortuneData) {
    nextFortune.replaceWith(retainedFortune);
  }

  root.replaceChildren(wrapper);
  document.dispatchEvent(new CustomEvent('profile-renderer:updated', { detail: { root } }));
}
