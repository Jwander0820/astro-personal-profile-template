/** Add Astro's configured base path to public assets and internal routes. */
export function withBase(path?: string) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}
