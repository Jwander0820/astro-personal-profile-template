import { createSaveCoordinator, createValueChangeTracker } from './save-coordinator.js';

const state = {
  content: null,
  order: [],
  homeVisibility: [],
  fortuneBucket: null,
  fortuneDraft: [],
  fortuneDirty: false,
  socialOrderDraft: [],
  validatedAnswers: null,
  toastTimer: null,
  previewRequest: 0,
  previewPending: null,
};
const saveTasks = new Map();

const fortuneGrades = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'];
const fortuneGradeOrder = Object.fromEntries(fortuneGrades.map((grade, index) => [grade, index]));

const homeLabels = {
  about: ['About me', '自介卡片與經歷'],
  turntable: ['播放唱盤', 'YouTube 播放清單'],
  links: ['Links', '精選網站與專案'],
  fortune: ['今日手氣', '互動抽籤板塊'],
  notion: ['Notion', '外部頁面預覽'],
};

const socialPresets = [
  ['facebook', 'Facebook', 'facebook', 'https://www.facebook.com/'],
  ['instagram', 'Instagram', 'instagram', 'https://www.instagram.com/'],
  ['threads', 'Threads', 'threads', 'https://www.threads.net/@'],
  ['github', 'GitHub', 'github', 'https://github.com/'],
  ['youtube', 'YouTube', 'youtube', 'https://www.youtube.com/@'],
  ['x', 'X', 'x', 'https://x.com/'],
  ['tiktok', 'TikTok', 'tiktok', 'https://www.tiktok.com/@'],
  ['linkedin', 'LinkedIn', 'linkedin', 'https://www.linkedin.com/in/'],
  ['spotify', 'Spotify', 'spotify', 'https://open.spotify.com/'],
  ['email', 'Email', 'mail', 'mailto:'],
  ['website', '個人網站', 'arrow', 'https://'],
  ['youtubemusic', 'YouTube Music', 'youtubemusic', 'https://music.youtube.com/'],
  ['applemusic', 'Apple Music', 'applemusic', 'https://music.apple.com/'],
  ['podcasts', 'Podcasts', 'podcasts', 'https://'],
  ['applepodcasts', 'Apple Podcasts', 'applepodcasts', 'https://podcasts.apple.com/'],
  ['kkbox', 'KKBOX', 'kkbox', 'https://www.kkbox.com/'],
  ['notion', 'Notion', 'notion', 'https://www.notion.so/'],
  ['pixiv', 'Pixiv', 'pixiv', 'https://www.pixiv.net/users/'],
  ['tidal', 'TIDAL', 'tidal', 'https://tidal.com/'],
].map(([id, label, icon, placeholder]) => ({ id, label, icon, placeholder }));

const iconLabels = {
  github: 'GitHub', threads: 'Threads', facebook: 'Facebook', x: 'X', twitter: 'Twitter / X',
  pixiv: 'Pixiv', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok',
  spotify: 'Spotify', youtubemusic: 'YouTube Music', applemusic: 'Apple Music', podcasts: 'Podcasts',
  applepodcasts: 'Apple Podcasts', kkbox: 'KKBOX', tidal: 'TIDAL', notion: 'Notion', mail: 'Email',
  music: '音樂', code: '程式碼', live: '現場活動', arrow: '一般連結', game12345: '數字牌', game: '遊戲手把',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast is-visible${error ? ' is-error' : ''}`;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { element.className = 'toast'; }, 3600);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '操作失敗。');
  return result;
}

const saveStatusLabels = {
  clean: '已儲存',
  dirty: '尚未儲存',
  scheduled: '待更新',
  saving: '更新中',
  refreshing: '更新中',
  error: '更新失敗',
};

function setSaveStatus(status, detail = '') {
  const element = $('#save-status');
  element.dataset.status = status;
  $('#save-status-text').textContent = detail || saveStatusLabels[status];
  const saveAll = $('#save-all');
  if (saveAll) saveAll.disabled = ['saving', 'refreshing'].includes(status) || !saveCoordinator.hasPending();
}

function refreshPreview(revision = state.content?.contentRevision ?? 0, timeoutMs = 8000) {
  if (state.previewPending) state.previewPending({ superseded: true });
  const frame = $('#preview');
  const requestId = ++state.previewRequest;
  const url = new URL(state.content.previewUrl);
  url.searchParams.set('studioRevision', String(revision));
  url.searchParams.set('studioRequest', String(requestId));
  frame.classList.add('is-refreshing');
  frame.setAttribute('aria-busy', 'true');
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      frame.removeEventListener('load', handleLoad);
      frame.removeEventListener('error', handleError);
      frame.classList.remove('is-refreshing');
      frame.removeAttribute('aria-busy');
      if (state.previewPending === settle) state.previewPending = null;
    };
    const settle = (result, error) => {
      cleanup();
      if (error) reject(error); else resolve(result);
    };
    const handleLoad = () => settle({ loaded: true, revision });
    const handleError = () => settle(null, new Error('預覽頁載入失敗。'));
    state.previewPending = settle;
    frame.addEventListener('load', handleLoad);
    frame.addEventListener('error', handleError, { once: true });
    timer = setTimeout(() => settle(null, new Error('內容已儲存，但預覽更新逾時。')), timeoutMs);
    frame.src = url.href;
  });
}

async function finishSave(result, message) {
  state.content.contentRevision = result.contentRevision;
  setSaveStatus('refreshing');
  try {
    const preview = await refreshPreview(result.contentRevision);
    if (!preview.superseded) setSaveStatus('clean');
    toast(message);
  } catch (error) {
    setSaveStatus('error');
    toast(error.message, true);
  }
}

async function refreshSavedContent(result, message) {
  state.content.contentRevision = result.contentRevision;
  const preview = await refreshPreview(result.contentRevision);
  if (!preview.superseded) toast(message);
}

const saveCoordinator = createSaveCoordinator({
  delayMs: 5000,
  canSave: ({ key }) => saveTasks.get(key)?.validate(false) !== false,
  save: async ({ key, revision }) => {
    const task = saveTasks.get(key);
    if (!task) throw new Error(`找不到儲存工作：${key}`);
    if (!task.validate(true)) throw new Error('請先修正欄位內容再儲存。');
    return task.run({ revision });
  },
  refresh: async ({ result, results, batch }) => refreshSavedContent(
    result.result,
    batch ? `${results.length} 項修改已儲存並更新。` : result.message,
  ),
  onStatus: ({ status, hasNewerChanges, contentSaved, error }) => {
    if (status === 'saving' && hasNewerChanges) setSaveStatus('saving');
    else if (status === 'error' && contentSaved) setSaveStatus('error');
    else if (status === 'clean' && saveCoordinator.hasPending()) setSaveStatus('dirty');
    else setSaveStatus(status);
    if (status === 'error' && error) toast(error.message, true);
  },
});

function registerSaveTask(key, task) {
  saveTasks.set(key, { validate: () => true, ...task });
}

function formValueSnapshot(form) {
  return JSON.stringify(
    [...new FormData(form).entries()]
      .filter(([, value]) => typeof value === 'string'),
  );
}

function bindDistinctFormChanges(form, callback) {
  const hasChanged = createValueChangeTracker(formValueSnapshot(form));
  const handleChange = (event) => {
    if (!hasChanged(formValueSnapshot(form))) return;
    callback(event);
  };
  form.addEventListener('input', handleChange);
  form.addEventListener('change', handleChange);
}

function bindSaveUnit(form, key, { ignore = () => false } = {}) {
  bindDistinctFormChanges(form, (event) => {
    if (event.target.matches('input[type="file"]') || ignore(event)) return;
    saveCoordinator.markDirty(key);
  });
}

async function submitSaveUnit(key, button) {
  const task = saveTasks.get(key);
  if (!task?.validate(true)) {
    setSaveStatus('dirty');
    return;
  }
  if (button) button.disabled = true;
  try { await saveCoordinator.submit(key); }
  catch { /* onStatus 已顯示可操作的錯誤。 */ }
  finally { if (button) button.disabled = false; }
}

async function submitAllPending() {
  const pendingKeys = saveCoordinator.pendingKeys();
  const invalidKey = pendingKeys.find((key) => saveTasks.get(key)?.validate(true) === false);
  if (invalidKey) {
    setSaveStatus('dirty');
    toast('請先修正尚未完成的欄位，再儲存全部修改。', true);
    return;
  }
  await saveCoordinator.submitAll();
}

function assertRerenderSafe(isAffected, message) {
  const affectedKeys = saveCoordinator.pendingKeys().filter(isAffected);
  if (affectedKeys.length > 0) throw new Error(message);
}

async function runExplicitSave(run, button) {
  if (button) button.disabled = true;
  setSaveStatus('saving');
  try {
    const output = await run();
    await finishSave(output.result, output.message);
    return output.result;
  } catch (error) {
    setSaveStatus('error');
    toast(error.message, true);
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}

function assetUrl(imagePath) {
  if (!imagePath) return '';
  return new URL(imagePath.replace(/^\//, ''), state.content.previewUrl).href;
}

function iconUrl(icon) {
  return `/api/icons/${encodeURIComponent(icon || 'arrow')}.svg`;
}

function previewUrl(icon, image) {
  return image ? assetUrl(image) : iconUrl(icon);
}

function buildIconOptions(selected) {
  const icons = [...new Set([...(state.content.icons ?? []), selected].filter(Boolean))];
  return icons.map((icon) => `<option value="${escapeHtml(icon)}" ${icon === selected ? 'selected' : ''}>${escapeHtml(iconLabels[icon] ?? icon)}</option>`).join('');
}

function switchMarkup(visible, label) {
  return `<label class="switch-control" title="${escapeHtml(label)}"><span>顯示</span><input name="visible" type="checkbox" ${visible ? 'checked' : ''} /><span class="switch-track" aria-hidden="true"></span></label>`;
}

function fontOptionsMarkup(selected) {
  return (state.content.fontOptions ?? []).map((font) => (
    `<option value="${escapeHtml(font.id)}" ${font.id === selected ? 'selected' : ''}>${escapeHtml(font.label)}</option>`
  )).join('');
}

function updateFontDescription(name) {
  const select = $(`#profile-panel select[name="${name}"]`);
  const font = (state.content.fontOptions ?? []).find((item) => item.id === select.value);
  const target = name === 'bodyFont' ? $('#body-font-description') : $('#display-font-description');
  target.textContent = font ? `${font.description}${font.license ? `｜${font.license}` : ''}` : '';
}

