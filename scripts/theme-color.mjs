export const DEFAULT_THEME_COLOR = '#7A58A6';

export function normalizeThemeColor(value) {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  const short = source.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    return `#${[...short[1]].map((character) => character.repeat(2)).join('').toUpperCase()}`;
  }
  const full = source.match(/^#?([0-9a-f]{6})$/i);
  return full ? `#${full[1].toUpperCase()}` : null;
}

export function isThemeColor(value) {
  return normalizeThemeColor(value) !== null;
}

export function assertThemeColor(value, label = '主色') {
  const normalized = normalizeThemeColor(value);
  if (!normalized) throw new Error(`${label}必須是 3 或 6 碼十六進位色碼，例如 #7A58A6。`);
  return normalized;
}

function rgbFromHex(value) {
  const hex = assertThemeColor(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hexFromRgb({ r, g, b }) {
  const channel = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function mixHex(first, second, firstWeight) {
  const a = rgbFromHex(first);
  const b = rgbFromHex(second);
  const weight = Math.max(0, Math.min(1, firstWeight));
  return hexFromRgb({
    r: a.r * weight + b.r * (1 - weight),
    g: a.g * weight + b.g * (1 - weight),
    b: a.b * weight + b.b * (1 - weight),
  });
}

function relativeLuminance(value) {
  const channels = Object.values(rgbFromHex(value)).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function colorContrast(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function ensureContrast(color, background, target, toward) {
  if (colorContrast(color, background) >= target) return color;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mixHex(color, toward, 1 - step / 100);
    if (colorContrast(candidate, background) >= target) return candidate;
  }
  return toward;
}

function rgbToHsl(value) {
  const { r, g, b } = rgbFromHex(value);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: (hue + 360) % 360, s: saturation, l: lightness };
}

function hslToHex({ h, s, l }) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(1, s));
  const lightness = Math.max(0, Math.min(1, l));
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] =
    segment < 1 ? [chroma, x, 0] :
    segment < 2 ? [x, chroma, 0] :
    segment < 3 ? [0, chroma, x] :
    segment < 4 ? [0, x, chroma] :
    segment < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = lightness - chroma / 2;
  return hexFromRgb({ r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 });
}

function shiftedColor(color, degrees) {
  const hsl = rgbToHsl(color);
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

function rgba(value, alpha) {
  const { r, g, b } = rgbFromHex(value);
  return `rgba(${r},${g},${b},${alpha})`;
}

function declarations(values) {
  return Object.entries(values).map(([name, value]) => `--${name}:${value};`).join('');
}

export function createThemePalette(value) {
  const mainColor = assertThemeColor(value);
  const white = '#FFFFFF';
  const black = '#160F1C';
  const darkPaper = '#15111B';
  const lightAccent = ensureContrast(mainColor, white, 4.5, black);
  const darkAccent = ensureContrast(mainColor, darkPaper, 4.5, white);
  const warm = shiftedColor(mainColor, -24);
  const cool = shiftedColor(mainColor, 30);

  return {
    mainColor,
    light: {
      accent: lightAccent,
      'accent-soft': mixHex(mainColor, white, 0.15),
      pink: mixHex(warm, white, 0.16),
      blue: mixHex(cool, white, 0.14),
      'body-bg': mixHex(mainColor, white, 0.08),
      'bg-gradient': `radial-gradient(circle at 12% 8%, ${mixHex(warm, white, 0.14)} 0, transparent 34%),radial-gradient(circle at 88% 38%, ${mixHex(cool, white, 0.13)} 0, transparent 36%),linear-gradient(180deg,${mixHex(mainColor, white, 0.11)},#FAF8FC 46%,${mixHex(mainColor, white, 0.09)})`,
      'cover-gradient': `linear-gradient(135deg,${mixHex(mainColor, white, 0.42)},${mixHex(cool, white, 0.27)} 54%,${mixHex(warm, white, 0.25)})`,
      'tagline-color': lightAccent,
      'tagline-border': rgba(mainColor, 0.22),
      'social-hover-border': mixHex(mainColor, white, 0.35),
      'section-title-color': lightAccent,
      'link-card-hover-border': mixHex(mainColor, white, 0.3),
      'link-card-primary-bg': lightAccent,
      'link-icon-color': lightAccent,
      'link-icon-pink-color': ensureContrast(warm, white, 4.5, black),
      'link-icon-blue-color': ensureContrast(cool, white, 4.5, black),
      'section-tag-bg': mixHex(mainColor, white, 0.12),
      'embed-link-color': lightAccent,
      'turntable-record-label-bg': `radial-gradient(circle at 38% 30%,${mixHex(mainColor, white, 0.6)},${mainColor})`,
      'turntable-status-light-playing': lightAccent,
      'turntable-status-light-glow': lightAccent,
      'turntable-button-hover-border': mixHex(mainColor, white, 0.48),
      'turntable-button-primary-bg': lightAccent,
      'turntable-button-primary-hover-bg': mixHex(lightAccent, black, 0.82),
      'focus-outline': lightAccent,
    },
    dark: {
      accent: darkAccent,
      'accent-soft': mixHex(mainColor, darkPaper, 0.28),
      pink: mixHex(warm, darkPaper, 0.28),
      blue: mixHex(cool, darkPaper, 0.27),
      'body-bg': mixHex(mainColor, '#0E0B12', 0.08),
      'bg-gradient': `radial-gradient(circle at 12% 8%, ${mixHex(warm, darkPaper, 0.32)} 0, transparent 34%),radial-gradient(circle at 88% 38%, ${mixHex(cool, darkPaper, 0.28)} 0, transparent 36%),linear-gradient(180deg,${mixHex(mainColor, darkPaper, 0.22)},#15111C 45%,#120F18)`,
      'cover-gradient': `linear-gradient(135deg,${mixHex(mainColor, darkPaper, 0.48)},${mixHex(cool, darkPaper, 0.38)} 58%,${mixHex(warm, darkPaper, 0.42)})`,
      'tagline-color': darkAccent,
      'tagline-border': rgba(darkAccent, 0.24),
      'social-hover-border': mixHex(mainColor, darkPaper, 0.44),
      'section-title-color': darkAccent,
      'link-card-hover-border': mixHex(mainColor, darkPaper, 0.4),
      'link-card-primary-bg': lightAccent,
      'link-icon-color': darkAccent,
      'link-icon-pink-color': ensureContrast(warm, darkPaper, 4.5, white),
      'link-icon-blue-color': ensureContrast(cool, darkPaper, 4.5, white),
      'section-tag-bg': mixHex(mainColor, darkPaper, 0.18),
      'embed-link-color': darkAccent,
      'turntable-record-label-bg': `radial-gradient(circle at 38% 30%,${mixHex(mainColor, white, 0.42)},${mixHex(mainColor, darkPaper, 0.72)})`,
      'turntable-status-light-playing': darkAccent,
      'turntable-status-light-glow': darkAccent,
      'turntable-button-hover-border': mixHex(mainColor, darkPaper, 0.55),
      'turntable-button-primary-bg': mixHex(lightAccent, darkPaper, 0.82),
      'turntable-button-primary-hover-bg': mixHex(lightAccent, darkPaper, 0.68),
      'focus-outline': darkAccent,
    },
  };
}

export function buildThemeCss(value) {
  const palette = createThemePalette(value);
  const light = declarations(palette.light);
  const dark = declarations(palette.dark);
  return `html:root{${light}}@media (prefers-color-scheme:dark){html:root:not([data-theme="light"]){${dark}}}html:root[data-theme="dark"]{${dark}}`;
}
