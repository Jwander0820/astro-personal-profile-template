import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from './file-writes.mjs';
import { createProfileAnswersFromStudioContent, resolveProfileAnswerUpdate } from './profile-answers.mjs';
import { applyProfileAnswers, loadStudioContent } from './profile-content.mjs';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PROJECT_SURFACES = ['public/images', 'src/content'];
const projectWriteQueues = new Map();

const IMAGE_FORMATS = {
  'image/png': {
    extension: '.png',
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/jpeg': {
    extension: '.jpg',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  'image/webp': {
    extension: '.webp',
    matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
  'image/gif': {
    extension: '.gif',
    matches: (buffer) => ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6)),
  },
};

function isNotFound(error) {
  return error?.code === 'ENOENT';
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function withProjectWriteLock(projectRoot, operation) {
  const key = path.resolve(projectRoot);
  const previous = projectWriteQueues.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  projectWriteQueues.set(key, current);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (projectWriteQueues.get(key) === current) projectWriteQueues.delete(key);
  }
}

function validateStudioImage(input) {
  if (!input || typeof input.path !== 'string' || typeof input.dataUrl !== 'string') {
    throw new Error('圖片資料不完整。');
  }
  if (!/^\/images\/[A-Za-z0-9._/-]+$/.test(input.path) || input.path.includes('..')) {
    throw new Error('圖片路徑必須位於 /images/。');
  }
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('僅支援 PNG、JPG、WebP 或 GIF。');
  const format = IMAGE_FORMATS[match[1]];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_SIZE) throw new Error('圖片不可超過 5 MB。');
  if (!format.matches(buffer)) throw new Error('圖片內容與宣告格式不一致。');
  return { requestedPath: input.path, buffer, extension: format.extension };
}

function normalizedImageBase(requestedPath, digest) {
  const parsed = path.posix.parse(requestedPath);
  const safeBase = parsed.name.toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return safeBase || `profile-image-${digest}`;
}

async function allocateImagePath(stagingRoot, image) {
  const digest = createHash('sha256').update(image.buffer).digest('hex').slice(0, 10);
  const base = normalizedImageBase(image.requestedPath, digest);
  const candidates = [`${base}${image.extension}`, `${base}-${digest}${image.extension}`];
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    candidates.push(`${base}-${digest}-${suffix}${image.extension}`);
  }
  for (const fileName of candidates) {
    const filePath = path.join(stagingRoot, 'public', 'images', fileName);
    const existing = await readOptional(filePath);
    if (!existing) return { filePath, publicPath: `/images/${fileName}`, shouldWrite: true };
    if (existing.equals(image.buffer)) return { filePath, publicPath: `/images/${fileName}`, shouldWrite: false };
  }
  throw new Error('無法為圖片建立不重複的安全檔名。');
}

function replaceImageReferences(answers, replacements) {
  const replace = (value) => replacements.get(value) ?? value;
  answers.media.avatar = replace(answers.media.avatar);
  answers.media.background = replace(answers.media.background);
  answers.sections.forEach((item) => { if (item.image) item.image = replace(item.image); });
  answers.imageBlocks.forEach((item) => { item.image = replace(item.image); });
}

function updatedImageReferences(answers, updateKeys) {
  const references = new Set();
  if (updateKeys.has('media')) {
    references.add(answers.media.avatar);
    references.add(answers.media.background);
  }
  if (updateKeys.has('sections')) {
    answers.sections.forEach((item) => { if (item.image) references.add(item.image); });
  }
  if (updateKeys.has('imageBlocks')) {
    answers.imageBlocks.forEach((item) => references.add(item.image));
  }
  return references;
}

