// One description of the public profile markup, shared by the formal Astro
// page (serialized to HTML at build time) and the Studio live preview (turned
// into DOM nodes in the browser). Change card structure, copy or attributes
// here so the two outputs cannot drift.
//
// A view is a plain tree:
//   'text'                      escaped text
//   { tag, attrs, children }    an element (see `h`)
//   { raw }                     trusted markup from the built-in icon catalog only
//   { slot }                    filled by an Astro slot on the formal page
//   { dom }                     an existing DOM node, preview only
import { embedFramePolicy, isSafeHttpUrl, isSafeInlineEmbedUrl, isSafeProfileUrl } from './content-safety.mjs';

export const HOME_SECTIONS = ['about', 'turntable', 'links', 'fortune', 'notion'];
export const SLOT_COMMENT = /<!--profile-slot:([a-z][a-z0-9-]*)-->/g;

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
const NAME_PATTERN = /^[a-z][a-z0-9:-]*$/i;

export function h(tag, attrs = {}, ...children) {
  return { tag, attrs: attrs ?? {}, children: flattenChildren(children) };
}

export const slot = (name) => ({ slot: name });
const raw = (html) => ({ raw: String(html ?? '') });

export function flattenChildren(children) {
  return [children].flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false && child !== '');
}

const escapeText = (value) => String(value).replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
const escapeAttribute = (value) => String(value).replace(/[&<>"]/g, (character) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]
));

