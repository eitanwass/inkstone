// ── Reading a token's conditions by hovering it ────────────────
// A list beside the pointer with each condition's badge and name, so someone who doesn't know the
// icons still gets the word. Not for the token whose card is open (it already lists them there).

import { conditionBadge } from '../conditions/icon';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { Point, TokenElement } from '../core/types';
import { hitTest } from '../elements';
import { cardToken } from './token-target';

const tip = byId('token-tip');
let tipFor: TokenElement | null = null;

export function hideConditionsTip(): void {
  tip.classList.add('hidden');
  tipFor = null;
}

// Called as the pointer moves over the map, with where it is in the world and on the screen.
export function updateConditionsTip(world: Point, clientX: number, clientY: number): void {
  const index = hitTest(world.x, world.y);
  const hovered = index === null ? undefined : state.elements[index];
  if (hovered?.type !== 'token' || !hovered.conditions?.length || hovered === cardToken()) {
    hideConditionsTip();
    return;
  }
  if (tipFor !== hovered) {
    tipFor = hovered;
    tip.replaceChildren(
      ...hovered.conditions.map((condition) => {
        const line = document.createElement('div');
        const name = document.createElement('span');
        name.textContent = condition.name;
        line.append(conditionBadge(condition, 18), name);
        return line;
      }),
    );
  }
  tip.classList.remove('hidden');
  const left = Math.min(clientX + 16, window.innerWidth - tip.offsetWidth - 8);
  const top = Math.min(clientY + 16, window.innerHeight - tip.offsetHeight - 8);
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}
