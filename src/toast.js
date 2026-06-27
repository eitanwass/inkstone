// ── Toast notifications ───────────────────────────────────────

let toastTimeout;

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('visible'), 1800);
}
