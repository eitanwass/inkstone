// ── Token & text-label placement dialogs ─────────────────────
// Both tools open a single-input modal before committing a new element.

import { byId } from './dom';
import { restoreFocus, trapFocus } from './focus';
import { pushHistory } from './history';
import { drawMain } from './render';
import { state } from './state';
import { showToast } from './toast';
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

// ── Token ──────────────────────────────────────────────────────
const TOKEN_COLORS = ['#e05c5c', '#5c8ae0', '#5cba6a', '#e0a85c', '#9a5ce0', '#5ce0d4', '#e05caa', '#c8e05c'];
let tokenColorIdx = 0;

let pendingToken: (Point & { radius: number }) | null = null;

const showTokenDialog = setupInputDialog(
  'token-name',
  (text) => {
    if (!pendingToken) return;
    const name = text || '?';
    state.elements.push({
      type: 'token',
      x: pendingToken.x,
      y: pendingToken.y,
      radius: pendingToken.radius,
      name,
      color: TOKEN_COLORS[tokenColorIdx % TOKEN_COLORS.length],
    });
    tokenColorIdx++;
    pendingToken = null;
    drawMain();
    pushHistory();
    showToast(`Token "${name}" placed`);
  },
  () => {
    pendingToken = null;
  },
);

export function openTokenDialog(wx: number, wy: number, radius: number): void {
  pendingToken = { x: wx, y: wy, radius };
  showTokenDialog();
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

// ── Token rename ───────────────────────────────────────────────
let renamingTokenIdx: number | null = null;

const showRenameDialog = setupInputDialog(
  'token-rename',
  (text) => {
    const el = renamingTokenIdx === null ? undefined : state.elements[renamingTokenIdx];
    renamingTokenIdx = null;
    // An empty name keeps the current one, and unchanged names aren't an edit.
    if (el?.type !== 'token' || !text || text === el.name) return;
    el.name = text;
    drawMain();
    pushHistory();
  },
  () => {
    renamingTokenIdx = null;
  },
);

export function openTokenRenameDialog(idx: number): void {
  const el = state.elements[idx];
  if (el?.type !== 'token') return;
  renamingTokenIdx = idx;
  showRenameDialog(el.name ?? '');
}
