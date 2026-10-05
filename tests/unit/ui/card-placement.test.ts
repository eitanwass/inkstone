import { describe, expect, it } from 'vitest';
import { type CardSpot, cardPosition } from '../../../src/ui/card-placement';

// A 1000x800 screen, the map starting at its top, a 200x100 card.
const spot = (over: Partial<CardSpot>): CardSpot => ({
  centerX: 500,
  top: 400,
  bottom: 440,
  width: 200,
  height: 100,
  screenTop: 0,
  viewportWidth: 1000,
  viewportHeight: 800,
  ...over,
});

describe('cardPosition', () => {
  it('goes above the thing, centred on it', () => {
    expect(cardPosition(spot({}))).toEqual({ left: 400, top: 400 - 14 - 100 });
  });

  it('goes below it, and below its name, when the top of the screen is in the way', () => {
    expect(cardPosition(spot({ top: 150, bottom: 210 }))).toEqual({ left: 400, top: 210 + 14 });
  });

  it('keeps clear of the map name and the action cluster at the top', () => {
    // room above is exactly enough: 96px clear of the top
    expect(cardPosition(spot({ top: 96 + 14 + 100 })).top).toBe(96);
    // one pixel less and it goes below
    expect(cardPosition(spot({ top: 96 + 14 + 100 - 1, bottom: 300 })).top).toBe(300 + 14);
  });

  it('stays on the screen at the sides', () => {
    expect(cardPosition(spot({ centerX: 20 })).left).toBe(8);
    expect(cardPosition(spot({ centerX: 990 })).left).toBe(1000 - 200 - 8);
  });

  it('stays on the screen at the bottom, even if that covers the thing', () => {
    const tall = cardPosition(spot({ top: 150, bottom: 760, height: 300 }));
    expect(tall.top).toBeLessThanOrEqual(800 - 300 - 8);
  });

  it('goes where there is more room when it fits on neither side', () => {
    // a 500px card for a thing at 480-520: it fits on neither side, there is more room above (370)
    // than below (258), so it goes above, and is then kept on the screen
    expect(cardPosition(spot({ top: 480, bottom: 520, height: 500 })).top).toBe(8);
  });

  it('counts from the top of the map, not the page', () => {
    // the map starts 60px down the page: clearance is measured from there
    expect(cardPosition(spot({ screenTop: 60, top: 60 + 96 + 14 + 100 })).top).toBe(60 + 96);
  });
});
