import { previewProfileAnswers } from '../../scripts/profile-answers.mjs';

const STORAGE_KEY = 'profile-online-studio-draft-v2';
const GRADES = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'];
const CATEGORIES = [
  ['blessing', '祝福'],
  ['joke', '玩梗'],
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function loadDraft(initialAnswers) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version === 1 && stored.identity && stored.appearance) {
      const draft = clone(stored);
      if (!draft.fortune || !Array.isArray(draft.fortune.fortunes)) {
        draft.fortune = clone(initialAnswers.fortune);
      }
      return draft;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return clone(initialAnswers);
}

function nextFortuneId(fortunes) {
  const used = new Set(fortunes.map((fortune) => fortune.id));
  let index = fortunes.length + 1;
  while (used.has(`fortune-${index}`)) index += 1;
  return `fortune-${index}`;
}

export function mountFortuneStudio() {
  const bootstrapNode = document.querySelector('#fortune-studio-data');
  if (!bootstrapNode) return;
  const bootstrap = JSON.parse(bootstrapNode.textContent);
  const initialAnswers = bootstrap.initialAnswers;
  let state = loadDraft(initialAnswers);
  let fortuneRevision = bootstrap.fortuneRevision;
  let localMode = false;
  let frameReady = false;
  let lastPreviewFortunesSignature;
  let pendingSelectedFortune;
  let toastTimer;

  const list = document.querySelector('#fortune-list');
  const headingInput = document.querySelector('#fortune-heading-input');
  const descriptionInput = document.querySelector('#fortune-description-input');
  const searchInput = document.querySelector('#fortune-search');
  const summary = document.querySelector('#fortune-summary');
  const status = document.querySelector('#fortune-status');
  const toastNode = document.querySelector('#fortune-toast');
  const frame = document.querySelector('#fortune-preview-frame');
  const saveButton = document.querySelector('#save-fortune-project');

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
      status.textContent = localMode ? '本機模式 · 尚未寫回專案' : '草稿已留在這台裝置';
    } catch {
      status.textContent = '瀏覽器無法保存草稿';
    }
  }

  function renderPreview(selectedFortune) {
    if (selectedFortune) pendingSelectedFortune = clone(selectedFortune);
    if (!frameReady || !frame.contentWindow) return;

    const fortunesSignature = JSON.stringify(state.fortune.fortunes);
    const payload = {
      title: state.fortune.title,
      description: state.fortune.description,
    };
    if (fortunesSignature !== lastPreviewFortunesSignature) {
      payload.fortunes = state.fortune.fortunes;
      lastPreviewFortunesSignature = fortunesSignature;
    }
    if (pendingSelectedFortune) {
      payload.selectedFortune = pendingSelectedFortune;
      pendingSelectedFortune = undefined;
    }

    frame.contentWindow.postMessage({
      type: 'fortune-studio:render',
      payload,
    }, window.location.origin);
  }

  function updateSummary() {
    const fortunes = state.fortune.fortunes;
    const visible = fortunes.filter((fortune) => fortune.visible).length;
    const jokes = fortunes.filter((fortune) => fortune.category === 'joke' && fortune.visible).length;
    summary.textContent = `${fortunes.length} 張籤 · ${visible} 張啟用 · ${jokes} 張啟用玩梗籤`;
  }

  function updateSearch() {
    const query = searchInput.value.trim().toLocaleLowerCase('zh-Hant');
    let matches = 0;
    list.querySelectorAll('.fortune-card').forEach((card) => {
      const fortune = state.fortune.fortunes[Number(card.dataset.index)];
      const haystack = [fortune.id, fortune.grade, fortune.category, fortune.message, fortune.note]
        .join(' ')
        .toLocaleLowerCase('zh-Hant');
      const match = !query || haystack.includes(query);
      card.hidden = !match;
      if (match) matches += 1;
    });
    let empty = list.querySelector('.fortune-empty');
    if (matches === 0) {
      empty ||= element('p', 'fortune-empty', '找不到符合的籤詩。');
      if (!empty.isConnected) list.append(empty);
    } else {
      empty?.remove();
    }
  }

  function createField(labelText, input) {
    const label = element('label', 'field');
    label.append(element('span', '', labelText), input);
    return label;
  }

  function moveFortune(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.fortune.fortunes.length) return;
    const [fortune] = state.fortune.fortunes.splice(index, 1);
    state.fortune.fortunes.splice(target, 0, fortune);
    renderList();
    persist();
    renderPreview();
  }

  function renderList() {
    list.replaceChildren();
    state.fortune.fortunes.forEach((fortune, index) => {
      const card = element('article', 'fortune-card');
      card.dataset.index = String(index);

      const top = element('div', 'fortune-card__top');
      const identity = element('div', 'fortune-card__identity');
      identity.append(
        element('span', 'fortune-card__number', String(index + 1).padStart(2, '0')),
        element('strong', '', fortune.id || '尚未命名'),
      );
      const actions = element('div', 'fortune-card__actions');
      const test = element('button', 'fortune-test-button', '抽到這張了');
      test.type = 'button';
      test.setAttribute('aria-controls', 'fortune-preview-frame');
      test.addEventListener('click', () => {
        renderPreview(fortune);
        toast(`右側正在顯示「${fortune.id || `第 ${index + 1} 張籤`}」。`);
      });
      const up = element('button', 'fortune-icon-button', '↑');
      up.type = 'button';
      up.ariaLabel = '上移籤詩';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveFortune(index, -1));
      const down = element('button', 'fortune-icon-button', '↓');
      down.type = 'button';
      down.ariaLabel = '下移籤詩';
      down.disabled = index === state.fortune.fortunes.length - 1;
      down.addEventListener('click', () => moveFortune(index, 1));
      const remove = element('button', 'fortune-icon-button fortune-icon-button--danger', '×');
      remove.type = 'button';
      remove.ariaLabel = '刪除籤詩';
      remove.addEventListener('click', () => {
        if (state.fortune.fortunes.length === 1) {
          toast('籤桶至少需要保留一張籤。', true);
          return;
        }
        state.fortune.fortunes.splice(index, 1);
        renderList();
        persist();
        renderPreview();
      });
      actions.append(test, up, down, remove);
      top.append(identity, actions);

      const grid = element('div', 'fortune-card__grid');
      const id = document.createElement('input');
      id.type = 'text';
      id.maxLength = 80;
      id.value = fortune.id;
      id.placeholder = 'fortune-1';
      id.addEventListener('input', () => {
        fortune.id = id.value;
        identity.querySelector('strong').textContent = fortune.id || '尚未命名';
        persist();
        renderPreview();
      });

      const grade = document.createElement('select');
      GRADES.forEach((value) => {
        const option = element('option', '', value);
        option.value = value;
        option.selected = value === fortune.grade;
        grade.append(option);
      });
      grade.addEventListener('change', () => {
        fortune.grade = grade.value;
        persist();
        renderPreview();
      });

      const category = document.createElement('select');
      CATEGORIES.forEach(([value, label]) => {
        const option = element('option', '', label);
        option.value = value;
        option.selected = value === fortune.category;
        category.append(option);
      });
      category.addEventListener('change', () => {
        fortune.category = category.value;
        persist();
        renderPreview();
      });

      const message = document.createElement('textarea');
      message.rows = 3;
      message.maxLength = 200;
      message.value = fortune.message;
      message.placeholder = '寫下抽中後顯示的籤文。';
      const messageField = createField('籤文', message);
      messageField.classList.add('field--message');
      message.addEventListener('input', () => {
        fortune.message = message.value;
        persist();
        renderPreview();
      });

      const note = document.createElement('textarea');
      note.rows = 2;
      note.maxLength = 300;
      note.value = fortune.note || '';
      note.placeholder = '選填補充說明';
      const noteField = createField('備註', note);
      noteField.classList.add('field--note');
      note.addEventListener('input', () => {
        fortune.note = note.value;
        persist();
        renderPreview();
      });

      const visible = element('label', 'fortune-visible');
      const visibleInput = document.createElement('input');
      visibleInput.type = 'checkbox';
      visibleInput.checked = fortune.visible;
      visibleInput.addEventListener('change', () => {
        fortune.visible = visibleInput.checked;
        updateSummary();
        persist();
        renderPreview();
      });
      visible.append(visibleInput, document.createTextNode('啟用這張籤'));

      grid.append(
        createField('籤詩 ID', id),
        createField('等級', grade),
        createField('分類', category),
        messageField,
        noteField,
        visible,
      );
      card.append(top, grid);
      list.append(card);
    });
    updateSummary();
    updateSearch();
  }

  async function saveToProject() {
    let answers;
    try {
      answers = previewProfileAnswers(state).answers;
    } catch (error) {
      toast(error.message || '籤詩格式需要修正。', true);
      return;
    }
    const buttonLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = '正在儲存…';
    try {
      const fortuneResponse = await fetch(`${bootstrap.localApiUrl}/api/fortunes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fortunes: answers.fortune.fortunes, expectedRevision: fortuneRevision }),
      });
      const fortuneResult = await fortuneResponse.json();
      if (!fortuneResponse.ok) throw new Error(fortuneResult.error || '籤桶儲存失敗。');
      fortuneRevision = fortuneResult.revision;
      const blockResponse = await fetch(`${bootstrap.localApiUrl}/api/blocks/fortune`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: answers.fortune.title,
          body: answers.fortune.description,
          visible: answers.features.fortune,
        }),
      });
      const blockResult = await blockResponse.json();
      if (!blockResponse.ok) throw new Error(blockResult.error || '今日手氣標題儲存失敗。');
      status.textContent = '已同步到本機專案';
      toast('籤詩、標題與說明已儲存到專案。');
    } catch (error) {
      toast(error.message || '無法儲存到本機專案。', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = buttonLabel;
    }
  }

  async function detectLocalAdapter() {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    try {
      const response = await fetch(`${bootstrap.localApiUrl}/api/fortunes`, { cache: 'no-store' });
      if (!response.ok) return;
      const current = await response.json();
      localMode = true;
      fortuneRevision = current.revision;
      saveButton.hidden = false;
      document.querySelector('#fortune-mode-badge').lastChild.textContent = ' 本機草稿';
      status.textContent = '本機模式 · 可寫回專案';
    } catch {
      localMode = false;
    }
  }

  headingInput.value = state.fortune.title;
  descriptionInput.value = state.fortune.description;
  headingInput.addEventListener('input', () => {
    state.fortune.title = headingInput.value;
    persist();
    renderPreview();
  });
  descriptionInput.addEventListener('input', () => {
    state.fortune.description = descriptionInput.value;
    persist();
    renderPreview();
  });
  searchInput.addEventListener('input', updateSearch);
  document.querySelector('#add-fortune').addEventListener('click', () => {
    state.fortune.fortunes.push({
      id: nextFortuneId(state.fortune.fortunes),
      grade: '吉',
      category: 'blessing',
      message: '',
      visible: true,
    });
    renderList();
    persist();
    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  saveButton.addEventListener('click', saveToProject);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'fortune-studio:preview-ready') {
      frameReady = true;
      renderPreview();
    }
  });
  frame.addEventListener('load', () => {
    frameReady = false;
    lastPreviewFortunesSignature = undefined;
    window.setTimeout(() => {
      frameReady = true;
      renderPreview();
    }, 100);
  });
  window.setTimeout(() => {
    if (frameReady || !frame.contentWindow) return;
    frameReady = true;
    lastPreviewFortunesSignature = undefined;
    renderPreview();
  }, 150);

  renderList();
  persist();
  detectLocalAdapter();
}
