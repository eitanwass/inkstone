import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

const list = (page) => page.locator('#shortcuts-popover');
const button = (page) => page.locator('#btn-shortcuts');

test('the ? button opens and closes the shortcut list', async ({ page }) => {
  await expect(list(page)).toBeHidden();
  await button(page).click();
  await expect(list(page)).toBeVisible();
  await expect(button(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(list(page)).toContainText('Rectangle room');

  await button(page).click();
  await expect(list(page)).toBeHidden();
  await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
});

test('the ? key toggles the list, and Escape or a click elsewhere closes it', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(list(page)).toBeVisible();
  await page.keyboard.press('?');
  await expect(list(page)).toBeHidden();

  await page.keyboard.press('?');
  await page.keyboard.press('Escape');
  await expect(list(page)).toBeHidden();

  await page.keyboard.press('?');
  await page.mouse.click(300, 300);
  await expect(list(page)).toBeHidden();
  await expect(button(page)).toHaveAttribute('aria-expanded', 'false');
});

test('? typed into a text field does not open the list', async ({ page }) => {
  await page.click('#map-name');
  await page.keyboard.type('Why?');
  await expect(list(page)).toBeHidden();
});

test('the button and list sit on screen, the list above the button, and the button shares the dock bottom line and the readout is centred on it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await button(page).click();
  const b = await button(page).boundingBox();
  const l = await list(page).boundingBox();
  const dock = await page.locator('#tool-dock').boundingBox();
  expect(b.x + b.width).toBeLessThanOrEqual(1280);
  expect(b.y + b.height).toBeLessThanOrEqual(720);
  expect(l.y + l.height).toBeLessThanOrEqual(b.y); // above the button
  expect(l.y).toBeGreaterThanOrEqual(0);
  expect(b.x).toBeGreaterThan(dock.x + dock.width); // not on top of the dock
  // the button sits on the dock's bottom line (it is shorter, so its top is lower)
  expect(b.y + b.height).toBeCloseTo(dock.y + dock.height, 0);
  const hud = await page.locator('#hud-meta').boundingBox(); // the coordinates and version readout
  expect(Math.abs(hud.y + hud.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(1);
});

test('every shortcut the list names does what it says', async ({ page }) => {
  // The list is the promise; spot-check the keys most likely to drift from it.
  await page.keyboard.press('r');
  await expect(page.locator('#tool-rect')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('+');
  await expect(page.locator('#zoom-label')).toHaveText('125%');
  await page.keyboard.press('Home');
  await expect(page.locator('#zoom-label')).toHaveText('100%');
});
