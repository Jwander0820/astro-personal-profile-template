import fontPresets from '../data/font-presets.json';

export type FontPresetId = 'system' | 'noto-sans-tc' | 'noto-serif-tc' | 'lxgw-wenkai-tc';

export interface FontPreset {
  id: FontPresetId;
  label: string;
  description: string;
  cssFamily: string;
  googleFamily: string | null;
  license: string | null;
  licenseUrl: string | null;
}

export const FONT_PRESETS = fontPresets as FontPreset[];

export function getFontPreset(id: string | undefined, fallback: FontPresetId = 'system') {
  return FONT_PRESETS.find((preset) => preset.id === id)
    ?? FONT_PRESETS.find((preset) => preset.id === fallback)
    ?? FONT_PRESETS[0]!;
}

export function getGoogleFontsUrl(...ids: Array<string | undefined>) {
  const families = [...new Set(ids
    .map((id) => getFontPreset(id).googleFamily)
    .filter((family): family is string => Boolean(family)))];
  if (families.length === 0) return undefined;
  const query = families.map((family) => `family=${encodeURIComponent(family)}`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
