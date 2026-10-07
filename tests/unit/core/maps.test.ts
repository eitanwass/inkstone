import { describe, expect, it } from 'vitest';
import {
  byRecent,
  filterMaps,
  isBlankMap,
  MAX_MAPS,
  newMapId,
  parseIndex,
  whenParked,
  withEntry,
  withoutEntry,
} from '../../../src/core/maps';
import type { BoardElement } from '../../../src/core/types';

const THUMB = 'data:image/jpeg;base64,/9j/4AAQ';
const room: BoardElement = {
  type: 'rect',
  x: 0,
  y: 0,
  w: 40,
  h: 40,
  strokeColor: '#000',
  strokeWidth: 2,
} as never;

describe('newMapId', () => {
  it('makes ids the index accepts, and different ones', () => {
    const a = newMapId();
    const b = newMapId();
    expect(a).not.toBe(b);
    expect(parseIndex({ current: a, maps: [] })).not.toBeNull();
  });
});

describe('isBlankMap', () => {
  it('is blank with no name and nothing on it', () => {
    expect(isBlankMap('', [])).toBe(true);
    expect(isBlankMap('  ', [])).toBe(true);
  });
  it('is not blank with a name or an element', () => {
    expect(isBlankMap('Crypt', [])).toBe(false);
    expect(isBlankMap('', [room])).toBe(false);
  });
});

describe('parseIndex', () => {
  it('reads a good index', () => {
    const index = parseIndex({
      current: 'm-1',
      maps: [{ id: 'm-2', name: 'The Crypt', updated: 5, thumbnail: THUMB }],
    });
    expect(index).toEqual({
      current: 'm-1',
      maps: [{ id: 'm-2', name: 'The Crypt', updated: 5, thumbnail: THUMB }],
    });
  });
  it('is null for anything that is not one', () => {
    expect(parseIndex(null)).toBeNull();
    expect(parseIndex('x')).toBeNull();
    expect(parseIndex({ maps: [] })).toBeNull();
    expect(parseIndex({ current: 'm-1' })).toBeNull();
    expect(parseIndex({ current: '../evil', maps: [] })).toBeNull();
  });
  it('drops bad, duplicate and current-id entries, and keeps the rest', () => {
    const index = parseIndex({
      current: 'm-1',
      maps: [
        { id: 'm-1', name: 'same as the working copy', updated: 1 },
        { id: 'm-2', name: 'Keep', updated: 2 },
        { id: 'm-2', name: 'Twice', updated: 3 },
        { id: 'a/b', name: 'Bad id', updated: 4 },
        { name: 'No id' },
        7,
      ],
    });
    expect(index?.maps.map((m) => m.name)).toEqual(['Keep']);
  });
  it('tidies a name and drops a thumbnail that is not a small jpeg', () => {
    const index = parseIndex({
      current: 'm-1',
      maps: [
        { id: 'm-2', name: '  a\u0000  b ', updated: 1, thumbnail: 'https://elsewhere/x.jpg' },
        { id: 'm-3', name: 'Big', updated: 1, thumbnail: `data:image/jpeg;base64,${'A'.repeat(90_000)}` },
      ],
    });
    expect(index?.maps[0].name).toBe('a b');
    expect(index?.maps[0].thumbnail).toBeUndefined();
    expect(index?.maps[1].thumbnail).toBeUndefined();
  });
  it('keeps at most MAX_MAPS', () => {
    const maps = Array.from({ length: MAX_MAPS + 20 }, (_, i) => ({
      id: `m-${i + 10}`,
      name: 'x',
      updated: i,
    }));
    expect(parseIndex({ current: 'm-1', maps })?.maps).toHaveLength(MAX_MAPS);
  });
});

describe('listing', () => {
  const maps = [
    { id: 'm-a', name: 'Old', updated: 1 },
    { id: 'm-b', name: 'New', updated: 9 },
    { id: 'm-c', name: '', updated: 5 },
  ];
  it('puts the most recently parked first', () => {
    expect(byRecent(maps).map((m) => m.id)).toEqual(['m-b', 'm-c', 'm-a']);
  });
  it('filters by every word of the name, ignoring capitals, and finds Untitled ones by that', () => {
    expect(filterMaps(maps, 'ne').map((m) => m.id)).toEqual(['m-b']);
    expect(filterMaps(maps, 'UNTITLED').map((m) => m.id)).toEqual(['m-c']);
    expect(filterMaps(maps, '  ')).toHaveLength(3);
    expect(filterMaps(maps, 'old new')).toHaveLength(0);
  });
});

describe('whenParked', () => {
  const now = Date.UTC(2026, 9, 7, 12, 0, 0);
  const ago = (ms: number) => whenParked(now - ms, now);
  const MIN = 60_000;
  it('says it in words, singular or plural', () => {
    expect(ago(10_000)).toBe('just now');
    expect(ago(MIN)).toBe('1 minute ago');
    expect(ago(5 * MIN)).toBe('5 minutes ago');
    expect(ago(60 * MIN)).toBe('1 hour ago');
    expect(ago(3 * 60 * MIN)).toBe('3 hours ago');
    expect(ago(24 * 60 * MIN)).toBe('yesterday');
    expect(ago(5 * 24 * 60 * MIN)).toBe('5 days ago');
  });
  it('gives a date once it is a month old', () => {
    expect(ago(40 * 24 * 60 * MIN)).toBe('on 2026-08-28');
  });
});

describe('withEntry and withoutEntry', () => {
  const index = { current: 'm-1', maps: [{ id: 'm-2', name: 'A', updated: 1 }] };
  it('adds an entry, or replaces the one with its id', () => {
    expect(withEntry(index, { id: 'm-3', name: 'B', updated: 2 }).maps).toHaveLength(2);
    const replaced = withEntry(index, { id: 'm-2', name: 'A2', updated: 3 });
    expect(replaced.maps).toEqual([{ id: 'm-2', name: 'A2', updated: 3 }]);
  });
  it('removes an entry and leaves the rest alone', () => {
    expect(withoutEntry(index, 'm-2').maps).toEqual([]);
    expect(withoutEntry(index, 'nope')).toEqual(index);
  });
});
