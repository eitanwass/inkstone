// ── What every right-click menu shares ────────────────────────
// Placing a menu on screen, fading it for a locked element, and closing them all. The menus
// themselves are in context-menu.ts (elements), token-menu.ts and canvas-menu.ts.

import { byId } from '../core/dom';

const MENU_IDS = ['context-menu', 'token-context-menu', 'canvas-context-menu'];
const onHidden: (() => void)[] = [];

// Something that belongs to a menu (a submenu) asks to be told when they are all closed.
export function onMenusHidden(fn: () => void): void {
  onHidden.push(fn);
}

export function hideContextMenus(): void {
  for (const id of MENU_IDS) byId(id).classList.add('hidden');
  for (const fn of onHidden) fn();
}

// Phone screens are small enough that a menu opened near an edge (very plausible — a long-press
// works anywhere on the map, not just the roomy center of a desktop window) can otherwise render
// partly off-screen with no way to reach its lower items.
export function placeMenu(menu: HTMLElement, cx: number, cy: number): void {
  menu.style.left = `${cx}px`;
  menu.style.top = `${cy}px`;
  menu.classList.remove('hidden');
  const { offsetWidth: w, offsetHeight: h } = menu;
  const maxLeft = window.innerWidth - w - 8;
  const maxTop = window.innerHeight - h - 8;
  if (cx > maxLeft) menu.style.left = `${Math.max(8, maxLeft)}px`;
  if (cy > maxTop) menu.style.top = `${Math.max(8, maxTop)}px`;
}

// Fades out every item of a menu but the lock row (which becomes Unlock) when it is for a locked
// element, and gives them all back otherwise.
export function showLockState(menu: HTMLElement, lockRow: HTMLElement, locked: boolean): void {
  for (const item of menu.querySelectorAll<HTMLElement>('.ctx-item')) {
    const off = locked && item !== lockRow;
    item.classList.toggle('disabled', off);
    item.setAttribute('aria-disabled', String(off));
  }
  lockRow.querySelector('use')?.setAttribute('href', `/icons.svg#icon-${locked ? 'unlock' : 'lock'}`);
  const text = lockRow.querySelector('.ctx-text');
  if (text) text.textContent = locked ? 'Unlock' : 'Lock';
}
