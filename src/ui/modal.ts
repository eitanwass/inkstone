// ── Confirm dialog ────────────────────────────────────────────
// Generic yes/no modal shared by the context menu (delete), the token
// context menu (remove token), and the Clear All action.

let confirmCallback: (() => void) | null = null;
let opener: Element | null = null;

trapFocus(byId('modal'));

function closeModal(): void {
  byId('modal-overlay').classList.add('hidden');
  restoreFocus(opener);
}

export function showConfirm(msg: string, onConfirm: () => void): void {
  opener = document.activeElement;
  byId('modal-message').textContent = msg;
  byId('modal-overlay').classList.remove('hidden');
  confirmCallback = onConfirm;
  byId('modal-cancel').focus(); // the safe choice for a destructive confirm
}

byId('modal-confirm').addEventListener('click', () => {
  closeModal();
  if (confirmCallback) {
    confirmCallback();
    confirmCallback = null;
  }
});

byId('modal-cancel').addEventListener('click', () => {
  closeModal();
  confirmCallback = null;
});

import { byId } from '../core/dom';
import { restoreFocus, trapFocus } from './focus';
