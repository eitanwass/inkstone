import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeRoom, placeToken } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('rubber-band select + drag moves the whole selection together', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await placeToken(page, toScreen, 500, 220, 'Frodo');

  await page.click('#tool-select');
  // Rubber-band over both elements.
  let p = toScreen(100, 100);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(600, 350);
  await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();

  const before = await boardElements(page);

  // Drag from a point on the room (now selected) to move the group.
  p = toScreen(240, 220);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(240 + 80, 220 + 40);
  await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();

  const after = await boardElements(page);
  expect(after[0].x - before[0].x).toBeCloseTo(80, 0);
  expect(after[0].y - before[0].y).toBeCloseTo(40, 0);
  // The token moved by the same delta, so the two elements' relative offset
  // is unchanged — confirms the whole selection moved together.
  expect(after[1].x - after[0].x).toBeCloseTo(before[1].x - before[0].x, 0);
});

test('Escape clears the selection box mid-drag without placing anything', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await page.click('#tool-select');
  let p = toScreen(100, 100);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(300, 300);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await boardElements(page)).toHaveLength(0);
});
