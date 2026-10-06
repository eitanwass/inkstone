import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The welcome on an empty map: there whenever nothing is on the map, gone while something is.

const hint = (page) => page.locator('#first-visit-hint');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('an empty map greets a new visitor', async ({ page }) => {
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toContainText('Start your map');
  await expect(hint(page)).toContainText('saved in this browser');
  await expect(page.locator('.hint-help')).toBeVisible(); // the arrow towards the ? button
});

test('the welcome is a single short line of instruction', async ({ page }) => {
  const line = page.locator('.hint-welcome p').first();
  await expect(line).toHaveText('Pick a tool below and drag on the map.');
  const box = await line.boundingBox();
  expect(box.height).toBeLessThan(24); // one line of 14px text
});

test('a second arrow points at the Share button and says what it is for', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const callout = page.locator('.hint-share');
  await expect(callout).toBeVisible();
  await expect(callout).toContainText('Share live with your friends');

  // The arrow's tip (12px in from the left edge of its drawing) is under the Share button.
  const tip = (await callout.locator('svg').boundingBox()).x + 12;
  const share = await page.locator('#btn-share').boundingBox();
  expect(Math.abs(tip - (share.x + share.width / 2))).toBeLessThan(16);
  expect((await callout.boundingBox()).y).toBeGreaterThan(share.y + share.height); // below it, not on it
});

test('the Share arrow gives way to the Share popover', async ({ page }) => {
  await page.click('#btn-share');
  await expect(page.locator('#share-popover')).toBeVisible();
  await expect(page.locator('.hint-share')).toBeHidden();
  await expect(page.locator('.hint-help')).toBeVisible(); // the other arrow is unaffected
});

test('it never takes clicks: a room can be drawn right through it', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  const welcome = await page.locator('.hint-welcome').boundingBox();
  // Draw starting in the middle of the welcome text.
  const start = { x: welcome.x + welcome.width / 2, y: welcome.y + welcome.height / 2 };
  const box = await page.locator('#interaction-canvas').boundingBox();
  const wx = start.x - toScreen(0, 0).x;
  const wy = start.y - toScreen(0, 0).y;
  expect(box.width).toBeGreaterThan(0);
  await placeRoom(page, toScreen, wx, wy, wx + 160, wy + 120);
  expect(await boardElements(page)).toHaveLength(1);
});

test('it goes while something is on the map, and is there again whenever the map is empty', async ({
  page,
}) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await expect(hint(page)).toBeHidden();

  await page.click('#btn-undo'); // back to an empty map
  expect(await boardElements(page)).toHaveLength(0);
  await expect(hint(page)).toBeVisible();

  await page.click('#btn-redo');
  await expect(hint(page)).toBeHidden();

  await page.reload(); // a saved map has something on it
  await page.waitForSelector('#tool-rect');
  await expect(hint(page)).toBeHidden();
});

test('clearing the map brings it back', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await expect(hint(page)).toBeHidden();
  await page.click('#btn-clear');
  await page.click('#modal-confirm');
  await expect(hint(page)).toBeVisible();
  await expect(page.locator('.hint-library')).toBeVisible();
});

test('an empty map shows it on every visit, not only the first', async ({ page }) => {
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(hint(page)).toBeVisible();
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(hint(page)).toBeVisible();
});

test('someone with a saved map never sees it', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(hint(page)).toBeHidden(); // the map is not empty
});

test('the arrow gives way to the shortcut list it points at', async ({ page }) => {
  await expect(page.locator('.hint-help')).toBeVisible();
  await page.click('#btn-shortcuts');
  await expect(page.locator('#shortcuts-popover')).toBeVisible();
  await expect(page.locator('.hint-help')).toBeHidden();
  await expect(hint(page)).toBeVisible(); // the welcome itself stays
});

test('on a phone it keeps the welcome but not the key hints or the arrow to a button it lacks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator('.hint-welcome')).toBeVisible();
  await expect(page.locator('.hint-keys')).toBeHidden();
  await expect(page.locator('.hint-help')).toBeHidden();
  await expect(page.locator('.hint-share')).toBeHidden();
  const welcome = await page.locator('.hint-welcome').boundingBox();
  expect(welcome.x).toBeGreaterThanOrEqual(0);
  expect(welcome.x + welcome.width).toBeLessThanOrEqual(390);
});

test('it stays clear of the panels around it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const welcome = await page.locator('.hint-welcome').boundingBox();
  const rail = await page.locator('#action-cluster').boundingBox();
  const dock = await page.locator('#tool-dock').boundingBox();
  expect(welcome.y).toBeGreaterThan(rail.y + rail.height);
  expect(welcome.y + welcome.height).toBeLessThan(dock.y);
});

// A third callout points at the library button, under the logo, with the same open book.
test('a callout points at the library button and says what it is for', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const callout = page.locator('.hint-library');
  await expect(callout).toBeVisible();
  await expect(callout).toContainText('start from an example map');
  await expect(callout.locator('use')).toHaveAttribute('href', '/icons.svg#icon-book'); // the button's own icon
  await expect(page.locator('#btn-library use')).toHaveAttribute('href', '/icons.svg#icon-book');

  // The arrow's tip (14px in from the left edge of its drawing) is under the button, in its middle.
  const tip = (await callout.locator('svg').first().boundingBox()).x + 14;
  const button = await page.locator('#btn-library').boundingBox();
  expect(Math.abs(tip - (button.x + button.width / 2))).toBeLessThan(12);
  expect((await callout.boundingBox()).y).toBeGreaterThan(button.y + button.height - 6); // below it, not on it
});

test('on a narrower screen, where the button moves down, the callout moves with it', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const button = await page.locator('#btn-library').boundingBox();
  const callout = await page.locator('.hint-library').boundingBox();
  expect(callout.y).toBeGreaterThan(button.y + button.height - 6);
  expect(callout.y).toBeLessThan(button.y + button.height + 30); // right under it, not left where it was
});

test('the library callout takes no clicks, and goes with the rest of the welcome', async ({ page }) => {
  expect(await page.locator('.hint-library').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe(
    'none',
  );
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, 160, 120);
  await expect(page.locator('.hint-library')).toBeHidden();
});
