import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat, utimes } from 'node:fs/promises';
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
  parseMarkdown,
  previewProfileAnswers,
  stringifyMarkdown,
  validateProfileAnswers,
} from './profile-content.mjs';
import { FORTUNE_GRADES, FortuneConflictError, loadFortuneBucket, restoreFortuneBucket, saveFortuneBucket, validateFortuneBucket } from './fortune-content.mjs';
import { resolvePackageBin } from './package-bin.mjs';
import { StudioRequestError, validateStudioRequest } from './studio-request-security.mjs';
import { atomicWriteFile, atomicWriteText } from './file-writes.mjs';
import { buildThemeCss, colorContrast, createThemePalette, normalizeThemeColor } from './theme-color.mjs';
import {
  createProfileAnswersFromStudioContent,
  serializeProfileAnswers,
} from './profile-answers.mjs';
import {
  createContentSafetyMdastPlugin,
  enforceContentSafety,
  isSafeHttpUrl,
  isSafeImagePath,
  isSafeImageSource,
  isSafeMarkdownUrl,
  isSafeProfileUrl,
} from './content-safety.mjs';
import { createSettingsZip, readSettingsZip } from '../src/scripts/settings-package.js';
import { resolveOnlineStudioAccess } from './studio-access.mjs';
import { extractIframeSource, normalizeEmbedSource } from './embed-source.mjs';
import { contentText, contentTextArray, contentTextMax } from './content-text-schema.mjs';
import { applyProfileProjectUpdate, planProfileProjectUpdate, prepareProfileProjectUpdate } from './profile-project.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'profile-tools-'));

async function createProjectCopy(name) {
  const root = path.join(temporaryRoot, name);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'public'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(root, 'src', 'content'), { recursive: true });
  await cp(path.join(projectRoot, 'public', 'images'), path.join(root, 'public', 'images'), { recursive: true });
  return root;
}

