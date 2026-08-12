import { isSafeHttpUrl, isSafeImageSource, isSafeProfileUrl } from './content-safety.mjs';
import { validateFortuneBucket } from './fortune-schema.mjs';
import { assertThemeColor } from './theme-color.mjs';
import { coerceDisplayText } from './text-values.mjs';
import { parseYoutubePlaylistId } from './youtube-playlist.mjs';
import { normalizeEmbedSource } from './embed-source.mjs';
import {
  APPEARANCE_DEFAULTS,
  APPEARANCE_RANGES,
  APPLY_MODES,
  EMBED_BLOCK_MODES,
  EMBED_BLOCK_PROVIDERS,
  EMBED_URL_MAX_LENGTH,
  FONT_PRESETS,
  HOME_SECTIONS,
  IMAGE_BLOCK_ASPECTS,
  IMAGE_BLOCK_LAYOUTS,
  IMAGE_BLOCK_PLACEMENTS,
  IMAGE_BLOCK_POSITIONS,
  LINK_STYLES,
  PROFILE_ANSWER_VERSION,
} from './profile-contract.mjs';

export {
  APPEARANCE_DEFAULTS,
  APPEARANCE_RANGES,
  APPLY_MODES,
  EMBED_BLOCK_MODES,
  EMBED_BLOCK_PROVIDERS,
  FONT_PRESETS,
  HOME_SECTIONS,
  IMAGE_BLOCK_ASPECTS,
  IMAGE_BLOCK_LAYOUTS,
  IMAGE_BLOCK_PLACEMENTS,
  IMAGE_BLOCK_POSITIONS,
  LINK_STYLES,
  PROFILE_ANSWER_VERSION,
};

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

function assertProvidedDisplayText(value, label, { max = 5000 } = {}) {
  if (value === undefined) return '';
  if (value === null) throw new Error(`${label}格式不正確。`);
  return assertDisplayText(value, label, { max });
}

function assertSlug(value, label = 'ID') {
  const slug = assertText(value, label, { required: true, max: 48 }).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`${label}只能使用小寫英數字與連字號。`);
  return slug;
}

function assertUrl(value, label = '網址') {
  const url = assertText(value, label, { required: true, max: 500 });
  if (!isSafeProfileUrl(url)) throw new Error(`${label}必須是 http(s)、mailto 或頁面錨點。`);
  return url;
}

function assertHttpUrl(value, label = '網址', { max = 500 } = {}) {
  const url = assertText(value, label, { required: true, max });
  if (!isSafeHttpUrl(url)) throw new Error(`${label}必須是公開的 http(s) 網址。`);
  return url;
}

