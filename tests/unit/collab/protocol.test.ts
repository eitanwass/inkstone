import { describe, expect, it } from 'vitest';
import { parseMessage } from '../../../src/collab/protocol';

const room = { type: 'rect', id: 'a', x: 0, y: 0, w: 80, h: 40 };

describe('a doc message', () => {
  it('has the epoch, the revision, the map name, the elements, and whether the room was fresh', () => {
    expect(
      parseMessage({
        type: 'doc',
        fresh: true,
        epoch: 'e1',
        rev: 4,
        name: 'The Sunken Crypt',
        elements: [room],
      }),
    ).toEqual({ type: 'doc', fresh: true, epoch: 'e1', rev: 4, name: 'The Sunken Crypt', elements: [room] });
  });

  it('is not fresh unless it says so, has no name unless it has one, and may have no epoch yet', () => {
    expect(parseMessage({ type: 'doc', epoch: '', rev: 0, elements: [] })).toEqual({
      type: 'doc',
      fresh: false,
      epoch: '',
      rev: 0,
      name: '',
      elements: [],
    });
  });

  it('tidies the name the same way the editor does', () => {
    const doc = (name: string) => ({ type: 'doc', epoch: 'e', rev: 0, name, elements: [] });
    expect(parseMessage(doc('  A   B  '))).toMatchObject({ name: 'A B' });
    expect(parseMessage(doc('x'.repeat(100)))).toMatchObject({ name: 'x'.repeat(60) });
  });

  it('drops invalid elements, and is null without a list or a revision', () => {
    const bad = { type: 'hologram', id: 'z', x: 0, y: 0 };
    const base = { type: 'doc', epoch: 'e', rev: 0 };
    expect(parseMessage({ ...base, elements: [room, bad] })).toMatchObject({ elements: [room] });
    for (const data of [base, { ...base, elements: 'no' }, { type: 'doc', epoch: 'e', elements: [] }]) {
      expect(parseMessage(data)).toBeNull();
    }
  });
});

describe('a changes message', () => {
  it('has the revision and reads each kind of change', () => {
    const changes = [
      { t: 'set', el: room },
      { t: 'del', id: 'b' },
      { t: 'order', ids: ['a', 'c'] },
      { t: 'name', name: 'New' },
    ];
    expect(parseMessage({ type: 'changes', rev: 5, changes })).toEqual({ type: 'changes', rev: 5, changes });
  });

  it('drops a bad change on its own and keeps the rest', () => {
    const changes = [
      { t: 'set', el: { type: 'hologram', id: 'z', x: 0, y: 0 } }, // not an element
      { t: 'set', el: { ...room, id: 'no spaces' } }, // an id the relay refuses
      { t: 'del', id: 42 },
      { t: 'order', ids: ['a', 7] },
      { t: 'name', name: 5 },
      { t: 'explode' },
      'junk',
      { t: 'del', id: 'good' },
    ];
    expect(parseMessage({ type: 'changes', rev: 1, changes })).toEqual({
      type: 'changes',
      rev: 1,
      changes: [{ t: 'del', id: 'good' }],
    });
  });

  it('cleans what is inside a set element, as it does for the saved map', () => {
    const token = { type: 'token', id: 't', x: 0, y: 0, image: 'https://example.com/a.png' };
    expect(parseMessage({ type: 'changes', rev: 1, changes: [{ t: 'set', el: token }] })).toEqual({
      type: 'changes',
      rev: 1,
      changes: [{ t: 'set', el: { type: 'token', id: 't', x: 0, y: 0 } }],
    });
  });

  it('is null when it has no list of changes or no revision', () => {
    expect(parseMessage({ type: 'changes', rev: 1 })).toBeNull();
    expect(parseMessage({ type: 'changes', changes: [] })).toBeNull();
    expect(parseMessage({ type: 'changes', rev: -1, changes: [] })).toBeNull();
    expect(parseMessage({ type: 'changes', rev: 1.5, changes: [] })).toBeNull();
  });
});

describe('a catchup message', () => {
  it('has the epoch, the revision and what changed', () => {
    expect(parseMessage({ type: 'catchup', epoch: 'e1', rev: 3, changes: [{ t: 'del', id: 'b' }] })).toEqual({
      type: 'catchup',
      epoch: 'e1',
      rev: 3,
      changes: [{ t: 'del', id: 'b' }],
    });
  });

  it('is null without an epoch or a list', () => {
    expect(parseMessage({ type: 'catchup', rev: 3, changes: [] })).toBeNull();
    expect(parseMessage({ type: 'catchup', epoch: 'e1', rev: 3 })).toBeNull();
    expect(parseMessage({ type: 'catchup', epoch: 'no spaces', rev: 3, changes: [] })).toBeNull();
  });
});

describe('an ack message', () => {
  it('has the epoch, the revision, and the fixes for what was refused', () => {
    expect(
      parseMessage({ type: 'ack', epoch: 'e1', rev: 7, fix: [{ t: 'set', el: room }, { t: 'junk' }] }),
    ).toEqual({ type: 'ack', epoch: 'e1', rev: 7, fix: [{ t: 'set', el: room }] });
  });

  it('is null without a list of fixes', () => {
    expect(parseMessage({ type: 'ack', epoch: 'e1', rev: 7 })).toBeNull();
  });
});

describe('an image message', () => {
  it('has the picture id and its data', () => {
    expect(parseMessage({ type: 'image', id: 'abc123', data: 'data:image/png;base64,AAAA' })).toEqual({
      type: 'image',
      id: 'abc123',
      data: 'data:image/png;base64,AAAA',
    });
  });

  it('is null without a valid id or data (what the data is is checked when it is stored)', () => {
    expect(parseMessage({ type: 'image', id: 'no spaces', data: 'x' })).toBeNull();
    expect(parseMessage({ type: 'image', id: 'abc', data: 5 })).toBeNull();
    expect(parseMessage({ type: 'image', data: 'x' })).toBeNull();
  });
});

describe('anything else', () => {
  it('is not a message', () => {
    for (const data of [
      null,
      undefined,
      42,
      'text',
      [],
      [room],
      {},
      { type: 'snapshot', rev: 0, elements: [] },
    ]) {
      expect(parseMessage(data)).toBeNull();
    }
  });
});