function populateProfile() {
  const form = $('#profile-panel');
  const profile = state.content.profile;
  form.elements.bodyFont.innerHTML = fontOptionsMarkup(profile.bodyFont ?? 'system');
  form.elements.displayFont.innerHTML = fontOptionsMarkup(profile.displayFont ?? 'system');
  ['displayName', 'title', 'location', 'archiveLabel', 'avatar', 'background', 'sectionsLayout', 'bodyFont', 'displayFont', 'fontScale', 'smallTextScale', 'bio'].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = profile[key] ?? '';
  });
  form.elements.tagline.value = Array.isArray(profile.tagline) ? profile.tagline.join(', ') : profile.tagline ?? '';
  $('#font-output').value = profile.fontScale ?? 1;
  $('#small-font-output').value = profile.smallTextScale ?? 1;
  updateFontDescription('bodyFont');
  updateFontDescription('displayFont');
}

function getBlock(id) {
  return state.content.blocks.find((block) => block.id === id);
}

function sectionEditorMarkup(section, isNew = false) {
  const data = section?.data ?? { title: '', slug: '', image: '', visible: true, layout: 'card', tags: [], order: 100 };
  return `<details class="content-editor section-editor" data-section-id="${escapeHtml(section?.id ?? '')}" data-new="${isNew}">
    <summary><span><strong>${escapeHtml(isNew ? '新增 About 卡片' : data.title)}</strong><small>${escapeHtml(isNew ? '填寫後建立 Markdown' : section.file)}</small></span><span class="disclosure" aria-hidden="true">⌄</span></summary>
    <form class="content-editor__body">
      <div class="link-editor__fields">
        <label><span>卡片標題</span><input name="title" value="${escapeHtml(data.title)}" maxlength="80" required /></label>
        <label><span>識別名稱</span><input name="slug" value="${escapeHtml(data.slug)}" placeholder="about" pattern="[a-z0-9][a-z0-9-]*" required /></label>
        <label class="field-wide"><span>內容</span><textarea name="body" rows="4" maxlength="5000">${escapeHtml(section?.body ?? '')}</textarea><small>支援 Markdown。</small></label>
        <label><span>標籤</span><input name="tags" value="${escapeHtml((data.tags ?? []).join(', '))}" placeholder="Python, Music" /></label>
        <label><span>圖片路徑 <i>選填</i></span><input name="image" value="${escapeHtml(data.image ?? '')}" placeholder="/images/about.svg" /></label>
        <label><span>卡片樣式</span><select name="layout"><option value="card" ${data.layout === 'card' ? 'selected' : ''}>一般卡片</option><option value="compact" ${data.layout === 'compact' ? 'selected' : ''}>精簡</option></select></label>
        <label><span>排序數字</span><input name="order" type="number" min="0" max="10000" value="${Number(data.order ?? 100)}" /></label>
      </div>
      <div class="link-editor__footer">${switchMarkup(Boolean(data.visible), 'About 卡片顯示設定')}<button class="secondary-action" type="submit">${isNew ? '建立卡片' : '儲存卡片'}</button></div>
    </form>
  </details>`;
}

function homeSettingsMarkup(id) {
  if (id === 'about') {
    const sections = [...state.content.sections].sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100));
    return `<div class="home-settings-heading"><label><span>板塊標題</span><input id="about-heading-input" value="${escapeHtml(state.content.profile.aboutHeading ?? 'About me')}" maxlength="80" /></label><button class="secondary-action" type="button" data-add-section>＋ 新增卡片</button></div>
      <div id="new-section-editor"></div>
      <div class="content-editor-list">${sections.map((section) => sectionEditorMarkup(section)).join('')}</div>`;
  }
  if (id === 'links') {
    return `<div class="home-settings-heading"><label><span>板塊標題</span><input id="links-heading-input" value="${escapeHtml(state.content.profile.linksHeading ?? 'Links')}" maxlength="80" /></label><button class="secondary-action" type="button" data-open-links>管理 Links 卡片</button></div><p class="inline-help">卡片的網址、內容、Icon 與顯示設定集中在「連結管理」，避免同一份資料出現兩套編輯欄位。</p>`;
  }
  const blockId = id === 'notion' ? 'notion-embed' : id;
  const block = getBlock(blockId);
  if (!block) return '<p class="inline-help">找不到這個板塊的 Markdown。</p>';
  const data = block.data;
  if (id === 'turntable') {
    return `<form class="home-block-form" data-block-id="turntable"><div class="link-editor__fields">
      <label><span>板塊標題</span><input name="title" value="${escapeHtml(data.title)}" required maxlength="80" /></label>
      <label><span>YouTube 播放清單</span><input name="playlist" value="${escapeHtml(data.playlistId ?? '')}" placeholder="貼上播放清單網址或 playlist ID" required /></label>
      <label class="field-wide"><span>說明</span><textarea name="body" rows="4" maxlength="5000">${escapeHtml(block.body)}</textarea></label>
      <label class="check-field"><input name="continuousPlayback" type="checkbox" ${data.continuousPlayback ? 'checked' : ''} /><span>切換頁面時持續播放</span></label>
    </div><div class="link-editor__footer"><span class="save-note">完整網址會自動抽出 list 參數</span><button class="secondary-action" type="submit">儲存唱盤</button></div></form>`;
  }
  if (id === 'notion') {
    return `<form class="home-block-form" data-block-id="notion-embed"><div class="link-editor__fields">
      <label><span>板塊標題</span><input name="title" value="${escapeHtml(data.title)}" required maxlength="80" /></label>
      <label><span>顯示方式</span><select name="embedMode"><option value="preview" ${data.embedMode === 'preview' ? 'selected' : ''}>簡化預覽卡片</option><option value="inline" ${data.embedMode === 'inline' ? 'selected' : ''}>頁面內嵌</option></select></label>
      <label class="field-wide"><span>Notion 公開頁面網址</span><input name="url" type="url" value="${escapeHtml(data.url ?? '')}" placeholder="https://name.notion.site/page" required /></label>
      <label><span>內嵌高度</span><input name="height" type="number" min="320" max="1200" value="${Number(data.height ?? 600)}" /></label>
      <label><span>說明 <i>預覽卡片使用</i></span><textarea name="body" rows="3" maxlength="5000">${escapeHtml(block.body)}</textarea></label>
    </div><div class="link-editor__footer"><span class="save-note">頁面需先在 Notion 發布到網路</span><button class="secondary-action" type="submit">儲存 Notion</button></div></form>`;
  }
  return `<form class="home-block-form" data-block-id="fortune"><div class="link-editor__fields">
    <label><span>板塊標題</span><input name="title" value="${escapeHtml(data.title)}" required maxlength="80" /></label>
    <label class="field-wide"><span>說明</span><textarea name="body" rows="4" maxlength="5000">${escapeHtml(block.body)}</textarea></label>
  </div><div class="link-editor__footer"><span class="save-note">籤詩內容仍來自 fortunes.json</span><button class="secondary-action" type="submit">儲存抽籤板塊</button></div></form>`;
}

