import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { planProfileProjectUpdate } from './profile-project.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument?.slice('--mode='.length);
const inputArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const inputPath = path.resolve(inputArgument || path.join(projectRoot, 'profile.answers.json'));

try {
  const answers = JSON.parse(await readFile(inputPath, 'utf8'));
  const plan = await planProfileProjectUpdate(projectRoot, { answers, mode });
  console.log(`套用計畫：${path.basename(inputPath)}（${plan.mode}）`);
  if (plan.changes.length === 0) {
    console.log('沒有檔案需要變更。');
  } else {
    for (const change of plan.changes) {
      console.log(`- ${change.action === 'create' ? '新增' : '更新'} ${change.file}`);
    }
  }
  console.log(`合計：新增 ${plan.summary.create}、更新 ${plan.summary.update}`);
} catch (error) {
  console.error(`無法建立套用計畫：${error.message}`);
  process.exitCode = 1;
}
