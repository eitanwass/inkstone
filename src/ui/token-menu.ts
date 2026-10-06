// ── The token menu ────────────────────────────────────────────
// Rename, recolor, duplicate, lock, delete and the Conditions submenu. It is for the one token it
// was opened on, whatever else is selected (rename and recolor don't make sense for several).

import { conditionBadge } from '../conditions/icon';
import { allConditions } from '../conditions/library';
import { hasCondition, toggleCondition } from '../conditions/tokens';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { pushHistory, showUndoToast } from '../input/history';
import { lockElements } from '../input/layers';
import { duplicateSelected } from '../input/selection';
import { onMenusHidden, placeMenu, showLockState } from './menu-kit';
import { showConfirm } from './modal';
import { chooseTokenColor, nameToken } from './token-card';

let target: number | null = null; // the token the open menu is for
let targetLocked = false;

function tokenAt(idx: number | null): TokenElement | null {
  const el = idx === null ? undefined : state.elements[idx];
  return el?.type === 'token' ? el : null;
}

export function showTokenContextMenu(cx: number, cy: number, idx: number, locked: boolean): void {
  const menu = byId('token-context-menu');
  // A token with no name is offered one; a named token a new name.
  byId('ctx-token-rename').textContent = tokenAt(idx)?.name ? '✏ Rename' : '✏ Add name';
  showLockState(menu, byId('ctx-token-lock'), locked);
  placeMenu(menu, cx, cy);
  target = idx;
  targetLocked = locked;
}

byId('ctx-token-lock').addEventListener('click', () => {
  if (target !== null) lockElements([target], !targetLocked);
});

byId('ctx-token-delete').addEventListener('click', () => {
  const idx = target;
  const token = tokenAt(idx);
  if (idx === null || !token) return;

  showConfirm(token.name ? `Remove token "${token.name}"?` : 'Remove this token?', () => {
    state.elements.splice(idx, 1);
    state.selected = [];
    drawMain();
    pushHistory();
    showUndoToast('Token removed');
  });
});

// Names the token in its card, over the map, rather than in a dialog.
byId('ctx-token-rename').addEventListener('click', () => {
  if (target !== null) nameToken(target);
});

// The colours are in the token's card, so this selects the token and moves to them.
byId('ctx-token-color').addEventListener('click', () => {
  if (target !== null) chooseTokenColor(target);
});

// A copy of just this token (numbered on if its name ends in a number), whatever else is selected.
byId('ctx-token-duplicate').addEventListener('click', () => {
  if (target === null || !tokenAt(target)) return;
  state.selected = [target];
  duplicateSelected();
});

// ── The Conditions submenu ────────────────────────────────────
// Every condition, ticked if the token has it. A click switches it and the menu stays open, so
// several can be switched in one visit; a click anywhere else closes it with the rest.
const conditionsMenu = byId('token-conditions-menu');
const conditionsRow = byId('ctx-token-conditions');

function closeConditionsMenu(): void {
  conditionsMenu.classList.add('hidden');
  conditionsRow.classList.remove('open');
}
onMenusHidden(closeConditionsMenu);

function markConditionsMenu(): void {
  const token = tokenAt(target);
  for (const item of conditionsMenu.querySelectorAll<HTMLElement>('.ctx-cond')) {
    item.setAttribute('aria-checked', String(!!token && hasCondition(token, item.dataset.id ?? '')));
  }
}

function openConditionsMenu(): void {
  if (!tokenAt(target)) return;
  conditionsMenu.replaceChildren(
    ...allConditions().map((condition) => {
      const item = document.createElement('div');
      item.className = 'ctx-item ctx-cond';
      item.setAttribute('role', 'menuitemcheckbox');
      item.dataset.id = condition.id;
      const name = document.createElement('span');
      name.className = 'ctx-name';
      name.textContent = condition.name;
      const tick = document.createElement('span');
      tick.className = 'ctx-tick';
      tick.textContent = '✓';
      tick.setAttribute('aria-hidden', 'true');
      item.append(conditionBadge(condition, 18), name, tick);
      item.addEventListener('click', (e) => {
        e.stopPropagation(); // the menu stays open
        const token = tokenAt(target);
        if (token) toggleCondition(token, condition);
        markConditionsMenu();
      });
      return item;
    }),
  );
  markConditionsMenu();

  // Beside the "Conditions" row, on the left instead if there is no room on the right.
  const row = conditionsRow.getBoundingClientRect();
  conditionsMenu.classList.remove('hidden');
  const { offsetWidth: width, offsetHeight: height } = conditionsMenu;
  const left = row.right + 2 + width > window.innerWidth - 8 ? row.left - width - 2 : row.right + 2;
  conditionsMenu.style.left = `${Math.max(8, left)}px`;
  conditionsMenu.style.top = `${Math.max(8, Math.min(row.top, window.innerHeight - height - 8))}px`;
  conditionsRow.classList.add('open');
}

conditionsRow.addEventListener('click', (e) => {
  e.stopPropagation(); // choosing this row must not close the menu it is in
  if (conditionsMenu.classList.contains('hidden')) openConditionsMenu();
  else closeConditionsMenu();
});
conditionsRow.addEventListener('mouseenter', openConditionsMenu);
