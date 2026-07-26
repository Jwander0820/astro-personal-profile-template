import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isSafeHttpUrl, isSafeImageSource, isSafeProfileUrl } from './content-safety.mjs';
import { atomicWriteText, withFileWriteLock } from './file-writes.mjs';
import { loadFortuneBucket, replaceFortuneBucket } from './fortune-content.mjs';
import { coerceDisplayText } from './text-values.mjs';
import { assertThemeColor, DEFAULT_THEME_COLOR } from './theme-color.mjs';
import {
  extractYoutubePlaylistId,
  FONT_PRESETS,
  HOME_SECTIONS,
  IMAGE_BLOCK_ASPECTS,
  IMAGE_BLOCK_LAYOUTS,
  IMAGE_BLOCK_PLACEMENTS,
  IMAGE_BLOCK_POSITIONS,
  EMBED_BLOCK_MODES,
  EMBED_BLOCK_PROVIDERS,
  previewProfileAnswers,
  validateProfileAnswers,
} from './profile-answers.mjs';

const STARTER_SECTIONS = new Set(['about', 'live', 'music', 'projects']);
const STARTER_LINKS = new Set(['github', 'live-archive', 'monthly-playlist', 'projects']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function splitInlineList(value) {
  const items = [];
  let current = '';
  let quote = '';
  for (const character of value) {
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? '' : character;
      current += character;
    } else if (character === ',' && !quote) {
      items.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return splitInlineList(value.slice(1, -1)).map(parseScalar);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    if (value.startsWith('"')) {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value.replace(/\s+#.*$/, '').trim();
}

export function parseMarkdown(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error('Markdown 檔案缺少有效的 frontmatter。');
  const data = {};
  let activeKey = null;
  for (const rawLine of match[1].split('\n')) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const listItem = rawLine.match(/^\s+-\s+(.+)$/);
    if (listItem && activeKey) {
      if (!Array.isArray(data[activeKey])) data[activeKey] = [];
      data[activeKey].push(parseScalar(listItem[1]));
      continue;
    }
    const field = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!field) continue;
    activeKey = field[1];
    data[activeKey] = field[2]?.trim() ? parseScalar(field[2]) : [];
  }
  return { data, body: match[2].replace(/^\n/, '').replace(/\s+$/, '') };
}

function formatScalar(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('無法寫入非有限數值。');
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  const text = String(value);
  const resemblesTypedScalar = /^-?\d+(?:\.\d+)?$/.test(text) || ['true', 'false', 'null', '~'].includes(text);
  if (!text || resemblesTypedScalar || /[:#[\]{},&*!?|>'"%@`]|^[-?]|\s$|^\s/.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

export function stringifyMarkdown(data, body = '') {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${key}: []`);
      else if (value.every((item) => String(item).length < 28 && !String(item).includes(','))) {
        lines.push(`${key}: [${value.map(formatScalar).join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        value.forEach((item) => lines.push(`  - ${formatScalar(item)}`));
      }
    } else {
      lines.push(`${key}: ${formatScalar(value)}`);
    }
  }
  lines.push('---', '');
  if (body.trim()) lines.push(body.trim(), '');
  return lines.join('\n');
}

function assertText(value, label, { required = false, max = 5000 } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(`${label}為必填欄位。`);
    return '';
  }
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label}格式不正確。`);
  const text = value.trim();
  if (required && !text) throw new Error(`${label}為必填欄位。`);
  return text;
}

function assertDisplayText(value, label, options) {
  return assertText(coerceDisplayText(value), label, options);
}

function assertSlug(value, label = 'ID') {
  const slug = assertText(value, label, { required: true, max: 48 }).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`${label}只能使用小寫英數字與連字號。`);
  return slug;
}

function assertUrl(value, label = '網址') {
  const url = assertText(value, label, { required: true, max: 500 });
  if (!isSafeProfileUrl(url)) {
    throw new Error(`${label}必須是 http(s)、mailto 或頁面錨點。`);
  }
  return url;
}

function assertProvidedDisplayText(value, label, { max = 5000 } = {}) {
  if (value === undefined) return '';
  if (value === null) throw new Error(`${label}格式不正確。`);
  return assertDisplayText(value, label, { max });
}

function assertHttpUrl(value, label = '網址') {
  const url = assertText(value, label, { required: true, max: 500 });
  if (!isSafeHttpUrl(url)) {
    throw new Error(`${label}必須是完整的 http(s) 網址。`);
  }
  return url;
}

function assertStringArray(value, label, { min = 0, max = 12 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label}數量不正確。`);
  return value.map((item) => assertDisplayText(item, label, { required: true, max: 80 }));
}

function assertUnique(items, key, label) {
  const values = items.map((item) => item[key]);
  if (new Set(values).size !== values.length) throw new Error(`${label}不可重複。`);
  return items;
}

function assertImageSource(value, label, { required = false } = {}) {
  const imageSource = assertText(value, label, { required, max: 2048 });
  if (!imageSource) return '';
  if (!isSafeImageSource(imageSource)) {
    throw new Error(`${label}必須是 /images/ 下的安全路徑或公開 HTTPS 圖片網址。`);
  }
  return imageSource;
}

function safeFile(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ...segments);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('拒絕存取內容目錄以外的檔案。');
  }
  return resolved;
}