function assertStringArray(value, label, { min = 0, max = 12 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label}數量不正確。`);
  return value.map((item) => assertDisplayText(item, label, { required: true, max: 80 }));
}

function assertAllowedKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`${label}包含不支援的欄位：${unknown.join('、')}。`);
}

function assertObjectArray(value, label, max) {
  if (!Array.isArray(value)) throw new Error(`${label}必須是陣列。`);
  if (value.length > max) throw new Error(`${label}數量不可超過 ${max}。`);
  return value;
}

function assertOptionalEnum(value, allowed, label, fallback) {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) throw new Error(`${label}包含不支援的值。`);
  return value;
}

function assertOptionalNumber(value, label, range, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < range.minimum || number > range.maximum) {
    throw new Error(`${label} 必須介於 ${range.minimum}～${range.maximum}。`);
  }
  return number;
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

export function extractYoutubePlaylistId(value) {
  const source = assertText(value, 'YouTube 播放清單', { required: true, max: 500 });
  const playlistId = parseYoutubePlaylistId(source);
  if (playlistId) return playlistId;
  throw new Error('請貼上 YouTube 播放清單網址，或輸入有效的 playlist ID。');
}

export function validateProfileAnswers(input) {
  if (!isObject(input) || input.version !== PROFILE_ANSWER_VERSION) throw new Error('回答檔 version 必須為 1。');
  if (!isObject(input.identity)) throw new Error('回答檔缺少 identity。');
  assertAllowedKeys(input, ['$schema', 'version', 'applyMode', 'identity', 'media', 'socials', 'links', 'sections', 'imageBlocks', 'embedBlocks', 'playlist', 'fortune', 'features', 'appearance'], '回答檔');
  if (input.$schema !== undefined && typeof input.$schema !== 'string') throw new Error('$schema 格式不正確。');
  const applyMode = assertOptionalEnum(input.applyMode, APPLY_MODES, 'applyMode', 'replace');
  assertAllowedKeys(input.identity, ['displayName', 'title', 'location', 'tagline', 'bio'], 'identity');
  const tagline = assertStringArray(input.identity.tagline ?? [], '關鍵字', { max: 6 });
  if (new Set(tagline).size !== tagline.length) throw new Error('關鍵字不可重複。');
  const identity = {
    displayName: assertDisplayText(input.identity.displayName, '顯示名稱', { required: true, max: 80 }),
    title: assertDisplayText(input.identity.title, '一句話身分', { max: 120 }),
    location: assertDisplayText(input.identity.location, '地點', { max: 100 }),
    tagline,
    bio: assertProvidedDisplayText(input.identity.bio, '自我介紹', { max: 5000 }),
  };
  if (input.media !== undefined && !isObject(input.media)) throw new Error('media 格式不正確。');
  const mediaInput = input.media ?? {};
  assertAllowedKeys(mediaInput, ['avatar', 'background'], 'media');
  const media = {
    avatar: assertImageSource(mediaInput.avatar ?? '/images/avatar.svg', '頭像'),
    background: assertImageSource(mediaInput.background ?? '/images/background.svg', '背景圖片'),
  };

  const socialInput = input.socials === undefined ? [] : assertObjectArray(input.socials, '社群連結', 20);
  const socials = socialInput.map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個社群連結格式不正確。`);
    assertAllowedKeys(item, ['service', 'title', 'url', 'icon'], `第 ${index + 1} 個社群連結`);
    const service = assertSlug(item.service, '社群服務');
    return {
      service,
      title: assertProvidedDisplayText(item.title, '社群名稱', { max: 80 }) || SERVICE_DEFAULTS[service]?.title || service,
      url: assertUrl(item.url, '社群網址'),
      icon: item.icon === undefined ? SERVICE_DEFAULTS[service]?.icon || 'arrow' : assertSlug(item.icon, '圖示名稱'),
    };
  });

  const linkInput = input.links === undefined ? [] : assertObjectArray(input.links, '精選連結', 20);
  const links = linkInput.map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個精選連結格式不正確。`);
    assertAllowedKeys(item, ['id', 'title', 'url', 'description', 'icon', 'style', 'tags'], `第 ${index + 1} 個精選連結`);
    return {
      id: assertSlug(item.id, '精選連結 ID'),
      title: assertDisplayText(item.title, '精選連結名稱', { required: true, max: 80 }),
      url: assertUrl(item.url, '精選連結網址'),
      description: assertDisplayText(item.description, '精選連結說明', { required: true, max: 500 }),
      icon: item.icon === undefined ? 'arrow' : assertSlug(item.icon, '圖示名稱'),
      style: assertOptionalEnum(item.style, LINK_STYLES, '精選連結樣式', 'normal'),
      tags: assertStringArray(item.tags ?? [], '精選連結標籤', { max: 6 }),
    };
  });

  const sectionInput = input.sections === undefined ? [] : assertObjectArray(input.sections, '自介區塊', 12);
  const sections = sectionInput.map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個自介區塊格式不正確。`);
    assertAllowedKeys(item, ['id', 'title', 'description', 'tags', 'image'], `第 ${index + 1} 個自介區塊`);
    const image = item.image === undefined ? '' : assertImageSource(item.image, '圖片來源', { required: true });
    return {
      id: assertSlug(item.id, '自介區塊 ID'),
      title: assertDisplayText(item.title, '自介區塊名稱', { required: true, max: 80 }),
      description: assertDisplayText(item.description, '自介區塊內容', { required: true, max: 2000 }),
      tags: assertStringArray(item.tags ?? [], '自介區塊標籤', { max: 8 }),
      ...(image ? { image } : {}),
    };
  });

  const imageBlockInput = input.imageBlocks === undefined ? [] : assertObjectArray(input.imageBlocks, '圖片板塊', 8);
  const imageBlocks = imageBlockInput.map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個圖片板塊格式不正確。`);
    assertAllowedKeys(item, ['id', 'title', 'image', 'imageAlt', 'description', 'placement', 'imageLayout', 'imageAspect', 'imagePosition', 'tags'], `第 ${index + 1} 個圖片板塊`);
    return {
      id: assertSlug(item.id, '圖片板塊 ID'),
      title: assertDisplayText(item.title, '圖片板塊標題', { required: true, max: 80 }),
      image: assertImageSource(item.image, '圖片板塊圖片', { required: true }),
      imageAlt: assertProvidedDisplayText(item.imageAlt, '圖片替代文字', { max: 300 }),
      description: assertProvidedDisplayText(item.description, '圖片板塊文字', { max: 5000 }),
      placement: assertOptionalEnum(item.placement, IMAGE_BLOCK_PLACEMENTS, '圖片板塊位置', 'after-sections'),
      imageLayout: assertOptionalEnum(item.imageLayout, IMAGE_BLOCK_LAYOUTS, '圖片板塊版型', 'full'),
      imageAspect: assertOptionalEnum(item.imageAspect, IMAGE_BLOCK_ASPECTS, '圖片板塊比例', 'landscape'),
      imagePosition: assertOptionalEnum(item.imagePosition, IMAGE_BLOCK_POSITIONS, '圖片板塊焦點', 'center'),
      tags: assertStringArray(item.tags ?? [], '圖片板塊標籤', { max: 8 }),
    };
  });

  const embedBlockInput = input.embedBlocks === undefined ? [] : assertObjectArray(input.embedBlocks, '網頁內嵌板塊', 8);
  const embedBlocks = embedBlockInput.map((item, index) => {
    if (!isObject(item)) throw new Error(`第 ${index + 1} 個網頁內嵌板塊格式不正確。`);
    assertAllowedKeys(item, ['id', 'title', 'url', 'description', 'provider', 'embedMode', 'height', 'tags'], `第 ${index + 1} 個網頁內嵌板塊`);
    const requestedProvider = assertOptionalEnum(item.provider, EMBED_BLOCK_PROVIDERS, '網頁內嵌類型', 'website');
    const embedSource = normalizeEmbedSource(item.url, requestedProvider);
    const height = item.height === undefined ? embedSource.height ?? 600 : Number(item.height);
    if (!Number.isInteger(height) || height < 320 || height > 1200) {
      throw new Error(`第 ${index + 1} 個網頁內嵌高度必須介於 320～1200。`);
    }
    return {
      id: assertSlug(item.id, '網頁內嵌板塊 ID'),
      title: assertDisplayText(item.title, '網頁內嵌板塊標題', { required: true, max: 80 }),
      url: assertHttpUrl(embedSource.url, '網頁內嵌網址', { max: EMBED_URL_MAX_LENGTH }),
      description: assertProvidedDisplayText(item.description, '網頁內嵌板塊說明', { max: 5000 }),
      provider: embedSource.provider,
      embedMode: assertOptionalEnum(item.embedMode, EMBED_BLOCK_MODES, '網頁內嵌模式', 'preview'),
      height,
      tags: assertStringArray(item.tags ?? [], '網頁內嵌板塊標籤', { max: 8 }),
    };
  });

  assertUnique(socials, 'service', '社群服務');
  assertUnique(links, 'id', '精選連結 ID');
  assertUnique(sections, 'id', '自介區塊 ID');
  assertUnique(imageBlocks, 'id', '圖片板塊 ID');
  assertUnique(embedBlocks, 'id', '網頁內嵌板塊 ID');

  if (input.appearance !== undefined && !isObject(input.appearance)) throw new Error('appearance 格式不正確。');
  const appearance = input.appearance ?? {};
  assertAllowedKeys(appearance, ['sectionsLayout', 'bodyFont', 'displayFont', 'mainColor', 'fontScale', 'smallTextScale', 'homeOrder'], 'appearance');
  const sectionsLayout = assertOptionalEnum(appearance.sectionsLayout, ['grid', 'list'], 'sectionsLayout', APPEARANCE_DEFAULTS.sectionsLayout);
  const bodyFont = assertOptionalEnum(appearance.bodyFont, FONT_PRESETS, 'bodyFont', APPEARANCE_DEFAULTS.bodyFont);
  const displayFont = assertOptionalEnum(appearance.displayFont, FONT_PRESETS, 'displayFont', APPEARANCE_DEFAULTS.displayFont);
  const mainColor = assertThemeColor(appearance.mainColor ?? APPEARANCE_DEFAULTS.mainColor, 'appearance.mainColor');
  const fontScale = assertOptionalNumber(appearance.fontScale, 'appearance.fontScale', APPEARANCE_RANGES.fontScale, APPEARANCE_DEFAULTS.fontScale);
  const smallTextScale = assertOptionalNumber(appearance.smallTextScale, 'appearance.smallTextScale', APPEARANCE_RANGES.smallTextScale, APPEARANCE_DEFAULTS.smallTextScale);
  const homeOrder = appearance.homeOrder ?? APPEARANCE_DEFAULTS.homeOrder;
  if (!Array.isArray(homeOrder) || homeOrder.length !== 5 || new Set(homeOrder).size !== 5 || homeOrder.some((item) => !HOME_SECTIONS.includes(item))) {
    throw new Error('appearance.homeOrder 必須包含五個首頁板塊。');
  }

  if (input.playlist !== null && input.playlist !== undefined && !isObject(input.playlist)) throw new Error('playlist 格式不正確。');
  if (isObject(input.playlist)) assertAllowedKeys(input.playlist, ['youtubePlaylistId', 'title', 'description'], 'playlist');
  const playlist = input.playlist === null || input.playlist === undefined ? null : {
    youtubePlaylistId: extractYoutubePlaylistId(input.playlist.youtubePlaylistId),
    title: assertProvidedDisplayText(input.playlist.title, '播放清單名稱', { max: 80 }) || 'PLAY！',
    description: assertProvidedDisplayText(input.playlist.description, '播放清單說明', { max: 500 }) || '按下唱針，隨機抽一首歌。',
  };

  if (input.fortune !== undefined && !isObject(input.fortune)) throw new Error('fortune 格式不正確。');
  let fortune;
  if (isObject(input.fortune)) {
    assertAllowedKeys(input.fortune, ['title', 'description', 'fortunes'], 'fortune');
    fortune = {
      title: assertProvidedDisplayText(input.fortune.title, '今日手氣標題', { max: 80 }) || '今日手氣',
      description: assertProvidedDisplayText(input.fortune.description, '今日手氣說明', { max: 500 }) || '搖一搖，抽走今天的一點好運。',
      fortunes: validateFortuneBucket(input.fortune.fortunes),
    };
  }

  if (input.features !== undefined && !isObject(input.features)) throw new Error('features 格式不正確。');
  const features = input.features ?? {};
  assertAllowedKeys(features, ['fortune'], 'features');
  if (features.fortune !== undefined && typeof features.fortune !== 'boolean') throw new Error('features.fortune 必須是布林值。');

  return {
    version: PROFILE_ANSWER_VERSION,
    applyMode,
    identity,
    media,
    socials,
    links,
    sections,
    imageBlocks,
    embedBlocks,
    playlist,
    ...(fortune ? { fortune } : {}),
    appearance: { sectionsLayout, homeOrder, bodyFont, displayFont, mainColor, fontScale, smallTextScale },
    features: { fortune: features.fortune !== false },
  };
}

export function resolveProfileAnswerUpdate(currentInput, rawInput, requestedMode) {
  if (!isObject(rawInput) || rawInput.version !== PROFILE_ANSWER_VERSION) {
    throw new Error('回答檔 version 必須為 1。');
  }
  assertAllowedKeys(rawInput, ['$schema', 'version', 'applyMode', 'identity', 'media', 'socials', 'links', 'sections', 'imageBlocks', 'embedBlocks', 'playlist', 'fortune', 'features', 'appearance'], '回答檔');
  const mode = requestedMode ?? rawInput.applyMode ?? 'replace';
  if (!APPLY_MODES.includes(mode)) throw new Error('applyMode 必須為 merge 或 replace。');
  if (mode === 'replace') {
    return {
      mode,
      answers: { ...validateProfileAnswers({ ...rawInput, applyMode: mode }), applyMode: mode },
      updateKeys: new Set(['identity', 'media', 'socials', 'links', 'sections', 'imageBlocks', 'embedBlocks', 'playlist', 'fortune', 'features', 'appearance']),
    };
  }

  const current = validateProfileAnswers(currentInput);
  const merged = structuredClone(current);
  for (const key of ['identity', 'media', 'appearance', 'features']) {
    if (rawInput[key] !== undefined) {
      if (!isObject(rawInput[key])) throw new Error(`${key} 格式不正確。`);
      merged[key] = { ...merged[key], ...rawInput[key] };
    }
  }
  if (rawInput.fortune !== undefined) {
    if (!isObject(rawInput.fortune)) throw new Error('fortune 格式不正確。');
    merged.fortune = { ...merged.fortune, ...rawInput.fortune };
  }
  for (const key of ['socials', 'links', 'sections', 'imageBlocks', 'embedBlocks', 'playlist']) {
    if (Object.hasOwn(rawInput, key)) merged[key] = structuredClone(rawInput[key]);
  }
  merged.version = PROFILE_ANSWER_VERSION;
  merged.applyMode = mode;
  if (rawInput.$schema !== undefined) merged.$schema = rawInput.$schema;
  const answers = validateProfileAnswers(merged);
  return {
    mode,
    answers: { ...answers, applyMode: mode },
    updateKeys: new Set(Object.keys(rawInput).filter((key) => !['$schema', 'version', 'applyMode'].includes(key))),
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
      imageBlockCount: answers.imageBlocks.length,
      imageBlockTitles: answers.imageBlocks.map((block) => block.title),
      embedBlockCount: answers.embedBlocks.length,
      embedBlockTitles: answers.embedBlocks.map((block) => block.title),
      playlistEnabled: Boolean(answers.playlist),
      fortuneEnabled: answers.features.fortune,
      fortuneCount: answers.fortune?.fortunes.length ?? 0,
      homeOrder: answers.appearance.homeOrder,
      mainColor: answers.appearance.mainColor,
    },
    warnings,
  };
}

function orderedVisible(entries, predicate = () => true) {
  return [...(entries ?? [])]
    .filter((entry) => entry?.data?.visible !== false && predicate(entry))
    .sort((first, second) => Number(first.data.order ?? 100) - Number(second.data.order ?? 100));
}

function uniqueId(rawId, used) {
  const base = String(rawId || 'item').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function strippedId(id, prefixes) {
  const prefix = prefixes.find((candidate) => id.startsWith(candidate));
  return prefix ? id.slice(prefix.length) : id;
}

export function createProfileAnswersFromStudioContent(content) {
  if (!isObject(content?.profile)) throw new Error('無法從缺少 profile 的內容建立回答檔。');
  const socialIds = new Set();
  const linkIds = new Set();
  const sectionIds = new Set();
  const imageBlockIds = new Set();
  const embedBlockIds = new Set();
  const blocks = content.blocks ?? [];
  const turntable = blocks.find((block) => block.id === 'turntable' && block.data.visible !== false);
  const fortune = blocks.find((block) => block.id === 'fortune');

  const draft = {
    version: PROFILE_ANSWER_VERSION,
    identity: {
      displayName: content.profile.displayName ?? '',
      title: content.profile.title ?? '',
      location: content.profile.location ?? '',
      tagline: Array.isArray(content.profile.tagline) ? content.profile.tagline : [],
      bio: content.profile.bio ?? '',
    },
    media: {
      avatar: content.profile.avatar ?? '/images/avatar.svg',
      background: content.profile.background ?? '/images/background.svg',
    },
    socials: orderedVisible(content.links, (entry) => entry.data.group === 'social' && entry.data.layout === 'icon')
      .map((entry) => ({
        service: uniqueId(strippedId(entry.id, ['generated-social-', 'studio-social-', 'social-']), socialIds),
        title: entry.data.title ?? '',
        url: entry.data.url ?? '',
        icon: entry.data.icon ?? 'arrow',
      })),
    links: orderedVisible(content.links, (entry) => ['main', 'featured'].includes(entry.data.group) && entry.data.layout === 'card')
      .map((entry) => ({
        id: uniqueId(strippedId(entry.id, ['generated-link-']), linkIds),
        title: entry.data.title ?? '',
        url: entry.data.url ?? '',
        description: entry.body ?? '',
        icon: entry.data.icon ?? 'arrow',
        style: LINK_STYLES.includes(entry.data.style) ? entry.data.style : 'normal',
        tags: Array.isArray(entry.data.tags) ? entry.data.tags : [],
      })),
    sections: orderedVisible(content.sections)
      .map((entry) => ({
        id: uniqueId(strippedId(entry.id, ['generated-']), sectionIds),
        title: entry.data.title ?? '',
        description: entry.body ?? '',
        tags: Array.isArray(entry.data.tags) ? entry.data.tags : [],
        ...(entry.data.image ? { image: entry.data.image } : {}),
      })),
    imageBlocks: orderedVisible(blocks, (entry) => entry.data.layout === 'image')
      .map((entry) => ({
        id: uniqueId(strippedId(entry.id, ['generated-image-']), imageBlockIds),
        title: entry.data.title ?? '',
        image: entry.data.image ?? '',
        imageAlt: entry.data.imageAlt ?? '',
        description: entry.body ?? '',
        placement: entry.data.placement ?? 'after-sections',
        imageLayout: entry.data.imageLayout ?? 'full',
        imageAspect: entry.data.imageAspect ?? 'landscape',
        imagePosition: entry.data.imagePosition ?? 'center',
        tags: Array.isArray(entry.data.tags) ? entry.data.tags : [],
      })),
    embedBlocks: orderedVisible(blocks, (entry) => entry.data.layout === 'embed')
      .map((entry) => ({
        id: uniqueId(strippedId(entry.id, ['generated-embed-']), embedBlockIds),
        title: entry.data.title ?? '',
        url: entry.data.url ?? '',
        description: entry.body ?? '',
        provider: EMBED_BLOCK_PROVIDERS.includes(entry.data.provider) ? entry.data.provider : 'website',
        embedMode: entry.data.embedMode ?? 'preview',
        height: entry.data.height ?? 600,
        tags: Array.isArray(entry.data.tags) ? entry.data.tags : [],
      })),
    playlist: turntable ? {
      youtubePlaylistId: turntable.data.playlistId ?? '',
      title: turntable.data.title ?? 'PLAY！',
      description: turntable.body ?? '',
    } : null,
    fortune: {
      title: fortune?.data?.title ?? '今日手氣',
      description: fortune?.body ?? '搖一搖，抽走今天的一點好運。',
      fortunes: Array.isArray(content.fortunes) ? content.fortunes : [],
    },
    features: { fortune: fortune?.data?.visible !== false },
    appearance: {
      sectionsLayout: content.profile.sectionsLayout ?? APPEARANCE_DEFAULTS.sectionsLayout,
      bodyFont: content.profile.bodyFont ?? APPEARANCE_DEFAULTS.bodyFont,
      displayFont: content.profile.displayFont ?? APPEARANCE_DEFAULTS.displayFont,
      mainColor: content.profile.mainColor ?? APPEARANCE_DEFAULTS.mainColor,
      fontScale: content.profile.fontScale ?? APPEARANCE_DEFAULTS.fontScale,
      smallTextScale: content.profile.smallTextScale ?? APPEARANCE_DEFAULTS.smallTextScale,
      homeOrder: Array.isArray(content.profile.homeOrder) ? content.profile.homeOrder : HOME_SECTIONS,
    },
  };

  return {
    $schema: './docs/profile-answers.schema.json',
    ...validateProfileAnswers(draft),
  };
}

export function serializeProfileAnswers(input) {
  return `${JSON.stringify({
    $schema: './docs/profile-answers.schema.json',
    ...validateProfileAnswers(input),
  }, null, 2)}\n`;
}
