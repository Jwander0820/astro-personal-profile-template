import { APPEARANCE_DEFAULTS } from './profile-contract.mjs';

// Presets only change presentation. Never replace a person's content or media.
export const PROFILE_PRESETS = [
  { id: 'minimal', name: '極簡名片', description: '名字、介紹與連結，輕巧地認識你。', color: '#36556B',
    appearance: { sectionsLayout: 'list', bodyFont: 'system', displayFont: 'system', mainColor: '#36556B', homeOrder: ['links', 'about', 'turntable', 'fortune', 'notion'], hiddenSections: ['about', 'turntable', 'fortune', 'notion'], showImages: false } },
  { id: 'creator', name: '創作者', description: '先看你的作品入口，再讀背後的故事。', color: '#A54260',
    appearance: { sectionsLayout: 'grid', bodyFont: 'noto-sans-tc', displayFont: 'noto-serif-tc', mainColor: '#A54260', homeOrder: ['links', 'about', 'notion', 'turntable', 'fortune'], hiddenSections: ['turntable', 'fortune'], showImages: true } },
  { id: 'portfolio', name: '作品集', description: '以自介卡片與圖片整理你的代表作。', color: '#27685B',
    appearance: { sectionsLayout: 'grid', bodyFont: 'noto-sans-tc', displayFont: 'noto-sans-tc', mainColor: '#27685B', homeOrder: ['about', 'links', 'notion', 'turntable', 'fortune'], hiddenSections: ['turntable', 'fortune'], showImages: true } },
  { id: 'music', name: '音樂生活', description: '讓唱盤先開場，接著分享日常與喜好。', color: '#7452A0',
    appearance: { sectionsLayout: 'list', bodyFont: 'noto-sans-tc', displayFont: 'lxgw-wenkai-tc', mainColor: '#7452A0', homeOrder: ['turntable', 'about', 'links', 'fortune', 'notion'], hiddenSections: [], showImages: true } },
];

export function applyProfilePreset(answers, id) {
  const preset = PROFILE_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error('找不到這個情境模板。');
  return { ...structuredClone(answers), appearance: {
    ...APPEARANCE_DEFAULTS, ...structuredClone(answers.appearance),
    ...structuredClone(preset.appearance),
  } };
}
