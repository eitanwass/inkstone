import { describe, expect, it } from 'vitest';
import { state } from '../../../src/core/state';
import type { BoardElement } from '../../../src/core/types';
import { isBackdrop, isInteractive, isLocked, isReachable, setLocked } from '../../../src/elements/layer';

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

describe('the map background', () => {
  const picture = (): BoardElement => ({
    type: 'background',
    id: 'bg',
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    image: 'abc',
  });

  it('is out of reach while drawing, and everything else is', () => {
    state.adjustingBackground = false;
    expect([isBackdrop(picture()), isReachable(picture()), isInteractive(picture())]).toEqual([
      true,
      false,
      false,
    ]);
    expect([isReachable(room()), isInteractive(room())]).toEqual([true, true]);
  });

  it('is the only thing in reach while it is being adjusted', () => {
    state.adjustingBackground = true;
    try {
      expect([isReachable(picture()), isInteractive(picture())]).toEqual([true, true]);
      expect([isReachable(room()), isInteractive(room())]).toEqual([false, false]);
    } finally {
      state.adjustingBackground = false;
    }
  });
});
