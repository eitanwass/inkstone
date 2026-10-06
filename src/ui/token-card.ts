// ── The token card ─────────────────────────────────────────────
// Click a token and a small card appears above it with the token's details: its name, colour, image
// and conditions (HP and AC are meant to join them). The card follows the token as the map is
// panned, zoomed or the token moved, and goes while it is being dragged or resized.
//
// This file is the card itself: where it goes, and the name field. Its other parts are
// token-card-color.ts, token-card-image.ts and token-card-conditions.ts; the list shown when
// hovering a token is token-tip.ts; which token the card is for is token-target.ts.
//
// It never takes focus by itself, so the keys that work on a selected token (Delete, the arrows)
// keep working. Click its field, double-click the token, press Enter, or choose "Add name" from the
// token's menu to type. Enter or clicking away keeps what was typed (one undo step, sent to a live
// session once); Escape puts the old name back.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { DEFAULT_TOKEN_RADIUS, state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain, onMainDrawn } from '../draw/render';
import { setTextStyle } from '../elements/text-style';
import { pushHistory } from '../input/history';
import { setTool } from '../input/toolbar';
import { cardPosition } from './card-placement';
import { mountTextStyleToggles } from './text-style-toggles';
import { focusColors, showColor } from './token-card-color';
import { forgetConditionsToken, onConditionsResize, showConditions } from './token-card-conditions';
import { showImage } from './token-card-image';
import { cardToken } from './token-target';

const card = byId('token-card');
const nameField = byId<HTMLInputElement>('token-name-field');

const NAME_LABEL_PX = 28; // a name is written just under its token

// Which token is being typed into, and what its name was before.
let editing: { token: TokenElement; original: string } | null = null;

function place(token: TokenElement): void {
  card.classList.remove('hidden'); // shown first, so it has a size to place
  const screen = iCanvas.getBoundingClientRect();
  const radius = (token.radius || DEFAULT_TOKEN_RADIUS) * state.zoom;
  const x = screen.left + state.panX + token.x * state.zoom;
  const y = screen.top + state.panY + token.y * state.zoom;
  const { left, top } = cardPosition({
    centerX: x,
    top: y - radius,
    bottom: y + radius + NAME_LABEL_PX,
    width: card.offsetWidth,
    height: card.offsetHeight,
    screenTop: screen.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

onConditionsResize(place);

// Called after every redraw of the map.
function update(): void {
  const token = cardToken();
  if (!token || state.elementDrag || state.handleDrag) {
    // Gone, or moving out of the way: whatever was being typed is kept first.
    if (!token) {
      commit();
      forgetConditionsToken();
    }
    card.classList.add('hidden');
    return;
  }
  if (editing && editing.token !== token) commit(); // another token was chosen: keep this one's name first
  if (!editing && document.activeElement !== nameField) nameField.value = token.name ?? '';
  nameStyle.refresh();
  showColor(token);
  showImage(token);
  showConditions(token);
  place(token);
}

// ── The name's style ───────────────────────────────────────────
// Bold, italic and a plate behind the name: the same buttons, drawn the same way, as a label's text.
const nameStyle = mountTextStyleToggles(byId('token-text-style'), {
  get: cardToken,
  set(key, on) {
    const token = cardToken();
    if (!token) return;
    setTextStyle(token, key, on);
    drawMain();
    pushHistory();
  },
});

// ── Typing a name ──────────────────────────────────────────────
nameField.addEventListener('focus', () => {
  const token = cardToken();
  if (token) editing = { token, original: token.name ?? '' };
});

// The map shows what is typed as it is typed, but it only counts once it is kept.
nameField.addEventListener('input', () => {
  if (!editing) return;
  editing.token.name = nameField.value || undefined;
  drawMain();
});

function commit(): void {
  if (!editing) return;
  const { token, original } = editing;
  editing = null;
  const name = nameField.value.trim();
  nameField.value = name;
  token.name = name || undefined;
  // Only a real change is an edit: typing and putting it back is not.
  if (state.elements.includes(token) && name !== original) pushHistory();
  drawMain();
}

nameField.addEventListener('blur', commit);

nameField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    nameField.blur();
  } else if (e.key === 'Escape') {
    if (editing) {
      editing.token.name = editing.original || undefined;
      nameField.value = editing.original;
      editing = null;
      drawMain();
    }
    nameField.blur();
    e.stopPropagation(); // Escape here undoes the typing; it does not also deselect the token
  }
});

// ── Ways in ────────────────────────────────────────────────────
// Puts the cursor in the name field of the selected token (Enter, or a double-click on it).
export function focusTokenName(): void {
  if (!cardToken()) return;
  nameField.focus();
  nameField.select();
}

// Selects a token with the select tool, so its card shows.
function selectForCard(idx: number): void {
  setTool('select');
  state.selected = [idx];
  drawMain();
}

// Chosen from a token's menu: select it and type.
export function nameToken(idx: number): void {
  selectForCard(idx);
  focusTokenName();
}

// Chosen from a token's menu: select it and move the keyboard to its colours.
export function chooseTokenColor(idx: number): void {
  selectForCard(idx);
  if (cardToken()) focusColors();
}

onMainDrawn(update);
