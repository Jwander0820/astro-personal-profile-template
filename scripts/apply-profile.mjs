import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyProfileAnswers } from './profile-content.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(process.argv[2] || path.join(projectRoot, 'profile.answers.json'));

try {
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = await applyProfileAnswers(projectRoot, input);
  console.log(`已套用 ${path.basename(inputPath)}。`);
  console.log(`個人資料：${result.profile.displayName}`);
  console.log(`社群連結：${result.links.filter((item) => item.data.group === 'social' && item.data.visible).length}`);
  console.log(`自介區塊：${result.sections.filter((item) => item.data.visible).length}`);
  console.log('下一步：執行 pnpm build 驗證，再用 pnpm studio 預覽。');
} catch (error) {
  console.error(`無法套用回答檔：${error.message}`);
  process.exitCode = 1;
}
