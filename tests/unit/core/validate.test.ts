import { describe, expect, it } from 'vitest';
import { parseElements, parseSnapshot } from '../../../src/core/validate';

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

describe('parseSnapshot', () => {
  const room = { type: 'rect', x: 0, y: 0, w: 80, h: 40 };

  it('reads the current format: the elements and the map name', () => {
    expect(parseSnapshot({ name: 'The Sunken Crypt', elements: [room] })).toEqual({
      name: 'The Sunken Crypt',
      elements: [room],
    });
  });

  it('is null for a bare list of elements (not a message)', () => {
    expect(parseSnapshot([room])).toBeNull();
  });

  it('keeps an empty name, which means the map is unnamed', () => {
    expect(parseSnapshot({ name: '', elements: [] })).toEqual({ name: '', elements: [] });
  });

  it('tidies the name the same way the editor does', () => {
    expect(parseSnapshot({ name: '  A   B  ', elements: [] })).toEqual({ name: 'A B', elements: [] });
    expect(parseSnapshot({ name: 'x'.repeat(100), elements: [] })?.name).toHaveLength(60);
  });

  it('ignores a name that is not text but still applies the elements', () => {
    for (const name of [42, null, {}, [], true]) {
      expect(parseSnapshot({ name, elements: [room] })).toEqual({ elements: [room] });
    }
  });

  it('drops invalid elements', () => {
    const bad = { type: 'hologram', x: 0, y: 0 };
    expect(parseSnapshot({ name: 'A', elements: [room, bad] })).toEqual({ name: 'A', elements: [room] });
  });

  it('is null when there is no usable list of elements', () => {
    for (const data of [null, undefined, 42, 'text', {}, { name: 'A' }, { name: 'A', elements: 'no' }]) {
      expect(parseSnapshot(data)).toBeNull();
    }
  });
});

describe("a token's conditions", () => {
  const prone = { id: 'prone', name: 'Prone', color: '#6d4fc7', icon: 'arrow-down' };
  const hexed = { id: 'custom-1', name: 'Hexed', color: '#a1b2c3', icon: 'moon' };
  const token = (conditions: unknown) => ({ type: 'token', x: 20, y: 20, name: 'Bob', conditions });

  it('are kept, as whole objects', () => {
    expect(parseElements([token([prone, hexed])])).toEqual([token([prone, hexed])]);
  });

  it('are left off a token that has none, and an empty list is no list', () => {
    expect(parseElements([{ type: 'token', x: 1, y: 1 }])).toEqual([{ type: 'token', x: 1, y: 1 }]);
    const [t] = parseElements([token([])]) ?? [];
    expect(t).toEqual({ type: 'token', x: 20, y: 20, name: 'Bob' });
    expect('conditions' in (t as object)).toBe(false);
  });

  it('are cleaned, not the whole token dropped, when some are not valid', () => {
    const bad = [
      { id: 'x', name: 'No icon', color: '#000000', icon: 'nope' },
      prone,
      'prone',
      null,
      { hexed: 1 },
    ];
    expect(parseElements([token(bad)])).toEqual([token([prone])]);
  });

  it('are removed, and the token kept, when they are not a list at all', () => {
    for (const junk of ['prone', 5, {}, true, null]) {
      const [t] = parseElements([token(junk)]) ?? [];
      expect(t, JSON.stringify(junk)).toEqual({ type: 'token', x: 20, y: 20, name: 'Bob' });
    }
  });

  it('drop a colour that is not a plain #rrggbb, which would end up in drawing code', () => {
    const evil = { ...hexed, color: 'url(javascript:alert(1))' };
    expect(parseElements([token([evil, prone])])).toEqual([token([prone])]);
  });

  it("are cleaned for a collaborator's message too", () => {
    const dirty = [token([prone, { nope: 1 }])];
    expect(parseSnapshot({ name: 'Map', elements: dirty })?.elements).toEqual([token([prone])]);
  });

  it('are limited to what a token can carry', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...hexed, id: `custom-${i}` }));
    const [t] = parseElements([token(many)]) ?? [];
    expect((t as { conditions: unknown[] }).conditions).toHaveLength(12);
  });
});

describe('token images', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  const withImage = (image: unknown) => ({ type: 'token', x: 0, y: 0, image });
  const imageOf = (image: unknown) => (parseElements([withImage(image)]) as { image?: string }[])[0].image;

  it('keeps a small raster picture', () => {
    expect(imageOf(PNG)).toBe(PNG);
    expect(imageOf('data:image/webp;base64,AAAA')).toBeDefined();
  });

  it('removes anything else, but keeps the token', () => {
    const bad = [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'https://example.com/a.png',
      'javascript:alert(1)',
      `data:image/png;base64,${'A'.repeat(100_000)}`,
      42,
    ];
    for (const image of bad) {
      expect(parseElements([withImage(image)])).toHaveLength(1);
      expect(imageOf(image)).toBeUndefined();
    }
  });
});
