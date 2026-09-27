import { getProfileFonts } from '../lib/font-presets';
import { normalizeThemeColor, colorContrast } from '../../scripts/theme-color.mjs';
import { TEMPLATE_REPOSITORY } from '../../scripts/profile-sharing.mjs';
import { markdownFragment } from './preview-markdown.js';

export const SHARE_FORMATS = {
  square: { width: 1080, height: 1080, label: '方形名片' },
  portrait: { width: 1080, height: 1440, label: '直式分享圖' },
  landscape: { width: 1200, height: 630, label: '橫式社群封面' },
};

const plain = (value) => markdownFragment(String(value || '')).textContent.replace(/\s+/g, ' ').trim();

function lines(ctx, text, width, maximum) {
  const output = [];
  let line = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    if (ctx.measureText(line + chars[i]).width > width && line) {
      output.push(line);
      line = '';
      if (output.length === maximum) {
        let last = output.pop();
        while (ctx.measureText(last + '…').width > width) last = Array.from(last).slice(0, -1).join('');
        output.push(last + '…');
        return output;
      }
    }
    line += chars[i];
  }
  if (line) output.push(line);
  return output;
}

function textBlock(ctx, text, x, y, width, size, family, maximum, weight = 400, color = '#253344') {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  const rows = lines(ctx, text, width, maximum);
  rows.forEach((line, index) => ctx.fillText(line, x, y + index * size * 1.4));
  return rows.length * size * 1.4;
}

function loadImage(source) {
  if (!source) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; resolve(null); }, 8000);
    image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = source;
  });
}

async function loadFonts(fonts, name) {
  if (!fonts.stylesheetUrl) return true;
  let link = document.querySelector('#share-card-fonts');
  if (!link) { link = document.createElement('link'); link.id = 'share-card-fonts'; link.rel = 'stylesheet'; document.head.append(link); }
  if (link.getAttribute('href') !== fonts.stylesheetUrl) {
    const ready = new Promise((resolve) => { link.onload = () => resolve(true); link.onerror = () => resolve(false); });
    link.href = fonts.stylesheetUrl;
    if (!await Promise.race([ready, new Promise((r) => setTimeout(() => r(false), 5000))])) return false;
  }
  const loaded = Promise.all([document.fonts.load(`700 64px ${fonts.displayFamily}`, name), document.fonts.load(`400 32px ${fonts.bodyFamily}`, name)]).then(() => true).catch(() => false);
  return Promise.race([loaded, new Promise((r) => setTimeout(() => r(false), 5000))]);
}

