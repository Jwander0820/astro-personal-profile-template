import { isStudioPreviewSearch } from '../../scripts/studio-preview-mode.mjs';

if (window.parent !== window && isStudioPreviewSearch(window.location.search)) {
  import('./profile-preview-bridge.js');
}
