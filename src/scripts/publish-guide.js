import { normalizePublicUrl } from '../../scripts/profile-sharing.mjs';

export function mountPublishGuide(root, { draftScope, getPublicUrl }) {
  const key = `profile-publish-guide-v1:${draftScope}`;
  let progress = { provider: 'github', checks: {}, confirmedUrl: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && ['github', 'cloudflare'].includes(stored.provider) && stored.checks && typeof stored.checks === 'object') progress = stored;
  } catch { /* Optional local progress must never block profile editing. */ }
  const provider = root.querySelector('#publish-provider');
  const confirm = root.querySelector('#publish-confirm-site');
  const open = root.querySelector('#publish-open-site');
  const urlStatus = root.querySelector('#publish-url-status');
  const summary = root.querySelector('#publish-progress');
  const save = () => { try { localStorage.setItem(key, JSON.stringify(progress)); } catch { /* Remains usable for this session. */ } };
  function refresh() {
    provider.value = progress.provider;
    root.querySelectorAll('[data-publish-platform]').forEach((section) => { section.hidden = section.dataset.publishPlatform !== progress.provider; });
    const checks = [...root.querySelectorAll('[data-publish-check]')];
    checks.forEach((input) => { input.checked = progress.checks[input.dataset.publishCheck] === true; });
    let url = '';
    let error = '';
    try { url = normalizePublicUrl(getPublicUrl()); } catch (reason) { error = reason.message; }
    open.hidden = !url;
    if (url) open.href = url; else open.removeAttribute('href');
    confirm.disabled = !url;
    confirm.checked = Boolean(url && progress.confirmedUrl === url);
    if (!confirm.checked && progress.confirmedUrl) { progress.confirmedUrl = ''; save(); }
    urlStatus.textContent = error || (url ? `將開啟：${url}` : '請先在上方填入正式網站網址。');
    const visible = checks.filter((input) => !input.closest('[data-publish-platform]') || input.closest('[data-publish-platform]').dataset.publishPlatform === progress.provider);
    const completed = visible.filter((input) => input.checked).length + Number(confirm.checked);
    summary.textContent = completed === visible.length + 1
      ? '你已手動確認所有發布步驟與正式網站。本助手未連線驗證部署狀態。'
      : `手動確認進度 ${completed} / ${visible.length + 1}；請以平台部署紀錄與實際網站為準。`;
  }
  provider.addEventListener('change', () => { progress.provider = provider.value; save(); refresh(); });
  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-publish-check]');
    if (!input) return;
    progress.checks[input.dataset.publishCheck] = input.checked; save(); refresh();
  });
  confirm.addEventListener('change', () => {
    try { progress.confirmedUrl = confirm.checked ? normalizePublicUrl(getPublicUrl()) : ''; } catch { progress.confirmedUrl = ''; }
    save(); refresh();
  });
  refresh();
  return { refresh };
}
