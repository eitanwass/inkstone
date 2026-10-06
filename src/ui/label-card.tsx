// ── The label card ──────────────────────────────────────────────
// Click a label and a small card appears next to it with its details: its size, text style (bold, italic, a plate) and colour for now,
// and the font and the like are meant to join them. The card follows the label as the map is panned or
// zoomed and goes while it is being dragged. It is the label's counterpart of the token card
// (token-card.tsx) and sits where it does, above, or below if the top of the screen is in the way.
//
// It is a Preact component (see library.tsx), drawn into #label-card and drawn again after every redraw
// of the map (use-editor.ts), reading the selected label straight from `state`. #label-card itself stays
// in the page's markup, so label-editor.ts can find it (and listen for focus leaving it) at load.
//
// A change shows on the map as it is made and is kept as one undo step: a colour when it is picked, a
// size when the slider is let go.

import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { iCanvas, worldToClient } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { LabelElement } from '../core/types';
import { drawMain } from '../draw/render';
import { getElementBounds } from '../elements';
import { fontSizeOf, LABEL_COLORS, LABEL_SIZE, labelColorOf } from '../elements/label';
import { setTextStyle } from '../elements/text-style';
import { pushHistory } from '../input/history';
import { cardPosition } from './card-placement';
import { isPendingLabel } from './label-editor';
import { mountTextStyleToggles } from './text-style-toggles';
import { useEditorRedraw } from './use-editor';

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

function place(card: HTMLElement, label: LabelElement): void {
  const screen = iCanvas.getBoundingClientRect();
  const bounds = getElementBounds(label);
  if (!bounds) return;
  const topLeft = worldToClient(bounds.x, bounds.y);
  const bottom = worldToClient(bounds.x, bounds.y + bounds.h).y;
  const { left, top } = cardPosition({
    // Lined up with the label's left edge, not its middle: the middle moves as the text grows, and the
    // card would slide about under the pointer while the size slider is dragged.
    centerX: topLeft.x + card.offsetWidth / 2,
    top: topLeft.y,
    bottom,
    width: card.offsetWidth,
    height: card.offsetHeight,
    screenTop: screen.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

const card = byId('label-card');

function LabelCard() {
  useEditorRedraw();

  const label = cardLabel();
  const visible = label !== null && !state.elementDrag && !state.handleDrag; // it steps aside while the label moves

  const styleBox = useRef<HTMLDivElement>(null);
  const styleToggles = useRef<ReturnType<typeof mountTextStyleToggles> | null>(null);

  // While the slider is held the label follows it; the whole drag is one undo step, kept when it is let go.
  const sizing = useRef<{ label: LabelElement; original: number } | null>(null);
  // The same for the browser's own colour picker: 'input' on each click, 'change' when it closes.
  const picking = useRef<{ label: LabelElement; original: string } | null>(null);

  // Bold, italic, plate: the buttons the token card has too (text-style-toggles.ts, put in place by hand).
  // A change is one undo step, and is what the next new label starts as.
  useEffect(() => {
    if (!styleBox.current) return;
    styleToggles.current = mountTextStyleToggles(styleBox.current, {
      get: cardLabel,
      set(key, on) {
        const current = cardLabel();
        if (!current) return;
        setTextStyle(current, key, on);
        state.labelStyle[key] = on;
        drawMain();
        keep(current);
      },
    });
  }, []);

  // After every draw of the card: shown first, so it has a size to place.
  useLayoutEffect(() => {
    card.classList.toggle('hidden', !visible);
    styleToggles.current?.refresh();
    if (visible && label && !sizing.current) place(card, label); // held still while the slider is dragged
  });

  const finishSizing = () => {
    const visit = sizing.current;
    if (!visit) return;
    sizing.current = null;
    if (state.elements.includes(visit.label) && fontSizeOf(visit.label) !== visit.original) keep(visit.label);
  };

  const setColor = (hex: string) => {
    if (!label || labelColorOf(label) === hex.toLowerCase()) return;
    label.strokeColor = hex;
    state.labelStyle.color = hex;
    drawMain();
    keep(label);
  };

  const finishPicking = () => {
    const visit = picking.current;
    if (!visit) return;
    picking.current = null;
    if (state.elements.includes(visit.label) && labelColorOf(visit.label) !== visit.original)
      keep(visit.label);
  };

  const size = label ? fontSizeOf(label) : LABEL_SIZE.min;
  const current = label ? labelColorOf(label) : '';

  return (
    <>
      <div class="lc-size">
        <span class="tc-label">Size</span>
        <input
          type="range"
          id="label-size"
          min={LABEL_SIZE.min}
          max={LABEL_SIZE.max}
          value={size}
          class="slider"
          aria-label="Label size"
          onInput={(e) => {
            if (!label) return;
            sizing.current ??= { label, original: fontSizeOf(label) };
            label.fontSize = Number(e.currentTarget.value);
            state.labelStyle.fontSize = label.fontSize; // the next new label starts like this one
            drawMain();
          }}
          onChange={finishSizing}
          onBlur={finishSizing}
        />
        <span id="label-size-value">{size}</span>
      </div>
      {/* Bold, italic and a plate behind the text (built in text-style-toggles.ts, shared with the token card) */}
      <div id="label-text-style" class="ts-toggles" role="group" aria-label="Text style" ref={styleBox} />
      {/* The swatches, then a ring that opens the browser's own picker for any colour */}
      <div id="label-colors" role="group" aria-label="Label color">
        {LABEL_COLORS.map(({ hex, name }) => (
          <button
            type="button"
            class="token-swatch"
            style={{ background: hex }}
            data-color={hex}
            title={name}
            aria-label={name}
            aria-pressed={current === hex}
            onClick={() => setColor(hex)}
          />
        ))}
        <label
          class={`token-swatch token-swatch-custom${!label || LABEL_COLORS.some((c) => c.hex === current) ? '' : ' selected'}`}
          title="Custom color"
        >
          <input
            type="color"
            id="label-color-custom"
            aria-label="Custom color"
            value={current || '#000000'}
            onInput={(e) => {
              if (!label) return;
              picking.current ??= { label, original: labelColorOf(label) };
              label.strokeColor = e.currentTarget.value;
              state.labelStyle.color = e.currentTarget.value;
              drawMain();
            }}
            onChange={(e) => {
              if (picking.current) finishPicking();
              else setColor(e.currentTarget.value); // a browser that sends only 'change'
            }}
            onBlur={finishPicking}
          />
        </label>
      </div>
    </>
  );
}

render(<LabelCard />, card);
