// ── The token card ─────────────────────────────────────────────
// Click a token and a small card appears above it with the token's details; for now that is its
// name, and image, HP and AC are meant to join it. The card follows the token as the map is
// panned, zoomed or the token moved, and goes while it is being dragged or resized.
//
// It never takes focus by itself, so the keys that work on a selected token (Delete, the arrows)
// keep working. Click its field, double-click the token, press Enter, or choose "Add name" from the
// token's menu to type. Enter or clicking away keeps what was typed (one undo step, sent to a live
// session once); Escape puts the old name back.

import { conditionBadge } from '../conditions/icon';
import { allConditions } from '../conditions/library';
import { hasCondition, toggleCondition } from '../conditions/tokens';
import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { DEFAULT_TOKEN_RADIUS, state } from '../core/state';
import type { Point, TokenElement } from '../core/types';
import { drawMain, onMainDrawn } from '../draw/render';
import { hitTest } from '../elements';
import { PALETTE } from '../elements/token';
import { addImage, getImageData, shrinkImage } from '../elements/token-image';
import { pushHistory } from '../input/history';
import { setTool } from '../input/toolbar';
import { showToast } from './toast';

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

// ── Image ──────────────────────────────────────────────────────
// A picture in the disc: chosen from a file, cropped and shrunk, kept as one undo step.
const imageFile = byId<HTMLInputElement>('token-image-file');
const imagePick = byId<HTMLButtonElement>('token-image-pick');
const imageRemove = byId<HTMLButtonElement>('token-image-remove');
const imagePreview = byId<HTMLImageElement>('token-image-preview');

function showImage(token: TokenElement): void {
  // A picture that hasn't reached us yet (it is being fetched from the room) isn't shown.
  const data = token.image ? getImageData(token.image) : undefined;
  imagePreview.hidden = imageRemove.hidden = !data;
  imagePick.classList.toggle('has-image', !!data);
  imagePick.setAttribute('aria-label', data ? 'Change image' : 'Add image');
  if (data && imagePreview.getAttribute('src') !== data) imagePreview.src = data;
}

function setImage(token: TokenElement, data: string | undefined): void {
  if (!state.elements.includes(token)) return; // gone while the file was being read
  token.image = data && addImage(data);
  drawMain();
  pushHistory();
}

imagePick.addEventListener('click', () => imageFile.click());
imageRemove.addEventListener('click', () => {
  const token = cardToken();
  if (token) setImage(token, undefined);
});
imageFile.addEventListener('change', async () => {
  const token = cardToken();
  const file = imageFile.files?.[0];
  imageFile.value = ''; // so choosing the same file again still counts
  if (!token || !file) return;
  try {
    setImage(token, await shrinkImage(file));
  } catch {
    showToast("Couldn't read that image");
  }
});

// ── Conditions ─────────────────────────────────────────────────
// What the token is under, as pills with a remove button, and a picker of every condition there is
// (the default ones and the person's own) to switch on and off. Each switch is one undo step.
const pills = byId('token-cond-pills');
const addButton = byId<HTMLButtonElement>('token-cond-add');
const picker = byId('token-cond-picker');
const filterField = byId<HTMLInputElement>('token-cond-filter');
const grid = byId('token-cond-grid');

let pickerOpen = false;
// What the pills currently show, so they are rebuilt only when it changes. Starts as something no token
// has, so the first token's pills (even "None") are drawn.
let shownKey: string | null = null;
let pickerFor: TokenElement | null = null;

const keyOf = (token: TokenElement): string =>
  (token.conditions ?? []).map((c) => `${c.id}|${c.name}|${c.color}|${c.icon}`).join(';');

