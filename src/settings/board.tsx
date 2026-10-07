// ── Settings: the Board panel ──────────────────────────────────
// The unit and the size of a square, which the ruler and the size rulers read through `scale`
// (core/measure.ts), and the D&D diagonal rule. They are kept in this browser (they are about how you
// read the map, not part of it), apply as they are changed, and are not shared with a live session.

import { useEffect, useReducer, useState } from 'preact/hooks';
import { formatDistance, gridDistance, parseScale, scale, UNITS, validPerCell } from '../core/measure';
import { GRID } from '../core/state';
import { storageGet, storageSet } from '../core/storage';
import { drawMain } from '../draw/render';
import { flashSaved } from './saved';

const STORAGE_KEY = 'inkstone-board-settings';

function loadSaved(): void {
  try {
    const saved = parseScale(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'));
    if (saved) Object.assign(scale, saved);
  } catch {
    // Not JSON: the defaults stay.
  }
}

function save(): void {
  storageSet(STORAGE_KEY, JSON.stringify(scale)); // if storage is unavailable, they just last this visit
  flashSaved();
}

loadSaved();

export function BoardPanel({ active, open }: { active: boolean; open: boolean }) {
  const [, changed] = useReducer((n: number) => n + 1, 0);
  const [size, setSize] = useState(String(scale.perCell)); // what is in the field, usable or not
  const [invalid, setInvalid] = useState(false);

  // Opened again: the field shows the size in use.
  useEffect(() => {
    if (!open) return;
    setSize(String(scale.perCell));
    setInvalid(false);
  }, [open]);

  // Something changed: keep it, and redraw so a ruler already on the map reads the new scale.
  const apply = () => {
    save();
    drawMain();
    changed(0);
  };

  return (
    <section
      id="settings-panel-board"
      class="settings-panel"
      role="tabpanel"
      aria-labelledby="settings-tab-board"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel is a tab stop, as in the WAI-ARIA tabs pattern
      tabIndex={0}
      hidden={!active}
    >
      <h3>Board</h3>
      <p class="settings-note">Used by the ruler and the sizes shown as you draw. Saved in this browser.</p>

      {/* The unit and the size of a square sit side by side on one line */}
      <div class="settings-fields">
        <fieldset class="settings-field">
          <legend>Units</legend>
          {/* A new unit starts at what a square usually is in it (5 ft, 1.5 m, 1 square). */}
          <div class="segmented" id="board-units">
            {UNITS.map(({ unit, label, perCell }) => (
              <label key={unit}>
                <input
                  type="radio"
                  name="board-unit"
                  value={unit}
                  checked={scale.unit === unit}
                  onChange={() => {
                    scale.unit = unit;
                    scale.perCell = perCell;
                    setSize(String(perCell));
                    setInvalid(false);
                    apply();
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div class="settings-field">
          <label for="board-per-cell">One square is</label>
          <div class="settings-row">
            <input
              type="number"
              id="board-per-cell"
              min="0.01"
              max="1000"
              step="0.5"
              inputMode="decimal"
              aria-describedby="board-example"
              aria-invalid={invalid ? 'true' : undefined}
              value={size}
              // Applies as it is typed, as long as it is a usable size; until then the last good one holds.
              onInput={(e) => {
                setSize(e.currentTarget.value);
                const usable = validPerCell(e.currentTarget.valueAsNumber);
                setInvalid(usable === null);
                if (usable === null) return;
                scale.perCell = usable;
                apply();
              }}
              // Leaving the field puts back the size in use if what was typed isn't one.
              onChange={() => {
                setSize(String(scale.perCell));
                setInvalid(false);
              }}
            />
            <span id="board-unit-name" aria-hidden="true">
              {scale.unit}
            </span>
          </div>
        </div>
      </div>

      <div class="settings-field settings-switch-row">
        <label class="settings-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={scale.dndDiagonals}
            id="board-dnd-diagonals"
            checked={scale.dndDiagonals}
            onChange={(e) => {
              scale.dndDiagonals = e.currentTarget.checked;
              apply();
            }}
          />
          <span class="switch-track" aria-hidden="true" />
          <span>D&D diagonal rules</span>
        </label>
        {/* The explanation shows on hover or focus: it is the button's description, so a screen reader reads it too */}
        <span class="help-tip">
          <button
            type="button"
            class="help-btn"
            aria-label="About the D&D diagonal rules"
            aria-describedby="board-diagonals-note"
          >
            ?
          </button>
          <span class="help-tip-text" role="tooltip" id="board-diagonals-note">
            The first diagonal square counts as 1, the next as 2, then 1, 2 and so on, as in the Dungeon
            Master's Guide. Off, a diagonal is measured as the straight line.
          </span>
        </span>
      </div>

      {/* Sample sums with the settings above, together at the bottom */}
      <div class="settings-examples" role="group" aria-label="Examples">
        <div class="settings-examples-label" aria-hidden="true">
          Examples
        </div>
        <p class="settings-example" id="board-example">
          {`A room 6 squares wide is ${formatDistance(6)} wide.`}
        </p>
        {/* The same diagonal both ways would be 30 ft with the rule and 28.3 ft without, so the effect is plain. */}
        <p class="settings-example" id="board-diagonal-example">
          {`A line 4 squares across and 4 down is ${formatDistance(gridDistance(4 * GRID, 4 * GRID))}.`}
        </p>
      </div>
    </section>
  );
}