function renderOrder() {
  const list = $('#order-list');
  list.innerHTML = '';
  state.order.forEach((id, index) => {
    const item = document.createElement('li');
    item.className = 'order-item home-item';
    item.draggable = true;
    item.dataset.id = id;
    item.innerHTML = `<div class="home-item__row"><span class="order-number">${String(index + 1).padStart(2, '0')}</span><button class="drag-handle" type="button" aria-label="拖曳 ${homeLabels[id][0]}">••</button><span class="order-copy"><strong>${homeLabels[id][0]}</strong><small>${homeLabels[id][1]}</small></span>${switchMarkup(state.homeVisibility.includes(id), `${homeLabels[id][0]}顯示設定`)}<span class="order-actions"><button type="button" data-move="up" aria-label="將 ${homeLabels[id][0]} 上移">↑</button><button type="button" data-move="down" aria-label="將 ${homeLabels[id][0]} 下移">↓</button><button type="button" data-expand aria-expanded="false">設定</button></span></div><div class="home-item__settings" hidden>${homeSettingsMarkup(id)}</div>`;
    item.addEventListener('dragstart', (event) => {
      if (!event.target.closest('.drag-handle')) { event.preventDefault(); return; }
      item.classList.add('is-dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
      saveCoordinator.markDirty('home');
    });
    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      const dragging = $('.order-item.is-dragging');
      if (!dragging || dragging === item) return;
      const before = event.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2;
      list.insertBefore(dragging, before ? item : item.nextSibling);
      state.order = $$('.order-item', list).map((element) => element.dataset.id);
      updateOrderNumbers();
    });
    item.addEventListener('click', (event) => {
      const moveButton = event.target.closest('button[data-move]');
      if (moveButton) {
        const sibling = moveButton.dataset.move === 'up' ? item.previousElementSibling : item.nextElementSibling;
        if (!sibling) return;
        if (moveButton.dataset.move === 'up') sibling.before(item); else sibling.after(item);
        state.order = $$('.order-item', list).map((element) => element.dataset.id);
        updateOrderNumbers();
        saveCoordinator.markDirty('home');
        return;
      }
      const expandButton = event.target.closest('button[data-expand]');
      if (expandButton) {
        const settings = $('.home-item__settings', item);
        settings.hidden = !settings.hidden;
        expandButton.setAttribute('aria-expanded', settings.hidden ? 'false' : 'true');
        expandButton.textContent = settings.hidden ? '設定' : '收合';
      }
    });
    const visibility = $('.home-item__row input[name="visible"]', item);
    $('.home-item__row .switch-control', item).addEventListener('click', (event) => event.stopPropagation());
    visibility.addEventListener('change', () => {
      const visible = new Set(state.homeVisibility);
      if (visibility.checked) visible.add(id); else visible.delete(id);
      state.homeVisibility = HOME_ORDER(visible);
      saveCoordinator.markDirty('home');
    });
    list.append(item);
  });
  bindHomeEditors();
}

function HOME_ORDER(visible) {
  return state.order.filter((id) => visible.has(id));
}

function updateOrderNumbers() {
  $$('.order-item', $('#order-list')).forEach((item, index) => { $('.order-number', item).textContent = String(index + 1).padStart(2, '0'); });
}

function bindSectionEditor(editor) {
  const form = $('form', editor);
  const isNew = editor.dataset.new === 'true';
  const key = `section:${editor.dataset.sectionId}`;
  const persist = async () => {
    if (isNew) {
      assertRerenderSafe(
        (pendingKey) => pendingKey === 'home' || pendingKey.startsWith('section:') || pendingKey.startsWith('block:'),
        '請先儲存首頁板塊與 About 卡片草稿，再建立新卡片。',
      );
    }
    const values = Object.fromEntries(new FormData(form));
    values.visible = form.elements.visible.checked;
    values.order = Number(values.order);
    values.tags = values.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const endpoint = isNew ? '/api/sections' : `/api/sections/${editor.dataset.sectionId}`;
    const result = await api(endpoint, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(values) });
    const index = state.content.sections.findIndex((item) => item.id === result.section.id);
    if (index >= 0) state.content.sections[index] = result.section;
    else state.content.sections.push(result.section);
    if (isNew) renderOrder();
    else {
      $('summary strong', editor).textContent = result.section.data.title;
      $('summary small', editor).textContent = result.section.file;
    }
    return { result, message: `已儲存 About 卡片「${result.section.data.title}」。` };
  };
  if (!isNew) {
    registerSaveTask(key, { validate: (report) => report ? form.reportValidity() : form.checkValidity(), run: persist });
    bindSaveUnit(form, key);
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('button[type="submit"]', form);
    if (isNew) await runExplicitSave(persist, button);
    else await submitSaveUnit(key, button);
  });
}

function bindHomeEditors() {
  $$('.section-editor', $('#order-list')).forEach(bindSectionEditor);
  $$('[data-add-section]', $('#order-list')).forEach((button) => button.addEventListener('click', () => {
    const container = $('#new-section-editor');
    if (container.innerHTML) { container.innerHTML = ''; return; }
    container.innerHTML = sectionEditorMarkup(null, true);
    const editor = $('.section-editor', container);
    editor.open = true;
    bindSectionEditor(editor);
    $('input[name="title"]', editor).focus();
  }));
  $$('[data-open-links]', $('#order-list')).forEach((button) => button.addEventListener('click', () => {
    $('.tab[data-panel="links"]').click();
  }));
  ['#about-heading-input', '#links-heading-input'].forEach((selector) => {
    const input = $(selector);
    if (input) input.addEventListener('input', () => saveCoordinator.markDirty('home'));
  });
  $$('.home-block-form', $('#order-list')).forEach((form) => {
    const key = `block:${form.dataset.blockId}`;
    const persist = async () => {
      const values = Object.fromEntries(new FormData(form));
      if (form.elements.continuousPlayback) values.continuousPlayback = form.elements.continuousPlayback.checked;
      if (form.elements.height) values.height = Number(values.height);
      const result = await api(`/api/blocks/${form.dataset.blockId}`, { method: 'PUT', body: JSON.stringify(values) });
      const index = state.content.blocks.findIndex((item) => item.id === result.block.id);
      if (index >= 0) state.content.blocks[index] = result.block;
      return { result, message: `已儲存「${result.block.data.title}」。` };
    };
    registerSaveTask(key, { validate: (report) => report ? form.reportValidity() : form.checkValidity(), run: persist });
    bindSaveUnit(form, key);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitSaveUnit(key, $('button[type="submit"]', form));
    });
  });
}

