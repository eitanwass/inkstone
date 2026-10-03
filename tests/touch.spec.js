import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, touch, worldToScreenFn } from './helpers.js';

// Where a fixed screen point sits in the world, as the HUD's grid readout shows it.
async function worldCellAt(page, x, y) {
  await page.mouse.move(x, y);
  return page.locator('#cursor-pos').textContent();
}

async function canvasCenter(page) {
  const box = await page.locator('#interaction-canvas').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('a one-finger drag draws like the mouse does', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await page.click('#tool-rect');
  const from = toScreen(160, 160);
  const to = toScreen(320, 280);

  await touch(page, 'pointerdown', 1, from.x, from.y);
  await touch(page, 'pointermove', 1, to.x, to.y);
  await touch(page, 'pointerup', 1, to.x, to.y);

  const elements = await boardElements(page);
  expect(elements).toHaveLength(1);
  expect(elements[0]).toMatchObject({ type: 'rect', w: 160, h: 120 });
});

test('pinching zooms around the midpoint and clamps at the limits', async ({ page }) => {
  const { x, y } = await canvasCenter(page);
  const before = await worldCellAt(page, x, y);

  await touch(page, 'pointerdown', 1, x - 50, y);
  await touch(page, 'pointerdown', 2, x + 50, y);
  await touch(page, 'pointermove', 1, x - 100, y);
  await touch(page, 'pointermove', 2, x + 100, y);
  await expect(page.locator('#zoom-label')).toHaveText('200%');

  // Spreading far past the limit stops at the maximum zoom.
  await touch(page, 'pointermove', 2, x + 2000, y);
  await expect(page.locator('#zoom-label')).toHaveText('800%');

  // Back to a 2x spread; the world point under the midpoint never moved.
  await touch(page, 'pointermove', 2, x + 100, y);
  await touch(page, 'pointerup', 2, x + 100, y);
  await touch(page, 'pointerup', 1, x - 100, y);
  await expect(page.locator('#zoom-label')).toHaveText('200%');
  expect(await worldCellAt(page, x, y)).toBe(before);
});

test('two fingers dragging together pan without changing the zoom', async ({ page }) => {
  const { x, y } = await canvasCenter(page);
  const before = await worldCellAt(page, x, y);

  await touch(page, 'pointerdown', 1, x, y);
  await touch(page, 'pointerdown', 2, x + 100, y);
  await touch(page, 'pointermove', 1, x + 80, y);
  await touch(page, 'pointermove', 2, x + 180, y);
  await touch(page, 'pointerup', 2, x + 180, y);
  await touch(page, 'pointerup', 1, x + 80, y);

  await expect(page.locator('#zoom-label')).toHaveText('100%');
  // The map moved 80px (2 cells) right, so the same screen point is 2 cells further left.
  const [bx] = before.split(', ').map(Number);
  const [ax] = (await worldCellAt(page, x, y)).split(', ').map(Number);
  expect(ax).toBe(bx - 2);
});

test('a second finger cancels a drawing in progress instead of committing it', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await page.click('#tool-rect');
  const from = toScreen(160, 160);
  const to = toScreen(320, 280);

  await touch(page, 'pointerdown', 1, from.x, from.y);
  await touch(page, 'pointermove', 1, to.x, to.y);
  await touch(page, 'pointerdown', 2, to.x + 60, to.y);
  await touch(page, 'pointerup', 2, to.x + 60, to.y);
  await touch(page, 'pointerup', 1, to.x, to.y);

  expect(await boardElements(page)).toHaveLength(0);
});

test('holding a finger on an element opens its context menu without moving it', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.click('#tool-select');
  const [placed] = await boardElements(page);
  const p = toScreen(240, 220);

  await touch(page, 'pointerdown', 1, p.x, p.y);
  await expect(page.locator('#context-menu')).toBeVisible({ timeout: 2000 });
  await touch(page, 'pointerup', 1, p.x, p.y);

  expect(await boardElements(page)).toEqual([placed]);
});

test('moving the finger before the hold completes cancels the long-press menu', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.click('#tool-select');
  const p = toScreen(240, 220);

  await touch(page, 'pointerdown', 1, p.x, p.y);
  await touch(page, 'pointermove', 1, p.x + 30, p.y);
  await page.waitForTimeout(700);
  await expect(page.locator('#context-menu')).toBeHidden();
  await touch(page, 'pointerup', 1, p.x + 30, p.y);
});
