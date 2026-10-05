import { describe, expect, it } from 'vitest';
import { identicon, TOKEN_COLORS } from '../../../src/core/identicon';

describe('identicon', () => {
  it('is the same for the same seed and differs between seeds', () => {
    expect(identicon('abc')).toEqual(identicon('abc'));
    expect(identicon('abc')).not.toEqual(identicon('abd'));
  });

  it('uses a token colour, with a darker shade of it, and 3 to 8 folds', () => {
    for (let i = 0; i < 100; i++) {
      const { color, shade, fold } = identicon(`seed-${i}`);
      expect(TOKEN_COLORS).toContain(color);
      expect(shade).toMatch(/^#[0-9a-f]{6}$/);
      expect(shade).not.toBe(color);
      expect(fold).toBeGreaterThanOrEqual(3);
      expect(fold).toBeLessThanOrEqual(8);
    }
  });

  it('repeats every shape once per fold, and draws petals and a centre', () => {
    for (let i = 0; i < 100; i++) {
      const { fold, shapes } = identicon(`seed-${i}`);
      const count = (role: string) => shapes.filter((s) => s.role === role).length;
      expect(count('bezel')).toBe(fold);
      expect(count('light') >= fold).toBe(true); // petals, and maybe dots
      expect(count('line') % fold === 0 || count('line') % fold === 1).toBe(true); // strokes, a ring
      expect(shapes.every((s) => /^M[-\d. LMaZ]+$/.test(s.d))).toBe(true);
    }
  });

  it('gives different people different sigils', () => {
    const looks = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(identicon(`p${i}`).shapes)));
    expect(looks.size).toBe(50);
  });
});
