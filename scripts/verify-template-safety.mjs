import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privatePaths = new Set([
  'profile.answers.json',
  '.env',
  '.env.local',
  '.env.production',
  'docs/PROJECT_HANDOFF.md',
  'docs/RELEASE_PROCESS.md',
]);
const privatePrefixes = [
  'docs/specs/',
  'docs/verification/',
  'docs/releases/',
  'docs/ai/cases/',
  '.studio-backups/',
  '.agents/',
  '.codex/',
];
const ignoredDirectories = new Set([
  '.git', '.astro', '.agents', '.codex', '.npm', '.pnpm-store', '.studio-backups',
  'dist', 'node_modules',
]);
const textExtensions = new Set([
  '.astro', '.cmd', '.css', '.html', '.js', '.json', '.md', '.mjs', '.svg', '.ts', '.txt', '.yml', '.yaml',
]);
const extensionlessTextFiles = new Set(['LICENSE']);

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function isPrivatePath(relativePath) {
  const normalized = normalizePath(relativePath);
  return privatePaths.has(normalized) || privatePrefixes.some((prefix) => normalized.startsWith(prefix));
}

function isTextFile(relativePath) {
  return textExtensions.has(path.extname(relativePath).toLowerCase()) || extensionlessTextFiles.has(path.basename(relativePath));
}

async function listPublicFiles() {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: projectRoot, encoding: 'buffer' },
    );
    const files = stdout.toString('utf8').split('\0').filter(Boolean).map(normalizePath);
    const existingFiles = await Promise.all(files.map(async (relativePath) => {
      try {
        await access(path.join(projectRoot, relativePath));
        return relativePath;
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
      }
    }));
    return existingFiles.filter(Boolean);
  } catch {
    return null;
  }
}

async function collectLocalTextFiles(directory = projectRoot, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relativePath = normalizePath(path.join(relativeDirectory, entry.name));
    if (isPrivatePath(relativePath)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectLocalTextFiles(absolutePath, relativePath));
    else if (isTextFile(relativePath)) files.push(relativePath);
  }
  return files;
}

const publicFiles = await listPublicFiles();
if (publicFiles) {
  for (const privatePath of publicFiles.filter(isPrivatePath)) {
    assert.fail(`${privatePath} 不得被 Git 追蹤。`);
  }
}

const scannedFiles = (publicFiles ?? await collectLocalTextFiles()).filter(isTextFile);
const secretPatterns = [
  ['OpenAI API key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
];

for (const relativePath of scannedFiles) {
  const content = await readFile(path.join(projectRoot, relativePath), 'utf8');
  for (const [label, pattern] of secretPatterns) {
    assert.doesNotMatch(content, pattern, `${relativePath} 疑似包含 ${label}。`);
  }
}

const workflowDirectory = path.join(projectRoot, '.github', 'workflows');
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name)).sort();
assert.ok(workflowNames.includes('deploy.yml') && workflowNames.includes('ci.yml'), '必須保留 CI 與部署 workflow。');
// CI now gates deployment, so every workflow is held to the same pinning rule.
for (const name of workflowNames) {
  const source = await readFile(path.join(workflowDirectory, name), 'utf8');
  const uses = [...source.matchAll(/uses:\s+(\S+)/g)].map(([, target]) => target);
  assert.ok(uses.length > 0, `${name} 必須使用明確的 Actions。`);
  for (const target of uses) {
    if (target.startsWith('./')) continue; // Local reusable workflow, versioned with this repository.
    assert.match(target, /^[^@\s]+@[0-9a-f]{40}$/, `${name} 的 ${target} 必須固定到完整 commit SHA。`);
  }
  assert.match(source, /timeout-minutes:\s*\d+/, `${name} 的 job 必須設定 timeout-minutes。`);
}
const workflow = await readFile(path.join(workflowDirectory, 'deploy.yml'), 'utf8');
assert.match(workflow, /verify:[\s\S]*?uses:\s*\.\/\.github\/workflows\/ci\.yml/, '部署前必須先呼叫 CI workflow。');
assert.match(workflow, /^  build:\s+needs:\s*verify\s*$/m, 'build job 必須等待 verify。');
assert.match(workflow, /^permissions:\s*\{\}\s*$/m, 'workflow 預設權限必須為空。');
assert.match(workflow, /build:[\s\S]*?permissions:\s*\r?\n\s+contents:\s*read/, 'build job 只能取得 contents: read。');
assert.match(workflow, /deploy:[\s\S]*?permissions:\s*\r?\n\s+pages:\s*write\s*\r?\n\s+id-token:\s*write/, 'deploy job 只能取得 Pages 部署所需權限。');

console.log(`Template safety check passed (${scannedFiles.length} tracked or unignored text files scanned).`);
