import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  applyProfileAnswers,
  createStudioLink,
  extractYoutubePlaylistId,
  saveHomeSettings,
  saveStudioBlock,
  saveStudioLink,
  saveStudioSection,
} from './profile-content.mjs';
import { StudioRequestError, validateStudioRequest } from './studio-request-security.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'profile-tools-'));

try {
  await mkdir(path.join(temporaryRoot, 'src'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(temporaryRoot, 'src', 'content'), { recursive: true });
  const answers = JSON.parse(await readFile(path.join(projectRoot, 'profile.answers.example.json'), 'utf8'));

  await applyProfileAnswers(temporaryRoot, answers);
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
  assert.equal('name' in result.profile, false);
  assert.ok(Number.isFinite(result.profile.fontScale) && result.profile.fontScale >= 0.9 && result.profile.fontScale <= 1.2);
  assert.ok(Number.isFinite(result.profile.smallTextScale) && result.profile.smallTextScale >= 0.9 && result.profile.smallTextScale <= 1.35);
  assert.deepEqual(result.profile.homeOrder, ['about', 'links', 'turntable', 'fortune', 'notion']);
  assert.equal(visibleSocials.length, 2);
  assert.deepEqual(visibleFeatured.filter((item) => item.id.startsWith('generated-')).map((item) => item.id), ['generated-link-projects']);
  assert.deepEqual(visibleSections.map((item) => item.id), ['generated-about', 'generated-music']);
  assert.equal(result.blocks.find((item) => item.id === 'turntable')?.data.visible, false);
  assert.equal(result.blocks.find((item) => item.id === 'fortune')?.data.visible, true);
  assert.equal(social.data.visible, false);
  assert.equal(social.data.icon, 'instagram');
  assert.equal(featured.data.group, 'featured');
  assert.equal(featured.data.image, '/images/custom-icon.svg');
  assert.equal(featured.body, 'Selected work.');
  assert.deepEqual(home.homeVisibility, ['links', 'about', 'turntable']);
  assert.equal(home.aboutHeading, 'Profile');
  assert.equal(turntable.data.playlistId, 'PL1234567890abcdef');
  assert.equal(turntable.data.continuousPlayback, false);
  assert.equal(about.body, 'Updated card.');
  assert.equal(extractYoutubePlaylistId('https://music.youtube.com/playlist?list=PLabcdefghij1234'), 'PLabcdefghij1234');

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

  const [studioCss, studioApp, studioServer] = await Promise.all([
    readFile(path.join(projectRoot, 'studio', 'style.css'), 'utf8'),
    readFile(path.join(projectRoot, 'studio', 'app.js'), 'utf8'),
    readFile(path.join(projectRoot, 'scripts', 'studio-server.mjs'), 'utf8'),
  ]);
  assert.match(studioCss, /body\s*\{[^}]*min-width:\s*1200px/);
  assert.match(studioCss, /html,\s*body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden/);
  assert.match(studioCss, /\.switch-track\s*\{[^}]*width:\s*42px;[^}]*height:\s*24px;[^}]*padding:\s*2px/);
  assert.match(studioCss, /\.switch-control\s*\{[^}]*position:\s*relative/);
  assert.match(studioCss, /\.switch-control input\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%/);
  assert.match(studioCss, /\.switch-control input\s*\{[^}]*padding:\s*0/);
  assert.ok(studioApp.includes("['instagram', 'Instagram', 'instagram'"));
  assert.ok(studioApp.includes("$('#add-featured-link').addEventListener"));
  assert.ok(studioApp.includes("if (toggleOnly) {"));
  assert.ok(studioApp.includes("$('.link-editor__meta small', editor).textContent"));
  assert.ok(studioApp.includes("await api('/api/home'"));
  assert.ok(!studioApp.includes('finally { event.currentTarget.disabled = false; }'));
  assert.ok(studioApp.includes('const button = event.currentTarget;'));
  assert.ok(studioServer.includes('previewUrl: `http://localhost:${previewPort}/`'));
  assert.ok(!studioServer.includes('previewUrl: `http://127.0.0.1:${previewPort}/`'));
  assert.ok(studioServer.includes('validateStudioRequest(request, studioPort)'));

  console.log('Profile tools check passed (answer import and Studio link management are valid).');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