async function readMarkdownFile(filePath) {
  return parseMarkdown(await readFile(filePath, 'utf8'));
}

async function readCollection(contentRoot, collection) {
  const directory = safeFile(contentRoot, collection);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(names.map(async (name) => {
    const filePath = safeFile(directory, name);
    return { id: name.slice(0, -3), file: `${collection}/${name}`, ...await readMarkdownFile(filePath) };
  }));
}

export async function loadStudioContent(projectRoot) {
  const contentRoot = safeFile(projectRoot, 'src', 'content');
  const profilePath = safeFile(contentRoot, 'profile', 'main.md');
  const [profile, links, sections, blocks, fortuneBucket] = await Promise.all([
    readMarkdownFile(profilePath),
    readCollection(contentRoot, 'links'),
    readCollection(contentRoot, 'sections'),
    readCollection(contentRoot, 'blocks'),
    loadFortuneBucket(projectRoot),
  ]);
  const defaultVisibility = HOME_SECTIONS.filter((id) => {
    const blockId = id === 'notion' ? 'notion-embed' : id;
    if (!['turntable', 'fortune', 'notion'].includes(id)) return true;
    return blocks.find((block) => block.id === blockId)?.data.visible !== false;
  });
  return {
    profile: {
      homeOrder: HOME_SECTIONS,
      homeVisibility: defaultVisibility,
      aboutHeading: 'About me',
      linksHeading: 'Links',
      sectionsLayout: 'list',
      bodyFont: 'system',
      displayFont: 'system',
      mainColor: DEFAULT_THEME_COLOR,
      fontScale: 1,
      smallTextScale: 1,
      ...profile.data,
      bio: profile.body,
    },
    links,
    sections,
    blocks,
    fortunes: fortuneBucket.fortunes,
    fortuneRevision: fortuneBucket.revision,
    fortuneSummary: fortuneBucket.summary,
  };
}

