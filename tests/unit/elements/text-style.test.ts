import { describe, expect, it } from 'vitest';
import { fontString, plateColorFor, setTextStyle } from '../../../src/elements/text-style';

describe('fontString', () => {
  it('is the plain font when nothing is on', () => {
    expect(fontString(14, {})).toBe("14px 'Inter Variable', system-ui, sans-serif");
  });

  it('adds italic and bold, in the order canvas wants them', () => {
    expect(fontString(20, { bold: true })).toMatch(/^bold 20px /);
    expect(fontString(20, { italic: true })).toMatch(/^italic 20px /);
    expect(fontString(20, { bold: true, italic: true })).toMatch(/^italic bold 20px /);
  });

  it('ignores the plate, which is not part of the font', () => {
    expect(fontString(14, { plate: true })).toBe(fontString(14, {}));
  });
});

describe('setTextStyle', () => {
  it('sets a flag to true, and takes it off the element when it is turned off', () => {
    const el: { bold?: boolean; italic?: boolean; plate?: boolean } = {};
    setTextStyle(el, 'bold', true);
    setTextStyle(el, 'plate', true);
    expect(el).toEqual({ bold: true, plate: true });

    setTextStyle(el, 'bold', false);
    expect(el).toEqual({ plate: true });
    expect('bold' in el).toBe(false); // not left as false: an unstyled element saves as it always did
  });

  it('leaves other flags alone, and turning off one that is not on is nothing', () => {
    const el = { italic: true };
    setTextStyle(el, 'bold', false);
    expect(el).toEqual({ italic: true });
  });
});

describe('plateColorFor', () => {
  const dark = 'rgba(28, 25, 21, 0.86)';
  const light = 'rgba(244, 236, 220, 0.9)';

  it('is a dark plate behind light text', () => {
    for (const color of ['#ffffff', '#fff', '#e8dcc8', '#FFF']) expect(plateColorFor(color)).toBe(dark);
  });

  it('is a light plate behind dark text', () => {
    for (const color of ['#000000', '#000', '#a04040', '#4a7c59', '#8b5e3c', '#5b7fa6']) {
      expect(plateColorFor(color), color).toBe(light);
    }
  });

  it('is a dark plate for a colour it cannot read', () => {
    for (const color of ['red', 'rgb(0,0,0)', '', '#12', '#12345']) expect(plateColorFor(color)).toBe(dark);
  });
});
