import { describe, expect, it } from 'vitest';
import { applyChanges, diff, ensureIds } from '../../../src/collab/changes';
import type { BoardElement } from '../../../src/core/types';

const room = (id: string, x = 0): BoardElement => ({ type: 'rect', id, x, y: 0, w: 40, h: 40 });
const ids = (els: BoardElement[]) => els.map((e) => e.id);

describe('ensureIds', () => {
  it('names an element that has no id, and leaves the others alone', () => {
    const els: BoardElement[] = [room('a'), { type: 'rect', x: 0, y: 0, w: 1, h: 1 }];
    ensureIds(els);
    expect(els[0].id).toBe('a');
    expect(els[1].id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('gives a copy (a duplicate or a paste) an id of its own', () => {
    const els = [room('a'), room('a')];
    ensureIds(els);
    expect(els[0].id).toBe('a');
    expect(els[1].id).not.toBe('a');
  });

  it('replaces an id the relay would refuse', () => {
    const els = [room('has spaces!')];
    ensureIds(els);
    expect(els[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('diff', () => {
  it('is nothing when nothing changed', () => {
    expect(diff([room('a'), room('b')], [room('a'), room('b')], 'N', 'N')).toEqual([]);
  });

  it('sends only the element that changed', () => {
    expect(diff([room('a'), room('b')], [room('a', 40), room('b')], '', '')).toEqual([
      { t: 'set', el: room('a', 40) },
    ]);
  });

  it('sends a new element with no order, since new ones go last anyway', () => {
    expect(diff([room('a')], [room('a'), room('b')], '', '')).toEqual([{ t: 'set', el: room('b') }]);
  });

  it('sends a deletion with no order', () => {
    expect(diff([room('a'), room('b'), room('c')], [room('a'), room('c')], '', '')).toEqual([
      { t: 'del', id: 'b' },
    ]);
  });

  it('sends the order when it was changed', () => {
    expect(diff([room('a'), room('b')], [room('b'), room('a')], '', '')).toEqual([
      { t: 'order', ids: ['b', 'a'] },
    ]);
  });

  it('sends a new element put somewhere other than the end with the order', () => {
    const changes = diff([room('a'), room('b')], [room('c'), room('a'), room('b')], '', '');
    expect(changes).toContainEqual({ t: 'order', ids: ['c', 'a', 'b'] });
  });

  it('sends a rename as the name alone, never the map', () => {
    expect(diff([room('a')], [room('a')], 'Old', 'New')).toEqual([{ t: 'name', name: 'New' }]);
  });
});

describe('applyChanges', () => {
  const cases: [string, BoardElement[], BoardElement[]][] = [
    ['an edit', [room('a'), room('b')], [room('a'), room('b', 80)]],
    ['an addition', [room('a')], [room('a'), room('b')]],
    ['a deletion', [room('a'), room('b'), room('c')], [room('a'), room('c')]],
    ['a reorder', [room('a'), room('b'), room('c')], [room('c'), room('a'), room('b')]],
    ['everything at once', [room('a'), room('b'), room('c')], [room('d'), room('c', 40), room('a')]],
    ['clearing the map', [room('a'), room('b')], []],
    ['filling an empty map', [], [room('a'), room('b')]],
  ];
  for (const [name, before, after] of cases) {
    it(`turns the old map into the new one: ${name}`, () => {
      expect(applyChanges(before, diff(before, after, '', ''))).toEqual(after);
    });
  }

  it("keeps someone else's edit to another element when applying yours", () => {
    const start = [room('a'), room('b')];
    const mine = diff(start, [room('a', 40), room('b')], '', '');
    const theirsAlready = [room('a'), room('b', 80)]; // what the room holds after a peer moved b
    expect(applyChanges(theirsAlready, mine)).toEqual([room('a', 40), room('b', 80)]);
  });

  it('does not change the list it was given', () => {
    const before = [room('a')];
    applyChanges(before, [{ t: 'del', id: 'a' }]);
    expect(ids(before)).toEqual(['a']);
  });

  it('ignores an order that mentions an element that is gone, and keeps one it forgot', () => {
    const result = applyChanges([room('a'), room('b'), room('c')], [{ t: 'order', ids: ['c', 'zzz', 'a'] }]);
    expect(ids(result)).toEqual(['c', 'a', 'b']);
  });
});
