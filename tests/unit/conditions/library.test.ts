import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_PREFIX, DEFAULT_CONDITIONS, MAX_CUSTOM } from '../../../src/conditions';

// The library keeps a person's own conditions in localStorage, which Node doesn't have: a plain
// in-memory stand-in, installed before the module is loaded fresh for each test.
let store: Map<string, string>;

async function load() {
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  return import('../../../src/conditions/library');
}

const draft = { name: 'Hexed', color: '#a1b2c3', icon: 'moon' };

beforeEach(() => {
  store = new Map();
});

describe('the library of conditions', () => {
  it("starts with the defaults and none of the person's own", async () => {
    const lib = await load();
    expect(lib.customConditions()).toEqual([]);
    expect(lib.allConditions()).toEqual([...DEFAULT_CONDITIONS]);
  });

  it('adds one of their own, with a new custom id, after the defaults', async () => {
    const lib = await load();
    const made = lib.addCustom(draft);
    expect(made).toMatchObject({ name: 'Hexed', color: '#a1b2c3', icon: 'moon' });
    expect(made?.id.startsWith(CUSTOM_PREFIX)).toBe(true);
    expect(lib.allConditions()).toHaveLength(DEFAULT_CONDITIONS.length + 1);
    expect(lib.allConditions().at(-1)).toEqual(made);
  });

  it('trims the name and keeps the color in lower case', async () => {
    const lib = await load();
    expect(lib.addCustom({ ...draft, name: '  Hexed  ', color: '#A1B2C3' })).toMatchObject({
      name: 'Hexed',
      color: '#a1b2c3',
    });
  });

  it('keeps them across a reload', async () => {
    const first = await load();
    const made = first.addCustom(draft);
    const second = await load(); // a fresh start of the app, same storage
    expect(second.customConditions()).toEqual([made]);
  });

  it('refuses a draft with no name, a taken name (any capitals), a bad color or a made-up icon', async () => {
    const lib = await load();
    expect(lib.addCustom({ ...draft, name: '   ' })).toBeNull();
    expect(lib.addCustom({ ...draft, name: 'prone' })).toBeNull(); // a default one's
    expect(lib.addCustom({ ...draft, name: 'POISONED' })).toBeNull();
    expect(lib.addCustom({ ...draft, color: 'red' })).toBeNull();
    expect(lib.addCustom({ ...draft, icon: 'no-such-icon' })).toBeNull();
    expect(lib.customConditions()).toEqual([]);
  });

  it('says why, in words, for each', async () => {
    const lib = await load();
    expect(lib.draftProblem({ ...draft, name: '' })).toMatch(/name/i);
    expect(lib.draftProblem({ ...draft, name: 'Prone' })).toMatch(/already/i);
    expect(lib.draftProblem({ ...draft, color: 'x' })).toMatch(/color|icon/i);
    expect(lib.draftProblem(draft)).toBeNull();
  });

  it('refuses a second with the same name as one of their own', async () => {
    const lib = await load();
    lib.addCustom(draft);
    expect(lib.addCustom({ ...draft, name: 'hexed' })).toBeNull();
    expect(lib.nameTaken('HEXED')).toBe(true);
    expect(lib.nameTaken('Something else')).toBe(false);
  });

  it('changes one, keeping its id, and lets it keep its own name', async () => {
    const lib = await load();
    const made = lib.addCustom(draft);
    expect(made).not.toBeNull();
    const id = (made as { id: string }).id;
    const changed = lib.updateCustom(id, { name: 'Hexed', color: '#112233', icon: 'sun' }); // same name: fine
    expect(changed).toEqual({ id, name: 'Hexed', color: '#112233', icon: 'sun' });
    expect(lib.customConditions()).toEqual([changed]);
    expect(lib.updateCustom(id, { ...draft, name: 'Prone' })).toBeNull(); // but not someone else's
    expect(lib.updateCustom('custom-nope', draft)).toBeNull();
  });

  it('forgets one, and only that one', async () => {
    const lib = await load();
    const a = lib.addCustom(draft);
    const b = lib.addCustom({ ...draft, name: 'Marked' });
    lib.removeCustom((a as { id: string }).id);
    expect(lib.customConditions()).toEqual([b]);
    const again = await load();
    expect(again.customConditions()).toEqual([b]); // and it stays forgotten
  });

  it('holds at most the limit', async () => {
    const lib = await load();
    for (let i = 0; i < MAX_CUSTOM; i++)
      expect(lib.addCustom({ ...draft, name: `Mine ${i}` })).not.toBeNull();
    expect(lib.addCustom({ ...draft, name: 'One too many' })).toBeNull();
    expect(lib.draftProblem({ ...draft, name: 'One too many' })).toMatch(String(MAX_CUSTOM));
  });
});

describe('what is read back from storage', () => {
  const key = 'inkstone-conditions';

  it('ignores something that is not JSON, or not a list', async () => {
    for (const junk of ['not json', '{"a":1}', '42', 'null', '"prone"']) {
      store.set(key, junk);
      const lib = await load();
      expect(lib.customConditions(), junk).toEqual([]);
    }
  });

  it('drops entries that are not valid conditions, and keeps the rest', async () => {
    const good = { id: 'custom-a', name: 'Hexed', color: '#a1b2c3', icon: 'moon' };
    store.set(
      key,
      JSON.stringify([good, { id: 'custom-b', name: '', color: '#000000', icon: 'moon' }, 'x', null]),
    );
    const lib = await load();
    expect(lib.customConditions()).toEqual([good]);
  });

  it('does not let a stored entry pose as a default one', async () => {
    const posing = { id: 'prone', name: 'Prone', color: '#000000', icon: 'moon' };
    store.set(key, JSON.stringify([posing]));
    const lib = await load();
    expect(lib.customConditions()).toEqual([]);
    expect(lib.allConditions().filter((c) => c.id === 'prone')).toHaveLength(1);
  });

  it('keeps no more than the limit, whatever is stored', async () => {
    const many = Array.from({ length: MAX_CUSTOM + 25 }, (_, i) => ({
      id: `custom-${i}`,
      name: `Mine ${i}`,
      color: '#a1b2c3',
      icon: 'moon',
    }));
    store.set(key, JSON.stringify(many));
    const lib = await load();
    expect(lib.customConditions()).toHaveLength(MAX_CUSTOM);
  });
});
