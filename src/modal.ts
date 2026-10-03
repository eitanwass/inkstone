// ── Confirm dialog ────────────────────────────────────────────
// Generic yes/no modal shared by the context menu (delete), the token
// context menu (remove token), and the Clear All action.

let confirmCallback: (() => void) | null = null;

export function showConfirm(msg: string, onConfirm: () => void): void {
  byId('modal-message').textContent = msg;
  byId('modal-overlay').classList.remove('hidden');
  confirmCallback = onConfirm;
}

byId('modal-confirm').addEventListener('click', () => {
  byId('modal-overlay').classList.add('hidden');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

byId('modal-cancel').addEventListener('click', () => {
  byId('modal-overlay').classList.add('hidden');
  confirmCallback = null;
});

import { byId } from './dom';
