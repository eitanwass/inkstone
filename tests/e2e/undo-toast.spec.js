import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// After something destructive the toast carries an Undo button, which takes it back.

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

const toast = (page) => page.locator('#toast');
const undoButton = (page) => page.locator('#toast .toast-action');

async function twoRooms(page) {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  await placeRoom(page, toScreen, 400, 160, 520, 240);
  return toScreen;
}

test('Clear All offers Undo, which brings the whole map back', async ({ page }) => {
  await twoRooms(page);
  await page.click('#btn-clear');
  await page.click('#modal-confirm');
  expect(await boardElements(page)).toHaveLength(0);

  await expect(toast(page)).toContainText('Map cleared');
  await expect(undoButton(page)).toBeVisible();
  await undoButton(page).click();
  expect(await boardElements(page)).toHaveLength(2);
  await expect(undoButton(page)).toHaveCount(0); // the button goes once used
});

test('deleting the selection offers Undo too', async ({ page }) => {
  await twoRooms(page);
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  expect(await boardElements(page)).toHaveLength(0);
  await expect(toast(page)).toContainText('2 elements deleted');

  await undoButton(page).click();
  expect(await boardElements(page)).toHaveLength(2);
});

test('removing a token from its menu offers Undo', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160, 'Frodo');
  const p = toScreen(180, 180); // a token's centre is its cell origin plus half a cell
  await page.click('#tool-select');
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.click('#ctx-token-delete');
  await page.click('#modal-confirm');
  expect(await boardElements(page)).toHaveLength(0);

  await undoButton(page).click();
  const els = await boardElements(page);
  expect(els).toHaveLength(1);
  expect(els[0].name).toBe('Frodo');
});

test('the Undo goes away as soon as you do something else, so it cannot undo the wrong thing', async ({
  page,
}) => {
  const toScreen = await twoRooms(page);
  await page.click('#btn-clear');
  await page.click('#modal-confirm');
  await expect(undoButton(page)).toBeVisible();

  const p = toScreen(700, 400);
  await page.mouse.click(p.x, p.y); // any click elsewhere
  await expect(undoButton(page)).toHaveCount(0);
  await expect(toast(page)).not.toHaveClass(/visible/);
});

test('pressing Ctrl on the way to a shortcut does not dismiss it, and Ctrl+Z still works', async ({
  page,
}) => {
  await twoRooms(page);
  await page.click('#btn-clear');
  await page.click('#modal-confirm');
  await page.keyboard.down('Control');
  await expect(undoButton(page)).toBeVisible();
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  expect(await boardElements(page)).toHaveLength(2);
});

test('an ordinary toast has no button and is not clickable', async ({ page }) => {
  await twoRooms(page);
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await expect(toast(page)).toContainText('Copied');
  await expect(undoButton(page)).toHaveCount(0);
  const pointer = await toast(page).evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointer).toBe('none');
});
