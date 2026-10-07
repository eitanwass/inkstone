// ── The Adjust image panel ─────────────────────────────────────
// Shown while the map's background picture is being adjusted (state.adjustingBackground, set by
// ui/background.ts), in place of the tool dock. The controls are in the order a picture is usually worked
// on: turn it the right way up, fit it to the grid (which reads it as it is shown, so after turning), then
// make it fainter; the keys that work on the map are beside them.
//
// It is a Preact component (see ui/library.tsx), drawn into #adjust-root and drawn again after every redraw
// of the map (ui/use-editor.ts), so dragging a corner shows the new width and an undo shows what it undid.
// What the picture does (turning, fitting, opacity, width) is in ui/background.ts; this only shows and asks.

import { render } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { byId } from '../core/dom';
import { GRID, state } from '../core/state';
import {
  background,
  chooseBackgroundPicture,
  fitPictureToGrid,
  keepBackground,
  removePicture,
  rotatePicture,
  round,
  setOpacity,
  setWidthInSquares,
  stopAdjusting,
} from './background';
import { useEditorRedraw } from './use-editor';

function AdjustPanel() {
  useEditorRedraw();

  const bg = background();
  const visible = state.adjustingBackground && !!bg?.image;
  const percent = Math.round((bg?.opacity ?? 1) * 100);

  // What is typed in the width field while it has the focus (usable or not); otherwise it shows the size in use.
  const [typed, setTyped] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const sizeChanged = useRef(false); // a usable width was typed since the field was entered
  const squares = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const wasVisible = useRef(false);

  // Adjusting begins with the focus on Done, so Enter or Escape ends it.
  useLayoutEffect(() => {
    if (visible && !wasVisible.current) done.current?.focus();
    wasVisible.current = visible;
  });

  return (
    <div
      id="adjust-panel"
      class={visible ? 'floating-panel' : 'floating-panel hidden'}
      role="region"
      aria-label="Adjust image"
    >
      <div class="adj-main">
        <h2 class="adj-title">Adjust image</h2>

        <div class="adj-controls">
          <div class="adj-field">
            <span class="adj-label" id="adjust-rotate-label">
              1 · Rotate
            </span>
            <div class="adj-row" role="group" aria-labelledby="adjust-rotate-label">
              <button
                type="button"
                class="adj-icon-btn"
                id="adjust-rotate-left"
                aria-label="Rotate 90° left"
                title="Rotate 90° left"
                onClick={() => rotatePicture(-1)}
              >
                <svg width="18" height="18" aria-hidden="true">
                  <use href="/icons.svg#icon-rotate-left" />
                </svg>
              </button>
              <button
                type="button"
                class="adj-icon-btn"
                id="adjust-rotate-right"
                aria-label="Rotate 90° right"
                title="Rotate 90° right"
                onClick={() => rotatePicture(1)}
              >
                <svg width="18" height="18" aria-hidden="true">
                  <use href="/icons.svg#icon-rotate-right" />
                </svg>
              </button>
            </div>
          </div>

          <div class="adj-field">
            <label for="adjust-squares">2 · Width in squares</label>
            <div class="adj-row">
              <input
                type="number"
                id="adjust-squares"
                min="0.5"
                max="2000"
                step="0.1"
                inputMode="decimal"
                aria-describedby="adjust-size"
                aria-invalid={invalid ? 'true' : undefined}
                ref={squares}
                value={typed ?? (bg ? round(bg.w / GRID, 2) : '')}
                // A typed width applies as it is typed, as long as it is a usable one, and is kept (one undo
                // step) when the field is left.
                onInput={(e) => {
                  setTyped(e.currentTarget.value);
                  const usable = setWidthInSquares(e.currentTarget.valueAsNumber);
                  setInvalid(!usable);
                  sizeChanged.current ||= usable;
                }}
                onChange={() => {
                  setInvalid(false);
                  if (sizeChanged.current) keepBackground();
                  sizeChanged.current = false;
                  squares.current?.blur(); // lets the field show the size in use
                }}
                onBlur={() => setTyped(null)}
              />
              <span id="adjust-size" class="adj-value">
                {bg ? `× ${round(bg.h / GRID, 1)} tall` : ''}
              </span>
              <button
                type="button"
                class="btn-secondary adj-fit"
                id="adjust-fit"
                title="Find the squares printed on the picture and fit them to ours"
                onClick={fitPictureToGrid}
              >
                Fit to grid
              </button>
            </div>
          </div>

          <div class="adj-field">
            <label for="adjust-opacity">3 · Opacity</label>
            <div class="adj-row">
              <input
                type="range"
                id="adjust-opacity"
                class="slider"
                min="5"
                max="100"
                step="5"
                value={percent}
                // The slider shows the change as it is dragged, and keeps it (one undo step) when it is let go.
                onInput={(e) => setOpacity(Number(e.currentTarget.value) / 100)}
                onChange={keepBackground}
              />
              <span id="adjust-opacity-text" class="adj-value" aria-hidden="true">
                {`${percent}%`}
              </span>
            </div>
          </div>
        </div>

        <div class="adj-actions">
          <div class="adj-actions-start">
            <button type="button" class="btn-secondary" id="adjust-replace" onClick={chooseBackgroundPicture}>
              Replace…
            </button>
            <button type="button" class="btn-secondary" id="adjust-remove" onClick={removePicture}>
              Remove
            </button>
          </div>
          <button type="button" class="btn-primary" id="adjust-done" ref={done} onClick={stopAdjusting}>
            Done
          </button>
        </div>
      </div>

      {/* How to adjust it on the map: the keys that work, beside the controls */}
      <aside class="adj-keys" aria-labelledby="adjust-keys-title">
        <h3 class="adj-label" id="adjust-keys-title">
          On the map
        </h3>
        <ul class="adj-hints">
          <li>
            <kbd>Drag</kbd>
            <span>move</span>
          </li>
          <li>
            <kbd>Corner</kbd>
            <span>resize</span>
          </li>
          <li>
            <kbd>Shift</kbd>
            <span>snap to the grid</span>
          </li>
          <li>
            <kbd>Arrows</kbd>
            <span>nudge a pixel</span>
          </li>
          <li>
            <kbd>Shift</kbd> <kbd>Arrows</kbd>
            <span>nudge ten</span>
          </li>
        </ul>
      </aside>
    </div>
  );
}

render(<AdjustPanel />, byId('adjust-root'));