export async function saveStudioProfile(projectRoot, input) {
  if (!isObject(input)) throw new Error('個人資料格式不正確。');
  const contentRoot = safeFile(projectRoot, 'src', 'content');
  const profilePath = safeFile(contentRoot, 'profile', 'main.md');
  return updateMarkdownFile(profilePath, async (current) => {
    const tagline = assertStringArray(input.tagline ?? [], '關鍵字', { max: 6 });
    const fontScale = Number(input.fontScale ?? current.data.fontScale ?? 1);
    const smallTextScale = Number(input.smallTextScale ?? current.data.smallTextScale ?? 1);
    const bodyFont = FONT_PRESETS.includes(input.bodyFont) ? input.bodyFont : current.data.bodyFont ?? 'system';
    const displayFont = FONT_PRESETS.includes(input.displayFont) ? input.displayFont : current.data.displayFont ?? 'system';
    const mainColor = assertThemeColor(input.mainColor ?? current.data.mainColor ?? DEFAULT_THEME_COLOR);
    if (fontScale < 0.9 || fontScale > 1.2) throw new Error('整體字級必須介於 0.9～1.2。');
    if (smallTextScale < 0.9 || smallTextScale > 1.35) throw new Error('小字比例必須介於 0.9～1.35。');
    const { name: _legacyName, ...currentData } = current.data;
    const next = {
      ...currentData,
      displayName: assertDisplayText(input.displayName, '顯示名稱', { required: true, max: 80 }),
      title: assertDisplayText(input.title, '一句話身分', { max: 120 }) || undefined,
      location: assertDisplayText(input.location, '地點', { max: 100 }) || undefined,
      archiveLabel: assertDisplayText(input.archiveLabel, '封面標籤', { max: 100 }) || undefined,
      avatar: assertImageSource(input.avatar, '頭像') || undefined,
      background: assertImageSource(input.background, '背景圖片') || undefined,
      sectionsLayout: ['list', 'grid'].includes(input.sectionsLayout) ? input.sectionsLayout : 'grid',
      bodyFont,
      displayFont,
      mainColor,
      fontScale,
      smallTextScale,
      tagline: tagline.length > 0 ? tagline : undefined,
    };
    const body = assertProvidedDisplayText(input.bio, '自我介紹', { max: 5000 });
    return { data: next, body, result: { ...next, bio: body } };
  });
}

export async function saveHomeOrder(projectRoot, input) {
  if (!Array.isArray(input) || input.length !== HOME_SECTIONS.length ||
      new Set(input).size !== HOME_SECTIONS.length || input.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('首頁順序必須包含全部五個板塊且不得重複。');
  }
  const profilePath = safeFile(projectRoot, 'src', 'content', 'profile', 'main.md');
  return updateMarkdownFile(profilePath, async (current) => ({
    data: { ...current.data, homeOrder: input },
    body: current.body,
    result: input,
  }));
}

export async function saveHomeSettings(projectRoot, input) {
  if (!isObject(input)) throw new Error('首頁板塊設定格式不正確。');
  const order = input.homeOrder ?? input.order;
  if (!Array.isArray(order) || order.length !== HOME_SECTIONS.length ||
      new Set(order).size !== HOME_SECTIONS.length || order.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('首頁順序必須包含全部五個板塊且不得重複。');
  }
  const visibility = input.homeVisibility ?? HOME_SECTIONS;
  if (!Array.isArray(visibility) || new Set(visibility).size !== visibility.length ||
      visibility.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('首頁板塊顯示設定包含不支援的項目。');
  }
  const profilePath = safeFile(projectRoot, 'src', 'content', 'profile', 'main.md');
  const profile = await updateMarkdownFile(profilePath, async (current) => {
    const data = {
      ...current.data,
      homeOrder: order,
      homeVisibility: visibility,
      aboutHeading: assertDisplayText(input.aboutHeading ?? current.data.aboutHeading ?? 'About me', 'About 標題', { required: true, max: 80 }),
      linksHeading: assertDisplayText(input.linksHeading ?? current.data.linksHeading ?? 'Links', 'Links 標題', { required: true, max: 80 }),
    };
    return { data, body: current.body, result: data };
  });
  const blockVisibility = {
    turntable: visibility.includes('turntable'),
    fortune: visibility.includes('fortune'),
  };
  await Promise.all(Object.entries(blockVisibility).map(([id, visible]) => setVisible(projectRoot, 'blocks', id, visible)));
  return {
    homeOrder: order,
    homeVisibility: visibility,
    aboutHeading: profile.aboutHeading,
    linksHeading: profile.linksHeading,
  };
}

