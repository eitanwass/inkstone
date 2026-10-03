import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// The ruler measures in feet, 5 ft a square, and drawing a shape shows how big it is. The numbers
// are drawn on the canvas; #measure-readout carries the same text for assistive tech and for these tests.

const readout = (page) => page.locator('#measure-readout');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function drag(page, toScreen, from, to, { release = true } = {}) {
  const a = toScreen(from.x, from.y);
  const b = toScreen(to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  if (release) await page.mouse.up();
}

test.describe('the ruler', () => {
  test('is in the dock and on the M key', async ({ page }) => {
    await page.keyboard.press('m');
    await expect(page.locator('#tool-ruler')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#tool-select');
    await page.click('#tool-ruler');
    await expect(page.locator('#tool-ruler')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#style-panel')).toBeHidden(); // nothing to style
  });

  test('measures a straight line at 5 ft a square', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 200 + 6 * 40, y: 200 });
    await expect(readout(page)).toHaveText('30 ft');
  });

  test('a 45° line is longer than a straight one with the same reach', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 200 + 6 * 40, y: 200 });
    await expect(readout(page)).toHaveText('30 ft');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 200 + 6 * 40, y: 200 + 6 * 40 });
    await expect(readout(page)).toHaveText('42.4 ft'); // 30 ft × √2
  });

  test('measures the true straight-line distance (a 3-4-5 line is 25 ft)', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 200 + 3 * 40, y: 200 + 4 * 40 });
    await expect(readout(page)).toHaveText('25 ft');
  });

  test('updates as it is dragged, in half squares', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 200 + 60, y: 200 }, { release: false });
    await expect(readout(page)).toHaveText('7.5 ft'); // a square and a half
    await page.mouse.up();
  });

  test('runs from the middle of one token to the middle of another', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await placeToken(page, toScreen, 160, 160, 'Aragorn');
    await placeToken(page, toScreen, 160 + 4 * 40, 160, 'Gimli');
    await page.keyboard.press('m');
    // Tokens sit at their cell origin plus half a cell
    await drag(page, toScreen, { x: 180, y: 180 }, { x: 180 + 4 * 40, y: 180 });
    await expect(readout(page)).toHaveText('20 ft');
  });

  test('stays up after letting go, and goes with a click, Escape or another tool', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 400, y: 200 });
    await expect(readout(page)).toHaveText('25 ft');
    await page.waitForTimeout(300);
    await expect(readout(page)).toHaveText('25 ft'); // still there to be read

    await page.keyboard.press('Escape');
    await expect(readout(page)).toHaveText('');

    await drag(page, toScreen, { x: 200, y: 200 }, { x: 400, y: 200 });
    await expect(readout(page)).toHaveText('25 ft');
    const p = toScreen(600, 400);
    await page.mouse.click(p.x, p.y); // a click that goes nowhere clears it
    await expect(readout(page)).toHaveText('');

    await drag(page, toScreen, { x: 200, y: 200 }, { x: 400, y: 200 });
    await page.click('#tool-select');
    await expect(readout(page)).toHaveText('');
  });

  test('leaves nothing on the map: not saved, and not an undo step', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('m');
    await drag(page, toScreen, { x: 200, y: 200 }, { x: 400, y: 200 });
    expect(await boardElements(page)).toHaveLength(0);
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('the shortcut list names it', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-popover')).toContainText('Measure distance');
  });
});

test.describe('the size of a shape', () => {
  test('a room shows a ruler on its width and another on its height while it is drawn', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('r');
    await drag(page, toScreen, { x: 160, y: 160 }, { x: 160 + 6 * 40, y: 160 + 4 * 40 }, { release: false });
    await expect(readout(page)).toHaveText('30 ft × 20 ft');
    await page.mouse.up();
    await expect(readout(page)).toHaveText(''); // gone once it is placed
  });

  test('a room dragged up and to the left shows the same sizes', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('r');
    await drag(page, toScreen, { x: 400, y: 400 }, { x: 400 - 3 * 40, y: 400 - 2 * 40 }, { release: false });
    await expect(readout(page)).toHaveText('15 ft × 10 ft');
    await page.mouse.up();
  });

  test('a wall shows its length while it is drawn', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('w');
    await drag(page, toScreen, { x: 160, y: 160 }, { x: 160 + 5 * 40, y: 160 }, { release: false });
    await expect(readout(page)).toHaveText('25 ft');
    await page.mouse.up();
  });

  test('a token shows its width in whole squares while it is dragged out', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('t');
    // Dragged out to a 2-square-wide (Large) token: radius of one square
    await drag(page, toScreen, { x: 160, y: 160 }, { x: 160 + 20 + 40, y: 180 }, { release: false });
    await expect(readout(page)).toHaveText('10 ft');
    await page.mouse.up();
  });

  test('resizing a placed room shows its new size, and not after letting go', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('r');
    await drag(page, toScreen, { x: 160, y: 160 }, { x: 160 + 4 * 40, y: 160 + 3 * 40 });
    await page.keyboard.press('v');
    const inside = toScreen(160 + 80, 160 + 60);
    await page.mouse.click(inside.x, inside.y); // select it: handles appear

    // The south-east corner handle sits on the room's corner
    const corner = toScreen(160 + 4 * 40, 160 + 3 * 40);
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    const to = toScreen(160 + 6 * 40, 160 + 4 * 40);
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await expect(readout(page)).toHaveText('30 ft × 20 ft');
    await page.mouse.up();
    await expect(readout(page)).toHaveText('');
  });

  test('moving a room shows no size', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await page.keyboard.press('r');
    await drag(page, toScreen, { x: 160, y: 160 }, { x: 320, y: 280 });
    await page.keyboard.press('v');
    await drag(page, toScreen, { x: 240, y: 220 }, { x: 320, y: 260 }, { release: false });
    await expect(readout(page)).toHaveText('');
    await page.mouse.up();
  });
});
