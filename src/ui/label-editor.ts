// ── Editing a label in place ───────────────────────────────────
// Double-click a label, press Enter on it, or choose "Edit Text" in its menu, and a field appears right
// over it on the map, at the same size and in the same colour, so the text is edited where it is.
// Enter or clicking away keeps it (one undo step, sent to a live session once); Escape puts the old
// text back. Blank or unchanged text is no edit: a label with no text would be invisible.
//
// The text tool uses the same field: a click on a label opens it, a click anywhere else puts a new,
// empty label there and opens that (textToolClick), and a drag marks out an area for a new one, whose
// height is its size (textToolArea), with its card (label-card.tsx) beside it. It joins the map, and the undo history, only
// when it has text; blank, or Escape, and it was never there.
//
// The label itself isn't drawn by the canvas while it is edited (see state.editingLabel), and the
// field follows it as the map is panned or zoomed. It is positioned from render.ts's onMainDrawn hook,
// which is registered rather than imported to keep the module chain one-way.

import { worldToClient } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { LabelElement, Point } from '../core/types';
import { drawMain, onMainDrawn } from '../draw/render';
import { hitTest } from '../elements';
import { fontSizeOf, LABEL_SIZE, labelColorOf } from '../elements/label';
import { fontString } from '../elements/text-style';
import { pushHistory } from '../input/history';

const field = byId<HTMLInputElement>('label-editor');
const PAD_PX = 3;

let editing: { label: LabelElement; original: string; isNew: boolean } | null = null;

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
  const size = fontSizeOf(label) * state.zoom;
  measure.font = fontString(size, label);
  const at = worldToClient(label.x, label.y);
  field.style.fontSize = `${size}px`;
  field.style.color = labelColorOf(label);
  field.style.fontWeight = label.bold ? '700' : '400';
  field.style.fontStyle = label.italic ? 'italic' : 'normal';
  field.style.width = `${Math.ceil(measure.measureText(field.value || ' ').width) + 2 * PAD_PX + size}px`;
  field.style.left = `${at.x - PAD_PX - 1}px`;
  field.style.top = `${at.y - PAD_PX - 1}px`;
}

// Whether this is a label that has just been placed and has no text yet: it is on the map for the field
// and the card to work on, but it is not part of the saved map until it has some.
export const isPendingLabel = (label: LabelElement): boolean =>
  editing?.isNew === true && editing.label === label;

// What a click with the text tool does: on a label, it opens that label to edit (as double-clicking it
// with the select tool does); anywhere else, it places a new one.
export function textToolClick(x: number, y: number): void {
  if (editing) commit(); // the one being typed into before is kept first
  const idx = hitTest(x, y);
  const hit = idx === null ? undefined : state.elements[idx];
  if (hit?.type === 'label') {
    state.selected = [state.elements.indexOf(hit)];
    editLabel(hit);
  } else {
    placeLabel(x, y);
  }
}

// What a drag with the text tool does: puts a new label in the area marked out, its top left corner at the
// area's, and its size set by the area's height (a label is a single line, so the width is the text's own).
export function textToolArea(a: Point, b: Point): void {
  if (editing) commit();
  const fontSize = Math.round(Math.abs(b.y - a.y));
  placeLabel(
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    Math.min(LABEL_SIZE.max, Math.max(LABEL_SIZE.min, fontSize)),
  );
}

// Puts a new, empty label where the text tool was clicked, selects it, and opens it to type into. Its
// size is the last one set in a label's card unless it is given.
function placeLabel(x: number, y: number, fontSize = state.labelStyle.fontSize): void {
  if (editing) commit();
  const label: LabelElement = {
    type: 'label',
    x,
    y,
    text: '',
    fontSize,
    strokeColor: state.labelStyle.color,
    ...(state.labelStyle.bold ? { bold: true } : {}),
    ...(state.labelStyle.italic ? { italic: true } : {}),
    ...(state.labelStyle.plate ? { plate: true } : {}),
  };
  state.elements.push(label);
  state.selected = [state.elements.length - 1];
  editLabel(label, true);
}

export function editLabel(label: LabelElement, isNew = false): void {
  if (editing) commit(); // another label was chosen: keep this one's text first
  editing = { label, original: label.text, isNew };
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

function removeFromMap(label: LabelElement): void {
  const i = state.elements.indexOf(label);
  if (i >= 0) state.elements.splice(i, 1);
  state.selected = [];
  drawMain();
}

function commit(): void {
  if (!editing) return;
  const { label, original, isNew } = editing;
  const text = field.value.trim();
  close();
  if (isNew) {
    if (!state.elements.includes(label)) return;
    if (!text)
      removeFromMap(label); // nothing was typed: it was never there
    else {
      label.text = text;
      drawMain();
      pushHistory(); // the label is added, whatever size and colour its card gave it
    }
    return;
  }
  // Only a real change is an edit: typing and putting it back is not.
  if (text && text !== original && state.elements.includes(label)) {
    label.text = text;
    drawMain();
    pushHistory();
  }
}

function cancel(): void {
  if (!editing) return;
  const { label, isNew } = editing;
  close();
  if (isNew) removeFromMap(label);
}

field.addEventListener('input', place); // it grows as it is typed into
// Going to the label's card (to set its size or colour) doesn't end the edit; leaving the field and the
// card both does. A new label with no text yet would otherwise be gone before it could be given a size.
const card = byId('label-card');
const inCardOrField = (target: EventTarget | null) =>
  target instanceof Node && (card.contains(target) || target === field);
field.addEventListener('blur', (e) => {
  if (!inCardOrField(e.relatedTarget)) commit();
});
card.addEventListener('focusout', (e) => {
  if (editing && !inCardOrField(e.relatedTarget)) commit();
});
field.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    field.blur();
  } else if (e.key === 'Escape') {
    cancel();
    e.stopPropagation(); // Escape here undoes the typing; it does not also deselect the label
  }
});

onMainDrawn(place);
