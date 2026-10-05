// ── Changes between two versions of the map ─────────────────────
// What goes over the wire (and what the relay keeps) is not the whole map but the difference
// between what the room has and what this client has now. Every element has a stable `id`, which is
// what lets two clients' edits to different elements both survive.
//
// A change is one of:
//   set    an element, added or replaced (new ids go to the end)
//   del    an element's id, removed
//   order  every id, front to back; only sent when the order is not what adding and removing
//          would give anyway
//   name   the map's name
// Applied in that order, they turn the old map into the new one.
//
// Pure (no DOM), so it is unit tested; the relay (party/server.js) applies the same changes to its
// own copy and keeps its own copy of ID_RE and the rest, since it can't import this file.

import type { BoardElement } from '../core/types';

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type Change =
  | { t: 'set'; el: BoardElement }
  | { t: 'del'; id: string }
  | { t: 'order'; ids: string[] }
  | { t: 'name'; name: string };

const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 12);

// Gives an id to every element that has none, or one the relay would refuse, or one another element
// already has (a duplicate or a paste is a copy, so it arrives carrying its original's id).
export function ensureIds(elements: BoardElement[]): void {
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el.id || !ID_RE.test(el.id) || seen.has(el.id)) el.id = newId();
    seen.add(el.id);
  }
}

const sameElement = (a: BoardElement, b: BoardElement) => JSON.stringify(a) === JSON.stringify(b);

// What turns prev (with its name) into next. Both must have ids (see ensureIds).
export function diff(
  prev: BoardElement[],
  next: BoardElement[],
  prevName: string,
  nextName: string,
): Change[] {
  const before = new Map(prev.map((el) => [el.id as string, el]));
  const nextIds = next.map((el) => el.id as string);
  const nextSet = new Set(nextIds);
  const changes: Change[] = [];

  for (const el of next) {
    const old = before.get(el.id as string);
    if (!old || !sameElement(old, el)) changes.push({ t: 'set', el });
  }
  for (const el of prev) if (!nextSet.has(el.id as string)) changes.push({ t: 'del', id: el.id as string });

  // What the receiver will have without being told: what was kept, in its old order, then what is new.
  const expected = [
    ...prev.filter((el) => nextSet.has(el.id as string)).map((el) => el.id as string),
    ...nextIds.filter((id) => !before.has(id)),
  ];
  if (expected.some((id, i) => id !== nextIds[i])) changes.push({ t: 'order', ids: nextIds });

  if (prevName !== nextName) changes.push({ t: 'name', name: nextName });
  return changes;
}

// The elements after the changes (the name ones are for the caller). A new array; the elements in
// `changes` are used as they are, so give a copy where the result must not share them.
export function applyChanges(elements: BoardElement[], changes: Change[]): BoardElement[] {
  const byId = new Map(elements.map((el) => [el.id as string, el]));
  for (const c of changes) if (c.t === 'set') byId.set(c.el.id as string, c.el); // keeps an old one's place
  for (const c of changes) if (c.t === 'del') byId.delete(c.id);
  const order = [...changes].reverse().find((c) => c.t === 'order');
  if (order?.t !== 'order') return [...byId.values()];
  const sorted = order.ids.flatMap((id) => byId.get(id) ?? []);
  const named = new Set(order.ids);
  return [...sorted, ...[...byId].filter(([id]) => !named.has(id)).map(([, el]) => el)];
}
