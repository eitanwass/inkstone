// ── The token card's conditions ────────────────────────────────
// What the token is under, as pills with a remove button, and a picker of every condition there is
// (the default ones and the player's own) to switch on and off. Each switch is one undo step.

import { conditionBadge } from '../conditions/icon';
import { allConditions } from '../conditions/library';
import { hasCondition, toggleCondition } from '../conditions/tokens';
import { byId } from '../core/dom';
import type { TokenElement } from '../core/types';
import { cardToken } from './token-target';

const card = byId('token-card');
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

// The picker makes the card taller or shorter: the card asks to be told so it can be placed again.
let relayout: (token: TokenElement) => void = () => {};
export function onConditionsResize(fn: (token: TokenElement) => void): void {
  relayout = fn;
}

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
    relayout(token); // the card is taller now
  }
  filterField.focus();
}

export function closePicker(): void {
  if (!pickerOpen) return;
  pickerOpen = false;
  picker.hidden = true;
  addButton.setAttribute('aria-expanded', 'false');
  addButton.textContent = '+ Add';
  const token = cardToken();
  if (token && !card.classList.contains('hidden')) relayout(token); // and shorter again
}

// The card has no token any more: the next one starts with the picker shut.
export function forgetConditionsToken(): void {
  closePicker();
  pickerFor = null;
}

export function showConditions(token: TokenElement): void {
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
