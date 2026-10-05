import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// A token is placed as a plain disc: no dialog, no name, no text. A name is added afterwards, from
// the token's own menu.

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function openMenu(page, toScreen, world = { x: 180, y: 180 }) {
  const p = toScreen(world.x, world.y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
}

test('placing a token asks for nothing: it appears at once, without a name', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160); // no name given
  await expect(page.locator('.input-overlay:not(.hidden)')).toHaveCount(0); // no dialog opened
  const [token] = await boardElements(page);
  expect(token).toMatchObject({ type: 'token', x: 180, y: 180 });
  expect(token.name).toBeUndefined();
  expect(token.color).toBeTruthy();
});

test('it is one undo step, and says nothing about a name in a toast', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  await expect(page.locator('#toast')).not.toContainText('placed');
  await page.click('#btn-undo');
  expect(await boardElements(page)).toHaveLength(0);
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('a token dragged out to a bigger size is placed at that size, unnamed', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 400, 400, undefined, { x: 480, y: 400 });
  const [token] = await boardElements(page);
  expect(token.radius).toBeGreaterThan(20);
  expect(token.name).toBeUndefined();
});

test('tokens placed one after another take different colours', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  for (let i = 0; i < 4; i++) await placeToken(page, toScreen, 120 + i * 80, 160);
  const colours = (await boardElements(page)).map((t) => t.color);
  expect(new Set(colours).size).toBe(4);
});

test('placing several in a row is quick: click, click, click', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await page.click('#tool-token');
  for (let i = 0; i < 5; i++) {
    const p = toScreen(120 + i * 80, 300);
    await page.mouse.click(p.x, p.y);
  }
  expect(await boardElements(page)).toHaveLength(5);
});

test('nothing about naming gets in the way while placing: no card, no field', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  await expect(page.locator('#token-card')).toBeHidden(); // the token tool is still in use
  await expect(page.locator('#token-name-field')).toBeHidden();
});

test('removing an unnamed token does not ask about a name it does not have', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  await openMenu(page, toScreen);
  await page.click('#ctx-token-delete');
  await expect(page.locator('#modal-message')).toHaveText('Remove this token?');
  await page.click('#modal-cancel');

  // and the same from the keyboard
  await page.click('#tool-select');
  const p = toScreen(180, 180);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Delete');
  await expect(page.locator('#modal-message')).toHaveText('Remove this token?');
});

test('a named token still says its name when removed', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160, 'Gimli');
  await openMenu(page, toScreen);
  await page.click('#ctx-token-delete');
  await expect(page.locator('#modal-message')).toHaveText('Remove token "Gimli"?');
});

test('an unnamed token can be moved like any other', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  await page.click('#tool-select');
  const from = toScreen(180, 180);
  const to = toScreen(260, 260);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  const [moved] = await boardElements(page);
  expect(moved.x).toBe(260);
  expect(moved.y).toBe(260);
});
