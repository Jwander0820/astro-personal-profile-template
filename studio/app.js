const state = { content: null, order: [], homeVisibility: [], toastTimer: null };

const homeLabels = {
  about: ['About me', '自介卡片與經歷'],
  turntable: ['播放唱盤', 'YouTube 播放清單'],
  links: ['Links', '精選網站與專案'],
  fortune: ['今日手氣', '互動抽籤板塊'],
  notion: ['Notion', '外部頁面預覽'],
};

const socialPresets = [
  ['github', 'GitHub', 'github', 'https://github.com/'],
  ['threads', 'Threads', 'threads', 'https://www.threads.net/@'],
  ['facebook', 'Facebook', 'facebook', 'https://www.facebook.com/'],
  ['x', 'X', 'x', 'https://x.com/'],
  ['pixiv', 'Pixiv', 'pixiv', 'https://www.pixiv.net/users/'],
  ['instagram', 'Instagram', 'instagram', 'https://www.instagram.com/'],
  ['linkedin', 'LinkedIn', 'linkedin', 'https://www.linkedin.com/in/'],
  ['youtube', 'YouTube', 'youtube', 'https://www.youtube.com/@'],
  ['tiktok', 'TikTok', 'tiktok', 'https://www.tiktok.com/@'],
  ['spotify', 'Spotify', 'spotify', 'https://open.spotify.com/'],
  ['youtubemusic', 'YouTube Music', 'youtubemusic', 'https://music.youtube.com/'],
  ['applemusic', 'Apple Music', 'applemusic', 'https://music.apple.com/'],
  ['podcasts', 'Podcasts', 'podcasts', 'https://'],
  ['applepodcasts', 'Apple Podcasts', 'applepodcasts', 'https://podcasts.apple.com/'],
  ['kkbox', 'KKBOX', 'kkbox', 'https://www.kkbox.com/'],
  ['tidal', 'TIDAL', 'tidal', 'https://tidal.com/'],
  ['notion', 'Notion', 'notion', 'https://www.notion.so/'],
  ['email', 'Email', 'mail', 'mailto:'],
  ['website', '個人網站', 'arrow', 'https://'],
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

function refreshPreview(delay = 350) {
  setTimeout(() => {
    const frame = $('#preview');
    frame.src = frame.src || state.content.previewUrl;
  }, delay);
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

function populateProfile() {
  const form = $('#profile-panel');
  const profile = state.content.profile;
  ['displayName', 'title', 'location', 'archiveLabel', 'avatar', 'background', 'sectionsLayout', 'fontScale', 'smallTextScale', 'bio'].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = profile[key] ?? '';
  });
  form.elements.tagline.value = Array.isArray(profile.tagline) ? profile.tagline.join(', ') : profile.tagline;
  $('#font-output').value = profile.fontScale ?? 1;
  $('#small-font-output').value = profile.smallTextScale ?? 1;
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
    item.addEventListener('dragend', () => item.classList.remove('is-dragging'));
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
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      values.visible = form.elements.visible.checked;
      values.order = Number(values.order);
      values.tags = values.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      const isNew = editor.dataset.new === 'true';
      const endpoint = isNew ? '/api/sections' : `/api/sections/${editor.dataset.sectionId}`;
      const result = await api(endpoint, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(values) });
      const index = state.content.sections.findIndex((item) => item.id === result.section.id);
      if (index >= 0) state.content.sections[index] = result.section;
      else state.content.sections.push(result.section);
      toast(`已儲存 About 卡片「${result.section.data.title}」。`);
      if (isNew) renderOrder();
      else {
        $('summary strong', editor).textContent = result.section.data.title;
        $('summary small', editor).textContent = result.section.file;
      }
      refreshPreview();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
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
  $$('.home-block-form', $('#order-list')).forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      if (form.elements.continuousPlayback) values.continuousPlayback = form.elements.continuousPlayback.checked;
      if (form.elements.height) values.height = Number(values.height);
      const result = await api(`/api/blocks/${form.dataset.blockId}`, { method: 'PUT', body: JSON.stringify(values) });
      const index = state.content.blocks.findIndex((item) => item.id === result.block.id);
      if (index >= 0) state.content.blocks[index] = result.block;
      toast(`已儲存「${result.block.data.title}」。`);
      refreshPreview();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  }));
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
  return entries;
}

