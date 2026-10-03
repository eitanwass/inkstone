// ── Text-label placement dialog ──────────────────────────────
// The text tool opens a single-input modal before committing a new label. (A token is placed
// with no dialog, and named in its card: see token-card.ts.)

import { byId } from './dom';
import { restoreFocus, trapFocus } from './focus';
import { pushHistory } from './history';
import { drawMain } from './render';
import { state } from './state';
import type { Point } from './types';

// Wires up the modal whose elements are `<prefix>-overlay`, `-input`,
// `-confirm` and `-cancel`. onConfirm gets the trimmed text; onCancel fires
// for the Cancel button and Escape. Returns a function that opens the dialog
// with a focused input, empty unless given an initial value.
function setupInputDialog(
  prefix: string,
  onConfirm: (text: string) => void,
  onCancel: () => void,
): (initialValue?: string) => void {
  const overlay = byId(`${prefix}-overlay`);
  const input = byId<HTMLInputElement>(`${prefix}-input`);
  const confirmBtn = byId(`${prefix}-confirm`);
  const cancelBtn = byId(`${prefix}-cancel`);
  let opener: Element | null = null;

  trapFocus(overlay);

  confirmBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    restoreFocus(opener);
    onConfirm(input.value.trim());
  });
  cancelBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    restoreFocus(opener);
    onCancel();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  return (initialValue = '') => {
    opener = document.activeElement;
    input.value = initialValue;
    overlay.classList.remove('hidden');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  };
}

// ── Text label ─────────────────────────────────────────────────
let pendingTextPos: Point | null = null;

const showTextDialog = setupInputDialog(
  'text-label',
  (text) => {
    if (text && pendingTextPos) {
      state.elements.push({
        type: 'label',
        x: pendingTextPos.x,
        y: pendingTextPos.y,
        text,
        fontSize: state.fontSize,
        strokeColor: state.strokeColor,
      });
      drawMain();
      pushHistory();
    }
    pendingTextPos = null;
  },
  () => {
    pendingTextPos = null;
  },
);

export function openTextDialog(wx: number, wy: number): void {
  pendingTextPos = { x: wx, y: wy };
  showTextDialog();
}
