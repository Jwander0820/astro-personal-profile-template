import assert from 'node:assert/strict';
import {
  STUDIO_PREVIEW_QUERY_PARAM,
  STUDIO_PREVIEW_QUERY_VALUE,
  isStudioPreviewSearch,
  withStudioPreviewQuery,
} from './studio-preview-mode.mjs';

assert.equal(STUDIO_PREVIEW_QUERY_PARAM, 'studioPreview');
assert.equal(STUDIO_PREVIEW_QUERY_VALUE, '1');
assert.equal(withStudioPreviewQuery('/'), '/?studioPreview=1');
assert.equal(withStudioPreviewQuery('/profile/'), '/profile/?studioPreview=1');
assert.equal(withStudioPreviewQuery('/profile/?theme=dark'), '/profile/?theme=dark&studioPreview=1');
assert.equal(isStudioPreviewSearch('?studioPreview=1'), true);
assert.equal(isStudioPreviewSearch('?studioPreview=0'), false);
assert.equal(isStudioPreviewSearch('?theme=dark'), false);

console.log('Studio preview mode check passed.');
