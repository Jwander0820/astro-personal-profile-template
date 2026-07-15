import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HOME_SECTIONS = ['about', 'turntable', 'links', 'fortune', 'notion'];
const STARTER_SECTIONS = new Set(['about', 'live', 'music', 'projects']);
const STARTER_LINKS = new Set(['github', 'live-archive', 'monthly-playlist', 'projects']);
const SERVICE_DEFAULTS = {
  github: { title: 'GitHub', icon: 'github' },
  threads: { title: 'Threads', icon: 'threads' },
  instagram: { title: 'Instagram', icon: 'instagram' },
  linkedin: { title: 'LinkedIn', icon: 'linkedin' },
  youtube: { title: 'YouTube', icon: 'youtube' },
  spotify: { title: 'Spotify', icon: 'spotify' },
  youtubemusic: { title: 'YouTube Music', icon: 'youtubemusic' },
  notion: { title: 'Notion', icon: 'notion' },
  email: { title: 'Email', icon: 'mail' },
  website: { title: 'Website', icon: 'arrow' },
};

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
  if (!text || /[:#[\]{},&*!?|>'"%@`]|^[-?]|\s$|^\s/.test(text) || ['true', 'false', 'null'].includes(text)) {
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
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${label}格式不正確。`);
  return value.trim();
}

function assertSlug(value, label = 'ID') {
  const slug = assertText(value, label, { required: true, max: 48 }).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`${label}只能使用小寫英數字與連字號。`);
  return slug;
}

function assertUrl(value, label = '網址') {
  const url = assertText(value, label, { required: true, max: 500 });
  if (url.startsWith('mailto:') || url.startsWith('#')) return url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${label}必須是 http(s)、mailto 或頁面錨點。`);
  }
  return url;
}

function assertHttpUrl(value, label = '網址') {
  const url = assertText(value, label, { required: true, max: 500 });
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${label}必須是完整的 http(s) 網址。`);
  }
  return url;
}

export function extractYoutubePlaylistId(value) {
  const source = assertText(value, 'YouTube 播放清單', { required: true, max: 500 });
  if (/^[A-Za-z0-9_-]{10,}$/.test(source)) return source;
  try {
    const parsed = new URL(source);
    const playlistId = parsed.searchParams.get('list') ?? '';
    if (/^[A-Za-z0-9_-]{10,}$/.test(playlistId)) return playlistId;
  } catch {}
  throw new Error('請貼上 YouTube 播放清單網址，或輸入有效的 playlist ID。');
}

function assertStringArray(value, label, { min = 0, max = 12 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label}數量不正確。`);
  return value.map((item) => assertText(item, label, { required: true, max: 80 }));
}

function assertUnique(items, key, label) {
  const values = items.map((item) => item[key]);
  if (new Set(values).size !== values.length) throw new Error(`${label}不可重複。`);
  return items;
}

function assertImagePath(value, label) {
  const imagePath = assertText(value, label, { max: 300 });
  if (!imagePath) return '';
  if (!/^\/images\/[A-Za-z0-9._/-]+$/.test(imagePath) || imagePath.includes('..')) {
    throw new Error(`${label}必須是 /images/ 下的安全路徑。`);
  }
  return imagePath;
}

function safeFile(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ...segments);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('拒絕存取內容目錄以外的檔案。');
  }
  return resolved;
}

async function atomicWrite(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content, 'utf8');
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error;
    await writeFile(filePath, content, 'utf8');
    await unlink(temporaryPath).catch(() => {});
  }
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
  const [profile, links, sections, blocks] = await Promise.all([
    readMarkdownFile(profilePath),
    readCollection(contentRoot, 'links'),
    readCollection(contentRoot, 'sections'),
    readCollection(contentRoot, 'blocks'),
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
      fontScale: 1,
      smallTextScale: 1,
      ...profile.data,
      bio: profile.body,
    },
    links,
    sections,
    blocks,
  };
}

