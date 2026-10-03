import { describe, expect, it } from 'vitest';
import { parseElements } from '../../src/validate';

describe('parseElements', () => {
  it('returns null for anything that is not a list', () => {
    for (const bad of [null, undefined, 42, 'text', {}, { type: 'rect' }]) {
      expect(parseElements(bad)).toBeNull();
    }
  });

  it('accepts a valid element of each type', () => {
    const valid = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: 80,
        h: 40,
        rotation: 0.5,
        strokeColor: '#fff',
        fillColor: '#000',
        strokeWidth: 4,
      },
      { type: 'wall', x1: 0, y1: 0, x2: 40, y2: 0, strokeColor: '#fff', strokeWidth: 4 },
      { type: 'token', x: 20, y: 20, radius: 20, name: 'Bob', color: '#e05c5c' },
      { type: 'label', x: 0, y: 0, text: 'Tavern', fontSize: 14, strokeColor: '#fff' },
    ];
    expect(parseElements(valid)).toEqual(valid);
  });

  it('accepts tokens saved before they had a radius or name', () => {
    expect(parseElements([{ type: 'token', x: 1, y: 2 }])).toHaveLength(1);
  });

  it('keeps the valid elements and drops the rest', () => {
    const result = parseElements([
      { type: 'rect', x: 0, y: 0, w: 80, h: 40 },
      { type: 'rect', x: 'oops', y: 0, w: 80, h: 40 },
      { type: 'wall', x1: 0, y1: 0, x2: 40 },
      { type: 'hologram', x: 0, y: 0 },
      { type: 'token', x: 40, y: 40, name: 'Bob' },
      null,
      'not an element',
      [],
    ]);
    expect(result?.map((e) => e.type)).toEqual(['rect', 'token']);
  });

  it('rejects missing or wrongly typed required fields', () => {
    expect(parseElements([{ type: 'label', x: 0, y: 0 }])).toEqual([]); // no text
    expect(parseElements([{ type: 'label', x: 0, y: 0, text: 5 }])).toEqual([]);
    expect(parseElements([{ x: 0, y: 0, w: 1, h: 1 }])).toEqual([]); // no type
  });

  it('rejects wrongly typed optional fields', () => {
    expect(parseElements([{ type: 'rect', x: 0, y: 0, w: 1, h: 1, rotation: '90' }])).toEqual([]);
    expect(parseElements([{ type: 'token', x: 0, y: 0, name: 7 }])).toEqual([]);
    expect(parseElements([{ type: 'wall', x1: 0, y1: 0, x2: 1, y2: 1, strokeWidth: 'thick' }])).toEqual([]);
    expect(parseElements([{ type: 'rect', x: 0, y: 0, w: 1, h: 1, strokeColor: 5 }])).toEqual([]);
  });

  it('rejects non-finite numbers', () => {
    for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(parseElements([{ type: 'rect', x: 0, y: 0, w: n, h: 1 }])).toEqual([]);
    }
  });

  it('does not treat inherited object keys as element types', () => {
    for (const type of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(parseElements([{ type, x: 0, y: 0 }])).toEqual([]);
    }
  });

  it('returns an empty list for an empty list', () => {
    expect(parseElements([])).toEqual([]);
  });
});
