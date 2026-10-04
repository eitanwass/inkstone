import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PREFIX,
  DEAD_ID,
  DEFAULT_CONDITIONS,
  DEFAULT_IDS,
  ICON_NAMES,
  ICONS,
  isCondition,
  MAX_NAME,
  MAX_PER_TOKEN,
  newCustomId,
  parseConditions,
  parseIconSvg,
} from '../../../src/conditions';

const good = { id: 'custom-abc', name: 'Hexed', color: '#a1b2c3', icon: 'moon' };

describe('the default conditions', () => {
  it('are the sixteen from the 5e rules plus Dead', () => {
    expect(DEFAULT_CONDITIONS).toHaveLength(16);
    const names = DEFAULT_CONDITIONS.map((c) => c.name);
    for (const name of ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled']) {
      expect(names).toContain(name);
    }
    for (const name of ['Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone']) {
      expect(names).toContain(name);
    }
    for (const name of ['Restrained', 'Stunned', 'Unconscious', 'Dead']) expect(names).toContain(name);
  });

  it('are all valid conditions, each with its own id, name, icon and color', () => {
    for (const c of DEFAULT_CONDITIONS) expect(isCondition(c), c.name).toBe(true);
    for (const key of ['id', 'name', 'icon', 'color'] as const) {
      expect(new Set(DEFAULT_CONDITIONS.map((c) => c[key])).size, `every ${key} is different`).toBe(16);
    }
  });

  it('have ids that cannot be mistaken for a custom one', () => {
    for (const c of DEFAULT_CONDITIONS) expect(c.id.startsWith(CUSTOM_PREFIX)).toBe(false);
  });

  it('include Dead, under the id the token drawing looks for', () => {
    expect(DEFAULT_IDS.has(DEAD_ID)).toBe(true);
    expect(DEFAULT_CONDITIONS.find((c) => c.id === DEAD_ID)?.name).toBe('Dead');
  });
});

describe('the icons', () => {
  it('are all drawn as one path starting with a move, in a 24-unit box', () => {
    for (const name of ICON_NAMES) {
      expect(ICONS[name].d, name).toMatch(/^M/);
      expect(ICONS[name].d.length, name).toBeGreaterThan(5);
    }
  });

  it('have no path numbers outside the box, which would be clipped', () => {
    for (const name of ICON_NAMES) {
      const numbers = ICONS[name].d.match(/-?\d*\.?\d+/g) ?? [];
      // arc flags and radii can be small or negative, but nothing should be wildly off the 24 box
      for (const n of numbers) expect(Math.abs(Number(n)), `${name}: ${n}`).toBeLessThanOrEqual(24);
    }
  });

  it('include every one a default uses, and some more for custom conditions', () => {
    for (const c of DEFAULT_CONDITIONS) expect(ICON_NAMES).toContain(c.icon);
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(24);
  });

  it('only give a dash pattern that is a list of positive numbers', () => {
    for (const name of ICON_NAMES) {
      const dash = ICONS[name].dash;
      if (dash) for (const n of dash) expect(n).toBeGreaterThan(0);
    }
  });
});

