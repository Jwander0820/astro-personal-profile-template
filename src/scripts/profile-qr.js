import { normalizePublicUrl } from '../../scripts/profile-sharing.mjs';

export function mountProfileShare() {
  const button = document.querySelector('#profile-share-toggle');
  const dialog = document.querySelector('#profile-share-dialog');
  if (!button || !dialog) return;
  const stage = dialog.querySelector('[data-profile-qr-stage]');
  const status = dialog.querySelector('[data-profile-qr-status]');
  const link = dialog.querySelector('[data-profile-qr-link]');
  const getProfile = () => JSON.parse(document.querySelector('[data-share-profile]')?.dataset.shareProfile || '{}');
  let sequence = 0;

  async function refresh() {
    const request = ++sequence;
    stage.replaceChildren();
    link.hidden = true;
    link.removeAttribute('href');
    link.textContent = '';
    stage.setAttribute('aria-busy', 'true');
    status.textContent = '正在載入 QR Code…';
    try {
      const fallback = window.parent === window ? `${location.origin}${location.pathname}` : '';
      const publicUrl = normalizePublicUrl(getProfile().sharing?.publicUrl || fallback);
      if (!publicUrl) {
        status.textContent = '尚未設定正式網站網址。';
        return;
      }
      const { default: QRCode } = await import('qrcode');
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, publicUrl, { width: 320, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#132333', light: '#ffffff' } });
      if (request !== sequence) return;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `QR Code 指向 ${publicUrl}`);
      stage.replaceChildren(canvas);
      link.href = publicUrl;
      link.textContent = publicUrl;
      link.hidden = false;
      status.textContent = '掃描 QR Code 開啟網站';
    } catch {
      if (request !== sequence) return;
      status.textContent = '目前無法顯示 QR Code，請確認已設定公開 HTTPS 正式網址。';
    } finally {
      if (request === sequence) stage.setAttribute('aria-busy', 'false');
    }
  }

  const sync = () => {
    button.hidden = getProfile().sharing?.enabled === false;
    if (button.hidden && dialog.open) dialog.close();
    else if (dialog.open) refresh();
  };
  button.addEventListener('click', () => { dialog.showModal(); refresh(); });
  dialog.addEventListener('close', () => { sequence++; });
  if (!('closedBy' in HTMLDialogElement.prototype)) dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  document.addEventListener('profile-renderer:updated', sync);
  sync();
}
