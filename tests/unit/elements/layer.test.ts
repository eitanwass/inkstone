import { describe, expect, it } from 'vitest';
import type { BoardElement } from '../../../src/core/types';
import { isInteractive, isLocked, setLocked } from '../../../src/elements/layer';

const room = (): BoardElement => ({ type: 'rect', id: 'a', x: 0, y: 0, w: 40, h: 40 });

describe('locking', () => {
  it('is off for an element that is not locked, which can be clicked', () => {
    const el = room();
    expect([isLocked(el), isInteractive(el)]).toEqual([false, true]);
  });

  it('makes an element not interactive', () => {
    const el = { ...room(), locked: true };
    expect([isLocked(el), isInteractive(el)]).toEqual([true, false]);
  });

  it('is set to true, and taken off the element when turned off', () => {
    const el = room();
    setLocked(el, true);
    expect(el.locked).toBe(true);

    setLocked(el, false);
    expect('locked' in el).toBe(false); // not left as false: an element that isn't locked saves as before
  });

  it('turning off what is not on is nothing', () => {
    const el = room();
    setLocked(el, false);
    expect(el).toEqual(room());
  });
});