describe('parseIconSvg', () => {
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>x</title>${inner}</svg>`;

  it('reads the path out of a plain SVG', () => {
    expect(parseIconSvg(wrap('<path d="M1 2l3 4"/>'))).toEqual({ d: 'M1 2l3 4' });
  });

  it('reads a dash pattern, separated by spaces or commas', () => {
    expect(parseIconSvg(wrap('<path d="M1 2" stroke-dasharray="3.5 3"/>'))).toEqual({
      d: 'M1 2',
      dash: [3.5, 3],
    });
    expect(parseIconSvg(wrap('<path stroke-dasharray="2,4" d="M1 2"/>'))).toEqual({
      d: 'M1 2',
      dash: [2, 4],
    });
  });

  it('reads one that is spread over several lines', () => {
    const multi = wrap('\n  <path\n    d="M1 2"\n    stroke-dasharray="3 3"\n  />\n');
    expect(parseIconSvg(multi)).toEqual({ d: 'M1 2', dash: [3, 3] });
  });

  it('refuses a file with no path, or with more than one', () => {
    expect(() => parseIconSvg(wrap(''))).toThrow(/exactly one/);
    expect(() => parseIconSvg(wrap('<path d="M1 2"/><path d="M3 4"/>'))).toThrow(/exactly one/);
    expect(() => parseIconSvg(wrap('<circle r="4"/>'))).toThrow(/exactly one/);
  });

  it('refuses a path with no data, and a bad dash pattern', () => {
    expect(() => parseIconSvg(wrap('<path/>'))).toThrow(/no d/);
    expect(() => parseIconSvg(wrap('<path d=""/>'))).toThrow(/no d/);
    for (const bad of ['0 3', '-2 3', 'a b', '3 x']) {
      expect(() => parseIconSvg(wrap(`<path d="M1 2" stroke-dasharray="${bad}"/>`)), bad).toThrow(/dash/);
    }
  });

  it('does not take a path from a comment or a title that merely mentions one', () => {
    expect(
      parseIconSvg(wrap('<path d="M1 2"/>').replace('<title>x</title>', '<title>a path here</title>')),
    ).toEqual({
      d: 'M1 2',
    });
  });
});

describe('the icon files', () => {
  // Everything in the folder, whatever it is, as text: file name -> contents.
  const everything = import.meta.glob<string>('../../../src/conditions/icons/*', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const contents = new Map(
    Object.entries(everything).map(([path, body]) => [path.slice(path.lastIndexOf('/') + 1), body]),
  );
  const files = [...contents.keys()].filter((f) => f.endsWith('.svg'));
  const text = (file: string) => contents.get(file) ?? '';

  it('are the library: one file per icon, named for it, and nothing else in the folder', () => {
    expect(files.map((f) => f.replace(/\.svg$/, '')).sort()).toEqual([...ICON_NAMES].sort());
    expect([...contents.keys()].filter((f) => !f.endsWith('.svg'))).toEqual([]);
  });

  it('include one for every default condition', () => {
    for (const c of DEFAULT_CONDITIONS) expect(files, c.name).toContain(`${c.icon}.svg`);
  });

  it('are standalone SVGs: a 24 box, a line style, a title, and one path', () => {
    for (const file of files) {
      const svg = text(file);
      expect(svg, file).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg, file).toContain('viewBox="0 0 24 24"');
      expect(svg, file).toContain('stroke="currentColor"');
      expect(svg, file).toContain('stroke-linecap="round"');
      expect(svg, file).toMatch(/<title>[^<]+<\/title>/);
      expect(svg.match(/<path\b/g), file).toHaveLength(1);
    }
  });

  it('hold nothing but a path: no script, style, image, link or event handler', () => {
    for (const file of files) {
      const svg = text(file);
      expect(svg, file).not.toMatch(/<(script|style|image|foreignObject|use|a)\b/i);
      expect(svg, file).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg, file).not.toMatch(/href\s*=/i);
    }
  });

  it('are what the library loaded, path for path', () => {
    for (const file of files) {
      const name = file.replace(/\.svg$/, '');
      expect(ICONS[name], name).toEqual(parseIconSvg(text(file)));
    }
  });

  it('each draw something different', () => {
    const paths = ICON_NAMES.map((name) => ICONS[name].d);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('are named in lower case with dashes, so a name is a safe key', () => {
    for (const name of ICON_NAMES) expect(name, name).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});

describe('isCondition', () => {
  it('accepts a whole condition', () => {
    expect(isCondition(good)).toBe(true);
  });

  it('wants a name, a #rrggbb color, a known icon and an id', () => {
    expect(isCondition({ ...good, name: '' })).toBe(false);
    expect(isCondition({ ...good, name: '   ' })).toBe(false);
    expect(isCondition({ ...good, color: 'red' })).toBe(false);
    expect(isCondition({ ...good, color: '#abc' })).toBe(false);
    expect(isCondition({ ...good, color: 'javascript:alert(1)' })).toBe(false);
    expect(isCondition({ ...good, icon: 'no-such-icon' })).toBe(false);
    expect(isCondition({ ...good, id: '' })).toBe(false);
    expect(isCondition({ name: 'Hexed', color: '#a1b2c3', icon: 'moon' })).toBe(false);
  });

  it('refuses names and ids that are too long', () => {
    expect(isCondition({ ...good, name: 'x'.repeat(MAX_NAME) })).toBe(true);
    expect(isCondition({ ...good, name: 'x'.repeat(MAX_NAME + 1) })).toBe(false);
    expect(isCondition({ ...good, id: 'x'.repeat(41) })).toBe(false);
  });

  it('refuses things that are not objects, and wrong kinds of field', () => {
    for (const bad of [null, undefined, 'prone', 5, [], true]) expect(isCondition(bad)).toBe(false);
    expect(isCondition({ ...good, name: 5 })).toBe(false);
    expect(isCondition({ ...good, icon: ['moon'] })).toBe(false);
  });

  it('does not take an icon name from the object prototype', () => {
    expect(isCondition({ ...good, icon: 'constructor' })).toBe(false);
    expect(isCondition({ ...good, icon: '__proto__' })).toBe(false);
  });
});

describe('parseConditions', () => {
  it('keeps the valid ones, in order', () => {
    const b = { ...good, id: 'custom-b', name: 'Marked' };
    expect(parseConditions([good, b])).toEqual([good, b]);
  });

  it('gives none for something that is not a list', () => {
    for (const bad of [null, undefined, 'prone', 5, {}, { 0: good }])
      expect(parseConditions(bad)).toEqual([]);
  });

  it('drops the bad ones and keeps the rest', () => {
    expect(parseConditions([{ nope: 1 }, good, 'prone', null, { ...good, id: 'x', color: 'blue' }])).toEqual([
      good,
    ]);
  });

  it('keeps each id once, the first', () => {
    expect(parseConditions([good, { ...good, name: 'Second' }])).toEqual([good]);
  });

  it('holds at most as many as a token can carry', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...good, id: `custom-${i}` }));
    expect(parseConditions(many)).toHaveLength(MAX_PER_TOKEN);
  });

  it('gives clean copies: only the four fields, with the color in lower case', () => {
    const [copy] = parseConditions([{ ...good, color: '#A1B2C3', extra: '<script>', hidden: true }]);
    expect(copy).toEqual({ id: 'custom-abc', name: 'Hexed', color: '#a1b2c3', icon: 'moon' });
    expect(Object.keys(copy).sort()).toEqual(['color', 'icon', 'id', 'name']);
  });

  it('does not change what it was given', () => {
    const input = [{ ...good, color: '#A1B2C3' }];
    parseConditions(input);
    expect(input[0].color).toBe('#A1B2C3');
  });
});

describe('newCustomId', () => {
  it('is a custom id, and a different one each time', () => {
    const a = newCustomId();
    const b = newCustomId();
    expect(a.startsWith(CUSTOM_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(DEFAULT_IDS.has(a)).toBe(false);
    expect(isCondition({ ...good, id: a })).toBe(true);
  });
});
