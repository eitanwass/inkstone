// ── Toast notifications ───────────────────────────────────────

let toastTimeout: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string): void {
  const t = byId('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('visible'), 1800);
}

import { byId } from './dom';
