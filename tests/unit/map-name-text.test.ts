import { describe, expect, it } from 'vitest';
import { MAP_NAME_MAX, mapFileSlug, normalizeMapName } from '../../src/map-name-text';

describe('normalizeMapName', () => {
  it('leaves an ordinary name alone', () => {
    expect(normalizeMapName('The Sunken Crypt')).toBe('The Sunken Crypt');
    expect(normalizeMapName("Aragorn's Rest, level 2")).toBe("Aragorn's Rest, level 2");
  });

  it('trims the ends and collapses runs of whitespace to one space', () => {
    expect(normalizeMapName('   The    Sunken \t  Crypt  ')).toBe('The Sunken Crypt');
    expect(normalizeMapName('a\n\nb')).toBe('a b');
  });

  it('turns control characters into spaces instead of keeping them', () => {
    expect(normalizeMapName('a\u0000b\u001fc\u007fd')).toBe('a b c d');
  });

  it('cuts at the maximum length without leaving a trailing space', () => {
    expect(normalizeMapName('x'.repeat(100))).toHaveLength(MAP_NAME_MAX);
    // a space exactly at the cut point must not survive as a trailing space
    const name = `${'x'.repeat(MAP_NAME_MAX - 1)} tail`;
    expect(normalizeMapName(name)).toBe('x'.repeat(MAP_NAME_MAX - 1));
  });

  it('keeps any script, emoji and accents', () => {
    expect(normalizeMapName('מערת הגובלינים')).toBe('מערת הגובלינים');
    expect(normalizeMapName('Café Écarlate ⚔️')).toBe('Café Écarlate ⚔️');
  });

  it('is empty for anything that is not text', () => {
    for (const value of [undefined, null, 42, {}, [], true]) expect(normalizeMapName(value)).toBe('');
    expect(normalizeMapName('')).toBe('');
    expect(normalizeMapName('   ')).toBe('');
  });

  it('is idempotent', () => {
    for (const raw of ['  A   B ', 'x'.repeat(80), 'a\tb', 'Café']) {
      const once = normalizeMapName(raw);
      expect(normalizeMapName(once)).toBe(once);
    }
  });
});

describe('mapFileSlug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(mapFileSlug('The Sunken Crypt of Vael')).toBe('the-sunken-crypt-of-vael');
  });

  it('drops punctuation and collapses separators', () => {
    expect(mapFileSlug("Aragorn's  Rest!!! (level 2)")).toBe('aragorn-s-rest-level-2');
    expect(mapFileSlug('--a--b--')).toBe('a-b');
  });

  it('keeps letters and numbers from any script', () => {
    expect(mapFileSlug('מערת הגובלינים')).toBe('מערת-הגובלינים');
    expect(mapFileSlug('Café 2')).toBe('café-2');
  });

  it('falls back to a default when nothing usable is left', () => {
    expect(mapFileSlug('')).toBe('inkstone-map');
    expect(mapFileSlug('!!! ???')).toBe('inkstone-map');
  });

  it('never produces path separators or other file-name hazards', () => {
    const slug = mapFileSlug('../../etc/passwd: <b>"x"</b>\\y|z*?');
    expect(slug).not.toMatch(/[/\\:*?"<>|]/);
    expect(slug.startsWith('-')).toBe(false);
  });

  it('keeps long names to a reasonable length with no trailing dash', () => {
    const slug = mapFileSlug('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });
});
