import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// Duplicating a token whose name ends in a number numbers the copy on: "Goblin 1" gives "Goblin 2".

let toScreen;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
});

const names = async (page) => (await boardElements(page)).map((t) => t.name);
// A token at (x, y) has its centre half a square in from its cell's corner.
const centre = (x, y) => toScreen(Math.round(x / 40) * 40 + 20, Math.round(y / 40) * 40 + 20);

async function selectToken(page, x, y) {
  await page.click('#tool-select');
  const p = centre(x, y);
  await page.mouse.click(p.x, p.y);
}

test('a copy of "Goblin 1" is "Goblin 2"', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Goblin 1', 'Goblin 2']);
});

test('and keeps going: the copy is selected, so duplicating again makes "Goblin 3", "Goblin 4"', async ({
  page,
}) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await selectToken(page, 160, 160);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4']);
});

test('the number is the next after the highest in use, so copying an earlier one does not repeat a number', async ({
  page,
}) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  await page.keyboard.press('Control+d'); // Goblin 1, 2, 3 now

  await selectToken(page, 160, 160); // back to the first
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4']);
});

test('only the same words count: another pack keeps its own numbers', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await placeToken(page, toScreen, 400, 160, 'Orc 7');
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Goblin 1', 'Orc 7', 'Goblin 2']);
});

test('a name with no number at the end is copied as it is', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Gandalf');
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Gandalf', 'Gandalf']);
});

test('so is a token with no name at all', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160);
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual([undefined, undefined]);
  expect(await boardElements(page)).toHaveLength(2);
});

test('the copy has the same color and size, one square down and to the right', async ({ page }) => {
  await placeToken(page, toScreen, 400, 400, 'Troll 1', { x: 480, y: 400 }); // a big one
  await selectToken(page, 400, 400);
  await page.keyboard.press('Control+d');
  const [original, copy] = await boardElements(page);
  expect(copy.color).toBe(original.color);
  expect(copy.radius).toBe(original.radius);
  expect(copy.x - original.x).toBe(40);
  expect(copy.y - original.y).toBe(40);
  expect(copy.name).toBe('Troll 2');
});

test('several selected at once are numbered in turn', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Orc 1');
  await placeToken(page, toScreen, 400, 160, 'Orc 2');
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Orc 1', 'Orc 2', 'Orc 3', 'Orc 4']);
});

test('a room and a token duplicated together: only the token is renamed', async ({ page }) => {
  await page.keyboard.press('r');
  const a = toScreen(480, 300);
  const b = toScreen(600, 380);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  const els = await boardElements(page);
  expect(els.filter((e) => e.type === 'rect')).toHaveLength(2);
  expect(els.filter((e) => e.type === 'token').map((t) => t.name)).toEqual(['Goblin 1', 'Goblin 2']);
});

test('the whole duplicate is one undo step, and takes its numbers back with it', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Orc 1');
  await placeToken(page, toScreen, 400, 160, 'Orc 2');
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  await page.click('#btn-undo');
  expect(await names(page)).toEqual(['Orc 1', 'Orc 2']);
});

test('the card shows the new name for the selected copy', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await selectToken(page, 160, 160);
  await page.keyboard.press('Control+d');
  await expect(page.locator('#token-name-field')).toHaveValue('Goblin 2');
});

test('the token menu has Duplicate: a numbered copy of just that token', async ({ page }) => {
  await placeToken(page, toScreen, 160, 160, 'Goblin 1');
  await placeToken(page, toScreen, 400, 160, 'Orc 1');
  await page.click('#tool-select');
  await page.keyboard.press('Control+a'); // both selected: the menu still acts on the one clicked
  const p = centre(160, 160);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('#ctx-token-duplicate')).toContainText('Duplicate');
  await expect(page.locator('#ctx-token-duplicate')).toContainText('Ctrl+D');
  await page.click('#ctx-token-duplicate');
  expect(await names(page)).toEqual(['Goblin 1', 'Orc 1', 'Goblin 2']);
});

test('naming a token with a number in the card, then duplicating, is the whole workflow for a pack', async ({
  page,
}) => {
  await placeToken(page, toScreen, 160, 160);
  await selectToken(page, 160, 160);
  await page.fill('#token-name-field', 'Skeleton 1');
  await page.keyboard.press('Enter'); // keep the name; the token stays selected
  for (let i = 0; i < 4; i++) await page.keyboard.press('Control+d');
  expect(await names(page)).toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3', 'Skeleton 4', 'Skeleton 5']);
});