function imageBlockEditorMarkup(block, isNew = false) {
  const data = block?.data ?? {
    title: '',
    placement: 'after-sections',
    order: 100,
    visible: true,
    image: '',
    imageAlt: '',
    imageLayout: 'full',
    imageAspect: 'landscape',
    imagePosition: 'center',
    tags: [],
  };
  const preview = data.image
    ? `<img src="${escapeHtml(assetUrl(data.image))}" alt="" />`
    : '';
  return `<details class="image-block-editor" data-block-id="${escapeHtml(block?.id ?? '')}" data-new="${isNew}">
    <summary><span class="image-block-preview">${preview}</span><span class="link-editor__meta"><strong>${escapeHtml(isNew ? '新增圖片板塊' : data.title)}</strong><small>${escapeHtml(isNew ? '選擇圖片與顯示區域' : block.file)}</small></span><span class="count-badge">${escapeHtml(data.imageLayout)}</span><span class="disclosure" aria-hidden="true">⌄</span></summary>
    <form class="image-block-editor__body">
      <div class="image-block-fields">
        ${isNew ? '<label><span>識別名稱</span><input name="id" placeholder="travel-photo" pattern="[a-z0-9][a-z0-9-]*" required /></label>' : ''}
        <label><span>板塊標題</span><input name="title" value="${escapeHtml(data.title)}" maxlength="80" required /></label>
        <label><span>顯示區域</span><select name="placement">
          <option value="before-links" ${data.placement === 'before-links' ? 'selected' : ''}>Links 前</option>
          <option value="between-links-sections" ${data.placement === 'between-links-sections' ? 'selected' : ''}>Links 後</option>
          <option value="after-sections" ${data.placement === 'after-sections' ? 'selected' : ''}>About 後</option>
        </select></label>
        <label><span>版型</span><select name="imageLayout">
          <option value="full" ${data.imageLayout === 'full' ? 'selected' : ''}>滿版圖片＋下方文字</option>
          <option value="split-left" ${data.imageLayout === 'split-left' ? 'selected' : ''}>圖片左／文字右</option>
          <option value="split-right" ${data.imageLayout === 'split-right' ? 'selected' : ''}>文字左／圖片右</option>
          <option value="poster" ${data.imageLayout === 'poster' ? 'selected' : ''}>海報式覆字</option>
        </select></label>
        <label><span>圖片比例</span><select name="imageAspect">
          <option value="auto" ${data.imageAspect === 'auto' ? 'selected' : ''}>保留原圖</option>
          <option value="landscape" ${data.imageAspect === 'landscape' ? 'selected' : ''}>橫幅 16:9</option>
          <option value="square" ${data.imageAspect === 'square' ? 'selected' : ''}>正方形 1:1</option>
          <option value="portrait" ${data.imageAspect === 'portrait' ? 'selected' : ''}>直式 4:5</option>
        </select></label>
        <label><span>圖片焦點</span><select name="imagePosition">
          <option value="center" ${data.imagePosition === 'center' ? 'selected' : ''}>中央</option>
          <option value="top" ${data.imagePosition === 'top' ? 'selected' : ''}>上方</option>
          <option value="bottom" ${data.imagePosition === 'bottom' ? 'selected' : ''}>下方</option>
          <option value="left" ${data.imagePosition === 'left' ? 'selected' : ''}>左側</option>
          <option value="right" ${data.imagePosition === 'right' ? 'selected' : ''}>右側</option>
          <option value="top-left" ${data.imagePosition === 'top-left' ? 'selected' : ''}>左上</option>
          <option value="top-right" ${data.imagePosition === 'top-right' ? 'selected' : ''}>右上</option>
          <option value="bottom-left" ${data.imagePosition === 'bottom-left' ? 'selected' : ''}>左下</option>
          <option value="bottom-right" ${data.imagePosition === 'bottom-right' ? 'selected' : ''}>右下</option>
        </select></label>
        <label><span>排序數字</span><input name="order" type="number" min="0" max="10000" value="${Number(data.order ?? 100)}" /></label>
        <div class="field-wide image-input-row">
          <label><span>圖片路徑</span><input name="image" value="${escapeHtml(data.image ?? '')}" placeholder="/images/photo.jpg" required /></label>
          <label class="file-button">上傳圖片<input class="image-block-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
        </div>
        <label class="field-wide"><span>替代文字</span><input name="imageAlt" value="${escapeHtml(data.imageAlt ?? '')}" maxlength="300" placeholder="描述圖片內容，純裝飾圖片可留空" /></label>
        <label class="field-wide"><span>附加文字 <i>選填</i></span><textarea name="body" rows="5" maxlength="5000">${escapeHtml(block?.body ?? '')}</textarea><small>支援 Markdown；滿版版型會顯示在圖片下方。</small></label>
        <label class="field-wide"><span>標籤</span><input name="tags" value="${escapeHtml((data.tags ?? []).join(', '))}" placeholder="Travel, Photography" /></label>
      </div>
      <div class="image-block-editor__footer">${switchMarkup(Boolean(data.visible), '圖片板塊顯示設定')}<button class="secondary-action" type="submit">${isNew ? '建立圖片板塊' : '儲存圖片板塊'}</button></div>
    </form>
  </details>`;
}

function bindImageBlockEditor(editor) {
  const form = $('form', editor);
  const isNew = editor.dataset.new === 'true';
  const key = `image-block:${editor.dataset.blockId}`;
  const persist = async () => {
    if (isNew) {
      assertRerenderSafe(
        (pendingKey) => pendingKey.startsWith('image-block:'),
        '請先儲存其他圖片板塊草稿，再建立新圖片板塊。',
      );
    }
    const values = Object.fromEntries(new FormData(form));
    values.visible = form.elements.visible.checked;
    values.order = Number(values.order);
    values.tags = values.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    const endpoint = isNew ? '/api/image-blocks' : `/api/image-blocks/${editor.dataset.blockId}`;
    const result = await api(endpoint, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(values) });
    const index = state.content.blocks.findIndex((item) => item.id === result.block.id);
    if (index >= 0) state.content.blocks[index] = result.block;
    else state.content.blocks.push(result.block);
    if (isNew) renderImageBlockManager();
    else {
      $('summary strong', editor).textContent = result.block.data.title;
      $('summary small', editor).textContent = result.block.file;
      $('.count-badge', editor).textContent = result.block.data.imageLayout;
      const preview = $('.image-block-preview', editor);
      preview.innerHTML = `<img src="${escapeHtml(assetUrl(result.block.data.image))}" alt="" />`;
    }
    return { result, message: `已儲存圖片板塊「${result.block.data.title}」。` };
  };
  if (!isNew) {
    registerSaveTask(key, { validate: (report) => report ? form.reportValidity() : form.checkValidity(), run: persist });
    bindSaveUnit(form, key);
  }
  $('.image-block-upload', form).addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imagePath = await uploadAsset(file);
      form.elements.image.value = imagePath;
      const preview = $('.image-block-preview', editor);
      preview.innerHTML = `<img src="${escapeHtml(assetUrl(imagePath))}" alt="" />`;
      if (!isNew) saveCoordinator.markDirty(key);
      toast(`圖片已放入 ${imagePath}。`);
    } catch (error) {
      toast(error.message, true);
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('button[type="submit"]', form);
    if (isNew) await runExplicitSave(persist, button);
    else await submitSaveUnit(key, button);
  });
}

function renderImageBlockManager() {
  const blocks = state.content.blocks
    .filter((block) => block.data.layout === 'image')
    .sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100));
  $('#new-image-block').innerHTML = '';
  $('#image-block-list').innerHTML = blocks.map((block) => imageBlockEditorMarkup(block)).join('');
  $$('.image-block-editor', $('#image-block-list')).forEach(bindImageBlockEditor);
}

function showNewImageBlock() {
  const container = $('#new-image-block');
  if (container.innerHTML) { container.innerHTML = ''; return; }
  container.innerHTML = imageBlockEditorMarkup(null, true);
  const editor = $('.image-block-editor', container);
  editor.open = true;
  bindImageBlockEditor(editor);
  $('input[name="id"]', editor).focus();
}

function socialEntries() {
  const existing = state.content.links.filter((link) => link.data.group === 'social');
  const used = new Set();
  const entries = socialPresets.map((preset) => {
    const exactIds = new Set([preset.id, `social-${preset.id}`, `generated-social-${preset.id}`, `studio-social-${preset.id}`]);
    const link = existing.find((item) => !used.has(item.id) && exactIds.has(item.id))
      ?? existing.find((item) => !used.has(item.id) && item.data.icon === preset.icon);
    if (link) used.add(link.id);
    return { preset, link };
  });
  existing.filter((link) => !used.has(link.id)).forEach((link) => {
    entries.push({ preset: { id: link.id, label: link.data.title, icon: link.data.icon, placeholder: 'https://' }, link });
  });
  return entries.sort((a, b) => {
    const aPresetOrder = socialPresets.findIndex((preset) => preset.id === a.preset.id);
    const bPresetOrder = socialPresets.findIndex((preset) => preset.id === b.preset.id);
    const aDraftOrder = a.link ? state.socialOrderDraft.indexOf(a.link.id) : -1;
    const bDraftOrder = b.link ? state.socialOrderDraft.indexOf(b.link.id) : -1;
    const aOrder = aDraftOrder >= 0 ? (aDraftOrder + 1) * 10 : (a.link?.data.order ?? (aPresetOrder >= 0 ? (aPresetOrder + 1) * 10 : 10000));
    const bOrder = bDraftOrder >= 0 ? (bDraftOrder + 1) * 10 : (b.link?.data.order ?? (bPresetOrder >= 0 ? (bPresetOrder + 1) * 10 : 10000));
    return aOrder - bOrder || a.preset.label.localeCompare(b.preset.label);
  });
}

function editorStatus(link) {
  if (!link) return '尚未設定';
  return link.data.visible ? '顯示中' : '已設定・目前隱藏';
}

