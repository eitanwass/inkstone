import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeRoom, placeWall, placeToken, placeLabel } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('placing a room adds a rect element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  const els = await boardElements(page);
  expect(els).toHaveLength(1);
  expect(els[0].type).toBe('rect');
});

test('placing a wall adds a wall element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeWall(page, toScreen, 160, 200, 400, 200);
  const els = await boardElements(page);
  expect(els).toHaveLength(1);
  expect(els[0].type).toBe('wall');
});

test('placing a token adds a named token element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 300, 300, 'Aragorn');
  const els = await boardElements(page);
  expect(els).toHaveLength(1);
  expect(els[0]).toMatchObject({ type: 'token', name: 'Aragorn' });
});

test('placing a label adds a text element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeLabel(page, toScreen, 300, 300, 'Throne Room');
  const els = await boardElements(page);
  expect(els).toHaveLength(1);
  expect(els[0]).toMatchObject({ type: 'label', text: 'Throne Room' });
});

test('a too-small room/wall drag is discarded as a stray click', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  // Drag less than GRID*0.3 (12 world units) — below the placement threshold.
  await placeRoom(page, toScreen, 160, 160, 165, 165);
  expect(await boardElements(page)).toHaveLength(0);
});
