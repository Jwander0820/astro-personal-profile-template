export const PROFILE_ANSWER_VERSION = 1;
export const APPLY_MODES = ['merge', 'replace'];
export const HOME_SECTIONS = ['about', 'turntable', 'links', 'fortune', 'notion'];
export const FONT_PRESETS = ['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc'];
export const LINK_STYLES = ['primary', 'normal', 'subtle'];
export const IMAGE_BLOCK_PLACEMENTS = ['before-links', 'between-links-sections', 'after-sections'];
export const IMAGE_BLOCK_LAYOUTS = ['full', 'split-left', 'split-right', 'poster'];
export const IMAGE_BLOCK_ASPECTS = ['auto', 'landscape', 'square', 'portrait'];
export const IMAGE_BLOCK_POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const EMBED_BLOCK_MODES = ['preview', 'inline'];
export const EMBED_BLOCK_PROVIDERS = ['website', 'notion', 'youtube'];

export const APPEARANCE_DEFAULTS = Object.freeze({
  sectionsLayout: 'list',
  bodyFont: 'system',
  displayFont: 'system',
  mainColor: '#7A58A6',
  fontScale: 1,
  smallTextScale: 1,
  homeOrder: HOME_SECTIONS,
});

export const APPEARANCE_RANGES = Object.freeze({
  fontScale: Object.freeze({ minimum: 0.9, maximum: 1.2, step: 0.05 }),
  smallTextScale: Object.freeze({ minimum: 0.9, maximum: 1.35, step: 0.05 }),
});

export const EMBED_URL_MAX_LENGTH = 2048;
