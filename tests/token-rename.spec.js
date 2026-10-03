import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

let tokenAt;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  // The browser's own prompt() used to handle this; fail loudly if it comes back.
  page.on('dialog', (dialog) => {
    throw new Error(`unexpected native dialog: ${dialog.message()}`);
  });
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160, 'Aragorn');
  tokenAt = toScreen(180, 180); // the token's center is its cell origin plus half a cell
});

async function openRename(page) {
  await page.mouse.click(tokenAt.x, tokenAt.y, { button: 'right' });
  await page.click('#ctx-token-rename');
  await expect(page.locator('#token-rename-overlay')).toBeVisible();
}

test('renaming uses an in-app dialog prefilled with the current name', async ({ page }) => {
  await openRename(page);
  await expect(page.locator('#token-rename-input')).toHaveValue('Aragorn');
  await expect(page.locator('#token-rename-input')).toBeFocused();

  await page.fill('#token-rename-input', 'Strider');
  await page.keyboard.press('Enter');
  await expect(page.locator('#token-rename-overlay')).toBeHidden();

  const [token] = await boardElements(page);
  expect(token.name).toBe('Strider');
});

test('a rename can be undone', async ({ page }) => {
  await openRename(page);
  await page.fill('#token-rename-input', 'Strider');
  await page.click('#token-rename-confirm');

  await page.click('#btn-undo');
  const [token] = await boardElements(page);
  expect(token.name).toBe('Aragorn');
});

test('cancelling, Escape, an empty name, or the same name changes nothing', async ({ page }) => {
  await openRename(page);
  await page.fill('#token-rename-input', 'Nope');
  await page.click('#token-rename-cancel');

  await openRename(page);
  await page.fill('#token-rename-input', 'Nope');
  await page.keyboard.press('Escape');
  await expect(page.locator('#token-rename-overlay')).toBeHidden();

  await openRename(page);
  await page.fill('#token-rename-input', '   ');
  await page.click('#token-rename-confirm');

  await openRename(page);
  await page.click('#token-rename-confirm'); // unchanged

  const [token] = await boardElements(page);
  expect(token.name).toBe('Aragorn');
  // None of that counts as an edit: the only undoable step is placing the token.
  await page.click('#btn-undo');
  expect(await boardElements(page)).toHaveLength(0);
  await expect(page.locator('#btn-undo')).toBeDisabled();
});