async function copyProjectSurface(projectRoot, stagingRoot) {
  await mkdir(path.join(stagingRoot, 'src'), { recursive: true });
  await mkdir(path.join(stagingRoot, 'public', 'images'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'content'), path.join(stagingRoot, 'src', 'content'), { recursive: true });
  try {
    await cp(path.join(projectRoot, 'public', 'images'), path.join(stagingRoot, 'public', 'images'), { recursive: true });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

async function listFiles(root, relative = '') {
  const directory = path.join(root, relative);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
    entries.sort((first, second) => first.name.localeCompare(second.name));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const next = path.posix.join(relative.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
}

async function collectOperations(projectRoot, stagingRoot) {
  const operations = [];
  for (const surface of PROJECT_SURFACES) {
    for (const relativeFile of await listFiles(stagingRoot, surface)) {
      const stagedPath = path.join(stagingRoot, relativeFile);
      const targetPath = path.join(projectRoot, relativeFile);
      const [next, previous] = await Promise.all([readFile(stagedPath), readOptional(targetPath)]);
      if (previous?.equals(next)) continue;
      operations.push({
        path: relativeFile.replaceAll('\\', '/'),
        kind: relativeFile.startsWith('public/images/') ? 'image' : 'content',
        action: previous ? 'update' : 'create',
        targetPath,
        previous,
        next,
      });
    }
  }
  return operations;
}

function publicPlan(mode, operations, replacements) {
  const token = createHash('sha256');
  token.update(mode);
  for (const operation of operations) {
    token.update(JSON.stringify({
      path: operation.path,
      action: operation.action,
      previous: operation.previous ? createHash('sha256').update(operation.previous).digest('hex') : null,
      next: createHash('sha256').update(operation.next).digest('hex'),
    }));
  }
  return {
    mode,
    token: token.digest('hex'),
    changes: operations.map(({ path: file, kind, action }) => ({ file, kind, action })),
    imageReplacements: Object.fromEntries(replacements),
    summary: {
      create: operations.filter((item) => item.action === 'create').length,
      update: operations.filter((item) => item.action === 'update').length,
      content: operations.filter((item) => item.kind === 'content').length,
      images: operations.filter((item) => item.kind === 'image').length,
    },
  };
}

async function commitOperations(operations) {
  for (const operation of operations) {
    const current = await readOptional(operation.targetPath);
    const unchanged = operation.previous ? current?.equals(operation.previous) : current === null;
    if (!unchanged) {
      throw new Error(`專案內容已在計畫後變更，請重新預覽再儲存：${operation.path}`);
    }
  }
  const committed = [];
  try {
    for (const operation of operations) {
      await atomicWriteFile(operation.targetPath, operation.next);
      committed.push(operation);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const operation of committed.reverse()) {
      try {
        if (operation.previous) await atomicWriteFile(operation.targetPath, operation.previous);
        else await rm(operation.targetPath, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], '專案寫入失敗，且部分檔案無法自動復原。');
    }
    throw error;
  }
}

export async function prepareProfileProjectUpdate(projectRoot, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('專案套用資料格式不正確。');
  const mode = payload.mode ?? payload.answers?.applyMode ?? 'replace';
  if (!['merge', 'replace'].includes(mode)) throw new Error('套用模式必須是 merge 或 replace。');
  const currentContent = await loadStudioContent(projectRoot);
  const resolved = resolveProfileAnswerUpdate(
    createProfileAnswersFromStudioContent(currentContent),
    payload.answers,
    mode,
  );
  const answers = structuredClone(resolved.answers);
  const images = (payload.images ?? []).map(validateStudioImage);
  if (new Set(images.map((image) => image.requestedPath)).size !== images.length) {
    throw new Error('圖片路徑不可重複。');
  }
  const referencedImages = updatedImageReferences(answers, resolved.updateKeys);
  for (const image of images) {
    if (!referencedImages.has(image.requestedPath)) {
      throw new Error(`圖片未被這次更新引用：${image.requestedPath}`);
    }
  }

  const stagingRoot = await mkdtemp(path.join(tmpdir(), 'profile-project-'));
  let disposed = false;
  try {
    await copyProjectSurface(projectRoot, stagingRoot);
    const replacements = new Map();
    for (const image of images) {
      const allocated = await allocateImagePath(stagingRoot, image);
      replacements.set(image.requestedPath, allocated.publicPath);
      if (allocated.shouldWrite) {
        await mkdir(path.dirname(allocated.filePath), { recursive: true });
        await writeFile(allocated.filePath, image.buffer);
      }
    }
    replaceImageReferences(answers, replacements);
    await applyProfileAnswers(stagingRoot, answers, {
      mode,
      answers,
      updateKeys: resolved.updateKeys,
    });
    const operations = await collectOperations(projectRoot, stagingRoot);
    const plan = publicPlan(mode, operations, replacements);
    if (payload.expectedPlanToken && payload.expectedPlanToken !== plan.token) {
      throw new Error('專案內容或套用結果已在預覽後改變，請重新預覽再儲存。');
    }
    return {
      answers,
      plan,
      async commit() {
        if (disposed) throw new Error('這份套用計畫已經關閉。');
        await withProjectWriteLock(projectRoot, () => commitOperations(operations));
        return { content: await loadStudioContent(projectRoot), plan, answers };
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        await rm(stagingRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function planProfileProjectUpdate(projectRoot, payload) {
  const prepared = await prepareProfileProjectUpdate(projectRoot, payload);
  try {
    return prepared.plan;
  } finally {
    await prepared.dispose();
  }
}

export async function applyProfileProjectUpdate(projectRoot, payload) {
  const prepared = await prepareProfileProjectUpdate(projectRoot, payload);
  try {
    return await prepared.commit();
  } finally {
    await prepared.dispose();
  }
}
