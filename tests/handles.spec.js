import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeRoom } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

// Room placed at exact grid-aligned world coords (multiples of GRID=40) so
// snapToGrid never shifts them — center (260,220), top edge at y=160,
// rotate handle 24px above that at (260,136).
async function placeGridAlignedRoom(page, toScreen) {
  await placeRoom(page, toScreen, 160, 160, 360, 280);
}

test('rotate handle snaps to 15 degree increments by default', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeGridAlignedRoom(page, toScreen);

  await page.click('#tool-select');
  let p = toScreen(260, 220);
  await page.mouse.click(p.x, p.y);

  p = toScreen(260, 136); // rotate handle
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  // Drag to ~40 degrees above horizontal -> nearest 15-degree step is 45.
  const rad = 40 * Math.PI / 180;
  p = toScreen(260 + 100 * Math.cos(rad), 220 - 100 * Math.sin(rad));
  await page.mouse.move(p.x, p.y, { steps: 10 });
  await page.mouse.up();

  const els = await boardElements(page);
  const deg = els[0].rotation * 180 / Math.PI;
  expect(Math.round(deg)).toBe(45);
});

test('Shift held while rotating gives free (unsnapped) rotation', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeGridAlignedRoom(page, toScreen);

  await page.click('#tool-select');
  let p = toScreen(260, 220);
  await page.mouse.click(p.x, p.y);

  p = toScreen(260, 136);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.keyboard.down('Shift');
  const rad = 40 * Math.PI / 180;
  p = toScreen(260 + 100 * Math.cos(rad), 220 - 100 * Math.sin(rad));
  await page.mouse.move(p.x, p.y, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  const els = await boardElements(page);
  const deg = els[0].rotation * 180 / Math.PI;
  // 40 degrees, free — should NOT have snapped to the nearest 15-degree step (45).
  expect(Math.round(deg) % 15).not.toBe(0);
});

test('resizing a rect from a corner keeps the opposite corner anchored', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeGridAlignedRoom(page, toScreen); // (160,160)-(360,280)

  await page.click('#tool-select');
  let p = toScreen(260, 220);
  await page.mouse.click(p.x, p.y);

  // Drag the se corner (360,280) further out.
  p = toScreen(360, 280);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(440, 360);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();

  const els = await boardElements(page);
  // nw corner (anchor) unchanged; se corner moved with the drag.
  expect(els[0].x).toBeCloseTo(160, 0);
  expect(els[0].y).toBeCloseTo(160, 0);
  expect(els[0].x + els[0].w).toBeGreaterThan(360);
  expect(els[0].y + els[0].h).toBeGreaterThan(280);
});
