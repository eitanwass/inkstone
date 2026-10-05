// ── Settings ───────────────────────────────────────────────────
// A modal over a blurred page, opened from the gear button. Its panels are tabs down the
// left; there is one so far, Board: the unit and the size of a square, which the ruler and
// the size rulers read through `scale` (measure.ts). Settings are kept in this browser (they
// are about how you read the map, not part of it), apply as they are changed, and are not
// shared with a live session.
//
// To add a panel: a tab button and a tabpanel section in index.html, then the code for its
// controls here.

import { byId } from '../core/dom';
import { formatDistance, gridDistance, parseScale, scale, UNITS, validPerCell } from '../core/measure';
import { GRID } from '../core/state';
import { storageGet, storageSet } from '../core/storage';
import { drawMain } from '../draw/render';
import { restoreFocus, trapFocus } from '../ui/focus';

const STORAGE_KEY = 'inkstone-board-settings';

// ── Keeping the settings ───────────────────────────────────────
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
}

// ── The Board panel ────────────────────────────────────────────
const unitChoices = byId('board-units');
const perCellInput = byId<HTMLInputElement>('board-per-cell');
const diagonalsCheckbox = byId<HTMLInputElement>('board-dnd-diagonals');

diagonalsCheckbox.addEventListener('change', () => {
  scale.dndDiagonals = diagonalsCheckbox.checked;
  applyScale();
});

// Something changed: keep it, and redraw so a ruler already on the map reads the new scale.
function applyScale(): void {
  save();
  drawMain();
  showScale();
}

// Brings the controls in line with `scale`.
function showScale(): void {
  for (const radio of unitChoices.querySelectorAll<HTMLInputElement>('input')) {
    radio.checked = radio.value === scale.unit;
  }
  byId('board-unit-name').textContent = scale.unit;
  byId('board-example').textContent = `A room 6 squares wide is ${formatDistance(6)} wide.`;
  diagonalsCheckbox.checked = scale.dndDiagonals;
  // The same diagonal both ways would be 30 ft with the rule and 28.3 ft without, so the effect is plain.
  byId('board-diagonal-example').textContent =
    `A line 4 squares across and 4 down is ${formatDistance(gridDistance(4 * GRID, 4 * GRID))}.`;
}

function buildUnitChoices(): void {
  for (const { unit, label } of UNITS) {
    const choice = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'board-unit';
    radio.value = unit;
    const text = document.createElement('span');
    text.textContent = label;
    choice.append(radio, text);
    unitChoices.append(choice);
  }
}

// A new unit starts at what a square usually is in it (5 ft, 1.5 m, 1 square).
unitChoices.addEventListener('change', (e) => {
  const preset = UNITS.find((u) => u.unit === (e.target as HTMLInputElement).value);
  if (!preset) return;
  scale.unit = preset.unit;
  scale.perCell = preset.perCell;
  perCellInput.value = String(scale.perCell);
  perCellInput.removeAttribute('aria-invalid');
  applyScale();
});

// Applies as it is typed, as long as it is a usable size; until then the last good one holds.
perCellInput.addEventListener('input', () => {
  const size = validPerCell(perCellInput.valueAsNumber);
  if (size === null) {
    perCellInput.setAttribute('aria-invalid', 'true');
    return;
  }
  perCellInput.removeAttribute('aria-invalid');
  scale.perCell = size;
  applyScale();
});

// Leaving the field puts back the size in use if what was typed isn't one.
perCellInput.addEventListener('change', () => {
  perCellInput.value = String(scale.perCell);
  perCellInput.removeAttribute('aria-invalid');
});

// ── Opening and closing ────────────────────────────────────────
const button = byId('btn-settings');
const overlay = byId('settings-overlay');
const modal = byId('settings-modal');
let opener: Element | null = null;

function openSettings(): void {
  opener = document.activeElement;
  perCellInput.value = String(scale.perCell);
  showScale();
  overlay.classList.remove('hidden');
  modal.focus();
}

function closeSettings(): void {
  overlay.classList.add('hidden');
  restoreFocus(opener ?? button);
}

// ── Panels ─────────────────────────────────────────────────────
const tabs = [...document.querySelectorAll<HTMLElement>('#settings-tabs [role="tab"]')];

function selectTab(selected: HTMLElement): void {
  for (const tab of tabs) {
    const isSelected = tab === selected;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1; // the list is one tab stop; the arrow keys move within it
    byId(tab.getAttribute('aria-controls') ?? '').hidden = !isSelected;
  }
}

for (const tab of tabs) tab.addEventListener('click', () => selectTab(tab));

// Up and Down (or Left and Right) move between the panels' tabs, as in any tab list.
byId('settings-tabs').addEventListener('keydown', (e) => {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (!step || at < 0) return;
  e.preventDefault();
  const next = tabs[(at + step + tabs.length) % tabs.length];
  selectTab(next);
  next.focus();
});

loadSaved();
buildUnitChoices();
showScale();
trapFocus(modal);

button.addEventListener('click', openSettings);
byId('settings-close').addEventListener('click', closeSettings);

// A click on the blurred page outside the modal closes it.
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeSettings();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeSettings();
});