function avatar(ctx, image, name, x, y, size, color, family) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = color; ctx.fillRect(x, y, size, size);
  if (image) {
    // Rasterize the whole source first: SVGs with only a viewBox can otherwise
    // use a different source-coordinate space in the nine-argument drawImage.
    const source = document.createElement('canvas');
    const scale = Math.min(1, 1024 / (image.naturalWidth || size), 1024 / (image.naturalHeight || size));
    source.width = Math.max(1, Math.round((image.naturalWidth || size) * scale));
    source.height = Math.max(1, Math.round((image.naturalHeight || size) * scale));
    source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
    const side = Math.min(source.width, source.height);
    ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, x, y, size, size);
  } else {
    ctx.fillStyle = colorContrast(color, '#ffffff') >= 4.5 ? '#ffffff' : '#132333'; ctx.font = `700 ${size * .42}px ${family}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Array.from(name)[0] || '·', x + size / 2, y + size / 2);
  }
  ctx.restore();
}

async function drawQr(ctx, url, x, y, size) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, size, size);
  if (!url) {
    ctx.fillStyle = '#e4e9ef'; ctx.fillRect(x + 12, y + 12, size - 24, size - 24);
    textBlock(ctx, '填入正式網址', x + 22, y + size / 2 - 12, size - 44, 22, 'sans-serif', 2);
    return;
  }
  const { default: QRCode } = await import('qrcode');
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const cell = Math.floor(size / (modules.size + 8));
  const offset = Math.floor((size - modules.size * cell) / 2);
  ctx.fillStyle = '#132333';
  for (let row = 0; row < modules.size; row++) for (let col = 0; col < modules.size; col++) {
    if (modules.get(row, col)) ctx.fillRect(x + offset + col * cell, y + offset + row * cell, cell, cell);
  }
}

export async function renderShareCard(profile, format, publicUrl) {
  const spec = SHARE_FORMATS[format] || SHARE_FORMATS.square;
  const canvas = document.createElement('canvas');
  canvas.width = spec.width; canvas.height = spec.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器無法產生圖片，請使用支援 Canvas 的瀏覽器。');
  const fonts = getProfileFonts(profile.bodyFont, profile.displayFont);
  const [image, fontsLoaded] = await Promise.all([loadImage(profile.avatar), loadFonts(fonts, profile.name + profile.title)]);
  const warnings = [];
  if (profile.avatar && !image) warnings.push('頭像未能載入或來源不允許匯出，已改用名字首字；可在 Studio 上傳圖片後重試。');
  if (!fontsLoaded) warnings.push('外部字型未能載入，已使用裝置字型。');
  const color = normalizeThemeColor(profile.mainColor) || '#7A58A6';
  const wide = format === 'landscape';
  const tall = format === 'portrait';
  const { width: w, height: h } = spec;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2f5f8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = color; ctx.fillRect(24, 24, 12, h - 48);
  const margin = wide ? 64 : 72;
  const nameWidth = wide ? 610 : w - margin * 2;
  avatar(ctx, image, profile.name, margin, wide ? 60 : 76, wide ? 112 : 164, color, fonts.bodyFamily);
  const name = profile.name || '你的名字';
  let nameSize = wide ? 58 : 76;
  while (nameSize > 36) {
    ctx.font = `700 ${nameSize}px ${fonts.displayFamily}`;
    if (ctx.measureText(name).width <= nameWidth * 1.8) break;
    nameSize -= 4;
  }
  textBlock(ctx, name, wide ? 208 : margin, wide ? 58 : 282, nameWidth, nameSize, fonts.displayFamily, 2, 700);
  textBlock(ctx, plain(profile.title), margin, wide ? 210 : 475, wide ? 724 : 920, wide ? 32 : 38, fonts.bodyFamily, 2, 500);
  textBlock(ctx, plain(profile.bio), margin, wide ? 318 : 606, wide ? 724 : 920, wide ? 26 : 32, fonts.bodyFamily, wide ? 3 : tall ? 6 : 3, 400, '#536171');
  const tags = Array.isArray(profile.tags) ? profile.tags.join('  /  ') : String(profile.tags);
  textBlock(ctx, tags, margin, wide ? 458 : tall ? 942 : 748, wide ? 724 : 900, 24, fonts.bodyFamily, 1, 500, '#536171');
  const qrSize = wide ? 228 : tall ? 230 : 204;
  const qrX = wide ? 888 : margin;
  const qrY = wide ? 110 : h - (tall ? 324 : 290);
  ctx.fillStyle = '#f2f5f8'; ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  await drawQr(ctx, publicUrl, qrX, qrY, qrSize);
  const urlLabel = publicUrl ? new URL(publicUrl).host + new URL(publicUrl).pathname.replace(/\/$/, '') : '尚未設定正式網址';
  const infoX = wide ? 888 : 324;
  const infoY = wide ? 366 : qrY + 24;
  const infoWidth = wide ? 236 : 672;
  textBlock(ctx, '掃描，認識更多', infoX, infoY, infoWidth, 24, fonts.bodyFamily, 1, 700);
  textBlock(ctx, urlLabel, infoX, infoY + 48, infoWidth, wide ? 18 : 24, fonts.bodyFamily, 2, 400, '#536171');
  ctx.fillStyle = '#dce3eb'; ctx.fillRect(margin, h - 70, w - margin * 2, 1);
  if (profile.sharing.showTemplateCredit) textBlock(ctx, `以開源模板製作 · ${TEMPLATE_REPOSITORY.replace('https://', '')}`, margin, h - 51, w - margin * 2, wide ? 16 : 17, fonts.bodyFamily, 1, 400, '#536171');
  else textBlock(ctx, 'PERSONAL PROFILE', margin, h - 51, w - margin * 2, 17, fonts.bodyFamily, 1, 500, '#536171');
  return { canvas, warnings };
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法匯出圖片，請重試。')), 'image/png'));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