function socialEditorMarkup(preset, link, position) {
  const data = link?.data ?? { title: preset.label, url: '', icon: preset.icon, visible: false, image: '', order: 100 };
  const id = link?.id ?? `studio-social-${preset.id}`;
  return `<details class="link-editor" data-link-id="${escapeHtml(id)}" data-kind="social" data-exists="${Boolean(link)}" data-order="${escapeHtml(data.order)}">
    <summary class="link-editor__summary">
      <button class="social-drag-handle" type="button" draggable="${Boolean(link)}" aria-label="拖曳調整 ${escapeHtml(preset.label)} 的顯示順序" ${link ? '' : 'disabled'}><span class="social-order-number" aria-hidden="true">${String(position).padStart(2, '0')}</span><span class="social-drag-glyph" aria-hidden="true">••</span></button>
      <span class="icon-preview"><img src="${escapeHtml(previewUrl(data.icon, data.image))}" alt="" /></span>
      <span class="link-editor__meta"><strong>${escapeHtml(preset.label)}</strong><small>${escapeHtml(editorStatus(link))}</small></span>
      ${switchMarkup(Boolean(data.visible), `${preset.label}顯示設定`)}
      ${link ? '<span class="social-order-actions"><button type="button" data-social-move="up" aria-label="上移此社群 icon">↑</button><button type="button" data-social-move="down" aria-label="下移此社群 icon">↓</button></span>' : '<span class="social-order-placeholder" aria-hidden="true"></span>'}
      <span class="disclosure" aria-hidden="true">⌄</span>
    </summary>
    <form class="link-editor__body">
      <div class="link-editor__fields">
        <label><span>顯示名稱</span><input name="title" value="${escapeHtml(data.title)}" maxlength="80" required /></label>
        <label><span>網址</span><input name="url" value="${escapeHtml(data.url)}" placeholder="${escapeHtml(preset.placeholder)}" maxlength="500" required /></label>
        <div class="field-wide icon-controls">
          <label><span>內建 Icon</span><select name="icon">${buildIconOptions(data.icon)}</select></label>
          <label class="file-button">匯入 Icon<input name="iconUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
          <button class="text-action clear-custom-icon" type="button" ${data.image ? '' : 'hidden'}>改用內建</button>
          <input name="image" type="hidden" value="${escapeHtml(data.image ?? '')}" />
        </div>
      </div>
      <div class="link-editor__footer"><span class="save-note">${escapeHtml(link?.file ?? '儲存後建立 Markdown')}</span><button class="secondary-action" type="submit">儲存設定</button></div>
    </form>
  </details>`;
}

function featuredEditorMarkup(link, isNew = false) {
  const data = link?.data ?? { title: '', url: '', icon: 'arrow', visible: true, image: '', style: 'normal', tags: [], order: 100 };
  const id = link?.id ?? '';
  const title = isNew ? '新增 Links 卡片' : data.title;
  return `<details class="link-editor ${isNew ? 'new-link-editor' : ''}" data-link-id="${escapeHtml(id)}" data-kind="featured" data-exists="${Boolean(link)}" ${isNew ? 'open' : ''}>
    <summary class="link-editor__summary">
      <span class="icon-preview"><img src="${escapeHtml(previewUrl(data.icon, data.image))}" alt="" /></span>
      <span class="link-editor__meta"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(isNew ? '填寫後建立新卡片' : editorStatus(link))}</small></span>
      ${switchMarkup(Boolean(data.visible), `${title}顯示設定`)}
      <span class="disclosure" aria-hidden="true">⌄</span>
    </summary>
    <form class="link-editor__body">
      <div class="link-editor__fields">
        <label><span>卡片名稱</span><input name="title" value="${escapeHtml(data.title)}" maxlength="80" required /></label>
        <label><span>網址</span><input name="url" value="${escapeHtml(data.url)}" placeholder="https://" maxlength="500" required /></label>
        <label class="field-wide"><span>說明</span><textarea name="body" rows="3" maxlength="3000" placeholder="這張卡片要介紹什麼？">${escapeHtml(link?.body ?? '')}</textarea></label>
        <label><span>標籤</span><input name="tags" value="${escapeHtml((data.tags ?? []).join(', '))}" placeholder="Project, Notes" /></label>
        <label><span>卡片樣式</span><select name="style"><option value="primary" ${data.style === 'primary' ? 'selected' : ''}>主要</option><option value="normal" ${data.style === 'normal' ? 'selected' : ''}>一般</option><option value="subtle" ${data.style === 'subtle' ? 'selected' : ''}>低調</option></select></label>
        <div class="field-wide icon-controls">
          <label><span>內建 Icon</span><select name="icon">${buildIconOptions(data.icon)}</select></label>
          <label class="file-button">匯入 Icon<input name="iconUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
          <button class="text-action clear-custom-icon" type="button" ${data.image ? '' : 'hidden'}>改用內建</button>
          <input name="image" type="hidden" value="${escapeHtml(data.image ?? '')}" />
        </div>
      </div>
      <div class="link-editor__footer"><span class="save-note">${escapeHtml(link?.file ?? '將建立新的 Markdown')}</span><button class="secondary-action" type="submit">${isNew ? '建立 Link' : '儲存卡片'}</button></div>
    </form>
  </details>`;
}

function bindLinkEditor(editor) {
  const form = $('form', editor);
  const exists = editor.dataset.exists === 'true';
  const key = `link:${editor.dataset.linkId}`;
  const visibility = $('input[name="visible"]', editor);
  const switchControl = $('.switch-control', editor);
  switchControl.addEventListener('click', (event) => event.stopPropagation());
  switchControl.addEventListener('keydown', (event) => event.stopPropagation());
  bindSocialOrderControls(editor);
  bindSocialDrag(editor);
  visibility.addEventListener('change', () => {
    if (!exists) {
      editor.open = true;
      if (visibility.checked) toast('先填寫網址，再儲存即可開啟這個項目。');
    }
    $('.link-editor__meta small', editor).textContent = '尚未儲存';
    saveCoordinator.markDirty(key);
    updateSocialCount();
  });
  if (exists || editor.dataset.kind === 'social') {
    registerSaveTask(key, {
      validate: (report) => report ? form.reportValidity() : form.checkValidity(),
      run: () => persistLinkEditor(editor),
    });
    bindSaveUnit(form, key);
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', form);
    if (exists || editor.dataset.kind === 'social') await submitSaveUnit(key, button);
    else await runExplicitSave(() => persistLinkEditor(editor), button);
  });
  form.elements.icon.addEventListener('change', () => updateEditorIcon(editor));
  form.elements.iconUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      form.elements.image.value = await uploadAsset(file);
      updateEditorIcon(editor);
      if (exists) saveCoordinator.markDirty(key);
      toast('自訂 Icon 已匯入；按下儲存後套用。');
    } catch (error) { toast(error.message, true); }
  });
  $('.clear-custom-icon', editor).addEventListener('click', () => {
    form.elements.image.value = '';
    updateEditorIcon(editor);
    if (exists) saveCoordinator.markDirty(key);
  });
}

function updateEditorIcon(editor) {
  const form = $('form', editor);
  $('.icon-preview img', editor).src = previewUrl(form.elements.icon.value, form.elements.image.value);
  $('.clear-custom-icon', editor).hidden = !form.elements.image.value;
}

function linkPayload(editor) {
  const form = $('form', editor);
  const kind = editor.dataset.kind;
  const featured = kind === 'featured';
  const featuredOrders = state.content.links.filter((item) => ['main', 'featured'].includes(item.data.group)).map((item) => item.data.order ?? 0);
  return {
    title: form.elements.title.value.trim(),
    url: form.elements.url.value.trim(),
    icon: form.elements.icon.value,
    image: form.elements.image.value,
    visible: $('input[name="visible"]', editor).checked,
    group: featured ? 'featured' : 'social',
    layout: featured ? 'card' : 'icon',
    style: featured ? form.elements.style.value : 'normal',
    order: editor.dataset.exists === 'true'
      ? Number(state.content.links.find((item) => item.id === editor.dataset.linkId)?.data.order ?? 100)
      : (featured ? Math.max(0, ...featuredOrders) + 10 : socialPresets.findIndex((item) => editor.dataset.linkId.endsWith(item.id)) * 10 + 10),
    tags: featured ? form.elements.tags.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) : [],
    body: featured ? form.elements.body.value.trim() : '',
  };
}

