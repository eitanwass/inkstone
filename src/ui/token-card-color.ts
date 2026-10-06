// ── The token card's colour ────────────────────────────────────
// The token palette as swatches, then a ring that opens the browser's own picker for any colour.
// A choice is kept at once as one undo step.

import { byId } from '../core/dom';
import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { PALETTE } from '../elements/token';
import { pushHistory } from '../input/history';
import { cardToken } from './token-target';

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
export function showColor(token: TokenElement): void {
  const current = colorOf(token);
  for (const swatch of swatches)
    swatch.setAttribute('aria-pressed', String(swatch.dataset.color === current));
  customLabel.classList.toggle('selected', !PALETTE.some((p) => p.hex === current));
  if (customInput.value !== current) customInput.value = current; // so the picker opens on it
}

// Moves the keyboard to the swatches: the one in use, or the first.
export function focusColors(): void {
  (swatches.find((s) => s.getAttribute('aria-pressed') === 'true') ?? swatches[0]).focus();
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
