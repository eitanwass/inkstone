import { test, expect } from '@playwright/test';
import { resetBoard, worldToScreenFn, boardElements, placeRoom, placeToken } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

test('Ctrl+C / Ctrl+V copies the selection and pastes it at the cursor', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await placeToken(page, toScreen, 500, 220, 'Frodo');

  await page.click('#tool-select');
  let p = toScreen(100, 100);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(600, 350);
  await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();

  await page.keyboard.press('Control+c');
  await expect(page.locator('#toast')).toContainText('Copied');

  p = toScreen(900, 600);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.press('Control+v');
  await expect(page.locator('#toast')).toContainText('Pasted');

  const els = await boardElements(page);
  expect(els).toHaveLength(4); // 2 originals + 2 pasted copies

  // Relative layout between the pasted pair matches the original pair.
  const [room, token, pastedRoom, pastedToken] = els;
  expect(pastedToken.x - pastedRoom.x).toBeCloseTo(token.x - room.x, 0);
  expect(pastedToken.y - pastedRoom.y).toBeCloseTo(token.y - room.y, 0);
});

test('Ctrl+D duplicates the current selection', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#tool-select');
  const p = toScreen(240, 220);
  await page.mouse.click(p.x, p.y);

  await page.keyboard.press('Control+d');
  expect(await boardElements(page)).toHaveLength(2);
});

test('right-click context menu: Copy, Duplicate, and Delete show their shortcuts', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#tool-select');
  const p = toScreen(240, 220);
  await page.mouse.click(p.x, p.y, { button: 'right' });

  await expect(page.locator('#ctx-copy .ctx-shortcut')).toHaveText('Ctrl+C');
  await expect(page.locator('#ctx-duplicate .ctx-shortcut')).toHaveText('Ctrl+D');
  await expect(page.locator('#ctx-delete .ctx-shortcut')).toHaveText('Del');
});

test('right-clicking empty canvas only offers Paste once something is copied', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  let p = toScreen(900, 700);

  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('#canvas-context-menu')).toBeHidden();

  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.click('#tool-select');
  p = toScreen(240, 220);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Control+c');

  p = toScreen(900, 700);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('#canvas-context-menu')).toBeVisible();
  await page.click('#ctx-paste');
  expect(await boardElements(page)).toHaveLength(2);
});