async function persistLinkEditor(editor) {
  const form = $('form', editor);
  if (!form.reportValidity()) throw new Error('請先填完名稱與網址。');
  const isNewFeatured = editor.dataset.kind === 'featured' && editor.dataset.exists !== 'true';
  if (isNewFeatured) {
    assertRerenderSafe(
      (pendingKey) => pendingKey === 'social-order' || pendingKey.startsWith('link:'),
      '請先儲存其他連結與社群排序草稿，再建立新 Link。',
    );
  }
  const endpoint = isNewFeatured ? '/api/links' : `/api/links/${editor.dataset.linkId}`;
  const payload = linkPayload(editor);
  const result = await api(endpoint, { method: isNewFeatured ? 'POST' : 'PUT', body: JSON.stringify(payload) });
  const index = state.content.links.findIndex((item) => item.id === result.link.id);
  if (index >= 0) state.content.links[index] = result.link;
  else state.content.links.push(result.link);
  if (isNewFeatured) {
    const scrollTop = $('.editor').scrollTop;
    $('#new-featured-link').innerHTML = '';
    renderLinkManager();
    requestAnimationFrame(() => { $('.editor').scrollTop = scrollTop; });
  } else {
    const wasNewSocial = editor.dataset.kind === 'social' && editor.dataset.exists !== 'true';
    editor.dataset.exists = 'true';
    editor.dataset.linkId = result.link.id;
    $('.link-editor__meta strong', editor).textContent = result.link.data.title;
    $('.link-editor__meta small', editor).textContent = editorStatus(result.link);
    $('.save-note', editor).textContent = result.link.file;
    if (wasNewSocial) {
      state.socialOrderDraft.push(result.link.id);
      const placeholder = $('.social-order-placeholder', editor);
      if (placeholder) {
        placeholder.outerHTML = '<span class="social-order-actions"><button type="button" data-social-move="up" aria-label="上移此社群 icon">↑</button><button type="button" data-social-move="down" aria-label="下移此社群 icon">↓</button></span>';
      }
      $('.social-drag-handle', editor).disabled = false;
      $('.social-drag-handle', editor).draggable = true;
      bindSocialOrderControls(editor);
      bindSocialDrag(editor);
    }
    updateSocialOrderControls();
    updateSocialCount();
  }
  return { result, message: `已儲存 ${result.link.data.title}。` };
}

function bindSocialOrderControls(editor) {
  const dragHandle = $('.social-drag-handle', editor);
  if (dragHandle && dragHandle.dataset.bound !== 'true') {
    dragHandle.dataset.bound = 'true';
    dragHandle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }
  $$('[data-social-move]', editor).forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveSocialLink(editor, button.dataset.socialMove);
    });
  });
}

function configuredSocialEditors() {
  return $$('.link-editor[data-kind="social"][data-exists="true"]', $('#social-link-list'));
}

function syncSocialOrderDraft() {
  state.socialOrderDraft = configuredSocialEditors().map((editor) => editor.dataset.linkId);
}

function bindSocialDrag(editor) {
  if (editor.dataset.kind !== 'social' || editor.dataset.dragBound === 'true') return;
  editor.dataset.dragBound = 'true';
  const dragHandle = $('.social-drag-handle', editor);
  dragHandle.addEventListener('dragstart', (event) => {
    if (editor.dataset.exists !== 'true') {
      event.preventDefault();
      return;
    }
    editor.dataset.dragStartOrder = state.socialOrderDraft.join('|');
    editor.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', editor.dataset.linkId);
  });
  editor.addEventListener('dragover', (event) => {
    const dragging = $('.link-editor.is-dragging', $('#social-link-list'));
    if (!dragging || dragging === editor || editor.dataset.exists !== 'true') return;
    event.preventDefault();
    const before = event.clientY < editor.getBoundingClientRect().top + editor.offsetHeight / 2;
    $('#social-link-list').insertBefore(dragging, before ? editor : editor.nextSibling);
    syncSocialOrderDraft();
    updateSocialOrderControls();
  });
  dragHandle.addEventListener('dragend', () => {
    editor.classList.remove('is-dragging');
    syncSocialOrderDraft();
    if (editor.dataset.dragStartOrder !== state.socialOrderDraft.join('|')) saveCoordinator.markDirty('social-order');
    delete editor.dataset.dragStartOrder;
  });
}

function moveSocialLink(editor, direction) {
  const configured = $$('.link-editor[data-kind="social"][data-exists="true"]', $('#social-link-list'));
  const index = configured.indexOf(editor);
  const target = configured[index + (direction === 'up' ? -1 : 1)];
  if (!target) return;
  if (direction === 'up') target.before(editor); else target.after(editor);
  syncSocialOrderDraft();
  updateSocialOrderControls();
  saveCoordinator.markDirty('social-order');
}

async function persistSocialOrder() {
  const saved = await api('/api/social-order', {
    method: 'PUT',
    body: JSON.stringify({ links: state.socialOrderDraft.map((id, index) => ({ id, order: (index + 1) * 10 })) }),
  });
  saved.links.forEach((link) => {
    const stateIndex = state.content.links.findIndex((item) => item.id === link.id);
    if (stateIndex >= 0) state.content.links[stateIndex] = link;
  });
  return { result: saved, message: '社群 icon 順序已儲存。' };
}

function updateSocialOrderControls() {
  const editors = $$('.link-editor[data-kind="social"]', $('#social-link-list'));
  editors.forEach((editor, index) => {
    const number = $('.social-order-number', editor);
    if (number) {
      number.textContent = String(index + 1).padStart(2, '0');
      $('.social-drag-handle', editor)?.setAttribute('aria-label', `拖曳調整第 ${index + 1} 個社群 icon 的顯示順序`);
    }
  });
  const configured = editors.filter((editor) => editor.dataset.exists === 'true');
  configured.forEach((editor, index) => {
    const up = $('[data-social-move="up"]', editor);
    const down = $('[data-social-move="down"]', editor);
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === configured.length - 1;
  });
}

function updateSocialCount() {
  const editors = $$('.link-editor[data-kind="social"]', $('#social-link-list'));
  $('#social-count').textContent = `${editors.filter((editor) => $('input[name="visible"]', editor)?.checked).length} / ${editors.length} 顯示`;
}

function renderLinkManager() {
  const entries = socialEntries();
  $('#social-link-list').innerHTML = entries.map(({ preset, link }, index) => socialEditorMarkup(preset, link, index + 1)).join('');
  const featured = state.content.links
    .filter((link) => ['main', 'featured'].includes(link.data.group))
    .sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100));
  $('#featured-link-list').innerHTML = featured.map((link) => featuredEditorMarkup(link)).join('');
  registerSaveTask('social-order', { run: persistSocialOrder });
  updateSocialCount();
  $$('.link-editor', $('#links-panel')).forEach(bindLinkEditor);
  updateSocialOrderControls();
}

function showNewFeaturedEditor() {
  const container = $('#new-featured-link');
  if (container.innerHTML) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = featuredEditorMarkup(null, true);
  bindLinkEditor($('.link-editor', container));
  $('input[name="title"]', container).focus();
}

function fortuneSummary(fortunes) {
  const visible = fortunes.filter((fortune) => fortune.visible);
  const count = (key, value) => fortunes.filter((fortune) => fortune[key] === value).length;
  const jokeRatio = visible.length ? visible.filter((fortune) => fortune.category === 'joke').length / visible.length : 0;
  return {
    total: fortunes.length,
    visible: visible.length,
    grades: Object.fromEntries(fortuneGrades.map((grade) => [grade, count('grade', grade)])),
    categories: { blessing: count('category', 'blessing'), joke: count('category', 'joke') },
    warnings: jokeRatio < 0.2 || jokeRatio > 0.4 ? ['目前啟用籤的玩梗比例偏離建議的約 3 成；這是風格提示，不會阻擋儲存。'] : [],
  };
}

function renderFortuneSummary() {
  const summary = fortuneSummary(state.fortuneDraft);
  $('#fortune-summary').innerHTML = [
    `共 ${summary.total} 張`,
    `啟用 ${summary.visible} 張`,
    ...fortuneGrades.map((grade) => `${grade} ${summary.grades[grade]}`),
    `祝福 ${summary.categories.blessing}`,
    `玩梗 ${summary.categories.joke}`,
  ].map((label) => `<span>${escapeHtml(label)}</span>`).join('');
  const warning = $('#fortune-warning');
  warning.hidden = summary.warnings.length === 0;
  warning.textContent = summary.warnings.join(' ');
}

