import { normalizePublicUrl } from '../../scripts/profile-sharing.mjs';

export function mountShareCard(panel, { getProfile, fallbackUrl = () => '', onSave }) {
  const stage = panel.querySelector('[data-share-stage]');
  const status = panel.querySelector('[data-share-status]');
  const download = panel.querySelector('[data-share-download]');
  const nativeShare = panel.querySelector('[data-share-native]');
  const copy = panel.querySelector('[data-share-copy]');
  const save = panel.querySelector('[data-share-save]');
  const format = panel.querySelector('[data-share-format]');
  let sequence = 0;
  let current;
  let debounce;
  let saving = false;
  const disable = () => { for (const button of [download, nativeShare, copy, save]) if (button) button.disabled = true; };
  async function refresh() {
    const request = ++sequence;
    current = null;
    disable();
    if (!panel.getClientRects().length) return;
    stage.setAttribute('aria-busy', 'true');
    status.textContent = '正在製作名片…';
    try {
      const profile = getProfile();
      let publicUrl = '';
      let urlError = '';
      try { publicUrl = normalizePublicUrl(profile.sharing.publicUrl || fallbackUrl()); }
      catch (error) { urlError = error.message; }
      const { renderShareCard, canvasBlob } = await import('./share-card-canvas.js');
      const result = await renderShareCard(profile, format.value, publicUrl);
      const blob = await canvasBlob(result.canvas);
      if (request !== sequence) return;
      result.canvas.setAttribute('role', 'img');
      result.canvas.setAttribute('aria-label', `${profile.name}的名片。${profile.title}。${publicUrl ? `QR Code 指向 ${publicUrl}` : '尚未設定正式網址'}`);
      stage.replaceChildren(result.canvas);
      current = { ...result, blob, publicUrl, profile, format: format.value };
      const file = new File([blob], `profile-${format.value}.png`, { type: 'image/png' });
      nativeShare.hidden = !navigator.canShare?.({ files: [file] });
      for (const button of [download, nativeShare, copy, save]) if (button) button.disabled = !publicUrl || !profile.name.trim() || saving;
      const visit = panel.querySelector('[data-share-visit]');
      visit.hidden = !publicUrl; visit.href = publicUrl || '#';
      status.textContent = [!profile.name.trim() ? '請先填入顯示名稱。' : urlError || (!publicUrl ? '請先在「06 完成設定」填入公開 HTTPS 正式網址，才能下載與分享。' : '名片已就緒，QR Code 連到你的正式首頁。'), ...result.warnings].join(' ');
    } catch (error) {
      if (request !== sequence) return;
      stage.replaceChildren(); status.textContent = `產生失敗：${error.message}`;
    } finally { if (request === sequence) stage.setAttribute('aria-busy', 'false'); }
  }
  function schedule() {
    sequence++; current = null; disable();
    clearTimeout(debounce); debounce = setTimeout(refresh, 350);
  }
  format.addEventListener('change', refresh);
  panel.querySelector('[data-share-refresh]').addEventListener('click', refresh);
  download.addEventListener('click', async () => {
    if (!current?.publicUrl) return;
    const snapshot = current;
    const { downloadBlob } = await import('./share-card-canvas.js');
    downloadBlob(snapshot.blob, `profile-${snapshot.format}.png`);
  });
  copy.addEventListener('click', async () => {
    if (!current?.publicUrl) return;
    try { await navigator.clipboard.writeText(current.publicUrl); status.textContent = '名片網址已複製。'; }
    catch { status.textContent = `無法使用剪貼簿，請複製：${current?.publicUrl || ''}`; }
  });
  nativeShare.addEventListener('click', async () => {
    if (!current?.publicUrl) return;
    try { await navigator.share({ files: [new File([current.blob], `profile-${current.format}.png`, { type: 'image/png' })], title: current.profile.name }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = '此裝置無法分享圖片，請下載 PNG 後分享。'; }
  });
  save?.addEventListener('click', async () => {
    if (!current?.publicUrl || !onSave || saving) return;
    const snapshot = current;
    saving = true; disable();
    try {
      const { renderShareCard, canvasBlob } = await import('./share-card-canvas.js');
      const result = snapshot.format === 'landscape' ? snapshot : await renderShareCard(snapshot.profile, 'landscape', snapshot.publicUrl);
      const blob = await canvasBlob(result.canvas);
      if (JSON.stringify(getProfile()) !== JSON.stringify(snapshot.profile)) throw new Error('自介已變更，請等待最新預覽後再設定封面。');
      await onSave(new File([blob], 'profile-social-cover.png', { type: 'image/png' }));
      status.textContent = `橫式社群封面已加入草稿。請儲存到專案或下載 ZIP 後發布。${result.warnings.join(' ')}`;
    } catch (error) { status.textContent = error.message; }
    finally { saving = false; if (current?.publicUrl) for (const button of [download, nativeShare, copy, save]) if (button) button.disabled = false; }
  });
  return { refresh, schedule };
}

export function mountProfileShare() {
  const button = document.querySelector('#profile-share-toggle');
  const dialog = document.querySelector('#profile-share-dialog');
  if (!button || !dialog) return;
  const getProfile = () => JSON.parse(document.querySelector('[data-share-profile]')?.dataset.shareProfile || '{}');
  const controller = mountShareCard(dialog.querySelector('[data-share-card]'), {
    getProfile,
    fallbackUrl: () => window.parent === window ? `${location.origin}${location.pathname}` : '',
  });
  const sync = () => {
    button.hidden = getProfile().sharing?.enabled === false;
    if (button.hidden && dialog.open) dialog.close();
    else if (dialog.open) controller.schedule();
  };
  button.addEventListener('click', () => { dialog.showModal(); controller.refresh(); });
  if (!('closedBy' in HTMLDialogElement.prototype)) dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  document.addEventListener('profile-renderer:updated', sync);
  sync();
}