export async function saveStudioProfile(projectRoot, input) {
  if (!isObject(input)) throw new Error('個人資料格式不正確。');
  const contentRoot = safeFile(projectRoot, 'src', 'content');
  const profilePath = safeFile(contentRoot, 'profile', 'main.md');
  const current = await readMarkdownFile(profilePath);
  const tagline = assertStringArray(input.tagline, '關鍵字', { min: 1, max: 6 });
  const fontScale = Number(input.fontScale ?? current.data.fontScale ?? 1);
  const smallTextScale = Number(input.smallTextScale ?? current.data.smallTextScale ?? 1);
  if (fontScale < 0.9 || fontScale > 1.2) throw new Error('整體字級必須介於 0.9～1.2。');
  if (smallTextScale < 0.9 || smallTextScale > 1.35) throw new Error('小字比例必須介於 0.9～1.35。');
  const { name: _legacyName, ...currentData } = current.data;
  const next = {
    ...currentData,
    displayName: assertText(input.displayName, '顯示名稱', { required: true, max: 80 }),
    title: assertText(input.title, '一句話身分', { required: true, max: 120 }),
    location: assertText(input.location, '地點', { max: 100 }) || undefined,
    archiveLabel: assertText(input.archiveLabel, '封面標籤', { max: 100 }) || undefined,
    avatar: assertImagePath(input.avatar, '頭像') || undefined,
    background: assertImagePath(input.background, '背景圖片') || undefined,
    sectionsLayout: ['list', 'grid'].includes(input.sectionsLayout) ? input.sectionsLayout : 'grid',
    fontScale,
    smallTextScale,
    tagline,
  };
  const body = assertText(input.bio, '自我介紹', { required: true, max: 5000 });
  await atomicWrite(profilePath, stringifyMarkdown(next, body));
  return { ...next, bio: body };
}

export async function saveHomeOrder(projectRoot, input) {
  if (!Array.isArray(input) || input.length !== HOME_SECTIONS.length ||
      new Set(input).size !== HOME_SECTIONS.length || input.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('首頁順序必須包含全部五個板塊且不得重複。');
  }
  const profilePath = safeFile(projectRoot, 'src', 'content', 'profile', 'main.md');
  const current = await readMarkdownFile(profilePath);
  current.data.homeOrder = input;
  await atomicWrite(profilePath, stringifyMarkdown(current.data, current.body));
  return input;
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
  const current = await readMarkdownFile(profilePath);
  current.data.homeOrder = order;
  current.data.homeVisibility = visibility;
  current.data.aboutHeading = assertText(input.aboutHeading ?? current.data.aboutHeading ?? 'About me', 'About 標題', { required: true, max: 80 });
  current.data.linksHeading = assertText(input.linksHeading ?? current.data.linksHeading ?? 'Links', 'Links 標題', { required: true, max: 80 });
  await atomicWrite(profilePath, stringifyMarkdown(current.data, current.body));
  const blockVisibility = {
    turntable: visibility.includes('turntable'),
    fortune: visibility.includes('fortune'),
    'notion-embed': visibility.includes('notion'),
  };
  await Promise.all(Object.entries(blockVisibility).map(([id, visible]) => setVisible(projectRoot, 'blocks', id, visible)));
  return {
    homeOrder: order,
    homeVisibility: visibility,
    aboutHeading: current.data.aboutHeading,
    linksHeading: current.data.linksHeading,
  };
}

