export function coerceDisplayText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return value;
}
