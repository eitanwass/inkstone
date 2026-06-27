import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeToken } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('a plain click places a token at the default radius', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 200, 200, 'Small');
  const [el] = await boardElements(page);
  expect(el.radius).toBeCloseTo(16.8, 1);
});

test('a tiny incidental jitter while clicking stays at the default radius', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  // Click world (400,200) -> true center (420,220); drag only 8 units from
  // that center, well inside the dead zone below the default radius.
  await placeToken(page, toScreen, 400, 200, 'Jitter', { x: 428, y: 220 });
  const [el] = await boardElements(page);
  expect(el.radius).toBeCloseTo(16.8, 1);
});

test('dragging while placing snaps the radius to grid-cell-diameter steps', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  // True center for a click at (600,200) is (620,220). Drag to (625,200):
  // distance ~20.6 -> snaps to the nearest GRID/2 step, 20.
  await placeToken(page, toScreen, 600, 200, 'Step1', { x: 625, y: 200 });
  const [el] = await boardElements(page);
  expect(el.radius).toBe(20);
});

test('the dragged radius is clamped to a sane maximum', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 300, 500, 'Capped', { x: 550, y: 500 });
  const [el] = await boardElements(page);
  expect(el.radius).toBe(100); // GRID * 2.5
});

test('an already-placed token can be resized via its single SE handle and stays circular', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 500, 400, 'Resizeme');
  let [tok] = await boardElements(page);
  const { x: cx, y: cy, radius: startRadius } = tok;
  const a = Math.PI / 4;

  await page.click('#tool-select');
  let p = toScreen(cx, cy);
  await page.mouse.click(p.x, p.y);

  // Drag the SE handle (sitting on the circle's edge at 45deg) outward.
  p = toScreen(cx + startRadius * Math.cos(a), cy + startRadius * Math.sin(a));
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(cx + 90 * Math.cos(a), cy + 90 * Math.sin(a));
  await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();

  [tok] = await boardElements(page);
  expect(tok.radius).toBeGreaterThan(startRadius);
  expect(tok.x).toBe(cx); // center doesn't drift during resize
  expect(tok.y).toBe(cy);

  // Drag the same handle inward to shrink it back down.
  p = toScreen(cx + tok.radius * Math.cos(a), cy + tok.radius * Math.sin(a));
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(cx + 25 * Math.cos(a), cy + 25 * Math.sin(a));
  await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();

  [tok] = await boardElements(page);
  expect(tok.radius).toBe(20); // nearest GRID/2 step to a 25-unit drag
  expect(tok.x).toBe(cx);
  expect(tok.y).toBe(cy);
});

test('a selected token shows no rotate handle (rotating a circle is a no-op)', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 500, 400, 'NoRotate');
  const [tok] = await boardElements(page);

  await page.click('#tool-select');
  const p = toScreen(tok.x, tok.y);
  await page.mouse.click(p.x, p.y);

  // The rotate handle for a rect/wall sits 24px (screen px, zoom=1) off the
  // shape itself; confirm nothing reacts to a grab gesture up there for a token.
  const above = toScreen(tok.x, tok.y - tok.radius - 24);
  await page.mouse.move(above.x, above.y);
  const cursor = await page.evaluate(() => document.getElementById('interaction-canvas').style.cursor);
  expect(cursor).not.toBe('grab');
});