export async function saveStudioBlock(projectRoot, id, input) {
  const safeId = assertSlug(id, '板塊 ID');
  if (!['turntable', 'notion-embed', 'fortune'].includes(safeId)) throw new Error('這個首頁板塊目前不支援編輯。');
  if (!isObject(input)) throw new Error('板塊格式不正確。');
  const blockPath = safeFile(projectRoot, 'src', 'content', 'blocks', `${safeId}.md`);
  return updateMarkdownFile(blockPath, async (current) => {
    const body = assertDisplayText(input.body ?? current.body, '板塊說明', { max: 5000 });
    const common = {
      ...current.data,
      title: assertDisplayText(input.title ?? current.data.title, '板塊標題', { required: true, max: 80 }),
      visible: input.visible === undefined ? Boolean(current.data.visible) : Boolean(input.visible),
    };
    let next;
    if (safeId === 'turntable') {
      next = {
        ...common,
        layout: 'turntable',
        provider: 'youtube',
        playlistId: extractYoutubePlaylistId(input.playlist ?? input.playlistId ?? current.data.playlistId),
        continuousPlayback: input.continuousPlayback === undefined
          ? Boolean(current.data.continuousPlayback)
          : Boolean(input.continuousPlayback),
      };
    } else if (safeId === 'notion-embed') {
      const height = Number(input.height ?? current.data.height ?? 600);
      if (!Number.isInteger(height) || height < 320 || height > 1200) throw new Error('Notion 預覽高度必須介於 320～1200。');
      next = {
        ...common,
        layout: 'embed',
        provider: 'notion',
        url: assertHttpUrl(input.url ?? current.data.url, 'Notion 公開頁面網址'),
        embedMode: ['preview', 'inline'].includes(input.embedMode) ? input.embedMode : 'preview',
        height,
      };
    } else {
      next = { ...common, layout: 'fortune' };
    }
    const result = { id: safeId, file: `blocks/${safeId}.md`, data: next, body };
    return { data: next, body, result };
  });
}

export async function saveStudioSection(projectRoot, id, input) {
  const safeId = assertSlug(id, '卡片 ID');
  if (!isObject(input)) throw new Error('About 卡片格式不正確。');
  const sectionPath = safeFile(projectRoot, 'src', 'content', 'sections', `${safeId}.md`);
  return updateMarkdownFile(sectionPath, async (current) => {
    const order = Number(input.order ?? current.data.order ?? 100);
    if (!Number.isFinite(order) || order < 0 || order > 10000) throw new Error('卡片順序必須介於 0～10000。');
    const image = assertImageSource(input.image ?? current.data.image, '卡片圖片');
    const next = {
      ...current.data,
      title: assertDisplayText(input.title, '卡片標題', { required: true, max: 80 }),
      slug: assertSlug(input.slug ?? current.data.slug ?? safeId, '卡片 slug'),
      image: image || undefined,
      order,
      visible: input.visible === undefined ? Boolean(current.data.visible ?? true) : Boolean(input.visible),
      layout: ['card', 'compact'].includes(input.layout) ? input.layout : current.data.layout ?? 'card',
      tags: assertStringArray(input.tags ?? current.data.tags ?? [], '卡片標籤', { max: 8 }),
    };
    const body = assertDisplayText(input.body ?? current.body, '卡片內容', { max: 5000 });
    const result = { id: safeId, file: `sections/${safeId}.md`, data: next, body };
    return { data: next, body, result };
  }, { allowMissing: true });
}

export async function createStudioSection(projectRoot, input) {
  if (!isObject(input)) throw new Error('新卡片格式不正確。');
  const id = input.id ? assertSlug(input.id, '卡片 ID') : `studio-section-${Date.now().toString(36)}`;
  return saveStudioSection(projectRoot, id, input);
}