export async function saveStudioBlock(projectRoot, id, input) {
  const safeId = assertSlug(id, '板塊 ID');
  if (!['turntable', 'notion-embed', 'fortune'].includes(safeId)) throw new Error('這個首頁板塊目前不支援編輯。');
  if (!isObject(input)) throw new Error('板塊格式不正確。');
  const blockPath = safeFile(projectRoot, 'src', 'content', 'blocks', `${safeId}.md`);
  const current = await readMarkdownFile(blockPath);
  const body = assertText(input.body ?? current.body, '板塊說明', { max: 5000 });
  const common = {
    ...current.data,
    title: assertText(input.title ?? current.data.title, '板塊標題', { required: true, max: 80 }),
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
  await atomicWrite(blockPath, stringifyMarkdown(next, body));
  return { id: safeId, file: `blocks/${safeId}.md`, data: next, body };
}

export async function saveStudioSection(projectRoot, id, input) {
  const safeId = assertSlug(id, '卡片 ID');
  if (!isObject(input)) throw new Error('About 卡片格式不正確。');
  const sectionPath = safeFile(projectRoot, 'src', 'content', 'sections', `${safeId}.md`);
  let current = { data: {}, body: '' };
  try {
    current = await readMarkdownFile(sectionPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const order = Number(input.order ?? current.data.order ?? 100);
  if (!Number.isFinite(order) || order < 0 || order > 10000) throw new Error('卡片順序必須介於 0～10000。');
  const image = assertImagePath(input.image ?? current.data.image, '卡片圖片');
  const next = {
    ...current.data,
    title: assertText(input.title, '卡片標題', { required: true, max: 80 }),
    slug: assertSlug(input.slug ?? current.data.slug ?? safeId, '卡片 slug'),
    image: image || undefined,
    order,
    visible: input.visible === undefined ? Boolean(current.data.visible ?? true) : Boolean(input.visible),
    layout: ['card', 'compact'].includes(input.layout) ? input.layout : current.data.layout ?? 'card',
    tags: assertStringArray(input.tags ?? current.data.tags ?? [], '卡片標籤', { max: 8 }),
  };
  const body = assertText(input.body ?? current.body, '卡片內容', { max: 5000 });
  await atomicWrite(sectionPath, stringifyMarkdown(next, body));
  return { id: safeId, file: `sections/${safeId}.md`, data: next, body };
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
  let current = { data: {}, body: '' };
  try {
    current = await readMarkdownFile(linkPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
  const image = assertImagePath(input.image, '自訂 Icon');
  const tags = assertStringArray(input.tags ?? current.data.tags ?? [], '連結標籤', { max: 8 });
  const body = input.body === undefined
    ? current.body
    : assertText(input.body, '連結說明', { max: 3000 });
  const next = {
    ...current.data,
    title: assertText(input.title, '連結名稱', { required: true, max: 80 }),
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
  await atomicWrite(linkPath, stringifyMarkdown(next, body));
  return { id: safeId, file: `links/${safeId}.md`, data: next, body };
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
  await atomicWrite(filePath, stringifyMarkdown(data, body));
}

async function setVisible(projectRoot, collection, id, visible) {
  const filePath = safeFile(projectRoot, 'src', 'content', collection, `${assertSlug(id)}.md`);
  try {
    const current = await readMarkdownFile(filePath);
    current.data.visible = visible;
    await atomicWrite(filePath, stringifyMarkdown(current.data, current.body));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function validateProfileAnswers(input) {
  if (!isObject(input) || input.version !== 1) throw new Error('回答檔 version 必須為 1。');
  if (!isObject(input.identity)) throw new Error('回答檔缺少 identity。');
  const identity = {
    displayName: assertText(input.identity.displayName, '顯示名稱', { required: true, max: 80 }),
    title: assertText(input.identity.title, '一句話身分', { required: true, max: 120 }),
    location: assertText(input.identity.location, '地點', { max: 100 }),
    tagline: assertStringArray(input.identity.tagline, '關鍵字', { min: 1, max: 6 }),
    bio: assertText(input.identity.bio, '自我介紹', { required: true, max: 5000 }),
  };
  const socials = (input.socials ?? []).map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個社群連結格式不正確。`);
    const service = assertSlug(item.service, '社群服務');
    return {
      service,
      title: assertText(item.title, '社群名稱', { max: 80 }) || SERVICE_DEFAULTS[service]?.title || service,
      url: assertUrl(item.url, '社群網址'),
      icon: assertSlug(item.icon || SERVICE_DEFAULTS[service]?.icon || 'arrow', '圖示名稱'),
    };
  });
  const links = (input.links ?? []).map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個精選連結格式不正確。`);
    return {
      id: assertSlug(item.id, '精選連結 ID'),
      title: assertText(item.title, '精選連結名稱', { required: true, max: 80 }),
      url: assertUrl(item.url, '精選連結網址'),
      description: assertText(item.description, '精選連結說明', { required: true, max: 500 }),
      icon: assertSlug(item.icon || 'arrow', '圖示名稱'),
      tags: assertStringArray(item.tags ?? [], '精選連結標籤', { max: 6 }),
    };
  });
  const sections = (input.sections ?? []).map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個自介區塊格式不正確。`);
    return {
      id: assertSlug(item.id, '自介區塊 ID'),
      title: assertText(item.title, '自介區塊名稱', { required: true, max: 80 }),
      description: assertText(item.description, '自介區塊內容', { required: true, max: 2000 }),
      tags: assertStringArray(item.tags ?? [], '自介區塊標籤', { max: 8 }),
      image: assertText(item.image, '圖片路徑', { max: 300 }),
    };
  });
  assertUnique(socials, 'service', '社群服務');
  assertUnique(links, 'id', '精選連結 ID');
  assertUnique(sections, 'id', '自介區塊 ID');
  const appearance = isObject(input.appearance) ? input.appearance : {};
  const homeOrder = appearance.homeOrder ?? HOME_SECTIONS;
  if (!Array.isArray(homeOrder) || homeOrder.length !== 5 || new Set(homeOrder).size !== 5 || homeOrder.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('appearance.homeOrder 必須包含五個首頁板塊。');
  }
  const playlist = input.playlist === null || input.playlist === undefined ? null : {
    youtubePlaylistId: assertText(input.playlist.youtubePlaylistId, 'YouTube 播放清單 ID', { required: true, max: 100 }),
    title: assertText(input.playlist.title, '播放清單名稱', { max: 80 }) || 'PLAY！',
    description: assertText(input.playlist.description, '播放清單說明', { max: 500 }) || '按下唱針，隨機抽一首歌。',
  };
  if (playlist && !/^[A-Za-z0-9_-]{10,}$/.test(playlist.youtubePlaylistId)) throw new Error('YouTube 播放清單 ID 格式不正確。');
  return {
    identity,
    socials,
    links,
    sections,
    playlist,
    appearance: {
      sectionsLayout: appearance.sectionsLayout === 'list' ? 'list' : 'grid',
      homeOrder,
    },
    features: { fortune: input.features?.fortune !== false },
  };
}

export function previewProfileAnswers(rawInput) {
  const answers = validateProfileAnswers(rawInput);
  const warnings = [];
  if (answers.identity.location) warnings.push('location 會公開顯示在網站上，請確認只填入願意公開的國家或地區。');
  if (answers.socials.some((social) => social.url.startsWith('mailto:'))) warnings.push('回答包含公開 email 連結，套用前請確認地址可公開。');
  return {
    answers,
    summary: {
      displayName: answers.identity.displayName,
      title: answers.identity.title,
      hasLocation: Boolean(answers.identity.location),
      taglineCount: answers.identity.tagline.length,
      socialCount: answers.socials.length,
      socialServices: answers.socials.map((social) => social.title),
      linkCount: answers.links.length,
      linkTitles: answers.links.map((link) => link.title),
      sectionCount: answers.sections.length,
      sectionTitles: answers.sections.map((section) => section.title),
      playlistEnabled: Boolean(answers.playlist),
      fortuneEnabled: answers.features.fortune,
      homeOrder: answers.appearance.homeOrder,
    },
    warnings,
  };
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
    sectionsLayout: input.appearance.sectionsLayout,
  });
  await saveHomeOrder(projectRoot, input.appearance.homeOrder);

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
      style: index === 0 ? 'primary' : 'normal',
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
  await setVisible(projectRoot, 'blocks', 'fortune', input.features.fortune);
  return loadStudioContent(projectRoot);
}

export { HOME_SECTIONS };
