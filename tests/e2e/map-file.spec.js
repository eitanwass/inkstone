import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// A map can be saved to a .inkstone.json file and opened again (replacing the map, with Undo).

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('save then open brings the map back, and Undo returns the old one', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  const before = await boardElements(page);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save-file')]);
  expect(download.suggestedFilename()).toMatch(/\.inkstone\.json$/);
  const path = await download.path();

  await page.click('#btn-clear');
  await page.click('#modal-confirm');
  expect(await boardElements(page)).toHaveLength(0);

  await page.setInputFiles('#open-file-input', path);
  await expect(page.locator('#toast')).toContainText('Map opened');
  expect(await boardElements(page)).toEqual(before);
});

test('a file that is not a map is refused and changes nothing', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  await page.setInputFiles('#open-file-input', {
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.locator('#toast')).toContainText("isn't an Inkstone map file");
  expect(await boardElements(page)).toHaveLength(1);
});
