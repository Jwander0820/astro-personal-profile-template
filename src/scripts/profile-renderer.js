import { parseYoutubePlaylistId } from '../../scripts/youtube-playlist.mjs';
import { markdownFragment } from './preview-markdown.js';
import { createShareProfile } from '../../scripts/profile-sharing.mjs';
import { arrangeHome, HOME_SECTIONS } from '../../scripts/profile-view.mjs';
import { views } from '../lib/profile-views.js';
import { viewToDom } from './profile-view-dom.js';

// Card markup, copy and ordering come from scripts/profile-view.mjs, the same
// views the formal Astro page serializes. This file maps a Studio draft onto
// them and keeps interactive features alive between renders.
const markdown = (source) => ({ dom: markdownFragment(source) });

function node(tag) {
  return document.createElement(tag);
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

function imageBlockView(item, assetHref) {
  return views.customBlock({
    id: `generated-image-${item.id}`,
    layout: 'image',
    title: item.title,
    image: {
      url: assetHref(item.image),
      alt: item.imageAlt || '',
      layout: item.imageLayout,
      aspect: item.imageAspect,
      position: item.imagePosition,
    },
    body: markdown(item.description),
    tags: item.tags,
  });
}

function embedBlockView(item) {
  return views.customBlock({
    id: `generated-embed-${item.id}`,
    layout: 'embed',
    title: item.title,
    body: markdown(item.description),
    embed: { url: item.url, provider: item.provider, mode: item.embedMode, height: item.height },
    tags: item.tags,
  });
}

export function renderProfileDocument(root, answers, options) {
  const {
    assetHref,
    assets = {},
    templates = {},
    headings = {},
    studioEnabled = false,
    studioHref = '/studio/',
  } = options;
  const retainedTurntable = root.querySelector('[data-turntable-player]');
  const retainedFortune = root.querySelector('[data-fortune-draw]');
  const wrapper = node('div');
  wrapper.dataset.profileRenderer = '';
  wrapper.dataset.shareProfile = JSON.stringify(createShareProfile(answers, assetHref));
  wrapper.dataset.studioEnabled = String(studioEnabled);
  wrapper.dataset.studioHref = studioHref;

  const order = (Array.isArray(answers.appearance.homeOrder) ? answers.appearance.homeOrder : HOME_SECTIONS)
    .filter((id) => !answers.appearance.hiddenSections?.includes(id));
  const links = answers.links || [];
  const sections = answers.sections || [];
  const turntable = answers.playlist && configureTurntableFeature(
    cloneFeature(templates.turntable, answers.playlist.title || 'PLAY！', answers.playlist.description || ''),
    answers.playlist,
  );
  const fortune = answers.features?.fortune && configureFortuneFeature(
    cloneFeature(
      templates.fortune,
      answers.fortune?.title || '今日手氣',
      answers.fortune?.description || '搖一搖，抽走今天的一點好運。',
    ),
    answers.fortune,
  );
  const home = arrangeHome({
    sections: order,
    parts: {
      about: sections.length > 0 && views.aboutSection({
        heading: headings.about || 'About me',
        layout: answers.appearance.sectionsLayout,
        cards: sections.map((item) => views.sectionCard({
          title: item.title,
          imageUrl: item.image ? assetHref(item.image) : '',
          tags: item.tags,
          body: markdown(item.description),
        })),
      }),
      turntable: turntable && { dom: turntable },
      links: (links.length > 0 || studioEnabled) && views.linksSection({
        heading: headings.links || 'Links',
        studioOnly: links.length === 0,
        cards: [
          links.map((item) => views.linkCard({
            title: item.title,
            url: item.url,
            style: item.style,
            imageUrl: item.image ? assetHref(item.image) : '',
            icon: item.icon,
            tags: item.tags,
            body: markdown(item.description),
          })),
          studioEnabled && views.studioLinkCard(studioHref),
        ],
      }),
      fortune: fortune && { dom: fortune },
      notion: (answers.embedBlocks || []).map(embedBlockView),
    },
    // Image blocks stay attached to their configured anchors, falling back to the end.
    blocks: (answers.appearance.showImages === false ? [] : answers.imageBlocks || [])
      .map((item) => ({ placement: item.placement, view: imageBlockView(item, assetHref) })),
  });
  wrapper.append(viewToDom([
    views.profileHeader({
      displayName: answers.identity.displayName,
      title: answers.identity.title,
      location: answers.identity.location,
      tagline: answers.identity.tagline || [],
      avatarUrl: assetHref(assets.avatar || '/images/avatar.svg'),
      backgroundUrl: assetHref(assets.background || '/images/background.svg'),
      bio: markdown(answers.identity.bio),
    }),
    views.socials(answers.socials || []),
    home,
    views.footer({ name: answers.identity.displayName, studioEnabled, studioHref }),
  ]));

  const currentWrapper = root.querySelector(':scope > [data-profile-renderer]');
  const preservedSections = new Map();
  const preserveFeature = (previous, next) => {
    const previousSection = previous.closest('.custom-block');
    const nextSection = next.closest('.custom-block');
    if (!currentWrapper || previousSection?.parentElement !== currentWrapper || !nextSection) return;
    // Update copy around the interactive feature without detaching its iframe.
    for (const selector of ['h2', '.custom-block__content']) {
      const oldCopy = previousSection.querySelector(selector);
      const newCopy = nextSection.querySelector(selector);
      if (oldCopy && newCopy) oldCopy.replaceWith(newCopy);
    }
    preservedSections.set(nextSection, previousSection);
  };
  const nextTurntable = wrapper.querySelector('[data-turntable-player]');
  if (
    retainedTurntable
    && nextTurntable
    && retainedTurntable.dataset.playlistId === nextTurntable.dataset.playlistId
  ) {
    preserveFeature(retainedTurntable, nextTurntable);
  }

  const nextFortune = wrapper.querySelector('[data-fortune-draw]');
  const retainedFortuneData = retainedFortune?.querySelector('[data-fortune-data]')?.textContent;
  const nextFortuneData = nextFortune?.querySelector('[data-fortune-data]')?.textContent;
  if (retainedFortune && nextFortune && retainedFortuneData === nextFortuneData) {
    preserveFeature(retainedFortune, nextFortune);
  }

  if (currentWrapper) {
    const children = Array.from(wrapper.children, (child) => preservedSections.get(child) || child);
    const retainedSections = new Set(preservedSections.values());
    for (const child of Array.from(currentWrapper.children)) {
      if (!retainedSections.has(child)) child.remove();
    }
    for (const [index, child] of children.entries()) {
      const reference = currentWrapper.children[index] || null;
      if (reference === child) continue;
      // State-preserving moves also keep playback when section order changes.
      if (child.parentElement === currentWrapper && typeof currentWrapper.moveBefore === 'function') {
        currentWrapper.moveBefore(child, reference);
      } else currentWrapper.insertBefore(child, reference);
    }
    Object.assign(currentWrapper.dataset, wrapper.dataset);
  } else root.replaceChildren(wrapper);
  document.dispatchEvent(new CustomEvent('profile-renderer:updated', { detail: { root } }));
}
