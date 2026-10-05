import { describe, expect, it } from 'vitest';
import { parseMapFile, serializeMap } from '../../../src/core/map-file';
import type { BoardElement } from '../../../src/core/types';

const wall = { type: 'wall', id: 'a', x1: 0, y1: 0, x2: 40, y2: 0, color: '#000', width: 2 };
const map = {
  name: 'Crypt',
  elements: [wall] as unknown as BoardElement[],
  images: { x: 'data:image/png;base64,AA' },
};

describe('map file', () => {
  it('round-trips a map', () => {
    expect(parseMapFile(serializeMap(map))).toEqual(map);
  });

  it('rejects things that are not map files', () => {
    for (const text of ['', 'nope', '[]', '{}', '{"format":"other","version":1,"elements":[]}']) {
      expect(parseMapFile(text)).toBeNull();
    }
  });

  it('rejects a newer version and missing elements', () => {
    expect(parseMapFile('{"format":"inkstone-map","version":99,"elements":[]}')).toBeNull();
    expect(parseMapFile('{"format":"inkstone-map","version":1}')).toBeNull();
  });

  it('drops bad elements but keeps the rest', () => {
    const text = JSON.stringify({ format: 'inkstone-map', version: 1, elements: [wall, { type: 'bogus' }] });
    expect(parseMapFile(text)?.elements).toHaveLength(1);
  });
});
