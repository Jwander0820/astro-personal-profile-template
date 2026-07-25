export const FORTUNE_GRADES = /** @type {const} */ (['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶']);

const GRADES = new Set(FORTUNE_GRADES);
const CATEGORIES = new Set(['blessing', 'joke']);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function normalizeFortune(fortune, index) {
  if (!fortune || typeof fortune !== 'object' || Array.isArray(fortune)) throw new Error(`第 ${index + 1} 張籤的格式不正確。`);
  const id = typeof fortune.id === 'string' ? fortune.id.trim() : '';
  const message = typeof fortune.message === 'string' ? fortune.message.trim() : '';
  const note = typeof fortune.note === 'string' ? fortune.note.trim() : '';
  if (!ID_PATTERN.test(id)) throw new Error(`第 ${index + 1} 張籤的 ID 必須使用小寫英數字與連字號。`);
  if (!GRADES.has(fortune.grade)) throw new Error(`籤「${id}」的等級必須是${FORTUNE_GRADES.join('、')}其中之一。`);
  if (!CATEGORIES.has(fortune.category)) throw new Error(`籤「${id}」的分類必須是 blessing 或 joke。`);
  if (message.length < 1 || message.length > 200) throw new Error(`籤「${id}」的訊息長度必須是 1 到 200 個字。`);
  if (note.length > 300) throw new Error(`籤「${id}」的備註不可超過 300 個字。`);
  if (typeof fortune.visible !== 'boolean') throw new Error(`籤「${id}」的 visible 必須是布林值。`);
  return {
    id,
    grade: fortune.grade,
    category: fortune.category,
    message,
    ...(note ? { note } : {}),
    visible: fortune.visible,
  };
}

export function validateFortuneBucket(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('籤桶至少需要一張籤。');
  const fortunes = input.map(normalizeFortune);
  const ids = new Set();
  for (const fortune of fortunes) {
    if (ids.has(fortune.id)) throw new Error(`籤詩 ID 重複：${fortune.id}`);
    ids.add(fortune.id);
  }
  if (!fortunes.some((fortune) => fortune.visible)) throw new Error('籤桶至少需要一張啟用中的籤。');
  return fortunes;
}

export function summarizeFortuneBucket(fortunes) {
  const visibleFortunes = fortunes.filter((fortune) => fortune.visible);
  const grades = Object.fromEntries([...GRADES].map((grade) => [grade, fortunes.filter((fortune) => fortune.grade === grade).length]));
  const categories = Object.fromEntries([...CATEGORIES].map((category) => [category, fortunes.filter((fortune) => fortune.category === category).length]));
  const visibleJokes = visibleFortunes.filter((fortune) => fortune.category === 'joke').length;
  const jokeRatio = visibleFortunes.length ? visibleJokes / visibleFortunes.length : 0;
  const warnings = [];
  if (jokeRatio < 0.2 || jokeRatio > 0.4) warnings.push('目前啟用籤的玩梗比例偏離建議的約 3 成；這是風格提示，不會阻擋儲存。');
  return { total: fortunes.length, visible: visibleFortunes.length, grades, categories, warnings };
}