function fortuneEditorMarkup(fortune, sourceIndex) {
  return `<details class="fortune-editor" data-index="${sourceIndex}">
    <summary>
      <span class="fortune-preview-grade">${escapeHtml(fortune.grade)}</span>
      <span class="fortune-preview-copy"><strong>${escapeHtml(fortune.message)}</strong><small>${escapeHtml(fortune.id)}・${fortune.visible ? '啟用中' : '已停用'}</small></span>
      <span class="disclosure" aria-hidden="true">⌄</span>
    </summary>
    <form class="fortune-editor__body">
      <div class="fortune-fields">
        <label><span>ID</span><input name="id" value="${escapeHtml(fortune.id)}" pattern="[a-z0-9][a-z0-9-]*" maxlength="80" required /></label>
        <label><span>等級</span><select name="grade">${fortuneGrades.map((grade) => `<option value="${grade}" ${fortune.grade === grade ? 'selected' : ''}>${grade}</option>`).join('')}</select></label>
        <label><span>分類</span><select name="category"><option value="blessing" ${fortune.category === 'blessing' ? 'selected' : ''}>祝福</option><option value="joke" ${fortune.category === 'joke' ? 'selected' : ''}>玩梗</option></select></label>
        <label class="switch-control fortune-visible"><span>啟用</span><input name="visible" type="checkbox" ${fortune.visible ? 'checked' : ''} /><span class="switch-track" aria-hidden="true"></span></label>
        <label class="field-wide"><span>籤文</span><textarea name="message" rows="3" maxlength="200" required>${escapeHtml(fortune.message)}</textarea></label>
        <label class="field-wide"><span>備註 <i>選填</i></span><textarea name="note" rows="2" maxlength="300">${escapeHtml(fortune.note ?? '')}</textarea></label>
      </div>
      <div class="fortune-editor__footer">
        <span><button class="text-action" type="button" data-fortune-move="up">上移</button><button class="text-action" type="button" data-fortune-move="down">下移</button></span>
        <button class="danger-action" type="button" data-delete-fortune>刪除</button>
      </div>
    </form>
  </details>`;
}

function markFortuneDirty() {
  state.fortuneDirty = true;
  saveCoordinator.markDirty('fortunes');
}

function renderFortuneList() {
  const query = $('#fortune-search').value.trim().toLowerCase();
  const sort = $('#fortune-sort').value;
  const entries = state.fortuneDraft
    .map((fortune, sourceIndex) => ({ fortune, sourceIndex }))
    .filter(({ fortune }) => !query || [fortune.id, fortune.message, fortune.note].some((value) => String(value ?? '').toLowerCase().includes(query)));
  if (sort === 'grade') entries.sort((a, b) => fortuneGradeOrder[a.fortune.grade] - fortuneGradeOrder[b.fortune.grade]);
  if (sort === 'category') entries.sort((a, b) => a.fortune.category.localeCompare(b.fortune.category));
  if (sort === 'visible') entries.sort((a, b) => Number(b.fortune.visible) - Number(a.fortune.visible));
  $('#fortune-list').innerHTML = entries.length
    ? entries.map(({ fortune, sourceIndex }) => fortuneEditorMarkup(fortune, sourceIndex)).join('')
    : '<p class="inline-help">找不到符合條件的籤詩。</p>';
  $$('.fortune-editor', $('#fortune-list')).forEach((editor) => {
    const sourceIndex = Number(editor.dataset.index);
    const form = $('form', editor);
    const updateDraft = () => {
      const values = Object.fromEntries(new FormData(form));
      state.fortuneDraft[sourceIndex] = { ...values, visible: form.elements.visible.checked };
      $('.fortune-preview-grade', editor).textContent = values.grade;
      $('.fortune-preview-copy strong', editor).textContent = values.message || '尚未填寫籤文';
      $('.fortune-preview-copy small', editor).textContent = `${values.id || '尚未設定 ID'}・${form.elements.visible.checked ? '啟用中' : '已停用'}`;
      markFortuneDirty();
      renderFortuneSummary();
    };
    bindDistinctFormChanges(form, updateDraft);
    $$('[data-fortune-move]', form).forEach((button) => button.addEventListener('click', () => {
      const target = button.dataset.fortuneMove === 'up' ? sourceIndex - 1 : sourceIndex + 1;
      if (target < 0 || target >= state.fortuneDraft.length) return;
      [state.fortuneDraft[sourceIndex], state.fortuneDraft[target]] = [state.fortuneDraft[target], state.fortuneDraft[sourceIndex]];
      markFortuneDirty();
      renderFortuneManager();
    }));
    $('[data-delete-fortune]', form).addEventListener('click', () => {
      const fortune = state.fortuneDraft[sourceIndex];
      if (!window.confirm(`確定要從草稿刪除「${fortune.message}」？按下上方「儲存並更新」後才會寫入檔案。`)) return;
      state.fortuneDraft.splice(sourceIndex, 1);
      markFortuneDirty();
      renderFortuneManager();
    });
  });
}

function renderFortuneManager() {
  renderFortuneSummary();
  renderFortuneList();
}

function addFortune() {
  const ids = new Set(state.fortuneDraft.map((fortune) => fortune.id));
  let id = 'new-fortune';
  let suffix = 2;
  while (ids.has(id)) id = `new-fortune-${suffix++}`;
  state.fortuneDraft.push({ id, grade: '小吉', category: 'blessing', message: '請填寫新的籤文。', note: '', visible: true });
  $('#fortune-search').value = '';
  $('#fortune-sort').value = 'source';
  markFortuneDirty();
  renderFortuneManager();
  const last = $$('.fortune-editor', $('#fortune-list')).at(-1);
  if (last) { last.open = true; $('textarea[name="message"]', last).select(); }
}

function resetAnswerValidation() {
  state.validatedAnswers = null;
  $('#answers-summary').hidden = true;
  $('#answers-summary').innerHTML = '';
  $('#apply-answers').hidden = true;
}