function showPills(token: TokenElement): void {
  const key = keyOf(token);
  if (key === shownKey) return;
  shownKey = key;
  const conditions = token.conditions ?? [];
  if (!conditions.length) {
    const none = document.createElement('span');
    none.className = 'tc-none';
    none.textContent = 'None';
    pills.replaceChildren(none);
    return;
  }
  pills.replaceChildren(
    ...conditions.map((condition) => {
      const pill = document.createElement('span');
      pill.className = 'tc-pill';
      const name = document.createElement('span');
      name.textContent = condition.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${condition.name}`);
      remove.addEventListener('click', () => {
        const current = cardToken();
        if (current) toggleCondition(current, condition);
      });
      pill.append(conditionBadge(condition, 18), name, remove);
      return pill;
    }),
  );
}

// The picker's buttons: one per condition, pressed if the token has it.
function buildPicker(): void {
  grid.replaceChildren(
    ...allConditions().map((condition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tc-cond';
      button.dataset.id = condition.id;
      const name = document.createElement('span');
      name.textContent = condition.name;
      button.append(conditionBadge(condition, 20), name);
      button.addEventListener('click', () => {
        const current = cardToken();
        if (current) toggleCondition(current, condition);
      });
      return button;
    }),
  );
}

function markPicker(token: TokenElement): void {
  for (const button of grid.querySelectorAll<HTMLButtonElement>('.tc-cond')) {
    button.setAttribute('aria-pressed', String(hasCondition(token, button.dataset.id ?? '')));
  }
}

function filterPicker(): void {
  const wanted = filterField.value.trim().toLowerCase();
  for (const button of grid.querySelectorAll<HTMLButtonElement>('.tc-cond')) {
    const name = button.textContent?.toLowerCase() ?? '';
    button.hidden = !!wanted && !name.includes(wanted);
  }
}

function openPicker(): void {
  pickerOpen = true;
  filterField.value = '';
  buildPicker(); // fresh each time, so conditions made in Settings are there
  picker.hidden = false;
  addButton.setAttribute('aria-expanded', 'true');
  addButton.textContent = 'Done';
  const token = cardToken();
  if (token) {
    markPicker(token);
    place(token); // the card is taller now
  }
  filterField.focus();
}

function closePicker(): void {
  if (!pickerOpen) return;
  pickerOpen = false;
  picker.hidden = true;
  addButton.setAttribute('aria-expanded', 'false');
  addButton.textContent = '+ Add';
  const token = cardToken();
  if (token && !card.classList.contains('hidden')) place(token); // and shorter again
}

function showConditions(token: TokenElement): void {
  if (pickerFor !== token) {
    closePicker(); // another token: start with the picker shut
    pickerFor = token;
  }
  showPills(token);
  if (pickerOpen) markPicker(token);
}

addButton.addEventListener('click', () => {
  if (pickerOpen) closePicker();
  else openPicker();
});

filterField.addEventListener('input', filterPicker);

picker.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePicker();
    addButton.focus();
    e.stopPropagation(); // Escape here shuts the picker; it does not also deselect the token
  } else if (e.key === 'Enter' && e.target === filterField) {
    // Enter switches the first condition the filter leaves, so "pro", Enter is Prone.
    const first = grid.querySelector<HTMLButtonElement>('.tc-cond:not([hidden])');
    const token = cardToken();
    const condition = allConditions().find((c) => c.id === first?.dataset.id);
    if (token && condition) toggleCondition(token, condition);
    e.preventDefault();
  }
});

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

  // Above the token, or below it (and its name) if the top of the screen is in the way. A tall card
  // (the picker open) may fit on neither side, so it goes where there is more room, and is then kept on
  // the screen even if that means covering part of the token.
  const above = y - radius - GAP_PX - height;
  const below = y + radius + GAP_PX + NAME_LABEL_PX;
  const roomAbove = y - radius - GAP_PX - (screen.top + KEEP_CLEAR_OF_TOP_PX);
  const roomBelow = screen.top + window.innerHeight - below - 8;
  let top = above >= screen.top + KEEP_CLEAR_OF_TOP_PX ? above : below;
  if (top === below && roomBelow < height && roomAbove > roomBelow) top = above;
  top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  const left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// Called after every redraw of the map.
function update(): void {
  const token = cardToken();
  if (!token || state.elementDrag || state.handleDrag) {
    // Gone, or moving out of the way: whatever was being typed is kept first.
    if (!token) {
      commit();
      closePicker();
      pickerFor = null;
    }
    card.classList.add('hidden');
    return;
  }
  if (editing && editing.token !== token) commit(); // another token was chosen: keep this one's name first
  if (!editing && document.activeElement !== nameField) nameField.value = token.name ?? '';
  showColor(token);
  showImage(token);
  showConditions(token);
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

// ── Reading a token's conditions by hovering it ────────────────
// A list beside the pointer with each condition's badge and name, so someone who doesn't know the
// icons still gets the word. Not for the token whose card is open (it already lists them there).
const tip = byId('token-tip');
let tipFor: TokenElement | null = null;

export function hideConditionsTip(): void {
  tip.classList.add('hidden');
  tipFor = null;
}

// Called as the pointer moves over the map, with where it is in the world and on the screen.
export function updateConditionsTip(world: Point, clientX: number, clientY: number): void {
  const index = hitTest(world.x, world.y);
  const hovered = index === null ? undefined : state.elements[index];
  if (hovered?.type !== 'token' || !hovered.conditions?.length || hovered === cardToken()) {
    hideConditionsTip();
    return;
  }
  if (tipFor !== hovered) {
    tipFor = hovered;
    tip.replaceChildren(
      ...hovered.conditions.map((condition) => {
        const line = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = condition.name;
        line.append(conditionBadge(condition, 18), name);
        return line;
      }),
    );
  }
  tip.classList.remove('hidden');
  const left = Math.min(clientX + 16, window.innerWidth - tip.offsetWidth - 8);
  const top = Math.min(clientY + 16, window.innerHeight - tip.offsetHeight - 8);
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}
