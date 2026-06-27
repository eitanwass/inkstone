import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeRoom, placeWall, placeToken } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('erasing the middle of a wall splits it into two pieces', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeWall(page, toScreen, 160, 200, 720, 200);

  await page.click('#tool-erase');
  const p = toScreen(440, 200); // midpoint
  await page.mouse.click(p.x, p.y);

  const els = await boardElements(page);
  expect(els).toHaveLength(2);
  expect(els.every(e => e.type === 'wall')).toBe(true);
});

test('erasing a rect removes the whole element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#tool-erase');
  const p = toScreen(240, 220); // interior point
  await page.mouse.click(p.x, p.y);

  expect(await boardElements(page)).toHaveLength(0);
});

test('erasing near a token edge (not its exact center) still removes it', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  // Click+drag to make a larger-than-default token so its edge clearly
  // falls in a different grid cell than its center.
  await placeToken(page, toScreen, 400, 400, 'Big', { x: 480, y: 400 });
  const [before] = await boardElements(page);
  expect(before.radius).toBeGreaterThan(40); // confirm it really is large

  await page.click('#tool-erase');
  // A point inside the circle but well off-center.
  const p = toScreen(before.x + before.radius * 0.7, before.y);
  await page.mouse.click(p.x, p.y);

  expect(await boardElements(page)).toHaveLength(0);
});

test('hovering empty space with the erase tool removes nothing on click', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#tool-erase');
  const p = toScreen(800, 800); // far from the room
  await page.mouse.click(p.x, p.y);

  expect(await boardElements(page)).toHaveLength(1);
});
