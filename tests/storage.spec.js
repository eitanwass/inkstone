import { expect, test } from '@playwright/test';
import { placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

test('a browser that refuses to save tells the user once, and the app keeps working', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });
  await resetBoard(page);
  await expect(page.locator('#toast')).toContainText("can't be saved in this browser");
  await expect(page.locator('#toast')).not.toHaveClass(/visible/, { timeout: 10000 }); // let it fade

  // Still usable in memory: a later edit fails to save too, but doesn't nag again.
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.waitForTimeout(300);
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await expect(page.locator('#btn-undo')).toBeEnabled();
  await page.click('#btn-undo');
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('custom colors saved under the old Tavern Map keys carry over', async ({ page }) => {
  await resetBoard(page);
  await page.evaluate(() => {
    localStorage.setItem('tavernmap-custom-stroke', JSON.stringify(['#123456', '#abcdef']));
    localStorage.setItem('tavernmap-custom-fill', JSON.stringify(['#654321']));
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');

  const keys = await page.evaluate(() => ({
    oldStroke: localStorage.getItem('tavernmap-custom-stroke'),
    oldFill: localStorage.getItem('tavernmap-custom-fill'),
    newStroke: localStorage.getItem('inkstone-custom-stroke'),
    newFill: localStorage.getItem('inkstone-custom-fill'),
  }));
  expect(keys.oldStroke).toBeNull();
  expect(keys.oldFill).toBeNull();
  expect(JSON.parse(keys.newStroke)).toEqual(['#123456', '#abcdef']);
  expect(JSON.parse(keys.newFill)).toEqual(['#654321']);

  await page.click('#tool-rect');
  await page.click('#stroke-custom-add');
  await expect(page.locator('#stroke-color-popover .swatch')).toHaveCount(2);
  await expect(page.locator('#stroke-color-popover [title="#123456"]')).toBeVisible();
});

test('existing custom colors are not overwritten by the migration', async ({ page }) => {
  await resetBoard(page);
  await page.evaluate(() => {
    localStorage.setItem('inkstone-custom-stroke', JSON.stringify(['#111111']));
    localStorage.setItem('tavernmap-custom-stroke', JSON.stringify(['#999999']));
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');

  const keys = await page.evaluate(() => ({
    old: localStorage.getItem('tavernmap-custom-stroke'),
    current: localStorage.getItem('inkstone-custom-stroke'),
  }));
  expect(keys.old).toBeNull();
  expect(JSON.parse(keys.current)).toEqual(['#111111']);
});

test('a corrupt saved color list is ignored instead of breaking the picker', async ({ page }) => {
  await resetBoard(page);
  await page.evaluate(() => {
    localStorage.setItem('inkstone-custom-stroke', 'not json');
    localStorage.setItem('inkstone-custom-fill', JSON.stringify({ not: 'a list' }));
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');

  await page.click('#tool-rect');
  await page.click('#stroke-custom-add');
  await expect(page.locator('#stroke-color-popover')).toBeVisible();
  await expect(page.locator('#stroke-color-popover .swatch')).toHaveCount(0);
  await page.click('#fill-custom-add');
  await expect(page.locator('#fill-color-popover')).toBeVisible();
  await expect(page.locator('#fill-color-popover .swatch')).toHaveCount(0);
});