function editorStatus(link) {
  if (!link) return '尚未設定';
  return link.data.visible ? '顯示中' : '已設定・目前隱藏';
}

function socialEditorMarkup(preset, link) {
  const data = link?.data ?? { title: preset.label, url: '', icon: preset.icon, visible: false, image: '', order: 100 };
  const id = link?.id ?? `studio-social-${preset.id}`;
  return `<details class="link-editor" data-link-id="${escapeHtml(id)}" data-kind="social" data-exists="${Boolean(link)}">
    <summary class="link-editor__summary">
      <span class="icon-preview"><img src="${escapeHtml(previewUrl(data.icon, data.image))}" alt="" /></span>
      <span class="link-editor__meta"><strong>${escapeHtml(preset.label)}</strong><small>${escapeHtml(editorStatus(link))}</small></span>
      ${switchMarkup(Boolean(data.visible), `${preset.label}顯示設定`)}
      <span class="disclosure" aria-hidden="true">⌄</span>
    </summary>
    <form class="link-editor__body">
      <div class="link-editor__fields">
        <label><span>顯示名稱</span><input name="title" value="${escapeHtml(data.title)}" maxlength="80" required /></label>
        <label><span>網址</span><input name="url" value="${escapeHtml(data.url)}" placeholder="${escapeHtml(preset.placeholder)}" maxlength="500" required /></label>
        <div class="field-wide icon-controls">
          <label><span>內建 Icon</span><select name="icon">${buildIconOptions(data.icon)}</select></label>
          <label class="file-button">匯入 Icon<input name="iconUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" /></label>
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
          <label class="file-button">匯入 Icon<input name="iconUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" /></label>
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
  const visibility = $('input[name="visible"]', editor);
  const switchControl = $('.switch-control', editor);
  switchControl.addEventListener('click', (event) => event.stopPropagation());
  switchControl.addEventListener('keydown', (event) => event.stopPropagation());
  visibility.addEventListener('change', async () => {
    if (editor.dataset.exists !== 'true') {
      editor.open = true;
      if (visibility.checked) toast('先填寫網址，再儲存即可開啟這個項目。');
      return;
    }
    try {
      await persistLinkEditor(editor, true);
    } catch (error) {
      visibility.checked = !visibility.checked;
      toast(error.message, true);
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await persistLinkEditor(editor, false); }
    catch (error) { toast(error.message, true); }
  });
  form.elements.icon.addEventListener('change', () => updateEditorIcon(editor));
  form.elements.iconUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      form.elements.image.value = await uploadAsset(file);
      updateEditorIcon(editor);
      toast('自訂 Icon 已匯入；按下儲存後套用。');
    } catch (error) { toast(error.message, true); }
  });
  $('.clear-custom-icon', editor).addEventListener('click', () => {
    form.elements.image.value = '';
    updateEditorIcon(editor);
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

async function persistLinkEditor(editor, toggleOnly) {
  const form = $('form', editor);
  const button = $('button[type="submit"]', form);
  if (!toggleOnly && !form.reportValidity()) throw new Error('請先填完名稱與網址。');
  if (button) button.disabled = true;
  try {
    const isNewFeatured = editor.dataset.kind === 'featured' && editor.dataset.exists !== 'true';
    const endpoint = isNewFeatured ? '/api/links' : `/api/links/${editor.dataset.linkId}`;
    const current = state.content.links.find((item) => item.id === editor.dataset.linkId);
    const payload = toggleOnly
      ? { ...current.data, body: current.body, visible: $('input[name="visible"]', editor).checked }
      : linkPayload(editor);
    const result = await api(endpoint, { method: isNewFeatured ? 'POST' : 'PUT', body: JSON.stringify(payload) });
    const index = state.content.links.findIndex((item) => item.id === result.link.id);
    if (index >= 0) state.content.links[index] = result.link;
    else state.content.links.push(result.link);
    if (toggleOnly) {
      $('.link-editor__meta small', editor).textContent = editorStatus(result.link);
      updateSocialCount();
    } else {
      const scrollTop = $('.editor').scrollTop;
      $('#new-featured-link').innerHTML = '';
      renderLinkManager();
      requestAnimationFrame(() => { $('.editor').scrollTop = scrollTop; });
    }
    toast(toggleOnly ? '顯示設定已更新。' : `已儲存 ${result.link.data.title}。`);
    refreshPreview();
  } finally {
    if (button) button.disabled = false;
  }
}

function updateSocialCount() {
  const entries = socialEntries();
  $('#social-count').textContent = `${entries.filter(({ link }) => link?.data.visible).length} / ${entries.length} 顯示`;
}

function renderLinkManager() {
  const entries = socialEntries();
  $('#social-link-list').innerHTML = entries.map(({ preset, link }) => socialEditorMarkup(preset, link)).join('');
  const featured = state.content.links
    .filter((link) => ['main', 'featured'].includes(link.data.group))
    .sort((a, b) => (a.data.order ?? 100) - (b.data.order ?? 100));
  $('#featured-link-list').innerHTML = featured.map((link) => featuredEditorMarkup(link)).join('');
  updateSocialCount();
  $$('.link-editor', $('#links-panel')).forEach(bindLinkEditor);
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
  toast(`圖片已放入 ${imagePath}，請記得儲存基本資料。`);
}

function bindEvents() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => {
    $$('.tab').forEach((item) => { item.classList.toggle('is-active', item === tab); item.setAttribute('aria-selected', item === tab ? 'true' : 'false'); });
    $$('.panel').forEach((panel) => { panel.hidden = panel.dataset.panelName !== tab.dataset.panel; });
  }));
  const form = $('#profile-panel');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('.primary-action', form);
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      values.tagline = values.tagline.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      values.fontScale = Number(values.fontScale);
      values.smallTextScale = Number(values.smallTextScale);
      const result = await api('/api/profile', { method: 'PUT', body: JSON.stringify(values) });
      state.content.profile = result.profile;
      toast('基本資料已儲存。');
      refreshPreview();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  form.elements.fontScale.addEventListener('input', () => { $('#font-output').value = form.elements.fontScale.value; });
  form.elements.smallTextScale.addEventListener('input', () => { $('#small-font-output').value = form.elements.smallTextScale.value; });
  $('#avatar-upload').addEventListener('change', (event) => uploadProfileImage(event.target.files[0], 'avatar').catch((error) => toast(error.message, true)));
  $('#background-upload').addEventListener('change', (event) => uploadProfileImage(event.target.files[0], 'background').catch((error) => toast(error.message, true)));
  $('#save-order').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
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
      toast('首頁板塊順序與顯示設定已儲存。');
      refreshPreview();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#add-featured-link').addEventListener('click', showNewFeaturedEditor);
  $('#answers-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) $('#answers-json').value = await file.text();
  });
  $('#apply-answers').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const payload = JSON.parse($('#answers-json').value);
      state.content = { ...state.content, ...await api('/api/apply', { method: 'POST', body: JSON.stringify(payload) }) };
      state.order = [...state.content.profile.homeOrder];
      state.homeVisibility = [...state.content.profile.homeVisibility];
      populateProfile(); renderOrder(); renderLinkManager();
      toast('AI 回答檔已套用並通過格式驗證。');
      refreshPreview(650);
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  $('#reload-preview').addEventListener('click', () => refreshPreview(0));
  $$('.viewport-switch button').forEach((button) => button.addEventListener('click', () => {
    $$('.viewport-switch button').forEach((item) => item.classList.toggle('is-active', item === button));
    $('#preview').classList.toggle('is-mobile', button.dataset.width === 'mobile');
  }));
}

async function initialize() {
  bindEvents();
  try {
    state.content = await api('/api/content');
    state.order = [...state.content.profile.homeOrder];
    state.homeVisibility = [...state.content.profile.homeVisibility];
    populateProfile(); renderOrder(); renderLinkManager();
    $('#preview').src = state.content.previewUrl;
    $('#loading').hidden = true;
    $('#profile-panel').hidden = false;
  } catch (error) {
    $('#loading').textContent = `無法讀取內容：${error.message}`;
    toast(error.message, true);
  }
}

initialize();
