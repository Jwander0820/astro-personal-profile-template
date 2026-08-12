async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '本機專案操作失敗。');
  return result;
}

export async function requestProjectPlan(localApiUrl, payload) {
  return (await postJson(`${localApiUrl}/api/project/plan`, payload)).plan;
}

export async function applyProjectPlan(localApiUrl, payload) {
  return postJson(`${localApiUrl}/api/project/apply`, payload);
}

export function formatProjectPlan(plan) {
  if (plan.changes.length === 0) return '目前設定與專案內容相同，不需要寫入檔案。';
  const lines = plan.changes.slice(0, 12).map((change) => (
    `${change.action === 'create' ? '新增' : '更新'} ${change.file}`
  ));
  if (plan.changes.length > lines.length) lines.push(`另有 ${plan.changes.length - lines.length} 個檔案`);
  return `即將以 ${plan.mode} 模式套用：\n\n${lines.join('\n')}\n\n確定寫入本機專案嗎？`;
}
