// ── The token card ─────────────────────────────────────────────
// Click a token and a small card appears above it with the token's details; for now that is its
// name, and image, HP and AC are meant to join it. The card follows the token as the map is
// panned, zoomed or the token moved, and goes while it is being dragged or resized.
//
// It never takes focus by itself, so the keys that work on a selected token (Delete, the arrows)
// keep working. Click its field, double-click the token, press Enter, or choose "Add name" from the
// token's menu to type. Enter or clicking away keeps what was typed (one undo step, sent to a live
// session once); Escape puts the old name back.

import { iCanvas } from './canvas';
import { byId } from './dom';
import { PALETTE } from './elements/token';
import { pushHistory } from './history';
import { drawMain, onMainDrawn } from './render';
import { DEFAULT_TOKEN_RADIUS, state } from './state';
import { setTool } from './toolbar';
import type { TokenElement } from './types';

const card = byId('token-card');
const nameField = byId<HTMLInputElement>('token-name-field');

const GAP_PX = 14; // between the token and the card
const KEEP_CLEAR_OF_TOP_PX = 96; // the map name and the action cluster
const NAME_LABEL_PX = 28; // a name is written just under its token

// ── Colour ─────────────────────────────────────────────────────
// The token palette as swatches, then a ring that opens the browser's own picker for any colour.
// A choice is kept at once as one undo step.
const colors = byId('token-colors');
const customLabel = colors.querySelector<HTMLElement>('.token-swatch-custom') as HTMLElement;
const customInput = byId<HTMLInputElement>('token-color-custom');
const swatches: HTMLButtonElement[] = [];

for (const { hex, name } of PALETTE) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'token-swatch';
  swatch.style.background = hex;
  swatch.dataset.color = hex;
  swatch.title = name;
  swatch.setAttribute('aria-label', name);
  swatch.setAttribute('aria-pressed', 'false');
  swatch.addEventListener('click', () => setColor(hex));
  colors.insertBefore(swatch, customLabel);
  swatches.push(swatch);
}

const colorOf = (token: TokenElement): string => (token.color || PALETTE[0].hex).toLowerCase();

function setColor(hex: string): void {
  const token = cardToken();
  if (!token || colorOf(token) === hex.toLowerCase()) return;
  token.color = hex;
  drawMain();
  pushHistory();
}

// Marks the token's colour: a swatch, or the ring if it isn't one of the palette's.
function showColor(token: TokenElement): void {
  const current = colorOf(token);
  for (const swatch of swatches)
    swatch.setAttribute('aria-pressed', String(swatch.dataset.color === current));
  customLabel.classList.toggle('selected', !PALETTE.some((p) => p.hex === current));
  if (customInput.value !== current) customInput.value = current; // so the picker opens on it
}

// The browser's own picker fires 'input' each time a color is clicked in it, and 'change' only when
// it is closed. So the token follows every click as it is made, and the whole visit to the picker
// is one undo step, kept when the picker closes (by 'change', or by the field losing focus, which
// is what a picker that is dismissed some other way leaves behind).
let picking: { token: TokenElement; original: string } | null = null;

customInput.addEventListener('input', () => {
  const token = cardToken();
  if (!token) return;
  picking ??= { token, original: colorOf(token) };
  token.color = customInput.value;
  drawMain();
});

function finishPicking(): void {
  if (!picking) return;
  const { token, original } = picking;
  picking = null;
  if (state.elements.includes(token) && colorOf(token) !== original) pushHistory();
}

customInput.addEventListener('change', () => {
  if (picking) finishPicking();
  else setColor(customInput.value); // a browser that sends only 'change'
});
customInput.addEventListener('blur', finishPicking);

// Which token is being typed into, and what its name was before.
let editing: { token: TokenElement; original: string } | null = null;

// The token the card is for: the one selected token, while the select tool is in use.
function cardToken(): TokenElement | null {
  if (state.tool !== 'select' || state.selected.length !== 1) return null;
  const el = state.elements[state.selected[0]];
  return el?.type === 'token' ? el : null;
}

function place(token: TokenElement): void {
  card.classList.remove('hidden'); // shown first, so it has a size to place
  const screen = iCanvas.getBoundingClientRect();
  const radius = (token.radius || DEFAULT_TOKEN_RADIUS) * state.zoom;
  const x = screen.left + state.panX + token.x * state.zoom;
  const y = screen.top + state.panY + token.y * state.zoom;
  const { offsetWidth: width, offsetHeight: height } = card;

  // Above the token, or below it (and its name) if the top of the screen is in the way.
  let top = y - radius - GAP_PX - height;
  if (top < screen.top + KEEP_CLEAR_OF_TOP_PX) top = y + radius + GAP_PX + NAME_LABEL_PX;
  const left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// Called after every redraw of the map.
function update(): void {
  const token = cardToken();
  if (!token || state.elementDrag || state.handleDrag) {
    // Gone, or moving out of the way: whatever was being typed is kept first.
    if (!token) commit();
    card.classList.add('hidden');
    return;
  }
  if (editing && editing.token !== token) commit(); // another token was chosen: keep this one's name first
  if (!editing && document.activeElement !== nameField) nameField.value = token.name ?? '';
  showColor(token);
  place(token);
}

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

// Chosen from a token's menu: select it, with the select tool so the card shows, and type.
export function nameToken(idx: number): void {
  setTool('select');
  state.selected = [idx];
  drawMain();
  focusTokenName();
}

// Chosen from a token's menu: select it, with the select tool so the card shows, and move the
// keyboard to its colours.
export function chooseTokenColor(idx: number): void {
  setTool('select');
  state.selected = [idx];
  drawMain();
  if (!cardToken()) return;
  (swatches.find((s) => s.getAttribute('aria-pressed') === 'true') ?? swatches[0]).focus();
}

onMainDrawn(update);