try {
  assert.equal(contentText.parse(12345), '12345');
  assert.equal(contentText.parse('12345'), '12345');
  assert.deepEqual(contentTextArray.parse([101, '202']), ['101', '202']);
  assert.equal(contentTextMax(3).parse(123), '123');
  assert.equal(contentText.safeParse(true).success, false);
  assert.equal(contentText.safeParse(null).success, false);
  assert.equal(contentText.safeParse({ value: 123 }).success, false);
  assert.equal(contentText.safeParse(Number.POSITIVE_INFINITY).success, false);
  assert.equal(contentTextMax(3).safeParse(1234).success, false);
  assert.equal(resolveOnlineStudioAccess({ mode: 'off', isDev: true }), true);
  assert.equal(resolveOnlineStudioAccess({ mode: 'auto', repository: 'someone/fork' }), false);
  assert.equal(resolveOnlineStudioAccess({
    mode: 'auto',
    repository: 'Jwander0820/astro-personal-profile-template',
    allowedRepositories: 'jwander0820/astro-personal-profile-template, someone/preview',
  }), true);
  assert.equal(resolveOnlineStudioAccess({
    mode: 'auto',
    siteUrl: 'https://example.com/profile/',
    allowedSites: 'https://example.com/profile',
  }), true);
  assert.equal(resolveOnlineStudioAccess({ mode: 'public' }), true);
  assert.throws(() => resolveOnlineStudioAccess({ mode: 'private' }), /auto、public 或 off/);
  const notionIframe = '<iframe src="https://jwander.notion.site/ebd/page?v=view&amp;mode=full" width="100%" height="600" frameborder="0" allowfullscreen />';
  assert.deepEqual(extractIframeSource(notionIframe), {
    url: 'https://jwander.notion.site/ebd/page?v=view&mode=full',
    height: 600,
  });
  assert.deepEqual(normalizeEmbedSource(notionIframe), {
    url: 'https://jwander.notion.site/ebd/page?v=view&mode=full',
    provider: 'notion',
    height: 600,
    fromIframe: true,
  });
  assert.deepEqual(
    normalizeEmbedSource('https://www.youtube.com/watch?v=vfQvkPAjmws&si=tracking'),
    {
      url: 'https://www.youtube.com/embed/vfQvkPAjmws',
      provider: 'youtube',
      fromIframe: false,
    },
  );
  assert.equal(
    normalizeEmbedSource('https://www.youtube-nocookie.com/embed/vfQvkPAjmws').url,
    'https://www.youtube-nocookie.com/embed/vfQvkPAjmws',
  );
  assert.deepEqual(
    normalizeEmbedSource('<iframe width="560" height="315" src="https://www.youtube.com/embed/vfQvkPAjmws?si=tracking" allowfullscreen></iframe>'),
    {
      url: 'https://www.youtube.com/embed/vfQvkPAjmws',
      provider: 'youtube',
      height: 320,
      fromIframe: true,
    },
  );
  assert.throws(
    () => normalizeEmbedSource('<iframe src="javascript:alert(1)"></iframe>'),
    /iframe 的 src 必須是公開的 http\(s\) 網址/,
  );

  await mkdir(path.join(temporaryRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(temporaryRoot, 'src', 'content'), { recursive: true });
  const answers = JSON.parse(await readFile(path.join(projectRoot, 'profile.answers.example.json'), 'utf8'));
  const answersSchema = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'profile-answers.schema.json'), 'utf8'));
  const minimalAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'minimal.json'), 'utf8'));
  const sensitiveRefusalAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'sensitive-data-refusal.json'), 'utf8'));
  const invalidUrlAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'invalid-url.json'), 'utf8'));
  const lunaAnswers = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'ai', 'examples', 'luna-persona.json'), 'utf8'));
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const pngA = Buffer.from([...pngHeader, 0x01]);
  const pngB = Buffer.from([...pngHeader, 0x02]);
  const dataUrl = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

  const rejectedProjectRoot = await createProjectCopy('rejected-project-update');
  const rejectedProfilePath = path.join(rejectedProjectRoot, 'src', 'content', 'profile', 'main.md');
  const rejectedProfileBefore = await readFile(rejectedProfilePath);
  await assert.rejects(
    applyProfileProjectUpdate(rejectedProjectRoot, {
      answers: { ...minimalAnswers, identity: { ...minimalAnswers.identity, displayName: '' } },
      images: [{ path: '/images/profile-image.png', dataUrl: dataUrl(pngA) }],
    }),
    /顯示名稱/,
  );
  assert.deepEqual(await readFile(rejectedProfilePath), rejectedProfileBefore);
  await assert.rejects(
    readFile(path.join(rejectedProjectRoot, 'public', 'images', 'profile-image.png')),
    (error) => error?.code === 'ENOENT',
  );

  const collisionRoot = await createProjectCopy('collision-project-update');
  const collisionPath = path.join(collisionRoot, 'public', 'images', 'profile-image.png');
  await atomicWriteFile(collisionPath, pngA);
  const collisionProfilePath = path.join(collisionRoot, 'src', 'content', 'profile', 'main.md');
  const collisionProfileBefore = await readFile(collisionProfilePath);
  const collisionPayload = {
    answers: { ...minimalAnswers, media: { ...minimalAnswers.media, avatar: '/images/profile-image.png' } },
    images: [{ path: '/images/profile-image.png', dataUrl: dataUrl(pngB) }],
  };
  const collisionPlan = await planProfileProjectUpdate(collisionRoot, collisionPayload);
  const resolvedCollisionPath = collisionPlan.imageReplacements['/images/profile-image.png'];
  assert.match(resolvedCollisionPath, /^\/images\/profile-image-[a-f0-9]{10}\.png$/);
  assert.deepEqual(await readFile(collisionPath), pngA, 'planning and collision handling must not overwrite an existing image');
  assert.deepEqual(await readFile(collisionProfilePath), collisionProfileBefore, 'planning must not update content');
  await assert.rejects(
    readFile(path.join(collisionRoot, 'public', resolvedCollisionPath)),
    (error) => error?.code === 'ENOENT',
  );
  const collisionResult = await applyProfileProjectUpdate(collisionRoot, collisionPayload);
  assert.equal(collisionResult.answers.media.avatar, resolvedCollisionPath);
  assert.deepEqual(await readFile(collisionPath), pngA);
  assert.deepEqual(await readFile(path.join(collisionRoot, 'public', resolvedCollisionPath)), pngB);

  const mergeRoot = await createProjectCopy('merge-project-update');
  const preservedLinkPath = path.join(mergeRoot, 'src', 'content', 'links', 'github.md');
  const preservedEmbedPath = path.join(mergeRoot, 'src', 'content', 'blocks', 'notion-embed.md');
  const [preservedLink, preservedEmbed] = await Promise.all([
    readFile(preservedLinkPath),
    readFile(preservedEmbedPath),
  ]);
  const mergeResult = await applyProfileProjectUpdate(mergeRoot, {
    answers: {
      version: 1,
      applyMode: 'merge',
      identity: { title: 'Merged title' },
    },
  });
  assert.equal(mergeResult.content.profile.title, 'Merged title');
  assert.deepEqual(await readFile(preservedLinkPath), preservedLink);
  assert.deepEqual(await readFile(preservedEmbedPath), preservedEmbed);
  assert.equal(mergeResult.plan.changes.some((change) => change.file.startsWith('src/content/links/')), false);
  assert.equal(mergeResult.plan.changes.some((change) => change.file === 'src/content/blocks/notion-embed.md'), false);
  await assert.rejects(
    planProfileProjectUpdate(mergeRoot, { answers: { version: 1, applyMode: 'merge', inventedField: true } }),
    /inventedField/,
  );
  await assert.rejects(
    planProfileProjectUpdate(mergeRoot, {
      answers: { version: 1, applyMode: 'merge', identity: { title: 'No image update' } },
      images: [{ path: '/images/unreferenced.png', dataUrl: dataUrl(pngA) }],
    }),
    /未被這次更新引用/,
  );

  const planTokenRoot = await createProjectCopy('plan-token-project-update');
  const tokenPayload = {
    answers: { version: 1, applyMode: 'merge', identity: { title: 'Confirmed plan' } },
  };
  const tokenPlan = await planProfileProjectUpdate(planTokenRoot, tokenPayload);
  assert.match(tokenPlan.token, /^[a-f0-9]{64}$/);
  await applyProfileProjectUpdate(planTokenRoot, {
    answers: { version: 1, applyMode: 'merge', identity: { title: 'Intervening update' } },
  });
  await assert.rejects(
    applyProfileProjectUpdate(planTokenRoot, { ...tokenPayload, expectedPlanToken: tokenPlan.token }),
    /預覽後改變/,
  );
  assert.equal((await loadStudioContent(planTokenRoot)).profile.title, 'Intervening update');

  const conflictRoot = await createProjectCopy('conflicting-project-update');
  const firstPrepared = await prepareProfileProjectUpdate(conflictRoot, {
    answers: { version: 1, applyMode: 'merge', identity: { title: 'First plan' } },
  });
  const stalePrepared = await prepareProfileProjectUpdate(conflictRoot, {
    answers: { version: 1, applyMode: 'merge', identity: { title: 'Stale plan' } },
  });
  try {
    await firstPrepared.commit();
    await assert.rejects(stalePrepared.commit(), /請重新預覽再儲存/);
    assert.equal((await loadStudioContent(conflictRoot)).profile.title, 'First plan');
  } finally {
    await firstPrepared.dispose();
    await stalePrepared.dispose();
  }

  const answersPreview = previewProfileAnswers(answers);
  const minimalPreview = previewProfileAnswers(minimalAnswers);
  const sensitiveRefusalPreview = previewProfileAnswers(sensitiveRefusalAnswers);
  const lunaPreview = previewProfileAnswers(lunaAnswers);
  const iframeAnswers = validateProfileAnswers({
    ...minimalAnswers,
    embedBlocks: [{
      id: 'notion-notes',
      title: 'Notion notes',
      url: notionIframe,
      embedMode: 'inline',
    }],
  });
  assert.equal(iframeAnswers.embedBlocks[0].url, 'https://jwander.notion.site/ebd/page?v=view&mode=full');
  assert.equal(iframeAnswers.embedBlocks[0].provider, 'notion');
  assert.equal(iframeAnswers.embedBlocks[0].height, 600);
  const numericTextAnswers = structuredClone(answers);
  numericTextAnswers.identity = {
    ...numericTextAnswers.identity,
    displayName: 2026,
    title: 101,
    location: 886,
    tagline: [1, 2],
    bio: 314159,
  };
  numericTextAnswers.socials[0].title = 1024;
  numericTextAnswers.links[0] = {
    ...numericTextAnswers.links[0],
    title: 2048,
    description: 4096,
    style: 'subtle',
    tags: [8192],
  };
  numericTextAnswers.sections[0] = {
    ...numericTextAnswers.sections[0],
    title: 16384,
    description: 32768,
    tags: [65536],
  };
  numericTextAnswers.imageBlocks[0] = {
    ...numericTextAnswers.imageBlocks[0],
    title: 131072,
    imageAlt: 262144,
    description: 524288,
    tags: [1048576],
  };
  numericTextAnswers.playlist = {
    youtubePlaylistId: 'PL1234567890abcdef',
    title: 2097152,
    description: 4194304,
  };
  numericTextAnswers.fortune = {
    ...numericTextAnswers.fortune,
    title: 8388608,
    description: 16777216,
    fortunes: numericTextAnswers.fortune.fortunes.map((fortune, index) => ({
      ...fortune,
      message: 33554432 + index,
      ...(index === 0 ? { note: 67108864 } : {}),
    })),
  };
  const normalizedNumericTextAnswers = validateProfileAnswers(numericTextAnswers);
  assert.equal(normalizedNumericTextAnswers.identity.displayName, '2026');
  assert.equal(normalizedNumericTextAnswers.identity.title, '101');
  assert.equal(normalizedNumericTextAnswers.identity.location, '886');
  assert.deepEqual(normalizedNumericTextAnswers.identity.tagline, ['1', '2']);
  assert.equal(normalizedNumericTextAnswers.identity.bio, '314159');
  assert.equal(normalizedNumericTextAnswers.socials[0].title, '1024');
  assert.equal(normalizedNumericTextAnswers.links[0].title, '2048');
  assert.equal(normalizedNumericTextAnswers.links[0].description, '4096');
  assert.equal(normalizedNumericTextAnswers.links[0].style, 'subtle');
  assert.deepEqual(normalizedNumericTextAnswers.links[0].tags, ['8192']);
  assert.equal(normalizedNumericTextAnswers.sections[0].title, '16384');
  assert.equal(normalizedNumericTextAnswers.sections[0].description, '32768');
  assert.deepEqual(normalizedNumericTextAnswers.sections[0].tags, ['65536']);
  assert.equal(normalizedNumericTextAnswers.imageBlocks[0].title, '131072');
  assert.equal(normalizedNumericTextAnswers.imageBlocks[0].imageAlt, '262144');
  assert.equal(normalizedNumericTextAnswers.imageBlocks[0].description, '524288');
  assert.deepEqual(normalizedNumericTextAnswers.imageBlocks[0].tags, ['1048576']);
  assert.equal(normalizedNumericTextAnswers.playlist.title, '2097152');
  assert.equal(normalizedNumericTextAnswers.playlist.description, '4194304');
  assert.equal(normalizedNumericTextAnswers.fortune.title, '8388608');
  assert.equal(normalizedNumericTextAnswers.fortune.description, '16777216');
  assert.equal(normalizedNumericTextAnswers.fortune.fortunes[0].message, '33554432');
  assert.equal(normalizedNumericTextAnswers.fortune.fortunes[0].note, '67108864');
  assert.match(serializeProfileAnswers(numericTextAnswers), /"displayName": "2026"/);
  const numericMarkdown = stringifyMarkdown({
    title: normalizedNumericTextAnswers.links[0].title,
    tags: normalizedNumericTextAnswers.links[0].tags,
  }, normalizedNumericTextAnswers.links[0].description);
  assert.match(numericMarkdown, /^title: "2048"$/m);
  assert.match(numericMarkdown, /^tags: \["8192"\]$/m);
  const numericMarkdownRoundTrip = parseMarkdown(numericMarkdown);
  assert.equal(numericMarkdownRoundTrip.data.title, '2048');
  assert.deepEqual(numericMarkdownRoundTrip.data.tags, ['8192']);
  assert.equal(numericMarkdownRoundTrip.body, '4096');
  assert.throws(
    () => validateProfileAnswers({
      ...numericTextAnswers,
      identity: { ...numericTextAnswers.identity, displayName: true },
    }),
    /顯示名稱格式不正確/,
  );
  const currentStudioContent = await loadStudioContent(temporaryRoot);
  const exportedCurrentAnswers = createProfileAnswersFromStudioContent(currentStudioContent);
  assert.equal(exportedCurrentAnswers.$schema, './docs/profile-answers.schema.json');
  assert.equal(typeof exportedCurrentAnswers.identity.displayName, 'string');
  assert.ok(exportedCurrentAnswers.identity.displayName.trim().length > 0);
  assert.equal(exportedCurrentAnswers.identity.displayName, currentStudioContent.profile.displayName);
  const expectedSocialCount = currentStudioContent.links.filter(
    (link) => link.data.visible !== false && link.data.group === 'social' && link.data.layout === 'icon',
  ).length;
  const expectedFeaturedLinkCount = currentStudioContent.links.filter(
    (link) => link.data.visible !== false
      && ['main', 'featured'].includes(link.data.group)
      && link.data.layout === 'card',
  ).length;
  const expectedSectionCount = currentStudioContent.sections.filter(
    (section) => section.data.visible !== false,
  ).length;
  assert.equal(exportedCurrentAnswers.socials.length, expectedSocialCount);
  assert.equal(exportedCurrentAnswers.links.length, expectedFeaturedLinkCount);
  assert.equal(exportedCurrentAnswers.sections.length, expectedSectionCount);
  assert.ok(exportedCurrentAnswers.fortune.fortunes.length > 0);
  assert.equal(answersPreview.summary.fortuneCount, 2);
  assert.equal('fortune' in minimalPreview.answers, false, '舊版回答檔未提供 fortune 時必須保持向下相容');
  assert.doesNotThrow(() => validateProfileAnswers(exportedCurrentAnswers));
  const contentWithoutOptionalCards = {
    ...structuredClone(currentStudioContent),
    links: currentStudioContent.links.map((link) => ({
      ...structuredClone(link),
      data: { ...structuredClone(link.data), visible: false },
    })),
    sections: currentStudioContent.sections.map((section) => ({
      ...structuredClone(section),
      data: { ...structuredClone(section.data), visible: false },
    })),
  };
  const answersWithoutOptionalCards = createProfileAnswersFromStudioContent(contentWithoutOptionalCards);
  assert.deepEqual(answersWithoutOptionalCards.socials, []);
  assert.deepEqual(answersWithoutOptionalCards.links, []);
  assert.deepEqual(answersWithoutOptionalCards.sections, []);
  assert.doesNotThrow(() => validateProfileAnswers(answersWithoutOptionalCards));
  const serializedCurrentAnswers = serializeProfileAnswers(exportedCurrentAnswers);
  assert.match(serializedCurrentAnswers, /^\{\n  "\$schema": "\.\/docs\/profile-answers\.schema\.json"/);
  assert.ok(serializedCurrentAnswers.endsWith('\n'));
  const astroCli = await resolvePackageBin('astro');
  assert.match(astroCli, /[\\/]astro[\\/]bin[\\/]astro\.mjs$/);
  assert.match(await readFile(astroCli, 'utf8'), /astro/);
  assert.equal(normalizeThemeColor('#7a58a6'), '#7A58A6');
  assert.equal(normalizeThemeColor('abc'), '#AABBCC');
  assert.equal(normalizeThemeColor('#12GG34'), null);
  const brightPalette = createThemePalette('#FFFFFF');
  assert.ok(colorContrast(brightPalette.light.accent, '#FFFFFF') >= 4.5);
  assert.ok(colorContrast(brightPalette.dark.accent, '#15111B') >= 4.5);
  const tealPalette = createThemePalette('#137C8B');
  assert.match(tealPalette.light['turntable-record-label-bg'], /#137C8B/);
  assert.match(tealPalette.dark['turntable-record-label-bg'], /^radial-gradient/);
  assert.match(buildThemeCss('#3568A8'), /:root\[data-theme="dark"\]/);

  const unchangedWritePath = path.join(temporaryRoot, 'unchanged-write.txt');
  assert.equal(await atomicWriteText(unchangedWritePath, 'same content'), true);
  const fixedTimestamp = new Date('2001-01-01T00:00:00.000Z');
  await utimes(unchangedWritePath, fixedTimestamp, fixedTimestamp);
  const timestampBeforeNoOp = (await stat(unchangedWritePath)).mtimeMs;
  assert.equal(await atomicWriteText(unchangedWritePath, 'same content'), false);
  assert.equal((await stat(unchangedWritePath)).mtimeMs, timestampBeforeNoOp);
  assert.equal(await atomicWriteText(unchangedWritePath, 'updated content'), true);
  assert.equal(await readFile(unchangedWritePath, 'utf8'), 'updated content');

  await applyProfileAnswers(temporaryRoot, answers);
  await applyProfileAnswers(temporaryRoot, answersPreview.answers);
  const numericAppliedResult = await applyProfileAnswers(temporaryRoot, numericTextAnswers);
  const numericAppliedLink = numericAppliedResult.links.find((link) => link.id === `generated-link-${numericTextAnswers.links[0].id}`);
  assert.equal(numericAppliedLink?.data.title, '2048');
  assert.equal(typeof numericAppliedLink?.data.title, 'string');
  assert.equal(numericAppliedLink?.data.style, 'subtle');
  assert.equal(numericAppliedLink?.body, '4096');
  const result = await applyProfileAnswers(temporaryRoot, answers);
  assert.equal(result.blocks.find((block) => block.id === 'fortune')?.data.title, answers.fortune.title);
  assert.equal(result.fortunes.length, answers.fortune.fortunes.length);
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
    playlist: 'https://youtube.com/playlist?list=PL1234567890abcdef&si=UHVN7ue5z4pT-Byi',
    continuousPlayback: false,
    body: 'Playlist description.',
  });
  const unchangedTurntablePath = path.join(temporaryRoot, 'src', 'content', 'blocks', 'turntable.md');
  await utimes(unchangedTurntablePath, fixedTimestamp, fixedTimestamp);
  const turntableTimestampBeforeNoOp = (await stat(unchangedTurntablePath)).mtimeMs;
  await saveHomeSettings(temporaryRoot, home);
  assert.equal((await stat(unchangedTurntablePath)).mtimeMs, turntableTimestampBeforeNoOp);
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
  const replaceRequiredIdentity = answersSchema.allOf[0].else.properties.identity.required;
  assert.equal(replaceRequiredIdentity.includes('displayName'), true);
  assert.equal(replaceRequiredIdentity.includes('bio'), false);
  assert.equal(replaceRequiredIdentity.includes('title'), false);
  assert.equal(replaceRequiredIdentity.includes('tagline'), false);
  assert.equal(answersSchema.properties.appearance.properties.mainColor.default, '#7A58A6');
  assert.ok(answersSchema.properties.identity.properties.displayName.type.includes('number'));
  assert.ok(answersSchema.properties.links.items.properties.title.type.includes('number'));
  assert.deepEqual(answersSchema.properties.links.items.properties.style.enum, ['primary', 'normal', 'subtle']);
  assert.ok(answersSchema.properties.sections.items.properties.description.type.includes('number'));
  assert.ok(answersSchema.properties.fortune.properties.fortunes.items.properties.message.type.includes('number'));
  assert.equal('minLength' in answersSchema.properties.identity.properties.title, false);
  assert.equal('minLength' in answersSchema.properties.identity.properties.bio, false);
  assert.equal(answersPreview.summary.socialCount, 2);
  assert.equal(answersPreview.summary.sectionCount, 2);
  assert.equal(answersPreview.summary.imageBlockCount, 1);
  assert.equal(answersPreview.summary.embedBlockCount, 1);
  assert.equal(answersSchema.properties.embedBlocks.items.properties.height.minimum, 320);
  assert.equal(answersSchema.properties.embedBlocks.items.properties.height.maximum, 1200);
  assert.equal(answersPreview.answers.identity.location, 'Taiwan');
  assert.ok(answersPreview.warnings.some((warning) => warning.includes('location')));
  assert.equal(minimalPreview.summary.socialCount, 0);
  assert.equal(minimalPreview.summary.playlistEnabled, false);
  assert.equal(minimalPreview.summary.title, '');
  assert.equal(minimalPreview.summary.taglineCount, 0);
  assert.equal(sensitiveRefusalPreview.summary.hasLocation, false);
  assert.equal(sensitiveRefusalPreview.summary.fortuneEnabled, false);
  assert.equal(lunaPreview.summary.displayName, 'Luna（測試人格）');
  assert.equal(lunaPreview.summary.taglineCount, 3);
  assert.equal(lunaPreview.summary.socialCount, 0);
  assert.equal(lunaPreview.summary.linkCount, 0);
  assert.equal(lunaPreview.summary.sectionCount, 2);
  assert.equal(lunaPreview.summary.imageBlockCount, 0);
  assert.equal(lunaPreview.summary.embedBlockCount, 0);
  assert.equal(lunaPreview.summary.playlistEnabled, false);
  assert.equal(lunaPreview.summary.fortuneEnabled, true);
  assert.deepEqual(lunaPreview.warnings, []);
  assert.throws(() => previewProfileAnswers(invalidUrlAnswers), /社群網址必須是 http\(s\)、mailto 或頁面錨點/);
  assert.equal(
    previewProfileAnswers({ ...lunaAnswers, identity: { ...lunaAnswers.identity, bio: '' } }).answers.identity.bio,
    '',
  );
  const { bio: _omittedBio, ...identityWithoutBio } = lunaAnswers.identity;
  const optionalBioRoot = path.join(temporaryRoot, 'optional-bio');
  await mkdir(path.join(optionalBioRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(optionalBioRoot, 'src', 'content'), { recursive: true });
  const optionalBioResult = await applyProfileAnswers(optionalBioRoot, {
    ...lunaAnswers,
    identity: identityWithoutBio,
  });
  assert.equal(optionalBioResult.profile.bio, '');
  const optionalIdentityRoot = path.join(temporaryRoot, 'optional-title-tagline');
  await mkdir(path.join(optionalIdentityRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(optionalIdentityRoot, 'src', 'content'), { recursive: true });
  const optionalIdentityResult = await applyProfileAnswers(optionalIdentityRoot, minimalAnswers);
  assert.equal(optionalIdentityResult.profile.title, undefined);
  assert.equal(optionalIdentityResult.profile.tagline, undefined);
  const optionalIdentityMarkdown = await readFile(path.join(optionalIdentityRoot, 'src', 'content', 'profile', 'main.md'), 'utf8');
  assert.doesNotMatch(optionalIdentityMarkdown, /^title:/m);
  assert.doesNotMatch(optionalIdentityMarkdown, /^tagline:/m);
  const remoteImageUrl = 'https://cdn.jwander.net/codexpet/Justaway/spritesheet.webp';
  const remoteImageAnswers = {
    ...minimalAnswers,
    media: { avatar: remoteImageUrl, background: remoteImageUrl },
    sections: [{
      id: 'remote-image',
      title: 'Remote image',
      description: 'Public HTTPS image test.',
      image: remoteImageUrl,
      tags: [],
    }],
    imageBlocks: [{
      id: 'remote-story',
      title: 'Remote story',
      image: remoteImageUrl,
      imageAlt: 'Remote image test.',
      description: '',
      placement: 'after-sections',
      imageLayout: 'full',
      imageAspect: 'landscape',
      imagePosition: 'center',
      tags: [],
    }],
  };
  const validatedRemoteImages = validateProfileAnswers(remoteImageAnswers);
  assert.equal(validatedRemoteImages.media.avatar, remoteImageUrl);
  assert.equal(validatedRemoteImages.sections[0].image, remoteImageUrl);
  assert.equal(validatedRemoteImages.imageBlocks[0].image, remoteImageUrl);
  const remoteImageRoot = path.join(temporaryRoot, 'remote-images');
  await mkdir(path.join(remoteImageRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(remoteImageRoot, 'src', 'content'), { recursive: true });
  const remoteImageResult = await applyProfileAnswers(remoteImageRoot, remoteImageAnswers);
  assert.equal(remoteImageResult.profile.avatar, remoteImageUrl);
  assert.equal(remoteImageResult.profile.background, remoteImageUrl);
  assert.equal(remoteImageResult.sections.find((item) => item.data.image === remoteImageUrl)?.data.image, remoteImageUrl);
  assert.equal(remoteImageResult.blocks.find((item) => item.data.image === remoteImageUrl)?.data.image, remoteImageUrl);
  assert.throws(
    () => previewProfileAnswers({ ...lunaAnswers, socials: [{ service: 'github', title: 'GitHub', url: 'github.com/luna', icon: 'github' }] }),
    /社群網址必須是 http\(s\)、mailto 或頁面錨點/,
  );
  assert.throws(
    () => previewProfileAnswers({
      ...lunaAnswers,
      embedBlocks: [{ id: 'unsafe', title: 'Unsafe', url: 'javascript:alert(1)' }],
    }),
    /網頁內嵌網址必須是公開的 http\(s\) 網址/,
  );
  assert.equal('name' in result.profile, false);
  assert.ok(Number.isFinite(result.profile.fontScale) && result.profile.fontScale >= 0.9 && result.profile.fontScale <= 1.2);
  assert.ok(Number.isFinite(result.profile.smallTextScale) && result.profile.smallTextScale >= 0.9 && result.profile.smallTextScale <= 1.35);
  assert.equal(result.profile.bodyFont, 'noto-sans-tc');
  assert.equal(result.profile.displayFont, 'noto-serif-tc');
  assert.equal(result.profile.mainColor, '#7A58A6');
  assert.equal(answersPreview.summary.mainColor, '#7A58A6');
  assert.deepEqual(result.profile.homeOrder, ['about', 'links', 'turntable', 'fortune', 'notion']);
  assert.equal(visibleSocials.length, 2);
  assert.deepEqual(visibleFeatured.filter((item) => item.id.startsWith('generated-')).map((item) => item.id), ['generated-link-projects']);
  assert.deepEqual(visibleSections.map((item) => item.id), ['generated-about', 'generated-music']);
  assert.equal(result.blocks.find((item) => item.id === 'turntable')?.data.visible, false);
  assert.equal(result.blocks.find((item) => item.id === 'fortune')?.data.visible, true);
  assert.equal(result.blocks.find((item) => item.id === 'generated-embed-recent-updates')?.data.layout, 'embed');
  assert.equal(result.blocks.find((item) => item.id === 'generated-embed-recent-updates')?.data.embedMode, 'preview');
  assert.equal(result.blocks.find((item) => item.id === 'notion-embed')?.data.visible, false);
  assert.equal(result.profile.homeVisibility.includes('notion'), true);
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
  assert.equal(
    extractYoutubePlaylistId('https://youtube.com/playlist?list=PLlaN88a7y2_oK0nKMjZSwdU_njxUYWykm&si=UHVN7ue5z4pT-Byi'),
    'PLlaN88a7y2_oK0nKMjZSwdU_njxUYWykm',
  );
  assert.equal(
    extractYoutubePlaylistId('https://youtu.be/abcdefghijk?si=share-token&list=PLabcdefghij1234'),
    'PLabcdefghij1234',
  );
  assert.throws(
    () => extractYoutubePlaylistId('https://example.com/playlist?list=PLabcdefghij1234'),
    /請貼上 YouTube 播放清單網址/,
  );
  assert.equal(
    validateProfileAnswers({
      ...minimalAnswers,
      playlist: {
        youtubePlaylistId: 'https://www.youtube.com/playlist?list=PLabcdefghij1234&si=share-token',
      },
    }).playlist.youtubePlaylistId,
    'PLabcdefghij1234',
  );
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
  assert.equal(isSafeImageSource('/images/profile.svg'), true);
  assert.equal(isSafeImageSource('https://cdn.jwander.net/codexpet/Justaway/spritesheet.webp'), true);
  assert.equal(isSafeImageSource('http://cdn.example.com/avatar.webp'), false);
  assert.equal(isSafeImageSource('https://user:password@example.com/private.webp'), false);
  assert.equal(isSafeImageSource("https://example.com/a');color:red;/*"), false);
  assert.equal(isSafeImageSource('javascript:alert(1)'), false);
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
        image: 'http://tracker.example/pixel.png',
      }],
    }),
    /圖片來源必須是 .*公開 HTTPS 圖片網址/,
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
  assert.throws(
    () => validateProfileAnswers({ ...answers, appearance: { ...answers.appearance, mainColor: 'purple' } }),
    /appearance\.mainColor必須是 3 或 6 碼十六進位色碼/,
  );
  assert.throws(
    () => validateProfileAnswers({
      ...answers,
      links: [{ ...answers.links[0], style: 'loud' }],
    }),
    /精選連結樣式包含不支援的值/,
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
  const sevenGradeBucket = validateFortuneBucket(FORTUNE_GRADES.map((grade, index) => ({
    id: `grade-${index + 1}`,
    grade,
    category: 'blessing',
    message: `${grade}測試籤。`,
    visible: true,
  })));
  assert.deepEqual(sevenGradeBucket.map((fortune) => fortune.grade), FORTUNE_GRADES);
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

  const packageBytes = createSettingsZip([
    { name: 'profile.answers.json', data: new TextEncoder().encode(serializedCurrentAnswers) },
    { name: 'images/avatar.png', data: new Uint8Array([1, 2, 3, 4]) },
  ]);
  const packageEntries = readSettingsZip(packageBytes);
  assert.equal(new TextDecoder().decode(packageEntries.get('profile.answers.json')), serializedCurrentAnswers);
  assert.deepEqual([...packageEntries.get('images/avatar.png')], [1, 2, 3, 4]);
  assert.equal(exportedCurrentAnswers.media.avatar, currentStudioContent.profile.avatar ?? '/images/avatar.svg');
  assert.equal(exportedCurrentAnswers.media.background, currentStudioContent.profile.background ?? '/images/background.svg');

  const localPreviewRequest = {
    method: 'POST',
    headers: { host: 'localhost:4322', origin: 'http://localhost:4321', 'content-type': 'application/json' },
  };
  assert.doesNotThrow(() => validateStudioRequest(localPreviewRequest, 4322, 4321));
  assert.throws(
    () => validateStudioRequest({ ...localPreviewRequest, headers: { ...localPreviewRequest.headers, origin: 'https://attacker.example' } }, 4322, 4321),
    (error) => error instanceof StudioRequestError && error.status === 403,
  );

  const [onlineStudioPage, onlineStudioApp, renderer, previewBridge, studioServerSource, fortuneStudioPage, fortuneStudioPreviewPage, fortuneStudioApp, iconStudioPage, studioRouteNav, studioExampleLink, fortuneDraw] = await Promise.all([
    readFile(path.join(projectRoot, 'src', 'pages', 'studio.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'scripts', 'online-studio.js'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'scripts', 'profile-renderer.js'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'scripts', 'profile-preview-bridge.js'), 'utf8'),
    readFile(path.join(projectRoot, 'scripts', 'studio-server.mjs'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'pages', 'studio', 'fortune-poem.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'pages', 'studio', 'fortune-poem', 'preview.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'scripts', 'fortune-studio.js'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'pages', 'studio', 'icons.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'components', 'StudioRouteNav.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'components', 'StudioExampleLink.astro'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'components', 'FortuneDraw.astro'), 'utf8'),
  ]);
  assert.match(onlineStudioPage, /<iframe[\s\S]*id="profile-preview"/);
  assert.match(onlineStudioPage, /id="tab-features"[\s\S]*其它功能/);
  assert.match(onlineStudioPage, /id="random-main-color"[^>]*>沒想法？抽！/);
  assert.match(onlineStudioPage, /id="save-project"[^>]*hidden/);
  assert.match(onlineStudioPage, /id="ai-answers-json"/);
  assert.ok(onlineStudioApp.includes('createSettingsZip'));
  assert.ok(onlineStudioApp.includes('readSettingsZip'));
  assert.ok(onlineStudioApp.includes('requestProjectPlan'));
  assert.ok(onlineStudioApp.includes('applyProjectPlan'));
  assert.ok(studioServerSource.includes("url.pathname === '/api/project/plan'"));
  assert.ok(studioServerSource.includes("url.pathname === '/api/project/apply'"));
  assert.ok(!onlineStudioApp.includes('sim-social'));
  assert.ok(renderer.includes("document.createElementNS('http://www.w3.org/2000/svg', 'svg')"));
  assert.ok(renderer.includes("node('nav', 'socials')"));
  assert.ok(previewBridge.includes("event.data?.type !== 'profile-studio:render'"));
  assert.ok(studioServerSource.includes("'Access-Control-Allow-Origin'"));
  assert.ok(studioServerSource.includes("Location: `http://localhost:${previewPort}/studio/`"));
  assert.ok(fortuneStudioPage.includes('/studio/fortune-poem/preview/'));
  assert.ok(fortuneStudioPreviewPage.includes('<CustomBlock'));
  assert.ok(fortuneStudioApp.includes('抽到這張了'));
  assert.ok(fortuneStudioApp.includes('selectedFortune'));
  assert.ok(fortuneStudioApp.includes('if (frameReady || !frame.contentWindow) return;'));
  assert.ok(fortuneDraw.includes("'fortune-draw:show'"));
  assert.ok(fortuneStudioApp.includes("localStorage.setItem(STORAGE_KEY"));
  assert.ok(fortuneStudioApp.includes('/api/fortunes'));
  assert.ok(fortuneStudioApp.includes('/api/blocks/fortune'));
  assert.ok(iconStudioPage.includes('data-copy={name}'));
  assert.ok(!iconStudioPage.includes('data-copy={`icon:'));
  assert.ok(iconStudioPage.includes('按下「複製」會取得該代號'));
  assert.ok(!onlineStudioPage.includes('只有顯示名稱必填'));
  assert.ok(studioExampleLink.includes('class="studio-example-link"'));
  assert.ok(studioExampleLink.includes('範例網頁'));
  assert.ok(!studioRouteNav.includes('原網站'));
  assert.ok(onlineStudioPage.indexOf('id="draft-status"') < onlineStudioPage.indexOf('<StudioExampleLink'));
  assert.ok(studioRouteNav.includes('/studio/fortune-poem/'));
  assert.ok(studioRouteNav.includes('/studio/icons/'));


  console.log('Profile tools check passed (answers, ZIP media, local adapter security, renderer bridge, and Studio writes are valid).');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
