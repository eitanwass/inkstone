// ── Settings: the Conditions panel ─────────────────────────────
// Where a person makes their own conditions (a name, a color, an icon) to use alongside the default
// ones, and edits or removes them. The default ones are listed for reference and can't be changed.
// What is made is kept in this browser (conditions/library.ts). Editing one brings the copy on every
// token that has it up to date; removing one only takes it off the list to choose from.

import { type Condition, DEFAULT_CONDITIONS, ICON_NAMES } from '../conditions';
import { conditionBadge, iconGlyph } from '../conditions/icon';
import { addCustom, customConditions, draftProblem, removeCustom, updateCustom } from '../conditions/library';
import { refreshCondition } from '../conditions/tokens';
import { byId } from '../dom';
import { showToast } from '../toast';

// A choice of colors that read well behind a white icon, plus any color of their own.
const COLORS = [
  '#c0267a',
  '#a3322e',
  '#c2610c',
  '#a16207',
  '#2f7d32',
  '#0f766e',
  '#0e6f8f',
  '#1f4fae',
  '#6d4fc7',
  '#a22fb0',
  '#57534e',
  '#475569',
];
const FIRST_ICON = 'star';

const form = byId<HTMLFormElement>('cond-form');
const nameInput = byId<HTMLInputElement>('cond-name');
const problem = byId('cond-problem');
const saveButton = byId<HTMLButtonElement>('cond-save');
const cancelButton = byId<HTMLButtonElement>('cond-cancel');
const colorsBox = byId('cond-colors');
const iconsBox = byId('cond-icons');

let editingId: string | null = null; // the one being edited, or null when making a new one
let color = COLORS[0];
let icon = FIRST_ICON;

// ── The lists ──────────────────────────────────────────────────
function row(condition: Condition, actions: HTMLElement[] = []): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'cond-row';
  const name = document.createElement('span');
  name.className = 'cond-name';
  name.textContent = condition.name;
  item.append(conditionBadge(condition, 22), name, ...actions);
  return item;
}

function actionButton(label: string, text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

function renderLists(): void {
  const mine = customConditions();
  byId('cond-custom-list').replaceChildren(
    ...mine.map((condition) =>
      row(condition, [
        actionButton(`Edit ${condition.name}`, 'Edit', () => startEditing(condition)),
        actionButton(`Delete ${condition.name}`, 'Delete', () => remove(condition)),
      ]),
    ),
  );
  byId('cond-custom-empty').hidden = mine.length > 0;
  byId('cond-default-list').replaceChildren(...DEFAULT_CONDITIONS.map((condition) => row(condition)));
}

// ── The form ───────────────────────────────────────────────────
function updatePreview(): void {
  const text = nameInput.value.trim();
  byId('cond-preview-badge').replaceChildren(conditionBadge({ id: 'preview', name: text, color, icon }, 26));
  byId('cond-preview-name').textContent = text || 'Condition';
}

function pickColor(hex: string): void {
  color = hex.toLowerCase();
  for (const button of colorsBox.querySelectorAll<HTMLButtonElement>('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.color === color));
  }
  const custom = colorsBox.querySelector<HTMLElement>('.token-swatch-custom');
  custom?.classList.toggle('selected', !COLORS.includes(color));
  const input = colorsBox.querySelector<HTMLInputElement>('input[type="color"]');
  if (input && input.value !== color) input.value = color;
  updatePreview();
}

function pickIcon(name: string): void {
  icon = name;
  for (const button of iconsBox.querySelectorAll<HTMLButtonElement>('button')) {
    const on = button.dataset.icon === name;
    button.setAttribute('aria-checked', String(on));
    button.tabIndex = on ? 0 : -1; // one stop for the group; the arrow keys move within it
  }
  updatePreview();
}

function buildPickers(): void {
  const swatches = COLORS.map((hex) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'token-swatch';
    swatch.style.background = hex;
    swatch.dataset.color = hex;
    swatch.setAttribute('aria-label', `Color ${hex}`);
    swatch.setAttribute('aria-pressed', 'false');
    swatch.addEventListener('click', () => pickColor(hex));
    return swatch;
  });
  const any = document.createElement('label');
  any.className = 'token-swatch token-swatch-custom';
  any.title = 'Any color';
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', 'Any color');
  input.value = COLORS[0];
  input.addEventListener('input', () => pickColor(input.value));
  any.append(input);
  colorsBox.replaceChildren(...swatches, any);

  iconsBox.replaceChildren(
    ...ICON_NAMES.map((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-choice';
      button.dataset.icon = name;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', name.replace(/-/g, ' '));
      button.title = name.replace(/-/g, ' ');
      button.append(iconGlyph(name, 20));
      button.addEventListener('click', () => pickIcon(name));
      return button;
    }),
  );
}

// The arrow keys move between icons, as in any group of radio buttons.
iconsBox.addEventListener('keydown', (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const at = ICON_NAMES.indexOf(icon);
  const next = ICON_NAMES[(at + step + ICON_NAMES.length) % ICON_NAMES.length];
  pickIcon(next);
  iconsBox.querySelector<HTMLButtonElement>(`[data-icon="${next}"]`)?.focus();
});

function resetForm(): void {
  editingId = null;
  nameInput.value = '';
  problem.textContent = '';
  byId('cond-form-title').textContent = 'Add a condition';
  saveButton.textContent = 'Add condition';
  cancelButton.hidden = true;
  form.dataset.editing = 'false';
  pickColor(COLORS[0]);
  pickIcon(FIRST_ICON);
}

function startEditing(condition: Condition): void {
  editingId = condition.id;
  nameInput.value = condition.name;
  problem.textContent = '';
  byId('cond-form-title').textContent = 'Edit condition';
  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;
  form.dataset.editing = 'true';
  pickColor(condition.color);
  pickIcon(condition.icon);
  form.scrollIntoView({ block: 'nearest' });
  nameInput.focus();
  nameInput.select();
}

function remove(condition: Condition): void {
  removeCustom(condition.id);
  if (editingId === condition.id) resetForm();
  renderLists();
  showToast('Removed. Tokens that already have it keep it.');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const draft = { name: nameInput.value, color, icon };
  const why = draftProblem(draft, editingId ?? undefined);
  problem.textContent = why ?? '';
  if (why) {
    nameInput.focus();
    return;
  }
  if (editingId) {
    const updated = updateCustom(editingId, draft);
    if (updated) refreshCondition(updated); // the tokens that have it show the change
  } else {
    addCustom(draft);
  }
  renderLists();
  resetForm();
});

cancelButton.addEventListener('click', resetForm);
nameInput.addEventListener('input', () => {
  problem.textContent = '';
  updatePreview();
});

buildPickers();
renderLists();
resetForm();
