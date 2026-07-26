import {
  previewProfileAnswers,
  serializeProfileAnswers,
  validateProfileAnswers,
} from '../../scripts/profile-answers.mjs';
import { normalizeThemeColor } from '../../scripts/theme-color.mjs';
import { normalizeEmbedSource } from '../../scripts/embed-source.mjs';
import { icons } from '../lib/icons';
import { createSettingsZip, readSettingsZip } from './settings-package.js';

const STORAGE_KEY = 'profile-online-studio-draft-v2';
const HOME_LABELS = {
  about: 'About me',
  turntable: '播放清單',
  links: 'Links',
  fortune: '今日手氣',
  notion: '網頁內嵌',
};
const SOCIAL_OPTIONS = [
  ['github', 'GitHub', 'https://github.com/yourname'],
  ['threads', 'Threads', 'https://www.threads.net/@yourname'],
  ['facebook', 'Facebook', 'https://www.facebook.com/yourname'],
  ['instagram', 'Instagram', 'https://www.instagram.com/yourname'],
  ['x', 'X', 'https://x.com/yourname'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/yourname'],
  ['youtube', 'YouTube', 'https://www.youtube.com/@yourname'],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@yourname'],
  ['spotify', 'Spotify', 'https://open.spotify.com/'],
  ['notion', 'Notion', 'https://www.notion.so/'],
  ['email', 'Email', 'mailto:hello@example.com', 'mail'],
  ['website', '自訂網站', 'https://example.com', 'arrow'],
];

const COLLECTIONS = {
  socials: {
    container: '#social-list',
    empty: '還沒有社群連結。需要時再新增即可。',
    title: (item) => item.title || item.service || '未命名社群',
    subtitle: (item) => item.url || '尚未填寫網址',
    fields: [
      ['service', '服務 ID', 'text', 'github', false],
      ['title', '顯示名稱', 'text', 'GitHub', false],
      ['url', '公開網址', 'text', 'https://github.com/yourname', false],
      ['icon', 'Icon 名稱', 'text', 'github', false],
    ],
  },
  links: {
    container: '#featured-link-list',
    empty: '還沒有精選 Link。你的網站也可以保持很簡潔。',
    title: (item) => item.title || item.id || '未命名 Link',
    subtitle: (item) => item.url || '尚未填寫網址',
    fields: [
      ['id', 'Link ID', 'text', 'my-project', false],
      ['title', '標題', 'text', 'My project', false],
      ['url', '公開網址', 'text', 'https://example.com', false],
      ['description', '簡短說明', 'textarea', '這個連結想介紹什麼？', true],
      ['icon', 'Icon 名稱', 'text', 'arrow', false],
      ['style', '卡片樣式', 'select', [
        ['normal', '一般'],
        ['primary', '主色強調'],
        ['subtle', '低調'],
      ], false],
      ['tags', '標籤', 'list', 'Open source, Side project', false],
    ],
  },
  sections: {
    container: '#section-list',
    empty: '還沒有 About me 卡片。這個區塊是選填的。',
    title: (item) => item.title || item.id || '未命名卡片',
    subtitle: (item) => item.description || '尚未填寫內容',
    fields: [
      ['id', '卡片 ID', 'text', 'about-me', false],
      ['title', '標題', 'text', 'About', false],
      ['description', '內容', 'textarea', '分享一段關於你的內容。', true],
      ['image', '圖片（上傳或網址，選填）', 'image', 'https://cdn.example.com/about.webp', false],
      ['tags', '標籤', 'list', 'Developer, Learning', false],
    ],
  },
  imageBlocks: {
    container: '#image-block-list',
    empty: '還沒有圖片板塊。只有文字也完全沒問題。',
    title: (item) => item.title || item.id || '未命名圖片板塊',
    subtitle: (item) => item.image || '尚未選擇圖片',
    fields: [
      ['id', '板塊 ID', 'text', 'featured-story', false],
      ['title', '標題', 'text', '最近的一段故事', false],
      ['image', '圖片（上傳或網址）', 'image', 'https://cdn.example.com/story.webp', false],
      ['imageAlt', '圖片替代文字', 'text', '描述圖片中的內容', false],
      ['description', '說明', 'textarea', '補充這張圖片背後的故事。', true],
      ['placement', '顯示位置', 'select', [
        ['before-links', 'Links 前'],
        ['between-links-sections', 'Links 後'],
        ['after-sections', 'About 後'],
      ], false],
      ['imageLayout', '版型', 'select', [
        ['full', '滿版'],
        ['split-left', '圖片在左'],
        ['split-right', '圖片在右'],
        ['poster', '海報'],
      ], false],
      ['imageAspect', '圖片比例', 'select', [
        ['auto', '自動'],
        ['landscape', '橫式'],
        ['square', '正方形'],
        ['portrait', '直式'],
      ], false],
      ['imagePosition', '裁切焦點', 'select', [
        ['center', '中央'], ['top', '上'], ['bottom', '下'], ['left', '左'], ['right', '右'],
        ['top-left', '左上'], ['top-right', '右上'], ['bottom-left', '左下'], ['bottom-right', '右下'],
      ], false],
      ['tags', '標籤', 'list', 'Story, Photo', false],
    ],
  },
  embedBlocks: {
    container: '#embed-block-list',
    empty: '還沒有網頁內嵌。可加入支援 iframe 的公開網站，或先使用預覽連結模式。',
    title: (item) => item.title || item.id || '未命名網頁內嵌',
    subtitle: (item) => item.url || '尚未填寫網址',
    fields: [
      ['id', '板塊 ID', 'text', 'my-embed', false],
      ['title', '標題', 'text', '最近動態', false],
      ['url', '嵌入網址或 iframe 程式碼', 'textarea', '貼上公開網址，或從服務複製的 <iframe ...></iframe>', true],
      ['description', '說明', 'textarea', '補充這個內嵌內容。', true],
      ['provider', '網站類型', 'select', [
        ['website', '一般網站'],
        ['notion', 'Notion'],
        ['youtube', 'YouTube'],
      ], false],
      ['embedMode', '顯示方式', 'select', [
        ['preview', '預覽連結卡片'],
        ['inline', '直接嵌入 iframe'],
      ], false],
      ['height', '內嵌高度（320～1200 px）', 'number', '600', false],
      ['tags', '標籤', 'list', 'Notes, Archive', false],
    ],
  },
};

const DEFAULT_ITEMS = {
  links: { id: 'my-link', title: 'My link', url: 'https://example.com', description: '介紹這個連結。', icon: 'arrow', style: 'normal', tags: [] },
  sections: { id: 'about-me', title: 'About', description: '寫下一段關於你的內容。', tags: [] },
  imageBlocks: {
    id: 'featured-story',
    title: '最近的一段故事',
    image: '/images/projects.svg',
    imageAlt: '',
    description: '',
    placement: 'after-sections',
    imageLayout: 'full',
    imageAspect: 'landscape',
    imagePosition: 'center',
    tags: [],
  },
  embedBlocks: {
    id: 'my-embed',
    title: '最近動態',
    url: 'https://example.com',
    description: '',
    provider: 'website',
    embedMode: 'preview',
    height: 600,
    tags: [],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function getPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

function splitList(value, maximum = 20) {
  return [...new Set(String(value || '').split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, maximum);
}

function safeDraft(value) {
  return value && typeof value === 'object' && value.version === 1 && value.identity && value.appearance;
}

function normalizeDraft(value, fallback = {}) {
  const draft = clone(value);
  draft.media ||= { avatar: '/images/avatar.svg', background: '/images/background.svg' };
  draft.media.avatar ||= '/images/avatar.svg';
  draft.media.background ||= '/images/background.svg';
  draft.embedBlocks ||= [];
  draft.links ||= [];
  draft.links.forEach((link) => { link.style ||= 'normal'; });
  if ((!draft.fortune || !Array.isArray(draft.fortune.fortunes)) && fallback.fortune) {
    draft.fortune = clone(fallback.fortune);
  }
  return draft;
}

function uniqueDraftId(items, field, preferred) {
  const used = new Set(items.map((item) => item[field]));
  if (!used.has(preferred)) return preferred;
  let suffix = 2;
  while (used.has(`${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
}

function safeImageName(name) {
  const extension = name.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[0] || '.png';
  const base = name.slice(0, -extension.length).toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'profile-image';
  return `${base}${extension === '.jpeg' ? '.jpg' : extension}`;
}

function iconSvg(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  const template = document.createElement('template');
  template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${icons[name] || icons.arrow}</svg>`;
  svg.append(...template.content.firstElementChild.childNodes);
  return svg;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function openMediaDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('profile-online-studio-media-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', { keyPath: 'path' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeStoredMedia(path, blob) {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').put({ path, blob });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readStoredMedia() {
  const database = await openMediaDatabase();
  const entries = await new Promise((resolve, reject) => {
    const request = database.transaction('media').objectStore('media').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return entries;
}

async function clearStoredMedia() {
  const database = await openMediaDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export function mountOnlineStudio() {
  const bootstrapNode = document.querySelector('#online-studio-data');
  if (!bootstrapNode) return;
  const bootstrap = JSON.parse(bootstrapNode.textContent);
  const initialAnswers = normalizeDraft(bootstrap.initialAnswers);
  const imageFiles = new Map();
  const objectUrls = new Map();
  let state = loadStoredDraft(initialAnswers);
  let toastTimer;
  let localMode = false;
  let mediaRestored = false;

  const status = document.querySelector('#draft-status');
  const toastNode = document.querySelector('#online-toast');
  const preview = document.querySelector('#profile-preview');
  const saveProjectButton = document.querySelector('#save-project');

  function loadStoredDraft(fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (safeDraft(stored)) return normalizeDraft(stored, fallback);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return clone(fallback);
  }

  function toast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toastNode.textContent = message;
    toastNode.classList.toggle('is-error', isError);
    toastNode.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toastNode.classList.remove('is-visible'), 3600);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      status.textContent = localMode ? '本機模式 · 草稿尚未儲存' : '草稿已留在這台裝置';
    } catch {
      status.textContent = '瀏覽器無法保存草稿，請記得下載';
    }
  }

  function updatePrivacySummary() {
    const summary = document.querySelector('#privacy-summary');
    const notices = [];
    if (String(state.identity.location || '').trim()) notices.push('公開地區');
    if ((state.socials || []).some((social) => String(social.url || '').toLowerCase().startsWith('mailto:'))) notices.push('公開 Email');
    summary.textContent = notices.length
      ? `公開資料提醒：設定包含${notices.join('、')}。儲存或發布前請再次確認。`
      : '';
  }

  function syncStaticControls() {
    document.querySelectorAll('[data-bind]').forEach((control) => {
      if (control.dataset.array) return;
      const value = getPath(state, control.dataset.bind);
      if (control.dataset.boolean !== undefined) control.checked = Boolean(value);
      else if (control.dataset.list !== undefined) control.value = Array.isArray(value) ? value.join(', ') : '';
      else if (control.type === 'color') control.value = normalizeThemeColor(value) || '#7A58A6';
      else control.value = value ?? '';
    });
    const playlistEnabled = document.querySelector('#playlist-enabled');
    playlistEnabled.checked = Boolean(state.playlist);
    document.querySelector('#playlist-fields').hidden = !state.playlist;
    document.querySelectorAll('[data-image-name]').forEach((label) => {
      label.textContent = getPath(state, label.dataset.imageName) || '尚未選擇';
    });
  }

  function createInput(kind, index, fieldName, inputType, placeholder) {
    if (inputType === 'image') {
      const group = element('div', 'image-input');
      const text = document.createElement('input');
      text.type = 'text';
      text.inputMode = 'url';
      text.maxLength = 2048;
      text.placeholder = placeholder;
      text.dataset.array = kind;
      text.dataset.index = String(index);
      text.dataset.field = fieldName;
      text.value = state[kind][index]?.[fieldName] ?? '';
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/png,image/jpeg,image/webp,image/gif';
      file.dataset.imageArray = kind;
      file.dataset.index = String(index);
      file.dataset.field = fieldName;
      const hint = element('small', 'image-source-hint', '可貼上公開 HTTPS 網址、使用 /images/ 路徑，或從裝置上傳圖片。');
      group.append(text, file, hint);
      return group;
    }
    let control;
    if (inputType === 'textarea') {
      control = document.createElement('textarea');
      control.rows = 4;
    } else if (inputType === 'select') {
      control = document.createElement('select');
      placeholder.forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        control.append(option);
      });
    } else {
      control = document.createElement('input');
      control.type = inputType === 'number' ? 'number' : 'text';
      if (inputType === 'number') {
        control.min = '320';
        control.max = '1200';
        control.step = '1';
      }
      if (typeof placeholder === 'string') control.placeholder = placeholder;
    }
    control.dataset.array = kind;
    control.dataset.index = String(index);
    control.dataset.field = fieldName;
    if (inputType === 'list') control.dataset.list = '';
    const current = state[kind][index]?.[fieldName];
    control.value = Array.isArray(current) ? current.join(', ') : current ?? '';
    return control;
  }

  function renderCollection(kind) {
    const config = COLLECTIONS[kind];
    const container = document.querySelector(config.container);
    container.replaceChildren();
    if (!state[kind].length) {
      container.append(element('div', 'empty-collection', config.empty));
      return;
    }
    state[kind].forEach((item, index) => {
      const details = element('details', 'collection-item');
      const summary = document.createElement('summary');
      const title = element('span', 'collection-item__title');
      title.append(element('strong', '', config.title(item)), element('small', '', config.subtitle(item)));
      const remove = element('button', 'remove-item', '移除');
      remove.type = 'button';
      remove.dataset.remove = kind;
      remove.dataset.index = String(index);
      const actions = element('span', 'collection-item__actions');
      if (kind === 'links') {
        [['up', '↑', index === 0], ['down', '↓', index === state[kind].length - 1]].forEach(([direction, label, disabled]) => {
          const move = element('button', 'move-item', label);
          move.type = 'button';
          move.dataset.moveCollection = direction;
          move.dataset.collection = kind;
          move.dataset.index = String(index);
          move.disabled = disabled;
          move.setAttribute('aria-label', `${config.title(item)}往${direction === 'up' ? '上' : '下'}移`);
          actions.append(move);
        });
      }
      actions.append(remove);
      summary.append(title, actions);
      const fields = element('div', 'collection-item__fields');
      config.fields.forEach(([fieldName, labelText, inputType, placeholder, wide]) => {
        const label = element('label', `field${wide ? ' field--wide' : ''}`);
        label.append(element('span', '', labelText), createInput(kind, index, fieldName, inputType, placeholder));
        fields.append(label);
      });
      details.append(summary, fields);
      container.append(details);
    });
  }

  function renderCollections() {
    Object.keys(COLLECTIONS).forEach(renderCollection);
  }

  function renderHomeOrder() {
    const list = document.querySelector('#home-order');
    list.replaceChildren();
    state.appearance.homeOrder.forEach((id, index) => {
      const item = document.createElement('li');
      item.append(element('span', '', String(index + 1).padStart(2, '0')), element('strong', '', HOME_LABELS[id] || id));
      const actions = element('div', 'home-order__actions');
      [['up', '↑', index === 0], ['down', '↓', index === state.appearance.homeOrder.length - 1]].forEach(([direction, label, disabled]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.moveHome = direction;
        button.dataset.index = String(index);
        button.disabled = disabled;
        button.setAttribute('aria-label', `${HOME_LABELS[id] || id}往${direction === 'up' ? '上' : '下'}移`);
        actions.append(button);
      });
      item.append(actions);
      list.append(item);
    });
  }

  function renderPreview() {
    updatePrivacySummary();
    const displayNameInput = document.querySelector('[data-bind="identity.displayName"]');
    displayNameInput?.setAttribute('aria-invalid', String(!String(state.identity.displayName || '').trim()));
    if (!mediaRestored || !preview.contentWindow) return;
    preview.contentWindow.postMessage({
      type: 'profile-studio:render',
      answers: state,
      assets: {
        avatar: state.media.avatar,
        background: state.media.background,
        objectUrls: Object.fromEntries(objectUrls),
      },
    }, window.location.origin);
  }

  function refreshAll() {
    syncStaticControls();
    renderCollections();
    renderHomeOrder();
    renderPreview();
    persist();
  }

  function addCollectionItem(kind, preset) {
    const item = clone(preset || DEFAULT_ITEMS[kind]);
    const idField = kind === 'socials' ? 'service' : 'id';
    item[idField] = uniqueDraftId(state[kind], idField, item[idField]);
    state[kind].push(item);
    renderCollection(kind);
    renderPreview();
    persist();
    const details = document.querySelector(COLLECTIONS[kind].container)?.lastElementChild;
    if (details?.tagName === 'DETAILS') {
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function exportAnswers() {
    try {
      const result = previewProfileAnswers(state);
      return { content: serializeProfileAnswers(result.answers), result };
    } catch (error) {
      status.textContent = '設定還有欄位需要修正';
      toast(error.message || '設定檔格式不正確。', true);
      throw error;
    }
  }

  async function downloadAnswers() {
    let exported;
    try { exported = exportAnswers(); } catch { return; }
    const files = [{ name: 'profile.answers.json', data: new TextEncoder().encode(exported.content) }];
    for (const [path, blob] of imageFiles) {
      files.push({ name: path.replace(/^\//, ''), data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const blob = new Blob([createSettingsZip(files)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profile-settings.zip';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = '設定包已下載';
    toast(exported.result.warnings.length
      ? `設定包已下載。提醒：${exported.result.warnings.join(' ')}`
      : '設定包已下載，JSON 與自訂圖片都放在裡面。');
  }

  async function copyAnswers() {
    let exported;
    try { exported = exportAnswers(); } catch { return; }
    try {
      await navigator.clipboard.writeText(exported.content);
      toast('JSON 已複製到剪貼簿。');
    } catch {
      toast('瀏覽器不允許自動複製，請改用「下載設定包」。', true);
    }
  }

  function downloadJson() {
    let exported;
    try { exported = exportAnswers(); } catch { return; }
    const blob = new Blob([exported.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profile.answers.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'JSON 已下載';
    toast('JSON 已下載。從裝置上傳的圖片檔不包含在 JSON 中。');
  }

  async function registerImage(file, assign) {
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) throw new Error('僅支援 PNG、JPG、WebP 或 GIF。');
    if (file.size > 5 * 1024 * 1024) throw new Error('單張圖片不可超過 5 MB。');
    let name = safeImageName(file.name);
    let path = `/images/${name}`;
    let suffix = 2;
    while (imageFiles.has(path)) {
      const dot = name.lastIndexOf('.');
      path = `/images/${name.slice(0, dot)}-${suffix}${name.slice(dot)}`;
      suffix += 1;
    }
    imageFiles.set(path, file);
    await writeStoredMedia(path, file);
    const previousUrl = objectUrls.get(path);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    objectUrls.set(path, URL.createObjectURL(file));
    assign(path);
    refreshAll();
    toast('圖片已加入草稿並顯示在正式預覽。');
  }

  async function importJsonText(text) {
    const imported = validateProfileAnswers(JSON.parse(text));
    state = normalizeDraft({ $schema: './docs/profile-answers.schema.json', ...imported }, initialAnswers);
    refreshAll();
  }

  async function importPackage(file) {
    if (file.size > 50 * 1024 * 1024) throw new Error('設定包不可超過 50 MB。');
    if (file.name.toLowerCase().endsWith('.json')) {
      await importJsonText(await file.text());
      return;
    }
    const entries = readSettingsZip(new Uint8Array(await file.arrayBuffer()));
    const answersBytes = entries.get('profile.answers.json');
    if (!answersBytes) throw new Error('ZIP 裡找不到 profile.answers.json。');
    await importJsonText(new TextDecoder().decode(answersBytes));
    for (const [name, bytes] of entries) {
      if (!name.startsWith('images/')) continue;
      const extension = name.toLowerCase().split('.').pop();
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
      if (!types[extension]) continue;
      const path = `/${name}`;
      if (bytes.length > 5 * 1024 * 1024) throw new Error(`${name} 超過單張圖片 5 MB 上限。`);
      const blob = new Blob([bytes], { type: types[extension] });
      imageFiles.set(path, blob);
      await writeStoredMedia(path, blob);
      objectUrls.set(path, URL.createObjectURL(blob));
    }
    renderPreview();
  }

  async function saveToProject() {
    if (!localMode) return;
    const replacements = new Map();
    try {
      saveProjectButton.disabled = true;
      status.textContent = '正在儲存圖片與設定…';
      for (const [path, blob] of imageFiles) {
        const response = await fetch(`${bootstrap.localApiUrl}/api/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: path.split('/').pop(), dataUrl: await blobToDataUrl(blob) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '圖片儲存失敗。');
        replacements.set(path, result.path);
      }
      const exported = exportAnswers();
      const answers = JSON.parse(exported.content);
      const replace = (value) => replacements.get(value) || value;
      answers.media.avatar = replace(answers.media.avatar);
      answers.media.background = replace(answers.media.background);
      answers.sections.forEach((item) => { if (item.image) item.image = replace(item.image); });
      answers.imageBlocks.forEach((item) => { item.image = replace(item.image); });
      const response = await fetch(`${bootstrap.localApiUrl}/api/answers/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '設定儲存失敗。');
      state = normalizeDraft(answers);
      imageFiles.clear();
      await clearStoredMedia();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
      refreshAll();
      status.textContent = '已儲存到本機專案';
      toast('已更新 src/content 與 public/images；右側預覽也會跟著重新整理。');
    } catch (error) {
      status.textContent = '本機儲存失敗';
      toast(error.message || '無法儲存到專案。', true);
    } finally {
      saveProjectButton.disabled = false;
    }
  }

  async function detectLocalAdapter() {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    try {
      const response = await fetch(`${bootstrap.localApiUrl}/api/content`, { cache: 'no-store' });
      if (!response.ok) return;
      localMode = true;
      saveProjectButton.hidden = false;
      const localSaveHint = document.querySelector('#local-save-hint');
      if (localSaveHint) localSaveHint.textContent = '已連接本機專案';
      document.querySelector('.browser-only-badge').innerHTML = '<span aria-hidden="true">●</span> 本機專案模式';
      status.textContent = '可直接儲存到本機專案';
    } catch {
      localMode = false;
    }
  }

  async function restoreStoredImages() {
    try {
      for (const { path, blob } of await readStoredMedia()) {
        imageFiles.set(path, blob);
        objectUrls.set(path, URL.createObjectURL(blob));
      }
    } catch {
      toast('瀏覽器無法還原圖片草稿；文字設定仍已保留。', true);
    }
  }

  function renderSocialPicker() {
    const container = document.querySelector('#social-picker-options');
    SOCIAL_OPTIONS.forEach(([service, title, url, icon = service]) => {
      const button = element('button', 'social-picker__option');
      button.type = 'button';
      button.dataset.socialService = service;
      button.append(iconSvg(icon), element('span', '', title));
      button.addEventListener('click', () => {
        addCollectionItem('socials', { service, title, url, icon });
        document.querySelector('#social-picker').close();
      });
      container.append(button);
    });
  }

  document.addEventListener('input', (event) => {
    const control = event.target.closest('[data-bind]');
    if (!control || control.dataset.array) return;
    let value = control.dataset.boolean !== undefined
      ? control.checked
      : control.dataset.list !== undefined
        ? splitList(control.value, 6)
        : control.value;
    if (control.type === 'color') value = normalizeThemeColor(value) || value;
    setPath(state, control.dataset.bind, value);
    if (control.dataset.bind === 'appearance.mainColor') {
      document.querySelectorAll('[data-bind="appearance.mainColor"]').forEach((other) => {
        if (other !== control) other.value = normalizeThemeColor(value) || value;
      });
    }
    renderPreview();
    persist();
  });

  Object.keys(COLLECTIONS).forEach((kind) => {
    document.querySelector(COLLECTIONS[kind].container).addEventListener('input', (event) => {
      const control = event.target.closest('[data-array]');
      if (!control) return;
      const index = Number(control.dataset.index);
      const field = control.dataset.field;
      const maximumItems = kind === 'links' ? 6 : 8;
      state[kind][index][field] = control.dataset.list !== undefined ? splitList(control.value, maximumItems) : control.value;
      const details = control.closest('.collection-item');
      if (kind === 'embedBlocks' && ['url', 'provider'].includes(field)) {
        try {
          const normalized = normalizeEmbedSource(state[kind][index].url, state[kind][index].provider);
          state[kind][index].url = normalized.url;
          state[kind][index].provider = normalized.provider;
          if (normalized.height) state[kind][index].height = normalized.height;
          details.querySelector('[data-field="url"]').value = normalized.url;
          details.querySelector('[data-field="provider"]').value = normalized.provider;
          details.querySelector('[data-field="height"]').value = String(state[kind][index].height);
          if (normalized.fromIframe && field === 'url') toast('已從 iframe 程式碼取出安全網址與高度。');
        } catch {
          // Keep incomplete input editable; shared validation reports details on export or save.
        }
      }
      details.querySelector('.collection-item__title strong').textContent = COLLECTIONS[kind].title(state[kind][index]);
      details.querySelector('.collection-item__title small').textContent = COLLECTIONS[kind].subtitle(state[kind][index]);
      renderPreview();
      persist();
    });
  });

  document.addEventListener('change', (event) => {
    const media = event.target.closest('[data-image-target]');
    const arrayImage = event.target.closest('[data-image-array]');
    const file = event.target.files?.[0];
    if (!file || (!media && !arrayImage)) return;
    const operation = media
      ? registerImage(file, (path) => setPath(state, media.dataset.imageTarget, path))
      : registerImage(file, (path) => {
        state[arrayImage.dataset.imageArray][Number(arrayImage.dataset.index)][arrayImage.dataset.field] = path;
      });
    operation.catch((error) => {
      toast(error.message || '無法讀取圖片。', true);
    });
    event.target.value = '';
  });

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      if (addButton.dataset.add === 'socials') document.querySelector('#social-picker').showModal();
      else addCollectionItem(addButton.dataset.add);
      return;
    }
    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) {
      event.preventDefault();
      event.stopPropagation();
      const kind = removeButton.dataset.remove;
      state[kind].splice(Number(removeButton.dataset.index), 1);
      renderCollection(kind);
      renderPreview();
      persist();
      return;
    }
    const collectionMoveButton = event.target.closest('[data-move-collection]');
    if (collectionMoveButton) {
      event.preventDefault();
      event.stopPropagation();
      const kind = collectionMoveButton.dataset.collection;
      const index = Number(collectionMoveButton.dataset.index);
      const nextIndex = collectionMoveButton.dataset.moveCollection === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= state[kind].length) return;
      [state[kind][index], state[kind][nextIndex]] = [state[kind][nextIndex], state[kind][index]];
      renderCollection(kind);
      renderPreview();
      persist();
      return;
    }
    const moveButton = event.target.closest('[data-move-home]');
    if (moveButton) {
      const index = Number(moveButton.dataset.index);
      const nextIndex = moveButton.dataset.moveHome === 'up' ? index - 1 : index + 1;
      [state.appearance.homeOrder[index], state.appearance.homeOrder[nextIndex]] =
        [state.appearance.homeOrder[nextIndex], state.appearance.homeOrder[index]];
      renderHomeOrder();
      renderPreview();
      persist();
    }
  });

  document.querySelector('#playlist-enabled').addEventListener('change', (event) => {
    state.playlist = event.currentTarget.checked
      ? { youtubePlaylistId: '', title: 'PLAY！', description: '按下唱針，隨機抽一首歌。' }
      : null;
    syncStaticControls();
    renderPreview();
    persist();
  });

  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...document.querySelectorAll('[data-tab]')];
      const index = tabs.indexOf(tab);
      const offset = event.key === 'ArrowLeft' ? -1 : 1;
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      activateTab(next.dataset.tab);
      next.focus();
    });
  });

  function activateTab(name) {
    document.querySelectorAll('[data-tab]').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.editor-panel').forEach((panel) => {
      const active = panel.id === `panel-${name}`;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  document.querySelectorAll('[data-preview-width]').forEach((button) => {
    button.addEventListener('click', () => {
      const narrow = button.dataset.previewWidth === 'narrow';
      document.querySelector('.online-preview').classList.toggle('is-narrow', narrow);
      document.querySelectorAll('[data-preview-width]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== preview.contentWindow || event.origin !== window.location.origin) return;
    if (event.data?.type === 'profile-studio:ready') {
      renderPreview();
    }
  });
  preview.addEventListener('load', () => {
    renderPreview();
  });

  document.querySelector('#import-answers').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await importPackage(file);
      refreshAll();
      toast('設定包已匯入，目前只更新草稿與預覽。');
    } catch (error) {
      toast(error.message || '無法讀取這份設定包。', true);
    } finally {
      input.value = '';
    }
  });

  document.querySelector('#import-ai-answers').addEventListener('click', async () => {
    try {
      await importJsonText(document.querySelector('#ai-answers-json').value);
      toast('AI 設定已驗證並載入草稿。');
    } catch (error) {
      toast(error.message || 'AI 設定格式不正確。', true);
    }
  });

  document.querySelector('#random-main-color').addEventListener('click', () => {
    const channels = new Uint8Array(3);
    crypto.getRandomValues(channels);
    state.appearance.mainColor = `#${[...channels].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    syncStaticControls();
    renderPreview();
    persist();
  });

  document.querySelector('#reset-draft').addEventListener('click', async () => {
    if (!window.confirm('要捨棄這台裝置上的草稿，還原成預設內容嗎？')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = clone(initialAnswers);
    imageFiles.clear();
    await clearStoredMedia();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
    refreshAll();
    toast('已還原成預設內容。');
  });

  document.querySelector('#copy-answers').addEventListener('click', copyAnswers);
  document.querySelector('#download-json').addEventListener('click', downloadJson);
  document.querySelector('#download-answers').addEventListener('click', downloadAnswers);
  saveProjectButton.addEventListener('click', saveToProject);

  renderSocialPicker();
  syncStaticControls();
  renderCollections();
  renderHomeOrder();
  persist();
  restoreStoredImages().finally(() => {
    mediaRestored = true;
    renderPreview();
    window.setTimeout(renderPreview, 500);
  });
  detectLocalAdapter();
  status.textContent = localStorage.getItem(STORAGE_KEY) ? '草稿已留在這台裝置' : '已載入目前網站內容';
}
