import { describe, expect, it } from 'vitest';
import {
  NAME_COMBINATIONS,
  normalizePlayerName,
  PLAYER_NAME_MAX,
  randomPlayerName,
} from '../../../src/core/player-name';

describe('randomPlayerName', () => {
  it('is two words, one from each list, and always a usable name', () => {
    for (let i = 0; i < 500; i++) {
      const name = randomPlayerName();
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(normalizePlayerName(name)).toBe(name);
      expect(name.length).toBeLessThanOrEqual(PLAYER_NAME_MAX);
    }
  });

  it('follows the numbers it is given, so the first and last of each list can be reached', () => {
    expect(randomPlayerName('', () => 0)).toBe('Crimson Owl');
    expect(randomPlayerName('', () => 0.9999)).toBe('Restless Cleric');
  });

  it('never gives back the name it is asked to avoid', () => {
    let calls = 0;
    // The first pick is the avoided name, the next one is not.
    const random = () => (calls++ < 2 ? 0 : 0.5);
    expect(randomPlayerName('Crimson Owl', random)).not.toBe('Crimson Owl');
  });

  it('has a good number of combinations', () => {
    expect(NAME_COMBINATIONS).toBeGreaterThan(500);
  });
});

describe('normalizePlayerName', () => {
  it('trims, collapses spaces and removes control characters', () => {
    expect(normalizePlayerName('  Gilded   Fox ')).toBe('Gilded Fox');
    expect(normalizePlayerName('Gil\u0000ded\tFox\n')).toBe('Gil ded Fox');
  });

  it('cuts to the limit, and is empty when nothing is left', () => {
    expect(normalizePlayerName('x'.repeat(100))).toHaveLength(PLAYER_NAME_MAX);
    for (const none of ['', '   ', '\u0001\u0002', null, undefined, 42]) {
      expect(normalizePlayerName(none)).toBe('');
    }
  });
});
