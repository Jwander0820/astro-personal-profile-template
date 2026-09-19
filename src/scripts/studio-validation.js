export function clearValidationError() {
  document.querySelector('#validation-summary').hidden = true;
  document.querySelectorAll('[data-validation-error]').forEach((control) => {
    control.removeAttribute('aria-invalid');
    const ids = (control.getAttribute('aria-describedby') || '').split(' ').filter((id) => id !== 'studio-field-error');
    if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
    else control.removeAttribute('aria-describedby');
    delete control.dataset.validationError;
  });
  document.querySelector('#studio-field-error')?.remove();
}

export function showValidationError(error, activateTab) {
  clearValidationError();
  const summary = document.querySelector('#validation-summary');
  summary.textContent = error.message || '請檢查設定內容。';
  summary.hidden = false;
  const path = error.path || '';
  const [kind, index, field] = path.split('.');
  const control = [...document.querySelectorAll('[data-bind], [data-array]')].find((item) =>
    item.dataset.bind === path || (item.dataset.array === kind && item.dataset.index === index && item.dataset.field === field));
  if (control) {
    const panel = control.closest('.editor-panel');
    if (panel) activateTab(panel.id.replace('panel-', ''));
    const details = control.closest('details');
    if (details) details.open = true;
    control.dataset.validationError = 'true';
    control.setAttribute('aria-invalid', 'true');
    const message = document.createElement('small');
    message.id = 'studio-field-error';
    message.className = 'field-error';
    message.textContent = summary.textContent;
    control.after(message);
    control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
    requestAnimationFrame(() => control.focus());
  } else {
    if (kind === 'fortune') summary.textContent += ' 請至籤詩編輯頁修正籤桶內容。';
    requestAnimationFrame(() => summary.focus());
  }
}
