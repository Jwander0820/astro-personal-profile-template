export const STUDIO_PREVIEW_QUERY_PARAM = 'studioPreview';
export const STUDIO_PREVIEW_QUERY_VALUE = '1';

export function withStudioPreviewQuery(href) {
  const url = new URL(String(href || '/'), 'https://profile-studio.invalid');
  url.searchParams.set(STUDIO_PREVIEW_QUERY_PARAM, STUDIO_PREVIEW_QUERY_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isStudioPreviewSearch(search) {
  return new URLSearchParams(search).get(STUDIO_PREVIEW_QUERY_PARAM) === STUDIO_PREVIEW_QUERY_VALUE;
}
