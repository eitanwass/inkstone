// ── Token & text-label placement dialogs ─────────────────────
// Both tools open a single-input modal before committing a new element;
// kept together since the two flows are nearly identical in shape.

import { state } from './state.js';
import { drawMain } from './render.js';
import { pushHistory } from './history.js';
import { showToast } from './toast.js';

const TOKEN_COLORS = [
  '#e05c5c', '#5c8ae0', '#5cba6a', '#e0a85c',
  '#9a5ce0', '#5ce0d4', '#e05caa', '#c8e05c',
];
let tokenColorIdx = 0;

let pendingToken = null;

export function openTokenDialog(wx, wy, radius) {
  pendingToken = { x: wx, y: wy, radius };
  document.getElementById('token-name-input').value = '';
  document.getElementById('token-name-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('token-name-input').focus(), 50);
}

function placeToken(name) {
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

document.getElementById('token-name-confirm').addEventListener('click', () => {
  const name = document.getElementById('token-name-input').value.trim();
  document.getElementById('token-name-overlay').classList.add('hidden');
  placeToken(name || '?');
});

document.getElementById('token-name-cancel').addEventListener('click', () => {
  document.getElementById('token-name-overlay').classList.add('hidden');
  pendingToken = null;
});

document.getElementById('token-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('token-name-confirm').click();
  if (e.key === 'Escape') document.getElementById('token-name-cancel').click();
});

let pendingTextPos = null;

export function openTextDialog(wx, wy) {
  pendingTextPos = { x: wx, y: wy };
  document.getElementById('text-label-input').value = '';
  document.getElementById('text-label-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('text-label-input').focus(), 50);
}

document.getElementById('text-label-confirm').addEventListener('click', () => {
  const text = document.getElementById('text-label-input').value.trim();
  document.getElementById('text-label-overlay').classList.add('hidden');
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

document.getElementById('text-label-cancel').addEventListener('click', () => {
  document.getElementById('text-label-overlay').classList.add('hidden');
  pendingTextPos = null;
});

document.getElementById('text-label-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('text-label-confirm').click();
  if (e.key === 'Escape') document.getElementById('text-label-cancel').click();
});