export function viewToHtml(view) {
  if (Array.isArray(view)) return flattenChildren(view).map(viewToHtml).join('');
  if (view === null || view === undefined || view === false) return '';
  if (typeof view === 'string' || typeof view === 'number') return escapeText(view);
  if ('raw' in view) return view.raw;
  if ('slot' in view) {
    if (!/^[a-z][a-z0-9-]*$/.test(view.slot)) throw new Error(`Invalid view slot name: ${view.slot}`);
    return `<!--profile-slot:${view.slot}-->`;
  }
  if ('dom' in view) throw new Error('DOM nodes can only be rendered in the browser.');
  if (!NAME_PATTERN.test(view.tag)) throw new Error(`Invalid view tag: ${view.tag}`);
  let html = `<${view.tag}`;
  for (const [name, value] of Object.entries(view.attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (!NAME_PATTERN.test(name)) throw new Error(`Invalid view attribute: ${name}`);
    html += value === true ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`;
  }
  if (VOID_TAGS.has(view.tag)) return `${html}>`;
  return `${html}>${view.children.map(viewToHtml).join('')}</${view.tag}>`;
}

const classes = (...names) => names.filter(Boolean).join(' ');
const isExternal = (url) => String(url ?? '').startsWith('http');
const externalAttrs = (url) => (isExternal(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {});
const tagItems = (tags, tag) => (tags ?? []).map((item) => h(tag, {}, String(item)));
// URLs are validated upstream; this keeps a CSS url() literal closed regardless.
const cssUrl = (value) => (value && !/['"()\\\s\u0000-\u001f\u007f]/.test(value) ? `url('${value}')` : '');

export function embedLabel(provider) {
  if (provider === 'notion') return '在 Notion 開啟';
  if (provider === 'youtube') return '在 YouTube 開啟';
  return '開啟完整內容';
}

/** @param {Record<string, string>} icons */
export function createProfileViews(icons) {
  function icon(name, size = 22) {
    const body = Object.hasOwn(icons, name) ? icons[name] : icons.arrow;
    return h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false',
    }, raw(body));
  }

  /** @param {Record<string, any>} options */
  function profileHeader({ displayName, title, location, tagline = [], avatarUrl, backgroundUrl, bio }) {
    const cover = cssUrl(backgroundUrl);
    return h('header', { class: 'profile', style: cover ? `--cover-image: ${cover}` : undefined },
      h('div', { class: 'cover', 'aria-hidden': 'true' }),
      h('div', { class: 'profile-body' },
        avatarUrl
          ? h('img', { class: 'avatar', src: avatarUrl, alt: `${displayName} 的頭像`, width: 112, height: 112 })
          : h('span', { class: 'avatar avatar-fallback' }, String(displayName).slice(0, 2)),
        h('div', { class: 'identity' },
          h('h1', {}, displayName),
          location && h('p', { class: 'location' }, location)),
        title && h('p', { class: 'role' }, title),
        tagline.length > 0 && h('ul', { class: 'tagline-list', 'aria-label': '個人標籤' },
          tagline.map((item) => h('li', { class: 'tagline' }, String(item)))),
        h('div', { class: 'bio' }, bio)));
  }

  /** @param {Array<Record<string, any>>} items */
  function socials(items = []) {
    if (!items.length) return null;
    return h('nav', { class: 'socials', 'aria-label': '快速連結' }, items.map((item) => h('a', {
      href: isSafeProfileUrl(item.url) ? item.url : '#',
      'aria-label': `前往 ${item.title}`,
      title: item.title,
      ...externalAttrs(item.url),
    }, item.imageUrl
      ? h('img', { src: item.imageUrl, alt: '', width: 22, height: 22 })
      : icon(item.icon))));
  }

  /** @param {Record<string, any>} options */
  function sectionCard({ title, imageUrl, tags = [], body }) {
    return h('article', { class: classes('section-card', imageUrl ? 'section-card--with-image' : 'section-card--text-only') },
      imageUrl && h('img', { src: imageUrl, alt: '', loading: 'lazy' }),
      h('div', { class: 'section-copy' },
        h('h3', {}, title),
        h('div', {}, body),
        h('ul', {}, tagItems(tags, 'li'))));
  }

  /** @param {Record<string, any>} options */
  function aboutSection({ heading, layout, cards }) {
    return h('section', { class: 'content-section', 'aria-labelledby': 'about-heading' },
      h('h2', { id: 'about-heading' }, heading),
      h('div', { class: `section-list section-list--${layout === 'grid' ? 'grid' : 'list'}` }, cards));
  }

  /** @param {Record<string, any>} options */
  function linkCard({ title, url, style, imageUrl, icon: iconName, tags, body }) {
    const variant = ['primary', 'normal', 'subtle'].includes(style) ? style : 'normal';
    return h('a', { class: `link-card is-${variant}`, href: isSafeProfileUrl(url) ? url : '#', ...externalAttrs(url) },
      h('span', { class: 'link-icon' }, imageUrl
        ? h('img', { src: imageUrl, alt: '', width: 24, height: 24 })
        : icon(iconName, 24)),
      h('span', { class: 'link-copy' },
        h('strong', {}, title),
        h('span', { class: 'description' }, body),
        tags?.length > 0 && h('span', { class: 'tags' }, tagItems(tags, 'small'))),
      h('span', { class: 'link-arrow', 'aria-hidden': 'true' }, '›'));
  }

  // Platform navigation, not profile content: hidden inside the Studio preview.
  function studioLinkCard(href) {
    return h('a', { class: 'link-card is-studio', href, 'data-studio-link-card': '' },
      h('span', { class: 'link-icon' }, icon('code', 24)),
      h('span', { class: 'link-copy' },
        h('strong', {}, '建立你的自介網站'),
        h('span', { class: 'description' }, '開啟線上 Studio，邊修改邊預覽，再下載自己的設定檔。')),
      h('span', { class: 'link-arrow', 'aria-hidden': 'true' }, '›'));
  }

  /** @param {Record<string, any>} options */
  function linksSection({ heading, cards, studioOnly = false }) {
    return h('section', {
      class: 'content-section',
      'aria-labelledby': 'links-heading',
      'data-studio-only-section': studioOnly ? '' : undefined,
    },
    h('h2', { id: 'links-heading' }, heading),
    h('div', { class: 'link-list' }, cards));
  }

  /** @param {Record<string, any>} options */
  function embedParts({ title, embed }) {
    if (!embed?.url) return [];
    const label = embedLabel(embed.provider);
    const url = isSafeHttpUrl(embed.url) ? embed.url : '#';
    // An inline embed that fails the destination guard degrades to a plain link.
    if (embed.mode === 'inline' && isSafeInlineEmbedUrl(url)) {
      const policy = embedFramePolicy(embed.provider);
      return [
        h('div', { class: 'custom-block__embed' }, h('iframe', {
          // sandbox precedes src so the first navigation is already confined.
          sandbox: policy.sandbox,
          src: url,
          title,
          height: embed.height || 600,
          loading: 'lazy',
          referrerpolicy: 'strict-origin-when-cross-origin',
          allow: policy.allow,
          allowfullscreen: true,
        })),
        h('a', { class: 'custom-block__embed-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, `${label} ↗`),
      ];
    }
    return [h('a', {
      class: 'custom-block__embed-preview',
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': `${label}：${title}`,
    },
    h('span', { class: 'custom-block__embed-kicker' }, 'Personal archive'),
    h('strong', {}, `查看完整的 ${title}`),
    h('span', { class: 'custom-block__embed-cta' }, `${label} `, h('span', { 'aria-hidden': 'true' }, '↗')))];
  }

  // `id` is the content entry id, so formal and preview headings share anchors.
  /** @param {Record<string, any>} options */
  function customBlock({ id, layout = 'card', title, image, body, feature, embed, tags = [] }) {
    const isImage = layout === 'image';
    const headingId = `block-${id}`;
    return h('section', { class: `content-section custom-block custom-block--${layout}`, 'aria-labelledby': headingId },
      h('h2', { id: headingId }, title),
      h('div', {
        class: classes('custom-block__body', isImage && `image-block--${image?.layout}`, isImage && `image-block--${image?.aspect}`),
        style: isImage ? `--image-position: ${String(image?.position || 'center').replace('-', ' ')};` : undefined,
      },
      image?.url && h('img', { src: image.url, alt: image.alt ?? '', loading: 'lazy' }),
      h('div', { class: 'custom-block__content' }, body),
      feature,
      layout === 'embed' && embedParts({ title, embed }),
      tags.length > 0 && h('ul', {}, tagItems(tags, 'li'))));
  }

  /** @param {Record<string, any>} options */
  function footer({ name, year = new Date().getFullYear(), studioEnabled = false, studioHref }) {
    return h('footer', {},
      h('span', {}, `© ${year} ${name}`),
      studioEnabled && h('a', { class: 'footer-studio-link', href: studioHref },
        h('span', { 'aria-hidden': 'true' }, '↗'), ' 線上 Studio'));
  }

  return { icon, profileHeader, socials, sectionCard, aboutSection, linkCard, studioLinkCard, linksSection, customBlock, footer };
}

// Order the home page. `parts` holds what each section renders (a view, a list
// of views, or nothing); `blocks` are free-standing blocks anchored to a
// section, which fall back to the end when their anchor is hidden.
/** @param {{ sections: string[], parts: Record<string, any>, blocks?: Array<{ placement: string, view: any }> }} options */
export function arrangeHome({ sections, parts, blocks = [] }) {
  const visible = sections.filter((id) => HOME_SECTIONS.includes(id));
  const placed = (placement) => blocks.filter((block) => block.placement === placement).map((block) => block.view);
  const items = [];
  for (const id of visible) {
    if (id === 'links') items.push(placed('before-links'));
    items.push(parts[id]);
    if (id === 'links') items.push(placed('between-links-sections'));
    if (id === 'about') items.push(placed('after-sections'));
  }
  items.push(blocks.filter((block) => (
    block.placement === 'after-sections' ? !visible.includes('about') : !visible.includes('links')
  )).map((block) => block.view));
  return flattenChildren(items);
}
