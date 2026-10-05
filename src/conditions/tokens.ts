// ── Putting conditions on tokens, and taking them off ──────────
// Shared by the token card's picker and the token's right-click menu. A token holds its own copy
// of each condition (name, color, icon), so these just add and remove copies; every change is one
// undo step and goes to a live session like any other edit.

import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { pushHistory } from '../input/history';
import { showToast } from '../ui/toast';
import { type Condition, MAX_PER_TOKEN } from './index';

export const hasCondition = (token: TokenElement, id: string): boolean =>
  !!token.conditions?.some((c) => c.id === id);

// Puts the condition on the token, or takes it off if it is already there.
export function toggleCondition(token: TokenElement, condition: Condition): void {
  const have = token.conditions ?? [];
  if (hasCondition(token, condition.id)) {
    const rest = have.filter((c) => c.id !== condition.id);
    if (rest.length) token.conditions = rest;
    else delete token.conditions; // a token with none carries no list at all
  } else if (have.length >= MAX_PER_TOKEN) {
    showToast(`A token can have up to ${MAX_PER_TOKEN} conditions`);
    return;
  } else {
    token.conditions = [...have, { ...condition }];
  }
  drawMain();
  pushHistory();
}

// A custom condition was changed in Settings: bring the copies on tokens up to date. One undo step
// if any token changed. Returns how many tokens were updated.
export function refreshCondition(updated: Condition): number {
  let changed = 0;
  for (const el of state.elements) {
    if (el.type !== 'token' || !el.conditions) continue;
    const index = el.conditions.findIndex((c) => c.id === updated.id);
    if (index < 0) continue;
    const old = el.conditions[index];
    if (old.name === updated.name && old.color === updated.color && old.icon === updated.icon) continue;
    el.conditions = el.conditions.map((c, i) => (i === index ? { ...updated } : c));
    changed++;
  }
  if (changed) {
    drawMain();
    pushHistory();
  }
  return changed;
}
