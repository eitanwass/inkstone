// ── The label card ──────────────────────────────────────────────
// Click a label and a small card appears next to it with its details: its size, text style (bold, italic, a plate) and colour for now,
// and the font and the like are meant to join them. The card follows the label as the map is panned or
// zoomed and goes while it is being dragged. It is the label's counterpart of the token card
// (token-card.ts) and sits where it does, above, or below if the top of the screen is in the way.
//
// A change shows on the map as it is made and is kept as one undo step: a colour when it is picked, a
// size when the slider is let go. The card is positioned from render.ts's onMainDrawn hook, which is
// registered rather than imported to keep the module chain one-way.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { LabelElement } from '../core/types';
import { drawMain, onMainDrawn } from '../draw/render';
import { getElementBounds } from '../elements';
import { fontSizeOf, LABEL_COLORS, LABEL_SIZE, labelColorOf } from '../elements/label';
import { setTextStyle } from '../elements/text-style';
import { pushHistory } from '../input/history';
import { cardPosition } from './card-placement';
import { isPendingLabel } from './label-editor';
import { mountTextStyleToggles } from './text-style-toggles';

const card = byId('label-card');

// The label the card is for: the one selected label, while the select or text tool is in use (the text
// tool leaves a label it has placed selected, to be given its size and colour).
function cardLabel(): LabelElement | null {
  if (!['select', 'text'].includes(state.tool) || state.selected.length !== 1) return null;
  const el = state.elements[state.selected[0]];
  return el?.type === 'label' ? el : null;
}

// Keeps a change as an undo step, unless the label has just been placed and has no text yet: it is not
// part of the saved map until it has (see label-editor.ts), and is saved then with whatever it was given.
function keep(label: LabelElement): void {
  if (!isPendingLabel(label)) pushHistory();
}

// ── Size ───────────────────────────────────────────────────────
const size = byId<HTMLInputElement>('label-size');
const sizeValue = byId('label-size-value');
size.min = String(LABEL_SIZE.min);
size.max = String(LABEL_SIZE.max);

// While the slider is held the label follows it; the whole drag is one undo step, kept when it is let go.
let sizing: { label: LabelElement; original: number } | null = null;

size.addEventListener('input', () => {
  const label = cardLabel();
  if (!label) return;
  sizing ??= { label, original: fontSizeOf(label) };
  label.fontSize = Number(size.value);
  state.labelStyle.fontSize = label.fontSize; // the next new label starts like this one
  sizeValue.textContent = size.value;
  drawMain();
});

function finishSizing(): void {
  if (!sizing) return;
  const { label, original } = sizing;
  sizing = null;
  if (state.elements.includes(label) && fontSizeOf(label) !== original) keep(label);
}

size.addEventListener('change', finishSizing);
size.addEventListener('blur', finishSizing);

// ── Bold, italic, plate ────────────────────────────────────────
// The buttons are the ones the token card has too (text-style-toggles.ts). A change is one undo step, and
// is what the next new label starts as.
const textStyle = mountTextStyleToggles(byId('label-text-style'), {
  get: cardLabel,
  set(key, on) {
    const label = cardLabel();
    if (!label) return;
    setTextStyle(label, key, on);
    state.labelStyle[key] = on;
    drawMain();
    keep(label);
  },
});

// ── Colour ─────────────────────────────────────────────────────
// The swatches, then a ring that opens the browser's own picker for any colour. A swatch is kept at
// once as one undo step; the picker follows every click as it is made and is one step in all.
const colors = byId('label-colors');
const customLabel = colors.querySelector<HTMLElement>('.token-swatch-custom') as HTMLElement;
const customInput = byId<HTMLInputElement>('label-color-custom');
const swatches: HTMLButtonElement[] = [];

for (const { hex, name } of LABEL_COLORS) {
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

function setColor(hex: string): void {
  const label = cardLabel();
  if (!label || labelColorOf(label) === hex.toLowerCase()) return;
  label.strokeColor = hex;
  state.labelStyle.color = hex;
  drawMain();
  keep(label);
}

let picking: { label: LabelElement; original: string } | null = null;

customInput.addEventListener('input', () => {
  const label = cardLabel();
  if (!label) return;
  picking ??= { label, original: labelColorOf(label) };
  label.strokeColor = customInput.value;
  state.labelStyle.color = customInput.value;
  drawMain();
});

function finishPicking(): void {
  if (!picking) return;
  const { label, original } = picking;
  picking = null;
  if (state.elements.includes(label) && labelColorOf(label) !== original) keep(label);
}

customInput.addEventListener('change', () => {
  if (picking) finishPicking();
  else setColor(customInput.value); // a browser that sends only 'change'
});
customInput.addEventListener('blur', finishPicking);

// Marks the label's colour: a swatch, or the ring if it isn't one of the offered.
function showColor(label: LabelElement): void {
  const current = labelColorOf(label);
  for (const swatch of swatches)
    swatch.setAttribute('aria-pressed', String(swatch.dataset.color === current));
  customLabel.classList.toggle('selected', !LABEL_COLORS.some((c) => c.hex === current));
  if (customInput.value !== current) customInput.value = current; // so the picker opens on it
}

// ── Showing it ─────────────────────────────────────────────────
function place(label: LabelElement): void {
  card.classList.remove('hidden'); // shown first, so it has a size to place
  const screen = iCanvas.getBoundingClientRect();
  const bounds = getElementBounds(label);
  if (!bounds) return;
  const { left, top } = cardPosition({
    // Lined up with the label's left edge, not its middle: the middle moves as the text grows, and the
    // card would slide about under the pointer while the size slider is dragged.
    centerX: screen.left + state.panX + bounds.x * state.zoom + card.offsetWidth / 2,
    top: screen.top + state.panY + bounds.y * state.zoom,
    bottom: screen.top + state.panY + (bounds.y + bounds.h) * state.zoom,
    width: card.offsetWidth,
    height: card.offsetHeight,
    screenTop: screen.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// Called after every redraw of the map.
function update(): void {
  const label = cardLabel();
  if (!label || state.elementDrag || state.handleDrag) {
    card.classList.add('hidden');
    return;
  }
  if (document.activeElement !== size) {
    size.value = String(fontSizeOf(label));
    sizeValue.textContent = size.value;
  }
  showColor(label);
  textStyle.refresh();
  if (!sizing) place(label); // held still while the slider is dragged: the label grows under it
}

onMainDrawn(update);
