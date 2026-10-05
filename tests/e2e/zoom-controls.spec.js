import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

const label = (page) => page.locator('#zoom-label');

test('the + and - buttons zoom in and out, and match the keys', async ({ page }) => {
  await expect(label(page)).toHaveText('100%');
  await page.click('#btn-zoom-in');
  await expect(label(page)).toHaveText('125%');
  await page.click('#btn-zoom-out');
  await page.click('#btn-zoom-out');
  await expect(label(page)).toHaveText('80%');
  await page.keyboard.press('+');
  await expect(label(page)).toHaveText('100%');
});

test('fit frames the whole map in the free part of the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  await placeRoom(page, toScreen, 1000, 500, 1150, 560);
  await page.click('#btn-zoom-fit');

  // The zoom that takes both rooms in, with room left for the panels (96px above,
  // 112px below, 48px at the sides).
  const els = await boardElements(page);
  const w = Math.max(...els.map((e) => e.x + e.w)) - Math.min(...els.map((e) => e.x));
  const h = Math.max(...els.map((e) => e.y + e.h)) - Math.min(...els.map((e) => e.y));
  const box = await page.locator('#interaction-canvas').boundingBox();
  const zoom = Math.min(2, (box.width - 96) / w, (box.height - 96 - 112) / h);
  await expect(label(page)).toHaveText(`${Math.round(zoom * 100)}%`);

  // And the dock really is below the allowance, so the map isn't hidden behind it.
  const dockTop = (await page.locator('#tool-dock').boundingBox()).y;
  expect(dockTop).toBeGreaterThan(box.y + 96 + 112); // the allowance really does clear the dock
});

test('fit centres a map in the free area', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 1100, 560);
  await page.click('#btn-zoom-fit');
  await page.click('#tool-select');
  const box = await page.locator('#interaction-canvas').boundingBox();
  // Middle of the free area: (640, 96 + (720 - 96 - 112) / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + 96 + (box.height - 96 - 112) / 2);
  await page.keyboard.press('Delete');
  expect(await boardElements(page)).toHaveLength(0);
});

test('fit does not blow a small map up past 200%', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 200, 200);
  await page.click('#btn-zoom-fit');
  await expect(label(page)).toHaveText('200%');
});

test('the F key fits the map, like the button', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 200, 200);
  await page.keyboard.press('f');
  await expect(label(page)).toHaveText('200%');
});

test('fit on an empty map goes home', async ({ page }) => {
  await page.click('#btn-zoom-in');
  await page.click('#btn-zoom-fit');
  await expect(label(page)).toHaveText('100%');
});

test('the zoom panel sits level with the tool dock', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const zoom = await page.locator('#zoom-controls').boundingBox();
  const dock = await page.locator('#tool-dock').boundingBox();
  expect(zoom.y).toBeCloseTo(dock.y, 0);
  expect(zoom.height).toBeCloseTo(dock.height, 0);
  expect(zoom.x + zoom.width).toBeLessThan(dock.x); // clear of the dock
});
