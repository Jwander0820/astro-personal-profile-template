export function randomRgbColor(randomSource = globalThis.crypto) {
  const channels = new Uint8Array(3);
  randomSource.getRandomValues(channels);
  return `#${[...channels].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function normalizeHistoryColor(value) {
  const source = String(value ?? '').trim();
  const short = source.match(/^#?([0-9a-f]{3})$/i);
  if (short) return `#${[...short[1]].map((character) => character.repeat(2)).join('').toUpperCase()}`;
  const full = source.match(/^#?([0-9a-f]{6})$/i);
  return full ? `#${full[1].toUpperCase()}` : null;
}

export function updateColorHistory(history, savedColor) {
  const color = normalizeHistoryColor(savedColor);
  const recent = [];
  for (const value of Array.isArray(history) ? history : []) {
    const normalized = normalizeHistoryColor(value);
    if (!normalized) continue;
    const previousIndex = recent.indexOf(normalized);
    if (previousIndex >= 0) recent.splice(previousIndex, 1);
    recent.push(normalized);
  }
  if (color) {
    const previousIndex = recent.indexOf(color);
    if (previousIndex >= 0) recent.splice(previousIndex, 1);
    recent.push(color);
  }
  return recent.slice(-8);
}
