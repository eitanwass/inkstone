// ── Toast notifications ───────────────────────────────────────
// A toast can carry one button (e.g. "Undo" after a delete). Such a toast stays longer
// and goes away as soon as the user does anything else, so its button can't act on a
// map that has since changed.

import { byId } from './dom';

export interface ToastAction {
  label: string;
  run: () => void;
}

const SHORT_MS = 1800;
const ACTION_MS = 6000;
const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

let toastTimeout: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | undefined;

function hideToast(): void {
  clearTimeout(toastTimeout);
  stopWatching?.();
  stopWatching = undefined;
  const t = byId('toast');
  t.classList.remove('visible', 'has-action');
  t.querySelector('.toast-action')?.remove(); // not reachable by Tab while invisible
}

export function showToast(msg: string, action?: ToastAction): void {
  const t = byId('toast');
  clearTimeout(toastTimeout);
  stopWatching?.();
  stopWatching = undefined;

  t.textContent = msg;
  t.classList.toggle('has-action', !!action);
  t.classList.add('visible');

  if (action) {
    const button = document.createElement('button');
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      hideToast();
      action.run();
    });
    t.append(button);

    // Any other click or key press (a lone Ctrl or Shift is just on its way to a shortcut) moves on.
    const dismiss = (e: Event) => {
      if (e instanceof KeyboardEvent && MODIFIER_KEYS.has(e.key)) return;
      if (e.target instanceof Node && t.contains(e.target)) return;
      hideToast();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', dismiss, true);
    stopWatching = () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', dismiss, true);
    };
  }

  toastTimeout = setTimeout(hideToast, action ? ACTION_MS : SHORT_MS);
}
