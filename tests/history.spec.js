import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('undo then redo restores the placed element', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  expect(await boardElements(page)).toHaveLength(1);

  await page.click('#btn-undo');
  expect(await boardElements(page)).toHaveLength(0);
  await expect(page.locator('#btn-undo')).toBeDisabled();

  await page.click('#btn-redo');
  expect(await boardElements(page)).toHaveLength(1);
  await expect(page.locator('#btn-redo')).toBeDisabled();
});

test('undo/redo buttons are disabled at the start and end of history', async ({ page }) => {
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('#btn-redo')).toBeDisabled();
});

test('the board persists across a reload', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(300);

  expect(await boardElements(page)).toHaveLength(1);
  await expect(page.locator('#toast')).toContainText('restored');
  // A fresh reload starts a new history baseline — nothing to undo to yet.
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('Ctrl+Z undoes, and both Ctrl+Y and Ctrl+Shift+Z redo', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.keyboard.press('Control+z');
  expect(await boardElements(page)).toHaveLength(0);

  await page.keyboard.press('Control+y');
  expect(await boardElements(page)).toHaveLength(1);

  await page.keyboard.press('Control+z');
  expect(await boardElements(page)).toHaveLength(0);

  await page.keyboard.press('Control+Shift+Z');
  expect(await boardElements(page)).toHaveLength(1);
});
