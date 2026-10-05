// ── Editing a label in place ───────────────────────────────────
// Double-click a label, press Enter on it, or choose "Edit Text" in its menu, and a field appears right
// over it on the map, at the same size and in the same colour, so the text is edited where it is.
// Enter or clicking away keeps it (one undo step, sent to a live session once); Escape puts the old
// text back. Blank or unchanged text is no edit: a label with no text would be invisible.
//
// The label itself isn't drawn by the canvas while it is edited (see state.editingLabel), and the
// field follows it as the map is panned or zoomed. It is positioned from render.ts's onMainDrawn hook,
// which is registered rather than imported to keep the module chain one-way.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { DEFAULT_FONT_SIZE, FONT_FAMILY, state } from '../core/state';
import type { LabelElement } from '../core/types';
import { drawMain, onMainDrawn } from '../draw/render';
import { pushHistory } from '../input/history';

const field = byId<HTMLInputElement>('label-editor');
const DEFAULT_COLOR = '#e8dcc8'; // as in elements/label.ts
const PAD_PX = 3;

let editing: { label: LabelElement; original: string } | null = null;

// A field the size of what is typed (a text input doesn't grow by itself), at the label's own size
// on screen: a hidden canvas measure, the same one the label's bounds use.
const measure = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

function place(): void {
  if (!editing) return;
  const { label } = editing;
  if (!state.elements.includes(label)) {
    cancel(); // gone (undone, or changed by someone else) while it was being edited
    return;
  }
  const size = (label.fontSize || DEFAULT_FONT_SIZE) * state.zoom;
  measure.font = `${size}px ${FONT_FAMILY}`;
  const screen = iCanvas.getBoundingClientRect();
  field.style.fontSize = `${size}px`;
  field.style.color = label.strokeColor || DEFAULT_COLOR;
  field.style.width = `${Math.ceil(measure.measureText(field.value || ' ').width) + 2 * PAD_PX + size}px`;
  field.style.left = `${screen.left + state.panX + label.x * state.zoom - PAD_PX - 1}px`;
  field.style.top = `${screen.top + state.panY + label.y * state.zoom - PAD_PX - 1}px`;
}

export function editLabel(label: LabelElement): void {
  if (editing) commit(); // another label was chosen: keep this one's text first
  editing = { label, original: label.text };
  state.editingLabel = label;
  field.value = label.text;
  field.classList.remove('hidden');
  place();
  drawMain(); // without the label's own text under the field
  field.focus();
  field.select();
}

function close(): void {
  editing = null;
  state.editingLabel = null;
  field.classList.add('hidden');
  drawMain();
}

function commit(): void {
  if (!editing) return;
  const { label, original } = editing;
  const text = field.value.trim();
  close();
  // Only a real change is an edit: typing and putting it back is not.
  if (text && text !== original && state.elements.includes(label)) {
    label.text = text;
    drawMain();
    pushHistory();
  }
}

function cancel(): void {
  if (editing) close();
}

field.addEventListener('input', place); // it grows as it is typed into
field.addEventListener('blur', commit);
field.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    field.blur();
  } else if (e.key === 'Escape') {
    cancel();
    e.stopPropagation(); // Escape here undoes the typing; it does not also deselect the label
  }
});

onMainDrawn(place);
