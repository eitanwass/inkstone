import { describe, expect, it } from 'vitest';
import { filterLibrary, type LibraryItem, parseLibrary } from '../../../src/core/library';

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'the-keep',
  kind: 'map',
  title: 'The Keep',
  description: 'A castle with a great hall.',
  file: '/library/maps/the-keep.inkstone.json',
  thumbnail: '/library/thumbs/the-keep.jpg',
  author: 'Inkstone',
  ...over,
});

describe('parseLibrary', () => {
  it('reads an item', () => {
    const [item] = parseLibrary({ version: 1, items: [entry()] });
    expect(item).toEqual({
      id: 'the-keep',
      kind: 'map',
      title: 'The Keep',
      description: 'A castle with a great hall.',
      file: '/library/maps/the-keep.inkstone.json',
      thumbnail: '/library/thumbs/the-keep.jpg',
      author: 'Inkstone',
    });
  });

  it('drops an item that is not complete or not safe, and keeps the rest', () => {
    const items = parseLibrary({
      items: [
        entry({ id: 'ok-one' }),
        entry({ id: 'no title', title: '' }),
        entry({ id: 'bad-kind', kind: 'spell' }),
        entry({ id: 'elsewhere', file: 'https://example.com/map.json' }),
        entry({ id: 'sideways', file: '/library/../secret.json' }),
        entry({ id: 'outside', thumbnail: '/other/thumb.jpg' }),
        entry({ id: 'Bad Id!' }),
        'nope',
        null,
        entry({ id: 'ok-two' }),
      ],
    });
    expect(items.map((i) => i.id)).toEqual(['ok-one', 'ok-two']);
  });

  it('keeps the first of two items with the same id', () => {
    const items = parseLibrary({ items: [entry({ title: 'First' }), entry({ title: 'Second' })] });
    expect(items.map((i) => i.title)).toEqual(['First']);
  });

  it('is empty for anything that is not a list', () => {
    for (const raw of [null, 3, 'x', [], {}, { items: 'no' }]) expect(parseLibrary(raw)).toEqual([]);
  });

  it('gives a missing author as Inkstone', () => {
    const [item] = parseLibrary({ items: [entry({ author: undefined })] });
    expect(item.author).toBe('Inkstone');
  });
});

describe('filterLibrary', () => {
  const items = parseLibrary({
    items: [
      entry(),
      entry({ id: 'tavern', title: 'The Rusty Flagon', description: 'A busy inn.', author: 'Ash' }),
      entry({ id: 'goblin', kind: 'token', title: 'Goblin' }),
    ],
  }) as LibraryItem[];
  const all = { kind: 'map' as const, query: '' };

  it('keeps only the chosen kind', () => {
    expect(filterLibrary(items, all).map((i) => i.id)).toEqual(['the-keep', 'tavern']);
    expect(filterLibrary(items, { ...all, kind: 'token' }).map((i) => i.id)).toEqual(['goblin']);
    expect(filterLibrary(items, { ...all, kind: 'model' })).toEqual([]);
  });

  it('matches every word of the search against the title, description and author', () => {
    expect(filterLibrary(items, { ...all, query: 'rusty' }).map((i) => i.id)).toEqual(['tavern']);
    expect(filterLibrary(items, { ...all, query: 'GREAT hall' }).map((i) => i.id)).toEqual(['the-keep']);
    expect(filterLibrary(items, { ...all, query: 'busy' }).map((i) => i.id)).toEqual(['tavern']);
    expect(filterLibrary(items, { ...all, query: 'ash' }).map((i) => i.id)).toEqual(['tavern']);
    expect(filterLibrary(items, { ...all, query: 'rusty castle' })).toEqual([]);
  });
});