export async function saveStudioLink(projectRoot, id, input) {
  const safeId = assertSlug(id, '連結 ID');
  if (!isObject(input)) throw new Error('連結格式不正確。');
  const linkPath = safeFile(projectRoot, 'src', 'content', 'links', `${safeId}.md`);
  return updateMarkdownFile(linkPath, async (current) => {
    const group = ['social', 'main', 'featured', 'footer'].includes(input.group)
      ? input.group
      : current.data.group ?? 'featured';
    const layout = ['icon', 'card', 'compact'].includes(input.layout)
      ? input.layout
      : current.data.layout ?? (group === 'social' ? 'icon' : 'card');
    const style = ['primary', 'normal', 'subtle'].includes(input.style)
      ? input.style
      : current.data.style ?? 'normal';
    const order = Number(input.order ?? current.data.order ?? 100);
    if (!Number.isFinite(order) || order < 0 || order > 10000) throw new Error('連結順序必須介於 0～10000。');
    const image = assertImageSource(input.image, '自訂 Icon');
    const tags = assertStringArray(input.tags ?? current.data.tags ?? [], '連結標籤', { max: 8 });
    const body = input.body === undefined
      ? current.body
      : assertDisplayText(input.body, '連結說明', { max: 3000 });
    const next = {
      ...current.data,
      title: assertDisplayText(input.title, '連結名稱', { required: true, max: 80 }),
      url: assertUrl(input.url),
      icon: assertSlug(input.icon ?? current.data.icon ?? 'arrow', 'Icon 名稱'),
      group,
      order,
      visible: Boolean(input.visible),
      layout,
      style,
      image: image || undefined,
      tags,
    };
    const result = { id: safeId, file: `links/${safeId}.md`, data: next, body };
    return { data: next, body, result };
  }, { allowMissing: true });
}

export async function createStudioLink(projectRoot, input) {
  if (!isObject(input)) throw new Error('新連結格式不正確。');
  const id = input.id
    ? assertSlug(input.id, '連結 ID')
    : `studio-link-${Date.now().toString(36)}`;
  return saveStudioLink(projectRoot, id, input);
}

async function upsertMarkdown(projectRoot, collection, id, data, body) {
  const filePath = safeFile(projectRoot, 'src', 'content', collection, `${assertSlug(id)}.md`);
  await withFileWriteLock(filePath, () => atomicWriteText(filePath, stringifyMarkdown(data, body)));
}