function renderAnswerSummary(preview) {
  const summary = preview.summary;
  const list = (values) => values.length ? values.join('、') : '無';
  $('#answers-summary').innerHTML = `<h3>套用前摘要</h3><dl>
    <dt>顯示名稱</dt><dd>${escapeHtml(summary.displayName)}</dd>
    <dt>一句話身分</dt><dd>${escapeHtml(summary.title || '未提供')}</dd>
    <dt>關鍵字</dt><dd>${summary.taglineCount} 個</dd>
    <dt>公開地點</dt><dd>${summary.hasLocation ? '有' : '無'}</dd>
    <dt>社群連結</dt><dd>${summary.socialCount} 個：${escapeHtml(list(summary.socialServices))}</dd>
    <dt>精選連結</dt><dd>${summary.linkCount} 個：${escapeHtml(list(summary.linkTitles))}</dd>
    <dt>自介卡片</dt><dd>${summary.sectionCount} 個：${escapeHtml(list(summary.sectionTitles))}</dd>
    <dt>圖片板塊</dt><dd>${summary.imageBlockCount} 個：${escapeHtml(list(summary.imageBlockTitles))}</dd>
    <dt>播放清單</dt><dd>${summary.playlistEnabled ? '啟用' : '停用'}</dd>
    <dt>今日手氣</dt><dd>${summary.fortuneEnabled ? '啟用' : '停用'}</dd>
  </dl>${preview.warnings.length ? `<ul>${preview.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : ''}`;
  $('#answers-summary').hidden = false;
  $('#apply-answers').hidden = false;
}

async function uploadAsset(file) {
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const result = await api('/api/images', { method: 'POST', body: JSON.stringify({ name: file.name, dataUrl }) });
  return result.path;
}

async function uploadProfileImage(file, targetName) {
  if (!file) return;
  const imagePath = await uploadAsset(file);
  $('#profile-panel').elements[targetName].value = imagePath;
  saveCoordinator.markDirty('profile');
  toast(`圖片已放入 ${imagePath}，請記得按上方「儲存並更新」或 Ctrl+S。`);
}

function bindEvents() {
  const modeControl = $('#save-mode');
  let initialMode = 'manual';
  try { initialMode = localStorage.getItem('profile-studio-save-mode') === 'auto' ? 'auto' : 'manual'; } catch { /* 使用預設模式。 */ }
  modeControl.value = initialMode;
  saveCoordinator.setMode(initialMode);
  modeControl.addEventListener('change', () => {
    saveCoordinator.setMode(modeControl.value);
    try { localStorage.setItem('profile-studio-save-mode', modeControl.value); } catch { /* 不阻擋本機編輯。 */ }
    toast(modeControl.value === 'auto' ? '已開啟自動更新；停止修改 5 秒後儲存。' : '已切換為手動儲存。');
  });
  const saveAllButton = $('#save-all');
  saveAllButton.addEventListener('click', async () => {
    try { await submitAllPending(); }
    catch { /* onStatus 已顯示可操作的錯誤。 */ }
  });
  let saveShortcutPending = false;
  window.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    if (event.repeat) return;
    saveShortcutPending = true;
  });
  window.addEventListener('keyup', (event) => {
    if (!saveShortcutPending || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    saveShortcutPending = false;
    if (!saveCoordinator.hasPending()) {
      toast('目前沒有需要儲存的修改。');
      return;
    }
    saveAllButton.click();
  });
  window.addEventListener('blur', () => { saveShortcutPending = false; });
  const tabs = $$('.tab');
  const activateTab = (tab) => {
    const current = $('.tab.is-active')?.dataset.panel;
    if (current !== tab.dataset.panel && saveCoordinator.hasPending()
      && !window.confirm('目前還有尚未儲存的修改，確定要切換編輯頁籤嗎？')) return false;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.tabIndex = active ? 0 : -1;
    });
    $$('.panel').forEach((panel) => { panel.hidden = panel.dataset.panelName !== tab.dataset.panel; });
    return true;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: tabs.length - index - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      const next = tabs[(index + moves[event.key] + tabs.length) % tabs.length];
      if (activateTab(next)) next.focus();
    });
  });
  const form = $('#profile-panel');
  registerSaveTask('profile', {
    validate: (report) => report ? form.reportValidity() : form.checkValidity(),
    run: async () => {
      const values = Object.fromEntries(new FormData(form));
      values.tagline = values.tagline.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      values.fontScale = Number(values.fontScale);
      values.smallTextScale = Number(values.smallTextScale);
      const result = await api('/api/profile', { method: 'PUT', body: JSON.stringify(values) });
      state.content.profile = result.profile;
      return { result, message: '基本資料已儲存。' };
    },
  });
  bindSaveUnit(form, 'profile');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await submitAllPending(); }
    catch { /* onStatus 已顯示可操作的錯誤。 */ }
  });
  form.elements.fontScale.addEventListener('input', () => { $('#font-output').value = form.elements.fontScale.value; });
  form.elements.smallTextScale.addEventListener('input', () => { $('#small-font-output').value = form.elements.smallTextScale.value; });
  form.elements.bodyFont.addEventListener('change', () => updateFontDescription('bodyFont'));
  form.elements.displayFont.addEventListener('change', () => updateFontDescription('displayFont'));
  $('#avatar-upload').addEventListener('change', (event) => uploadProfileImage(event.target.files[0], 'avatar').catch((error) => toast(error.message, true)));
  $('#background-upload').addEventListener('change', (event) => uploadProfileImage(event.target.files[0], 'background').catch((error) => toast(error.message, true)));
  registerSaveTask('home', {
    run: async () => {
      const result = await api('/api/home', {
        method: 'PUT',
        body: JSON.stringify({
          homeOrder: state.order,
          homeVisibility: state.homeVisibility,
          aboutHeading: $('#about-heading-input')?.value.trim() || state.content.profile.aboutHeading || 'About me',
          linksHeading: $('#links-heading-input')?.value.trim() || state.content.profile.linksHeading || 'Links',
        }),
      });
      state.order = result.home.homeOrder;
      state.homeVisibility = result.home.homeVisibility;
      Object.assign(state.content.profile, result.home);
      state.content.blocks.forEach((block) => {
        const homeId = block.id === 'notion-embed' ? 'notion' : block.id;
        if (['turntable', 'fortune', 'notion'].includes(homeId)) block.data.visible = state.homeVisibility.includes(homeId);
      });
      return { result, message: '首頁板塊順序與顯示設定已儲存。' };
    },
  });
  $('#add-featured-link').addEventListener('click', showNewFeaturedEditor);
  $('#add-image-block').addEventListener('click', showNewImageBlock);
  $('#fortune-search').addEventListener('input', renderFortuneList);
  $('#fortune-sort').addEventListener('change', renderFortuneList);
  $('#add-fortune').addEventListener('click', addFortune);
  registerSaveTask('fortunes', {
    run: async () => {
      const result = await api('/api/fortunes', {
        method: 'PUT',
        body: JSON.stringify({ fortunes: state.fortuneDraft, expectedRevision: state.fortuneBucket.revision }),
      });
      state.fortuneBucket = result;
      state.fortuneDraft = result.fortunes.map((fortune) => ({ ...fortune }));
      state.fortuneDirty = false;
      renderFortuneManager();
      return { result, message: '籤桶已儲存並建立上一次版本備份。' };
    },
  });
  $('#restore-fortunes').addEventListener('click', async (event) => {
    if (!window.confirm('確定要用上一次備份取代目前籤桶嗎？目前版本也會保留下來供下一次復原。')) return;
    const button = event.currentTarget;
    button.disabled = true;
    setSaveStatus('saving');
    try {
      const result = await api('/api/fortunes/restore', {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: state.fortuneBucket.revision }),
      });
      state.fortuneBucket = result;
      state.fortuneDraft = result.fortunes.map((fortune) => ({ ...fortune }));
      state.fortuneDirty = false;
      saveCoordinator.reset('fortunes');
      renderFortuneManager();
      await finishSave(result, '已復原上一次籤桶；復原前版本仍可再次復原。');
    } catch (error) { setSaveStatus('error'); toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#answers-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) { $('#answers-json').value = await file.text(); resetAnswerValidation(); }
  });
  $('#load-project-answers').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await api('/api/answers/project-file');
      $('#answers-json').value = result.content;
      resetAnswerValidation();
      toast('已載入專案根目錄的 profile.answers.json。');
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#answers-json').addEventListener('input', resetAnswerValidation);
  $('#validate-answers').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const payload = JSON.parse($('#answers-json').value);
      state.validatedAnswers = await api('/api/answers/validate', { method: 'POST', body: JSON.stringify(payload) });
      renderAnswerSummary(state.validatedAnswers);
      toast('回答格式有效；請確認套用摘要。');
    } catch (error) {
      resetAnswerValidation();
      toast(error.message, true);
    } finally { button.disabled = false; }
  });
  $('#apply-answers').addEventListener('click', async (event) => {
    if (!state.validatedAnswers) { toast('請先驗證回答內容。', true); return; }
    if (saveCoordinator.hasPending()) { toast('請先儲存或還原目前的 Studio 修改，再套用 AI 回答。', true); return; }
    if (!window.confirm('確定依摘要套用 AI 回答嗎？這會更新個人資料、產生的連結與自介卡片，以及播放清單和抽籤開關。')) return;
    const button = event.currentTarget;
    button.disabled = true;
    setSaveStatus('saving');
    try {
      state.content = { ...state.content, ...await api('/api/answers/apply', { method: 'POST', body: JSON.stringify(state.validatedAnswers.answers) }) };
      state.order = [...state.content.profile.homeOrder];
      state.homeVisibility = [...state.content.profile.homeVisibility];
      state.socialOrderDraft = state.content.links.filter((link) => link.data.group === 'social').sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100)).map((link) => link.id);
      populateProfile(); renderOrder(); renderLinkManager();
      await finishSave(state.content, 'AI 回答檔已套用並通過格式驗證。');
      resetAnswerValidation();
    } catch (error) { setSaveStatus('error'); toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#reload-preview').addEventListener('click', async () => {
    setSaveStatus('refreshing');
    try { await refreshPreview(); setSaveStatus('clean'); }
    catch (error) { setSaveStatus('error'); toast(error.message, true); }
  });
  $$('.viewport-switch button').forEach((button) => button.addEventListener('click', () => {
    $$('.viewport-switch button').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    $('#preview').classList.toggle('is-mobile', button.dataset.width === 'mobile');
  }));
  window.addEventListener('beforeunload', (event) => {
    if (!saveCoordinator.hasPending()) return;
    event.preventDefault();
  });
}

async function initialize() {
  bindEvents();
  try {
    const [content, fortuneBucket] = await Promise.all([api('/api/content'), api('/api/fortunes')]);
    state.content = content;
    state.fortuneBucket = fortuneBucket;
    state.fortuneDraft = fortuneBucket.fortunes.map((fortune) => ({ ...fortune }));
    state.order = [...state.content.profile.homeOrder];
    state.homeVisibility = [...state.content.profile.homeVisibility];
    state.socialOrderDraft = state.content.links.filter((link) => link.data.group === 'social').sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100)).map((link) => link.id);
    populateProfile(); renderOrder(); renderImageBlockManager(); renderLinkManager(); renderFortuneManager();
    $('#preview').src = state.content.previewUrl;
    setSaveStatus('clean');
    $('#loading').hidden = true;
    $('#profile-panel').hidden = false;
  } catch (error) {
    $('#loading').textContent = `無法讀取內容：${error.message}`;
    toast(error.message, true);
  }
}

initialize();
