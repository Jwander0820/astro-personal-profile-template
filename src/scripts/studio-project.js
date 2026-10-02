// Capture only the user's local launch fragment; it is never sent over HTTP.
// Same-origin Studio code remains trusted. This is not OS-user/browser isolation.
export function createStudioApiClient(localApiUrl) {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
  const destination = new URL(localApiUrl);
  if (destination.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(destination.hostname)) return null;
  window.addEventListener('hashchange', () => {
    if (new URLSearchParams(window.location.hash.slice(1)).has('studio-token')) window.location.reload();
  });
  const key = `profile-studio-capability:${destination.origin}`;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const launched = fragment.get('studio-token');
  let capability = /^[a-f0-9]{64}$/.test(launched || '') ? launched : null;
  if (fragment.has('studio-token')) {
    fragment.delete('studio-token');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${fragment.size ? `#${fragment}` : ''}`);
  }
  try {
    if (launched !== null && !capability) { sessionStorage.removeItem(key); return null; }
    if (capability) sessionStorage.setItem(key, capability);
    else capability = sessionStorage.getItem(key);
  } catch { /* The launch still works for this page if session storage is disabled. */ }
  if (!/^[a-f0-9]{64}$/.test(capability || '')) return null;
  return {
    request(endpoint, options = {}) {
      if (!endpoint.startsWith('/api/')) throw new Error('本機 API 路徑不正確。');
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${capability}`);
      return fetch(`${destination.origin}${endpoint}`, { ...options, headers });
    },
  };
}

async function postJson(client, endpoint, body) {
  const response = await client.request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '本機專案操作失敗。');
  return result;
}

export async function requestProjectPlan(client, payload) {
  return (await postJson(client, '/api/project/plan', payload)).plan;
}

export async function applyProjectPlan(client, payload) {
  return postJson(client, '/api/project/apply', payload);
}

export function formatProjectPlan(plan) {
  if (plan.changes.length === 0) return '目前設定與專案內容相同，不需要寫入檔案。';
  const lines = plan.changes.slice(0, 12).map((change) => (
    `${change.action === 'create' ? '新增' : '更新'} ${change.file}`
  ));
  if (plan.changes.length > lines.length) lines.push(`另有 ${plan.changes.length - lines.length} 個檔案`);
  return `即將以 ${plan.mode} 模式套用：\n\n${lines.join('\n')}\n\n確定寫入本機專案嗎？`;
}
