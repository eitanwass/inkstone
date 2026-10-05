import { describe, expect, it } from 'vitest';
import { ID_RE } from '../../../src/core/ids';
import { hashImage, isImageData } from '../../../src/core/image-data';

describe('isImageData', () => {
  it('accepts a small raster picture', () => {
    for (const type of ['png', 'jpeg', 'webp']) {
      expect(isImageData(`data:image/${type};base64,iVBORw0KGgo=`)).toBe(true);
    }
  });

  it('refuses anything else', () => {
    const bad = [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', // can carry script
      'data:image/gif;base64,R0lGODlh',
      'data:image/png;base64,',
      'data:image/png,notbase64',
      'https://example.com/a.png',
      'javascript:alert(1)',
      `data:image/png;base64,${'A'.repeat(800_000)}`, // too big
      '',
      42,
      null,
    ];
    for (const value of bad) expect(isImageData(value), String(value).slice(0, 40)).toBe(false);
  });
});

describe('hashImage', () => {
  const a = 'data:image/png;base64,AAAA';
  const b = 'data:image/png;base64,AAAB';

  it('gives the same id to the same picture, and a different one to another', () => {
    expect(hashImage(a)).toBe(hashImage(a));
    expect(hashImage(a)).not.toBe(hashImage(b));
  });

  it('makes ids that are valid element ids (so a token can hold one)', () => {
    for (const data of [a, b, '', 'x'.repeat(50_000)]) expect(hashImage(data)).toMatch(ID_RE);
  });

  it('does not repeat across a few thousand different pictures', () => {
    const ids = new Set(Array.from({ length: 5000 }, (_, i) => hashImage(`data:image/png;base64,${i}`)));
    expect(ids.size).toBe(5000);
  });
});
