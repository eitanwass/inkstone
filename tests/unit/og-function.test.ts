import { describe, expect, it } from 'vitest';
import { isDrawable, nameFontSize, RUNTIME_FILES } from '../../api/_card';
import { GET } from '../../api/og';

const ORIGIN = 'https://inkstone.example';
const call = (name?: string) =>
  GET(new Request(`${ORIGIN}/api/og${name === undefined ? '' : `?name=${encodeURIComponent(name)}`}`));

const bytes = async (response: Response) => Buffer.from(await response.arrayBuffer());
const isPng = (png: Buffer) => png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

describe('GET /api/og', () => {
  it('draws a 1200x630 PNG for a map name, cacheable', async () => {
    const response = await call('The Sunken Crypt of Vael');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
    const png = await bytes(response);
    expect(isPng(png)).toBe(true);
    expect(size(png)).toEqual([1200, 630]);
    expect(png.length).toBeLessThan(300 * 1024); // chat apps skip very large images
  });

  it('gives the same image for the same name and a different one for another name', async () => {
    const a1 = await bytes(await call('The Sunken Crypt'));
    const a2 = await bytes(await call('The Sunken Crypt'));
    const b = await bytes(await call('Goblin Warren'));
    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(b)).toBe(false);
  });

  it('treats the name like every other map name, so tidy and messy spellings match', async () => {
    const tidy = await bytes(await call('The Sunken Crypt'));
    const messy = await bytes(await call('   The    Sunken \t Crypt  '));
    expect(messy.equals(tidy)).toBe(true);
  });

  it('draws long names, wide letters, accents and punctuation without failing', async () => {
    const names = [
      'The Forgotten Halls of the Thrice-Cursed Archmage of Vael Karthos',
      'W'.repeat(60),
      'x'.repeat(500), // cut to 60 characters first
      'Café Écarlate: Ñandú & the "Ångström" <Vault>',
      "Aragorn's Rest, level 2 (draft) #3",
      '1',
    ];
    for (const name of names) {
      const response = await call(name);
      expect(response.status, name).toBe(200);
      const png = await bytes(response);
      expect(isPng(png), name).toBe(true);
      expect(size(png), name).toEqual([1200, 630]);
    }
  });

  it('sends people to the plain site card when there is nothing it can draw', async () => {
    const undrawable = [
      undefined, // no name at all
      '',
      '   ',
      '\u0000\u0001', // only control characters
      'מערת הגובלינים', // a script the bundled fonts don't cover
      'Подземелье', // Cyrillic is not bundled either
      '洞窟',
      '⚔️🏰',
    ];
    for (const name of undrawable) {
      const response = await call(name);
      expect(response.status, String(name)).toBe(302);
      expect(response.headers.get('location'), String(name)).toBe(`${ORIGIN}/og-image.png`);
    }
  });
});

describe('isDrawable', () => {
  it('accepts Latin text with accents, digits, punctuation, symbols and spaces', () => {
    for (const name of [
      'The Sunken Crypt',
      'Café Écarlate',
      'Ñandú',
      'Level 2',
      "Aragorn's Rest!",
      'A & B (C) #1 $5 50%',
      'Vael’s “Hold” – part 2…',
      '€5 © 2026',
    ]) {
      expect(isDrawable(name), name).toBe(true);
    }
  });

  it('rejects anything the bundled fonts would draw as empty boxes', () => {
    for (const name of [
      'מערת',
      'Подземелье',
      '洞窟',
      'Crypt 🏰',
      'Crypt ⚔',
      'mixed Latin and עברית',
      'Ⅻ',
      '٣',
    ]) {
      expect(isDrawable(name), name).toBe(false);
    }
  });
});

describe('nameFontSize', () => {
  it('starts large for a short name and shrinks as the name gets longer, within bounds', () => {
    expect(nameFontSize('Crypt')).toBe(112);
    let previous = Number.POSITIVE_INFINITY;
    for (let length = 1; length <= 60; length++) {
      const fontSize = nameFontSize('x'.repeat(length));
      expect(fontSize).toBeLessThanOrEqual(previous);
      expect(fontSize).toBeGreaterThanOrEqual(44);
      expect(fontSize).toBeLessThanOrEqual(112);
      previous = fontSize;
    }
    expect(nameFontSize('x'.repeat(60))).toBeLessThan(nameFontSize('x'.repeat(10)));
  });
});

describe('the files the function reads at runtime', () => {
  it('all exist (a renamed file in a dependency upgrade would otherwise only fail in production)', async () => {
    const { existsSync } = await import('node:fs');
    for (const file of RUNTIME_FILES) expect(existsSync(file), file).toBe(true);
  });
});

describe('the card text', () => {
  it('is drawn with real letters, not the same box for every character', async () => {
    // Satori draws a missing glyph as an identical box, so two names of the same length
    // look alike if the fonts didn't load properly (this happened in production).
    const { renderCard } = await import('../../api/_card');
    const [narrow, wide] = await Promise.all([renderCard('iiiiiiii'), renderCard('WWWWWWWW')]);
    expect(Buffer.from(narrow).equals(Buffer.from(wide))).toBe(false);
  });
});
