// ── Token & text-label placement dialogs ─────────────────────
// Both tools open a single-input modal before committing a new element;
// kept together since the two flows are nearly identical in shape.

import { byId } from './dom';
import { state } from './state';
import { drawMain } from './render';
import { pushHistory } from './history';
import { showToast } from './toast';
import type { Point } from './types';

const TOKEN_COLORS = [
  '#e05c5c', '#5c8ae0', '#5cba6a', '#e0a85c',
  '#9a5ce0', '#5ce0d4', '#e05caa', '#c8e05c',
];
let tokenColorIdx = 0;

let pendingToken: (Point & { radius: number }) | null = null;

export function openTokenDialog(wx: number, wy: number, radius: number): void {
  pendingToken = { x: wx, y: wy, radius };
  byId<HTMLInputElement>('token-name-input').value = '';
  byId('token-name-overlay').classList.remove('hidden');
  setTimeout(() => byId<HTMLInputElement>('token-name-input').focus(), 50);
}

function placeToken(name: string): void {
  if (!pendingToken) return;
  state.elements.push({
    type: 'token',
    x: pendingToken.x,
    y: pendingToken.y,
    radius: pendingToken.radius,
    name: name || '?',
    color: TOKEN_COLORS[tokenColorIdx % TOKEN_COLORS.length],
  });
  tokenColorIdx++;
  pendingToken = null;
  drawMain();
  pushHistory();
  showToast(`Token "${name}" placed`);
}

byId('token-name-confirm').addEventListener('click', () => {
  const name = byId<HTMLInputElement>('token-name-input').value.trim();
  byId('token-name-overlay').classList.add('hidden');
  placeToken(name || '?');
});

byId('token-name-cancel').addEventListener('click', () => {
  byId('token-name-overlay').classList.add('hidden');
  pendingToken = null;
});

byId<HTMLInputElement>('token-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') byId('token-name-confirm').click();
  if (e.key === 'Escape') byId('token-name-cancel').click();
});

let pendingTextPos: Point | null = null;

export function openTextDialog(wx: number, wy: number): void {
  pendingTextPos = { x: wx, y: wy };
  byId<HTMLInputElement>('text-label-input').value = '';
  byId('text-label-overlay').classList.remove('hidden');
  setTimeout(() => byId<HTMLInputElement>('text-label-input').focus(), 50);
}

byId('text-label-confirm').addEventListener('click', () => {
  const text = byId<HTMLInputElement>('text-label-input').value.trim();
  byId('text-label-overlay').classList.add('hidden');
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
});

byId('text-label-cancel').addEventListener('click', () => {
  byId('text-label-overlay').classList.add('hidden');
  pendingTextPos = null;
});

byId<HTMLInputElement>('text-label-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') byId('text-label-confirm').click();
  if (e.key === 'Escape') byId('text-label-cancel').click();
});
