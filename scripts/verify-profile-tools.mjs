import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applyProfileAnswers,
  createStudioImageBlock,
  createStudioLink,
  extractYoutubePlaylistId,
  loadStudioContent,
  saveHomeSettings,
  saveStudioBlock,
  saveStudioLink,
  saveStudioProfile,
  saveStudioSocialOrder,
  saveStudioSection,
  previewProfileAnswers,
  validateProfileAnswers,
} from './profile-content.mjs';
import { FortuneConflictError, loadFortuneBucket, restoreFortuneBucket, saveFortuneBucket } from './fortune-content.mjs';
import { resolvePackageBin } from './package-bin.mjs';
import { StudioRequestError, validateStudioRequest } from './studio-request-security.mjs';
import { createSaveCoordinator } from '../studio/save-coordinator.js';
import {
  createContentSafetyMdastPlugin,
  enforceContentSafety,
  isSafeHttpUrl,
  isSafeImagePath,
  isSafeMarkdownUrl,
  isSafeProfileUrl,
} from './content-safety.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'profile-tools-'));

try {
  await mkdir(path.join(temporaryRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(temporaryRoot, 'src', 'content'), { recursive: true });
  const answers = JSON.parse(await readFile(path.join(projectRoot, 'profile.answers.example.json'), 'utf8'));
  const minimalAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'minimal.json'), 'utf8'));
  const sensitiveRefusalAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'sensitive-data-refusal.json'), 'utf8'));
  const invalidUrlAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'invalid-url.json'), 'utf8'));
  const lunaAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'luna-persona.json'), 'utf8'));
  const answersPreview = previewProfileAnswers(answers);
  const minimalPreview = previewProfileAnswers(minimalAnswers);
  const sensitiveRefusalPreview = previewProfileAnswers(sensitiveRefusalAnswers);
  const lunaPreview = previewProfileAnswers(lunaAnswers);
  const astroCli = await resolvePackageBin('astro');
  assert.match(astroCli, /[\\/]astro[\\/]bin[\\/]astro\.mjs$/);
  assert.match(await readFile(astroCli, 'utf8'), /astro/);

  await applyProfileAnswers(temporaryRoot, answers);
  await applyProfileAnswers(temporaryRoot, answersPreview.answers);
  const result = await applyProfileAnswers(temporaryRoot, answers);
  const social = await saveStudioLink(temporaryRoot, 'studio-social-instagram', {
    title: 'Instagram',
    url: 'https://www.instagram.com/example',
    icon: 'instagram',
    group: 'social',
    order: 30,
    visible: false,
    layout: 'icon',
    style: 'normal',
    tags: [],
    body: '',
  });
  const reorderedSocials = await saveStudioSocialOrder(temporaryRoot, {
    links: [
      { id: 'generated-social-github', order: 20 },
      { id: 'generated-social-email', order: 10 },
    ],
  });
  const featured = await createStudioLink(temporaryRoot, {
    title: 'Portfolio',
    url: 'https://example.com/portfolio',
    icon: 'arrow',
    image: '/images/custom-icon.svg',
    group: 'featured',
    order: 90,
    visible: true,
    layout: 'card',
    style: 'normal',
    tags: ['Work'],
    body: 'Selected work.',
  });
  const imageBlock = await createStudioImageBlock(temporaryRoot, {
    id: 'studio-photo',
    title: 'Studio photo',
    placement: 'before-links',
    order: 15,
    visible: true,
    image: '/images/projects.svg',
    imageAlt: 'Project illustration.',
    imageLayout: 'split-right',
    imageAspect: 'square',
    imagePosition: 'top-right',
    tags: ['Photo'],
    body: 'Image block copy.',
  });
  const home = await saveHomeSettings(temporaryRoot, {
    homeOrder: ['links', 'about', 'turntable', 'fortune', 'notion'],
    homeVisibility: ['links', 'about', 'turntable'],
    aboutHeading: 'Profile',
    linksHeading: 'Explore',
  });
  const turntable = await saveStudioBlock(temporaryRoot, 'turntable', {
    title: 'Now playing',
    playlist: 'https://www.youtube.com/playlist?list=PL1234567890abcdef',
    continuousPlayback: false,
    body: 'Playlist description.',
  });
  const about = await saveStudioSection(temporaryRoot, 'about', {
    title: 'About this person',
    slug: 'about',
    image: '/images/about.svg',
    order: 10,
    visible: true,
    layout: 'card',
    tags: ['Profile'],
    body: 'Updated card.',
  });
  const visibleSocials = result.links.filter((item) => item.data.group === 'social' && item.data.visible);
  const visibleFeatured = result.links.filter((item) => ['main', 'featured'].includes(item.data.group) && item.data.visible);
  const visibleSections = result.sections.filter((item) => item.data.visible);

  assert.equal(result.profile.displayName, '你的名字');
  assert.equal(answersPreview.summary.displayName, '你的名字');
  assert.equal(answersPreview.answers.version, 1);
  assert.equal(answersPreview.summary.socialCount, 2);
  assert.equal(answersPreview.summary.sectionCount, 2);
  assert.equal(answersPreview.summary.imageBlockCount, 1);
  assert.equal(answersPreview.answers.identity.location, 'Taiwan');
  assert.ok(answersPreview.warnings.some((warning) => warning.includes('location')));
  assert.equal(minimalPreview.summary.socialCount, 0);
  assert.equal(minimalPreview.summary.playlistEnabled, false);
  assert.equal(sensitiveRefusalPreview.summary.hasLocation, false);
  assert.equal(sensitiveRefusalPreview.summary.fortuneEnabled, false);
  assert.equal(lunaPreview.summary.displayName, 'Luna（測試人格）');
  assert.equal(lunaPreview.summary.taglineCount, 3);
  assert.equal(lunaPreview.summary.socialCount, 0);
  assert.equal(lunaPreview.summary.linkCount, 0);
  assert.equal(lunaPreview.summary.sectionCount, 2);
  assert.equal(lunaPreview.summary.imageBlockCount, 0);
  assert.equal(lunaPreview.summary.playlistEnabled, false);
  assert.equal(lunaPreview.summary.fortuneEnabled, true);
  assert.deepEqual(lunaPreview.warnings, []);
  assert.throws(() => previewProfileAnswers(invalidUrlAnswers), /社群網址必須是 http\(s\)、mailto 或頁面錨點/);
  assert.throws(
    () => previewProfileAnswers({ ...lunaAnswers, identity: { ...lunaAnswers.identity, bio: '' } }),
    /自我介紹為必填欄位/,
  );
  assert.throws(
    () => previewProfileAnswers({ ...lunaAnswers, socials: [{ service: 'github', title: 'GitHub', url: 'github.com/luna', icon: 'github' }] }),
    /社群網址必須是 http\(s\)、mailto 或頁面錨點/,
  );
  assert.equal('name' in result.profile, false);
  assert.ok(Number.isFinite(result.profile.fontScale) && result.profile.fontScale >= 0.9 && result.profile.fontScale <= 1.2);
  assert.ok(Number.isFinite(result.profile.smallTextScale) && result.profile.smallTextScale >= 0.9 && result.profile.smallTextScale <= 1.35);
  assert.equal(result.profile.bodyFont, 'noto-sans-tc');
  assert.equal(result.profile.displayFont, 'noto-serif-tc');
  assert.deepEqual(result.profile.homeOrder, ['about', 'links', 'turntable', 'fortune', 'notion']);
  assert.equal(visibleSocials.length, 2);
  assert.deepEqual(visibleFeatured.filter((item) => item.id.startsWith('generated-')).map((item) => item.id), ['generated-link-projects']);
  assert.deepEqual(visibleSections.map((item) => item.id), ['generated-about', 'generated-music']);
  assert.equal(result.blocks.find((item) => item.id === 'turntable')?.data.visible, false);
  assert.equal(result.blocks.find((item) => item.id === 'fortune')?.data.visible, true);
  assert.equal(result.profile.homeVisibility.includes('turntable'), false);
  assert.equal(result.profile.homeVisibility.includes('fortune'), true);
  assert.equal(social.data.visible, false);
  assert.equal(social.data.icon, 'instagram');
  assert.deepEqual(reorderedSocials.map((item) => [item.id, item.data.order]), [
    ['generated-social-github', 20],
    ['generated-social-email', 10],
  ]);
  assert.equal(featured.data.group, 'featured');
  assert.equal(featured.data.image, '/images/custom-icon.svg');
  assert.equal(featured.body, 'Selected work.');
  assert.equal(imageBlock.data.layout, 'image');
  assert.equal(imageBlock.data.placement, 'before-links');
  assert.equal(imageBlock.data.imageLayout, 'split-right');
  assert.equal(imageBlock.data.imagePosition, 'top-right');
  assert.equal(imageBlock.body, 'Image block copy.');
  assert.deepEqual(home.homeVisibility, ['links', 'about', 'turntable']);
  assert.equal(home.aboutHeading, 'Profile');
  assert.equal(turntable.data.playlistId, 'PL1234567890abcdef');
  assert.equal(turntable.data.continuousPlayback, false);
  assert.equal(about.body, 'Updated card.');
  assert.equal(extractYoutubePlaylistId('https://music.youtube.com/playlist?list=PLabcdefghij1234'), 'PLabcdefghij1234');
  assert.equal(isSafeProfileUrl('https://example.com'), true);
  assert.equal(isSafeProfileUrl('mailto:hello@example.com'), true);
  assert.equal(isSafeProfileUrl('https://'), false);
  assert.equal(isSafeProfileUrl('mailto:'), false);
  assert.equal(isSafeProfileUrl('java\nscript:alert(1)'), false);
  assert.equal(isSafeProfileUrl('javascript&colon;alert(1)'), false);
  assert.equal(isSafeProfileUrl('java&Tab;script&colon;alert(1)'), false);
  assert.equal(isSafeHttpUrl('https://exa mple.com'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeImagePath('/images/profile.svg'), true);
  assert.equal(isSafeImagePath('/images/../private.svg'), false);
  assert.equal(isSafeImagePath('https://tracker.example/pixel.png'), false);
  assert.equal(isSafeMarkdownUrl('/notes/example'), true);
  assert.equal(isSafeMarkdownUrl('javascript:alert(1)'), false);
  const rawHtmlTree = { type: 'root', children: [{ type: 'html', value: '<script>alert(1)</script>' }] };
  enforceContentSafety(rawHtmlTree);
  assert.deepEqual(rawHtmlTree.children[0], { type: 'text', value: '<script>alert(1)</script>' });
  assert.throws(
    () => enforceContentSafety({ type: 'root', children: [{ type: 'link', url: 'data:text/html,unsafe', children: [] }] }),
    /Markdown URL uses a blocked or invalid protocol/,
  );
  const safetyPlugin = createContentSafetyMdastPlugin();
  const pluginHtmlNode = { type: 'html', value: '<img src=x onerror=alert(1)>' };
  let pluginReplacement;
  safetyPlugin.html(pluginHtmlNode, { replaceNode: (_node, replacement) => { pluginReplacement = replacement; } });
  assert.deepEqual(pluginReplacement, { type: 'text', value: '<img src=x onerror=alert(1)>' });
  assert.throws(
    () => safetyPlugin.link({ type: 'link', url: 'java&#x73;cript:alert(1)' }, {}),
    /Markdown URL uses a blocked or invalid protocol/,
  );

  assert.throws(
    () => validateProfileAnswers({ ...answers, unexpected: true }),
    /不支援的欄位.*unexpected/,
  );
  assert.throws(
    () => validateProfileAnswers({
      ...answers,
      identity: { ...answers.identity, tagline: ['Code', 'Code'] },
    }),
    /關鍵字不可重複/,
  );
  assert.throws(
    () => validateProfileAnswers({
      ...answers,
      links: Array.from({ length: 21 }, (_, index) => ({
        id: `link-${index}`,
        title: `Link ${index}`,
        url: 'https://example.com',
        description: 'Example',
      })),
    }),
    /精選連結數量不可超過 20/,
  );
  assert.throws(
    () => validateProfileAnswers({
      ...answers,
      sections: [{
        id: 'remote-image',
        title: 'Remote image',
        description: 'Example',
        image: 'https://tracker.example/pixel.png',
      }],
    }),
    /圖片路徑必須是 \/images\//,
  );
  assert.throws(
    () => validateProfileAnswers({
      ...answers,
      socials: [{ service: 'github', url: 'https://github.com/example', icon: null }],
    }),
    /圖示名稱為必填欄位/,
  );
  assert.throws(
    () => validateProfileAnswers({ ...answers, $schema: null }),
    /\$schema 格式不正確/,
  );

  const concurrencyRoot = path.join(temporaryRoot, 'concurrency');
  await mkdir(path.join(concurrencyRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(concurrencyRoot, 'src', 'content'), { recursive: true });
  const concurrentContent = await loadStudioContent(concurrencyRoot);
  await Promise.all([
    saveStudioProfile(concurrencyRoot, {
      ...concurrentContent.profile,
      displayName: 'Mutex Test',
      title: 'Concurrent profile write',
      tagline: ['Mutex'],
      bio: 'Both writes must survive.',
    }),
    saveHomeSettings(concurrencyRoot, {
      homeOrder: ['about', 'links', 'turntable', 'fortune', 'notion'],
      homeVisibility: ['about', 'links'],
      aboutHeading: 'Concurrent About',
      linksHeading: 'Concurrent Links',
    }),
  ]);
  const concurrentResult = await loadStudioContent(concurrencyRoot);
  assert.equal(concurrentResult.profile.displayName, 'Mutex Test');
  assert.equal(concurrentResult.profile.aboutHeading, 'Concurrent About');
  assert.deepEqual(concurrentResult.profile.homeVisibility, ['about', 'links']);

  const originalBucket = await loadFortuneBucket(temporaryRoot);
  const concurrentFortuneWrites = await Promise.allSettled([
    saveFortuneBucket(temporaryRoot, {
      fortunes: originalBucket.fortunes.map((fortune, index) => ({
        ...fortune,
        note: index === 0 ? 'First concurrent update.' : fortune.note,
      })),
      expectedRevision: originalBucket.revision,
    }),
    saveFortuneBucket(temporaryRoot, {
      fortunes: originalBucket.fortunes.map((fortune, index) => ({
        ...fortune,
        note: index === 0 ? 'Second concurrent update.' : fortune.note,
      })),
      expectedRevision: originalBucket.revision,
    }),
  ]);
  assert.equal(concurrentFortuneWrites.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(concurrentFortuneWrites.filter(({ status }) => status === 'rejected').length, 1);
  assert.ok(concurrentFortuneWrites.find(({ status }) => status === 'rejected')?.reason instanceof FortuneConflictError);
  const concurrentFortuneBucket = await loadFortuneBucket(temporaryRoot);
  const addedFortune = {
    id: 'studio-contract',
    grade: '小吉',
    category: 'joke',
    message: 'Studio 籤桶測試。',
    note: '只存在暫存測試目錄。',
    visible: true,
  };
  const savedBucket = await saveFortuneBucket(temporaryRoot, {
    fortunes: [...concurrentFortuneBucket.fortunes, addedFortune],
    expectedRevision: concurrentFortuneBucket.revision,
  });
  assert.equal(savedBucket.fortunes.at(-1)?.id, 'studio-contract');
  assert.equal(savedBucket.summary.total, concurrentFortuneBucket.summary.total + 1);
  await assert.rejects(
    saveFortuneBucket(temporaryRoot, { fortunes: savedBucket.fortunes, expectedRevision: concurrentFortuneBucket.revision }),
    (error) => error instanceof FortuneConflictError && error.status === 409,
  );
  await assert.rejects(
    saveFortuneBucket(temporaryRoot, {
      fortunes: savedBucket.fortunes.map((fortune) => ({ ...fortune, visible: false })),
      expectedRevision: savedBucket.revision,
    }),
    /至少需要一張啟用中的籤/,
  );
  const restoredBucket = await restoreFortuneBucket(temporaryRoot, { expectedRevision: savedBucket.revision });
  assert.equal(restoredBucket.fortunes.some((fortune) => fortune.id === 'studio-contract'), false);
  assert.equal(restoredBucket.summary.total, originalBucket.summary.total);

  const coordinatorStatuses = [];
  const coordinatorSaves = [];
  const coordinatorRefreshes = [];
  let scheduledCallback = null;
  let timerId = 0;
  const coordinator = createSaveCoordinator({
    delayMs: 5000,
    save: async ({ key, revision }) => { coordinatorSaves.push({ key, revision }); return { contentRevision: revision }; },
    refresh: async ({ key, revision }) => { coordinatorRefreshes.push({ key, revision }); },
    onStatus: (status) => coordinatorStatuses.push(status),
    setTimeoutFn: (callback) => { scheduledCallback = callback; timerId += 1; return timerId; },
    clearTimeoutFn: () => { scheduledCallback = null; },
  });
  for (let index = 0; index < 20; index += 1) coordinator.markDirty('profile');
  assert.equal(coordinator.getStatus('profile').status, 'dirty');
  coordinator.setMode('auto');
  assert.equal(coordinator.getStatus('profile').status, 'scheduled');
  assert.equal(typeof scheduledCallback, 'function');
  await coordinator.submit('profile');
  assert.deepEqual(coordinatorSaves, [{ key: 'profile', revision: 20 }]);
  assert.deepEqual(coordinatorRefreshes, [{ key: 'profile', revision: 20 }]);
  assert.equal(coordinator.hasPending(), false);

  const batchSaves = [];
  const batchRefreshes = [];
  const batchCoordinator = createSaveCoordinator({
    save: async ({ key, revision }) => {
      batchSaves.push({ key, revision });
      return { contentRevision: revision, key };
    },
    refresh: async ({ results, batch }) => { batchRefreshes.push({ count: results.length, batch }); },
  });
  batchCoordinator.markDirty('profile');
  batchCoordinator.markDirty('home');
  await batchCoordinator.submitAll();
  assert.deepEqual(batchSaves.map(({ key }) => key), ['profile', 'home']);
  assert.deepEqual(batchRefreshes, [{ count: 2, batch: true }]);
  assert.equal(batchCoordinator.hasPending(), false);
  batchCoordinator.markDirty('fortunes');
  batchCoordinator.reset('fortunes');
  assert.equal(batchCoordinator.hasPending(), false);

  const slowResolvers = [];
  const slowRevisions = [];
  let activeSaves = 0;
  let maximumActiveSaves = 0;
  const slowCoordinator = createSaveCoordinator({
    save: ({ revision }) => new Promise((resolve) => {
      slowRevisions.push(revision);
      activeSaves += 1;
      maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves);
      slowResolvers.push(() => { activeSaves -= 1; resolve({ contentRevision: revision }); });
    }),
  });
  slowCoordinator.markDirty('home');
  const firstSlowSave = slowCoordinator.submit('home');
  slowCoordinator.markDirty('home');
  const secondSlowSave = slowCoordinator.submit('home');
  slowResolvers.shift()();
  await firstSlowSave;
  await new Promise((resolve) => setImmediate(resolve));
  slowResolvers.shift()();
  await secondSlowSave;
  assert.deepEqual(slowRevisions, [1, 2]);
  assert.equal(maximumActiveSaves, 1);
  assert.equal(slowCoordinator.getStatus('home').status, 'clean');
  assert.ok(coordinatorStatuses.some((status) => status.status === 'scheduled'));

  const localJsonRequest = (host, origin, method = 'PUT', contentType = 'application/json; charset=utf-8') => ({
    method,
    headers: { host, origin, 'content-type': contentType },
  });
  assert.doesNotThrow(() => validateStudioRequest({ method: 'GET', headers: { host: 'localhost:4322' } }, 4322));
  assert.doesNotThrow(() => validateStudioRequest(localJsonRequest('localhost:4322', 'http://localhost:4322'), 4322));
  assert.doesNotThrow(() => validateStudioRequest(localJsonRequest('127.0.0.1:4322', 'http://127.0.0.1:4322', 'POST'), 4322));
  const rejectsStudioRequest = (request, status) => assert.throws(
    () => validateStudioRequest(request, 4322),
    (error) => error instanceof StudioRequestError && error.status === status,
  );
  rejectsStudioRequest({ method: 'GET', headers: { host: 'attacker.example:4322' } }, 403);
  rejectsStudioRequest(localJsonRequest('localhost:4322', 'http://127.0.0.1:4322'), 403);
  rejectsStudioRequest(localJsonRequest('localhost:4322', ''), 403);
  rejectsStudioRequest(localJsonRequest('localhost:4322', 'http://localhost:4322', 'POST', 'text/plain'), 415);

  const [studioCss, studioApp, studioHtml, studioServer, turntablePlayer] = await Promise.all([
    readFile(path.join(projectRoot, 'studio', 'style.css'), 'utf8'),
    readFile(path.join(projectRoot, 'studio', 'app.js'), 'utf8'),
    readFile(path.join(projectRoot, 'studio', 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'scripts', 'studio-server.mjs'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'components', 'TurntablePlayer.astro'), 'utf8'),
  ]);
  assert.match(studioCss, /body\s*\{[^}]*min-width:\s*1200px/);
  assert.match(studioCss, /html,\s*body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden/);
  assert.match(studioCss, /\.switch-track\s*\{[^}]*width:\s*42px;[^}]*height:\s*24px;[^}]*padding:\s*2px/);
  assert.match(studioCss, /\.switch-control\s*\{[^}]*position:\s*relative/);
  assert.match(studioCss, /\.switch-control input\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/);
  assert.match(studioCss, /\.switch-control input\s*\{[^}]*padding:\s*0/);
  assert.match(studioCss, /\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
  assert.match(studioCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(studioHtml, /<a class="skip-link" href="#editor">/);
  assert.match(studioHtml, /role="tablist"/);
  assert.equal((studioHtml.match(/role="tab"/g) ?? []).length, 6);
  assert.equal((studioHtml.match(/role="tabpanel"/g) ?? []).length, 6);
  assert.match(studioHtml, /data-width="desktop"[^>]*aria-pressed="true"/);
  assert.match(studioHtml, /data-width="mobile"[^>]*aria-pressed="false"/);
  assert.match(studioHtml, /id="save-all"[^>]*>儲存並更新<\/button>/);
  assert.ok(studioHtml.indexOf('id="save-all"') < studioHtml.indexOf('id="save-mode"'));
  assert.ok(studioApp.indexOf("['facebook', 'Facebook', 'facebook'") < studioApp.indexOf("['instagram', 'Instagram', 'instagram'"));
  assert.ok(studioApp.indexOf("['instagram', 'Instagram', 'instagram'") < studioApp.indexOf("['threads', 'Threads', 'threads'"));
  assert.ok(studioApp.indexOf("['threads', 'Threads', 'threads'") < studioApp.indexOf("['github', 'GitHub', 'github'"));
  assert.ok(studioApp.includes("api('/api/social-order'"));
  assert.ok(studioApp.includes('data-social-move="up"'));
  assert.ok(studioApp.includes('social-drag-handle'));
  assert.ok(studioApp.includes('dragHandle.addEventListener(\'dragstart\''));
  assert.ok(studioApp.includes('event.dataTransfer.setData(\'text/plain\''));
  assert.ok(studioApp.includes("saveCoordinator.markDirty('social-order')"));
  assert.ok(studioCss.includes('.social-order-actions'));
  assert.ok(studioCss.includes('.social-drag-handle'));
  assert.ok(studioCss.includes('.topbar-save'));
  assert.ok(studioApp.includes("$('#add-featured-link').addEventListener"));
  assert.ok(studioApp.includes("$('#add-image-block').addEventListener"));
  assert.ok(studioApp.includes("isNew ? '/api/image-blocks' : `/api/image-blocks/${editor.dataset.blockId}`"));
  assert.ok(studioApp.includes('imagePosition'));
  assert.ok(!studioApp.includes('toggleOnly'));
  assert.ok(studioApp.includes("$('.link-editor__meta small', editor).textContent"));
  assert.ok(studioApp.includes("await api('/api/home'"));
  assert.ok(studioApp.includes("url.searchParams.set('studioRevision'"));
  assert.ok(studioApp.includes("frame.addEventListener('load'"));
  assert.ok(studioApp.includes("await api('/api/fortunes'"));
  assert.ok(studioApp.includes("await api('/api/fortunes/restore'"));
  assert.ok(studioApp.includes("window.addEventListener('beforeunload'"));
  assert.ok(studioApp.includes("createSaveCoordinator"));
  assert.ok(studioApp.includes("profile-studio-save-mode"));
  assert.ok(studioApp.includes("ArrowLeft: -1, ArrowRight: 1"));
  assert.ok(studioApp.includes("if (activateTab(next)) next.focus();"));
  assert.ok(studioApp.includes("item.setAttribute('aria-pressed', active ? 'true' : 'false')"));
  assert.ok(studioApp.includes("await api('/api/answers/validate'"));
  assert.ok(studioApp.includes("await api('/api/answers/apply'"));
  assert.ok(!studioApp.includes('maximumAttempts = 3'));
  assert.equal((studioApp.match(/frame\.src = url\.href/g) ?? []).length, 1);
  assert.ok(studioApp.includes('async function submitAllPending()'));
  assert.ok(studioApp.includes('saveCoordinator.submitAll()'));
  assert.ok(studioApp.includes('assertRerenderSafe('));
  assert.ok(!studioApp.includes('image/svg+xml'));
  assert.ok(!studioApp.includes('refreshPreview(650)'));
  assert.ok(!studioApp.includes('function refreshPreview(delay = 350)'));
  assert.ok(!studioApp.includes('finally { event.currentTarget.disabled = false; }'));
  assert.ok(studioApp.includes('const button = event.currentTarget;'));
  assert.ok(studioServer.includes('previewUrl: `http://localhost:${previewPort}/`'));
  assert.ok(!studioServer.includes('previewUrl: `http://127.0.0.1:${previewPort}/`'));
  assert.ok(studioServer.includes('validateStudioRequest(request, studioPort)'));
  assert.ok(studioServer.includes('let contentRevision = 0;'));
  assert.ok(studioServer.includes('{ ...body, contentRevision }'));
  assert.ok(studioServer.includes("url.pathname === '/api/fortunes'"));
  assert.ok(studioServer.includes("url.pathname === '/api/fortunes/restore'"));
  assert.ok(studioServer.includes("url.pathname === '/api/answers/validate'"));
  assert.ok(studioServer.includes("url.pathname === '/api/answers/apply'"));
  assert.ok(studioServer.includes("url.pathname === '/api/image-blocks'"));
  assert.ok(studioServer.includes('fontOptions'));
  assert.ok(!studioServer.includes("'image/svg+xml': { extension"));
  assert.ok(studioServer.includes('if (!format.matches(buffer))'));
  assert.ok(studioServer.includes("'image/png': { extension: '.png'"));
  assert.ok(studioServer.includes("await resolvePackageBin('astro')"));
  assert.ok(!studioServer.includes("'astro', 'astro.js'"));
  assert.ok(studioServer.includes("ASTRO_DEV_BACKGROUND: 'studio-managed'"));
  assert.ok(turntablePlayer.includes('youtubeApiPromise = undefined'));

  console.log('Profile tools check passed (autosave, answer validation, image blocks, fonts, fortune editing, and Studio writes are valid).');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
