import { expect, test } from '@playwright/test';
import { placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The indicator beside the Live pill: a spinner while saving, a check once saved, an X if
// the browser refuses to save.

const status = (page) => page.locator('#save-status');
const state = (page, value) => expect(status(page)).toHaveAttribute('data-state', value);

test('an edit shows saving, then saved, and really is saved', async ({ page }) => {
  await resetBoard(page);
  await state(page, 'saved'); // settles after the load's own save

  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await state(page, 'saving');
  await state(page, 'saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-board')).length)).toBe(1);
});

test('each state shows its own icon, and says what it means to assistive tech', async ({ page }) => {
  await resetBoard(page);
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await state(page, 'saving');
  await expect(status(page)).toHaveAttribute('aria-label', 'Saving…');
  await expect(status(page).locator('.save-saving')).toBeVisible();
  await expect(status(page).locator('.save-saved')).toBeHidden();

  await state(page, 'saved');
  await expect(status(page)).toHaveAttribute('aria-label', 'Saved');
  await expect(status(page).locator('.save-saved')).toBeVisible();
  await expect(status(page).locator('.save-saving')).toBeHidden();
});

test('hovering it says what state it is in', async ({ page }) => {
  await resetBoard(page);
  await state(page, 'saved');
  await expect(status(page)).toHaveAttribute('title', 'Saved');
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await state(page, 'saving');
  await expect(status(page)).toHaveAttribute('title', 'Saving…');
});

test('a failed save says so on hover', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
  });
  await resetBoard(page);
  await state(page, 'failed');
  await expect(status(page)).toHaveAttribute('title', 'Not saved');
});

test('it is a small chip, inside the action bar, before undo and redo', async ({ page }) => {
  await resetBoard(page);
  const chip = await status(page).boundingBox();
  const cluster = await page.locator('#action-cluster').boundingBox();
  const undo = await page.locator('#btn-undo').boundingBox();
  expect(chip.width).toBeLessThanOrEqual(22);
  expect(chip.height).toBe(chip.width);
  expect(chip.x).toBeGreaterThanOrEqual(cluster.x); // inside the bar
  expect(chip.x + chip.width).toBeLessThanOrEqual(undo.x); // the first thing in it
  expect(chip.y + chip.height / 2).toBeCloseTo(undo.y + undo.height / 2, 0); // on the same line
});

test('renaming the map is saved too', async ({ page }) => {
  await resetBoard(page);
  await state(page, 'saved');
  await page.click('#map-name');
  await page.keyboard.type('The Sunken Crypt');
  await page.keyboard.press('Enter');
  await state(page, 'saving');
  await state(page, 'saved');
  expect(await page.evaluate(() => localStorage.getItem('inkstone-map-name'))).toBe('The Sunken Crypt');
});

test('a burst of edits keeps saving until the last one has settled', async ({ page }) => {
  await resetBoard(page);
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await placeRoom(page, toScreen, 400, 160, 520, 280);
  await state(page, 'saving');
  await state(page, 'saved');
});

test('a browser that refuses to save shows a red X straight away', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  await resetBoard(page);
  await state(page, 'failed');
  await expect(status(page)).toHaveAttribute('aria-label', 'Not saved');
  await expect(status(page).locator('.save-failed')).toBeVisible();
  await page.waitForTimeout(800); // longer than the saving delay: it must not drift to "saved"
  await state(page, 'failed');
});

test('after a failed save, one that works shows saved again', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    window.__failSaves = true;
    Storage.prototype.setItem = function (...args) {
      if (window.__failSaves) throw new DOMException('full', 'QuotaExceededError');
      return real.apply(this, args);
    };
  });
  await resetBoard(page);
  await state(page, 'failed');
  await page.evaluate(() => {
    window.__failSaves = false;
  });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await state(page, 'saved');
});

test('it stays in the action bar while sharing: the Live indicator is in the session panel below', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.routeWebSocket(/\/parties\//, () => {});
  await resetBoard(page);
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await page.keyboard.press('Escape');

  const chip = await status(page).boundingBox();
  const cluster = await page.locator('#action-cluster').boundingBox();
  const pill = await page.locator('#collab-status').boundingBox();
  expect(chip.y + chip.height).toBeLessThanOrEqual(cluster.y + cluster.height); // in the bar
  expect(pill.y).toBeGreaterThan(cluster.y + cluster.height); // the indicator is below it
});
