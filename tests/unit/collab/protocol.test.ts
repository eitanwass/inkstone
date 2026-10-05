import { describe, expect, it } from 'vitest';
import { parseMessage } from '../../../src/collab/protocol';

const room = { type: 'rect', id: 'a', x: 0, y: 0, w: 80, h: 40 };

describe('a doc message', () => {
  it('has the map name, the elements, and whether the room was fresh', () => {
    expect(parseMessage({ type: 'doc', fresh: true, name: 'The Sunken Crypt', elements: [room] })).toEqual({
      type: 'doc',
      fresh: true,
      name: 'The Sunken Crypt',
      elements: [room],
    });
  });

  it('is not fresh unless it says so, and has no name unless it has one', () => {
    expect(parseMessage({ type: 'doc', elements: [] })).toEqual({
      type: 'doc',
      fresh: false,
      name: '',
      elements: [],
    });
  });

  it('tidies the name the same way the editor does', () => {
    expect(parseMessage({ type: 'doc', name: '  A   B  ', elements: [] })).toMatchObject({ name: 'A B' });
    expect(parseMessage({ type: 'doc', name: 'x'.repeat(100), elements: [] })).toMatchObject({
      name: 'x'.repeat(60),
    });
  });

  it('drops invalid elements and is null without a list', () => {
    const bad = { type: 'hologram', id: 'z', x: 0, y: 0 };
    expect(parseMessage({ type: 'doc', elements: [room, bad] })).toMatchObject({ elements: [room] });
    for (const data of [{ type: 'doc' }, { type: 'doc', elements: 'no' }])
      expect(parseMessage(data)).toBeNull();
  });
});

describe('a changes message', () => {
  it('reads each kind of change', () => {
    const changes = [
      { t: 'set', el: room },
      { t: 'del', id: 'b' },
      { t: 'order', ids: ['a', 'c'] },
      { t: 'name', name: 'New' },
    ];
    expect(parseMessage({ type: 'changes', changes })).toEqual({ type: 'changes', changes });
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
    expect(parseMessage({ type: 'changes', changes })).toEqual({
      type: 'changes',
      changes: [{ t: 'del', id: 'good' }],
    });
  });

  it('cleans what is inside a set element, as it does for the saved map', () => {
    const token = { type: 'token', id: 't', x: 0, y: 0, image: 'https://example.com/a.png' };
    expect(parseMessage({ type: 'changes', changes: [{ t: 'set', el: token }] })).toEqual({
      type: 'changes',
      changes: [{ t: 'set', el: { type: 'token', id: 't', x: 0, y: 0 } }],
    });
  });

  it('is null when it is not a list', () => {
    expect(parseMessage({ type: 'changes' })).toBeNull();
  });
});

describe('anything else', () => {
  it('is not a message', () => {
    for (const data of [null, undefined, 42, 'text', [], [room], {}, { type: 'snapshot', elements: [] }]) {
      expect(parseMessage(data)).toBeNull();
    }
  });
});
