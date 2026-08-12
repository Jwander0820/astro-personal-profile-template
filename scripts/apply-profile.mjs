import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyProfileProjectUpdate } from './profile-project.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modeArgument = process.argv.find((argument) => argument.startsWith('--mode='));
const mode = modeArgument?.slice('--mode='.length);
const inputArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const inputPath = path.resolve(inputArgument || path.join(projectRoot, 'profile.answers.json'));

try {
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = await applyProfileProjectUpdate(projectRoot, { answers: input, mode });
  const content = result.content;
  console.log(`已套用 ${path.basename(inputPath)}。`);
  console.log(`模式：${result.plan.mode}`);
  console.log(`檔案變更：新增 ${result.plan.summary.create}、更新 ${result.plan.summary.update}`);
  console.log(`個人資料：${content.profile.displayName}`);
  console.log(`社群連結：${content.links.filter((item) => item.data.group === 'social' && item.data.visible).length}`);
  console.log(`自介區塊：${content.sections.filter((item) => item.data.visible).length}`);
  console.log('下一步：執行 npm run build 驗證，再用 npm run studio 預覽。');
} catch (error) {
  console.error(`無法套用回答檔：${error.message}`);
  process.exitCode = 1;
}
