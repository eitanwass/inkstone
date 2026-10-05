import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function selectEverything(page) {
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
}

test('Ctrl+A selects every element, so one delete clears them', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await placeRoom(page, toScreen, 400, 160, 520, 280);
  await selectEverything(page);
  await page.keyboard.press('Delete');
  expect(await boardElements(page)).toHaveLength(0);
});

test('arrow keys move the selection one cell, and undo takes it back', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await placeToken(page, toScreen, 500, 220, 'Frodo');
  await selectEverything(page);
  const before = await boardElements(page);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const after = await boardElements(page);
  for (const [i, el] of after.entries()) {
    expect(el.x - before[i].x).toBe(40); // GRID
    expect(el.y - before[i].y).toBe(40);
  }

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await boardElements(page)).toEqual(before);
});

test('arrow keys do nothing with nothing selected', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.keyboard.press('Escape'); // clears the selection the new room has
  const before = await boardElements(page);
  await page.keyboard.press('ArrowLeft');
  expect(await boardElements(page)).toEqual(before);
});

test('plus and minus zoom in steps', async ({ page }) => {
  const label = page.locator('#zoom-label');
  await expect(label).toHaveText('100%');
  await page.keyboard.press('+');
  await expect(label).toHaveText('125%');
  await page.keyboard.press('=');
  await expect(label).toHaveText('156%');
  await page.keyboard.press('-');
  await page.keyboard.press('-');
  await expect(label).toHaveText('100%');
});

test('Escape clears the selection', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await selectEverything(page);
  await page.keyboard.press('Escape');
  const before = await boardElements(page);
  await page.keyboard.press('ArrowRight'); // nothing selected, so nothing moves
  expect(await boardElements(page)).toEqual(before);
});