async function setVisible(projectRoot, collection, id, visible) {
  const filePath = safeFile(projectRoot, 'src', 'content', collection, `${assertSlug(id)}.md`);
  try {
    await updateMarkdownFile(filePath, async (current) => ({
      data: { ...current.data, visible },
      body: current.body,
      result: undefined,
    }));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function updateMarkdownFile(filePath, update, { allowMissing = false } = {}) {
  return withFileWriteLock(filePath, async () => {
    let current;
    try {
      current = await readMarkdownFile(filePath);
    } catch (error) {
      if (!allowMissing || error.code !== 'ENOENT') throw error;
      current = { data: {}, body: '' };
    }
    const mutation = await update(current);
    await atomicWriteText(filePath, stringifyMarkdown(mutation.data, mutation.body));
    return mutation.result;
  });
}

export async function saveStudioImageBlock(projectRoot, id, input) {
  const safeId = assertSlug(id, '圖片板塊 ID');
  if (!isObject(input)) throw new Error('圖片板塊格式不正確。');
  const blockPath = safeFile(projectRoot, 'src', 'content', 'blocks', `${safeId}.md`);
  return updateMarkdownFile(blockPath, async (current) => {
    if (current.data.layout && current.data.layout !== 'image') throw new Error('這個 ID 已被其他板塊使用。');
    const order = Number(input.order ?? current.data.order ?? 100);
    if (!Number.isFinite(order) || order < 0 || order > 10000) throw new Error('圖片板塊順序必須介於 0～10000。');
    const next = {
      ...current.data,
      title: assertDisplayText(input.title ?? current.data.title, '圖片板塊標題', { required: true, max: 80 }),
      placement: IMAGE_BLOCK_PLACEMENTS.includes(input.placement) ? input.placement : current.data.placement ?? 'after-sections',
      order,
      visible: input.visible === undefined ? Boolean(current.data.visible ?? true) : Boolean(input.visible),
      layout: 'image',
      image: assertImageSource(input.image ?? current.data.image, '圖片來源'),
      imageAlt: assertDisplayText(input.imageAlt ?? current.data.imageAlt, '圖片替代文字', { max: 300 }),
      imageLayout: IMAGE_BLOCK_LAYOUTS.includes(input.imageLayout) ? input.imageLayout : current.data.imageLayout ?? 'full',
      imageAspect: IMAGE_BLOCK_ASPECTS.includes(input.imageAspect) ? input.imageAspect : current.data.imageAspect ?? 'landscape',
      imagePosition: IMAGE_BLOCK_POSITIONS.includes(input.imagePosition) ? input.imagePosition : current.data.imagePosition ?? 'center',
      tags: assertStringArray(input.tags ?? current.data.tags ?? [], '圖片板塊標籤', { max: 8 }),
    };
    if (!next.image) throw new Error('圖片板塊必須選擇圖片。');
    const body = assertDisplayText(input.body ?? current.body, '圖片板塊文字', { max: 5000 });
    const result = { id: safeId, file: `blocks/${safeId}.md`, data: next, body };
    return { data: next, body, result };
  }, { allowMissing: true });
}

export async function createStudioImageBlock(projectRoot, input) {
  if (!isObject(input)) throw new Error('新圖片板塊格式不正確。');
  const id = input.id
    ? assertSlug(input.id, '圖片板塊 ID')
    : `studio-image-${Date.now().toString(36)}`;
  return saveStudioImageBlock(projectRoot, id, input);
}

export async function saveStudioSocialOrder(projectRoot, input) {
  if (!isObject(input) || !Array.isArray(input.links) || input.links.length < 2) {
    throw new Error('社群排序至少需要兩個連結。');
  }
  const ids = input.links.map((item) => assertSlug(item?.id, '社群連結 ID'));
  assertUnique(ids.map((id) => ({ id })), 'id', '社群連結');
  return Promise.all(input.links.map(async (item, index) => {
    const id = ids[index];
    const linkPath = safeFile(projectRoot, 'src', 'content', 'links', `${id}.md`);
    const order = Number(item.order);
    if (!Number.isFinite(order) || order < 0 || order > 10000) throw new Error('社群排序必須介於 0 到 10000。');
    return updateMarkdownFile(linkPath, async (current) => {
      if (current.data.group !== 'social') throw new Error(`${id} 不是社群連結。`);
      const data = { ...current.data, order };
      return {
        data,
        body: current.body,
        result: { id, file: `links/${id}.md`, data, body: current.body },
      };
    });
  }));
}

export async function applyProfileAnswers(projectRoot, rawInput) {
  const input = validateProfileAnswers(rawInput);
  const current = await loadStudioContent(projectRoot);
  await saveStudioProfile(projectRoot, {
    ...current.profile,
    displayName: input.identity.displayName,
    title: input.identity.title,
    location: input.identity.location,
    tagline: input.identity.tagline,
    bio: input.identity.bio,
    avatar: input.media.avatar,
    background: input.media.background,
    sectionsLayout: input.appearance.sectionsLayout,
    bodyFont: input.appearance.bodyFont,
    displayFont: input.appearance.displayFont,
    mainColor: input.appearance.mainColor,
  });

  for (const link of current.links.filter((item) => item.data.group === 'social')) {
    await setVisible(projectRoot, 'links', link.id, false);
  }
  for (const [index, social] of input.socials.entries()) {
    await upsertMarkdown(projectRoot, 'links', `generated-social-${social.service}`, {
      title: social.title,
      url: social.url,
      icon: social.icon,
      group: 'social',
      order: (index + 1) * 10,
      visible: true,
      layout: 'icon',
      style: 'normal',
    }, '');
  }

  for (const link of current.links.filter((item) => item.id.startsWith('generated-link-'))) {
    await setVisible(projectRoot, 'links', link.id, false);
  }
  for (const link of current.links.filter((item) => STARTER_LINKS.has(item.id))) {
    await setVisible(projectRoot, 'links', link.id, false);
  }
  for (const [index, link] of input.links.entries()) {
    await upsertMarkdown(projectRoot, 'links', `generated-link-${link.id}`, {
      title: link.title,
      url: link.url,
      icon: link.icon,
      group: 'featured',
      order: (index + 1) * 10,
      visible: true,
      layout: 'card',
      style: link.style,
      tags: link.tags,
    }, link.description);
  }

  for (const section of current.sections) {
    if (STARTER_SECTIONS.has(section.id) || section.id.startsWith('generated-')) {
      await setVisible(projectRoot, 'sections', section.id, false);
    }
  }
  for (const [index, section] of input.sections.entries()) {
    await upsertMarkdown(projectRoot, 'sections', `generated-${section.id}`, {
      title: section.title,
      slug: section.id,
      ...(section.image ? { image: section.image } : {}),
      order: (index + 1) * 10,
      visible: true,
      layout: 'card',
      tags: section.tags,
    }, section.description);
  }

  for (const block of current.blocks.filter((item) => item.id.startsWith('generated-image-'))) {
    await setVisible(projectRoot, 'blocks', block.id, false);
  }
  for (const [index, block] of input.imageBlocks.entries()) {
    await upsertMarkdown(projectRoot, 'blocks', `generated-image-${block.id}`, {
      title: block.title,
      placement: block.placement,
      order: (index + 1) * 10,
      visible: true,
      layout: 'image',
      image: block.image,
      imageAlt: block.imageAlt,
      imageLayout: block.imageLayout,
      imageAspect: block.imageAspect,
      imagePosition: block.imagePosition,
      tags: block.tags,
    }, block.description);
  }

  for (const block of current.blocks.filter((item) => item.data.layout === 'embed')) {
    await setVisible(projectRoot, 'blocks', block.id, false);
  }
  for (const [index, block] of input.embedBlocks.entries()) {
    await upsertMarkdown(projectRoot, 'blocks', `generated-embed-${block.id}`, {
      title: block.title,
      placement: 'after-sections',
      order: (index + 1) * 10,
      visible: true,
      layout: 'embed',
      provider: EMBED_BLOCK_PROVIDERS.includes(block.provider) ? block.provider : 'website',
      url: block.url,
      embedMode: EMBED_BLOCK_MODES.includes(block.embedMode) ? block.embedMode : 'preview',
      height: block.height,
      tags: block.tags,
    }, block.description);
  }

  if (input.playlist) {
    await upsertMarkdown(projectRoot, 'blocks', 'turntable', {
      title: input.playlist.title,
      placement: 'after-sections',
      order: 5,
      visible: true,
      layout: 'turntable',
      provider: 'youtube',
      playlistId: input.playlist.youtubePlaylistId,
      continuousPlayback: true,
      tags: [],
    }, input.playlist.description);
  } else {
    await setVisible(projectRoot, 'blocks', 'turntable', false);
  }
  if (input.fortune) {
    await upsertMarkdown(projectRoot, 'blocks', 'fortune', {
      title: input.fortune.title,
      placement: 'after-sections',
      order: 10,
      visible: input.features.fortune,
      layout: 'fortune',
      tags: [],
    }, input.fortune.description);
    await replaceFortuneBucket(projectRoot, input.fortune.fortunes);
  } else {
    await setVisible(projectRoot, 'blocks', 'fortune', input.features.fortune);
  }
  const nextContent = await loadStudioContent(projectRoot);
  const homeVisibility = [];
  if (nextContent.sections.some((section) => section.data.visible)) homeVisibility.push('about');
  if (nextContent.blocks.some((block) => block.id === 'turntable' && block.data.visible)) homeVisibility.push('turntable');
  if (nextContent.links.some((link) => ['main', 'featured'].includes(link.data.group) && link.data.visible)) homeVisibility.push('links');
  if (nextContent.blocks.some((block) => block.id === 'fortune' && block.data.visible)) homeVisibility.push('fortune');
  if (nextContent.blocks.some((block) => block.data.layout === 'embed' && block.data.visible)) homeVisibility.push('notion');
  await saveHomeSettings(projectRoot, {
    homeOrder: input.appearance.homeOrder,
    homeVisibility,
    aboutHeading: current.profile.aboutHeading,
    linksHeading: current.profile.linksHeading,
  });
  return loadStudioContent(projectRoot);
}

export {
  extractYoutubePlaylistId,
  HOME_SECTIONS,
  previewProfileAnswers,
  validateProfileAnswers,
};
