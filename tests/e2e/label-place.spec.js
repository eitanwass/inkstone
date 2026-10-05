import { expect, test } from '@playwright/test';
import { boardElements, resetBoard, worldToScreenFn } from './helpers.js';

// The text tool: a click puts a new, empty label there, selected and open for typing, with its card beside
// it. It is part of the map (and the undo history) only once it has text. There is no dialog, and the tool
// has no stroke or font controls on the toolbar: size and colour are in the label's card.

const field = (page) => page.locator('#label-editor');
const card = (page) => page.locator('#label-card');
const texts = async (page) => (await boardElements(page)).map((e) => e.text);

let toScreen;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await page.click('#tool-text');
});

const clickAt = (page, x, y) => {
  const p = toScreen(x, y);
  return page.mouse.click(p.x, p.y);
};

test('a click opens an empty field right there, and the label’s card, with no dialog', async ({ page }) => {
  await clickAt(page, 320, 320);
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('');
  await expect(card(page)).toBeVisible();
  await expect(page.locator('#text-label-overlay')).toHaveCount(0);

  const box = await field(page).boundingBox();
  const at = toScreen(320, 320);
  expect(Math.abs(box.x - at.x)).toBeLessThan(10);
  expect(Math.abs(box.y - at.y)).toBeLessThan(10);

  const cardBox = await card(page).boundingBox();
  expect(cardBox.y + cardBox.height).toBeLessThan(box.y); // above it
});

test('the toolbar has no stroke or font controls for the text tool', async ({ page }) => {
  await expect(page.locator('#style-panel')).toBeHidden();
  await clickAt(page, 320, 320);
  await expect(page.locator('#style-panel')).toBeHidden();
});

test('typing and pressing Enter adds the label, selected, as one undo step', async ({ page }) => {
  await clickAt(page, 320, 320);
  expect(await boardElements(page)).toEqual([]); // not on the saved map until it has text
  await page.keyboard.type('Throne Room');
  await page.keyboard.press('Enter');

  const [label] = await boardElements(page);
  expect(label).toMatchObject({ type: 'label', text: 'Throne Room', fontSize: 14, strokeColor: '#e8dcc8' });
  await expect(field(page)).toBeHidden();
  await expect(card(page)).toBeVisible(); // still selected, to be styled

  await page.click('#btn-undo');
  expect(await boardElements(page)).toEqual([]);
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('a label with no text, or one given up with Escape, was never there', async ({ page }) => {
  await clickAt(page, 320, 320);
  await page.keyboard.press('Enter'); // blank
  await expect(field(page)).toBeHidden();
  await expect(card(page)).toBeHidden();
  expect(await boardElements(page)).toEqual([]);

  await clickAt(page, 320, 320);
  await page.keyboard.type('Never mind');
  await page.keyboard.press('Escape');
  await expect(field(page)).toBeHidden();
  expect(await boardElements(page)).toEqual([]);

  await expect(page.locator('#btn-undo')).toBeDisabled(); // not even an undo step
});

test('clicking elsewhere keeps the label and starts the next one there', async ({ page }) => {
  await clickAt(page, 320, 320);
  await page.keyboard.type('One');
  await clickAt(page, 640, 480);
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toHaveValue('');
  expect(await texts(page)).toEqual(['One']);

  await page.keyboard.type('Two');
  await page.keyboard.press('Enter');
  expect(await texts(page)).toEqual(['One', 'Two']);
});

test('its size and colour can be set before typing, and are kept', async ({ page }) => {
  await clickAt(page, 320, 320);
  await page.locator('#label-size').fill('30');
  await page.getByRole('button', { name: 'Gold' }).click();
  await expect(field(page)).toBeVisible(); // using the card does not end it, or lose a label with no text yet
  await expect(card(page)).toBeVisible();

  await field(page).click();
  await page.keyboard.type('Big gold');
  await page.keyboard.press('Enter');
  expect((await boardElements(page))[0]).toMatchObject({
    text: 'Big gold',
    fontSize: 30,
    strokeColor: '#c9a84c',
  });

  await page.click('#btn-undo'); // adding it was one step, whatever it was given along the way
  expect(await boardElements(page)).toEqual([]);
});

test('the next new label starts as the last one was set', async ({ page }) => {
  await clickAt(page, 320, 320);
  await page.keyboard.type('One');
  await page.locator('#label-size').fill('24');
  await page.getByRole('button', { name: 'Blood' }).click();
  await page.mouse.click(900, 700); // done with it (and, with the text tool, starts another label there)
  await expect(field(page)).toBeVisible();
  await page.keyboard.type('Two');
  await page.keyboard.press('Enter');

  const [, two] = await boardElements(page);
  expect(two).toMatchObject({ text: 'Two', fontSize: 24, strokeColor: '#a04040' });
});

test('a label with no text yet is not sent to a shared session, and is, once it has', async ({ page }) => {
  const sent = [];
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (message.type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
      } else {
        sent.push(message);
      }
    });
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect.poll(() => sent.map((m) => m.type)).toEqual(['doc']);

  await page.click('#tool-text');
  await clickAt(page, 320, 320);
  await page.locator('#label-size').fill('30'); // styled while still empty
  await page.waitForTimeout(300);
  expect(sent.map((m) => m.type)).toEqual(['doc']); // nothing yet

  await field(page).click();
  await page.keyboard.type('Treasury');
  await page.keyboard.press('Enter');
  await expect.poll(() => sent.at(-1)?.type).toBe('changes');
  expect(sent.at(-1).changes).toEqual([
    { t: 'set', el: expect.objectContaining({ type: 'label', text: 'Treasury', fontSize: 30 }) },
  ]);
  expect(sent.filter((m) => m.type === 'changes')).toHaveLength(1);
});

test('clicking an existing label opens it to edit, as the select tool does, and places nothing new', async ({
  page,
}) => {
  await clickAt(page, 320, 320);
  await page.keyboard.type('Throne Room');
  await page.keyboard.press('Enter');
  await page.mouse.click(900, 700); // done with it, and starts another label, which is blank and so goes
  await page.keyboard.press('Escape');
  expect(await texts(page)).toEqual(['Throne Room']);

  await clickAt(page, 332, 328); // on the label
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toHaveValue('Throne Room');
  await expect(field(page)).toBeFocused();
  await expect(card(page)).toBeVisible(); // it is selected, so its card shows
  await page.keyboard.type('Treasury'); // the text was selected, so this replaces it
  await page.keyboard.press('Enter');
  expect(await texts(page)).toEqual(['Treasury']); // changed, not added to

  await page.click('#btn-undo');
  expect(await texts(page)).toEqual(['Throne Room']);
});

test('clicking an existing label while another is being typed keeps that one and opens this one', async ({
  page,
}) => {
  await clickAt(page, 320, 320);
  await page.keyboard.type('First');
  await page.keyboard.press('Enter');
  await clickAt(page, 640, 480);
  await page.keyboard.type('Second');
  await clickAt(page, 332, 328); // back on the first, mid-way through the second
  await expect(field(page)).toHaveValue('First');
  expect(await texts(page)).toEqual(['First', 'Second']);
});

test('a click on a room (not a label) with the text tool places a label on it', async ({ page }) => {
  await page.click('#tool-rect');
  const a = toScreen(320, 320);
  const b = toScreen(560, 480);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await page.click('#tool-text');
  await clickAt(page, 440, 400); // inside the room
  await page.keyboard.type('Armoury');
  await page.keyboard.press('Enter');
  expect((await boardElements(page)).map((e) => e.type)).toEqual(['rect', 'label']);
});

// Dragging with the text tool marks out the area for the text: its top left corner, and its height is
// the font size (at the default zoom a world unit is a pixel on screen).
const drag = async (page, from, to) => {
  const a = toScreen(from[0], from[1]);
  const b = toScreen(to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
};

test('dragging marks out the area for the text, and its height is the font size', async ({ page }) => {
  await drag(page, [320, 320], [520, 360]); // 40 high
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveCSS('font-size', '40px');
  await expect(page.locator('#label-size')).toHaveValue('40');
  const box = await field(page).boundingBox();
  const at = toScreen(320, 320);
  expect(Math.abs(box.x - at.x)).toBeLessThan(10);
  expect(Math.abs(box.y - at.y)).toBeLessThan(10);

  await page.keyboard.type('Great Hall');
  await page.keyboard.press('Enter');
  expect((await boardElements(page))[0]).toMatchObject({ text: 'Great Hall', fontSize: 40, x: 320, y: 320 });
});

test('the area can be dragged in any direction, and sets the label at its top left', async ({ page }) => {
  await drag(page, [520, 400], [320, 360]); // up and to the left
  await page.keyboard.type('Hall');
  await page.keyboard.press('Enter');
  expect((await boardElements(page))[0]).toMatchObject({ fontSize: 40, x: 320, y: 360 });
});

test('the size is kept between the smallest and the largest a label can be', async ({ page }) => {
  await drag(page, [320, 320], [520, 322]); // nearly flat
  await page.keyboard.type('Small');
  await page.keyboard.press('Enter');
  await page.mouse.click(900, 700);
  await page.keyboard.press('Escape');
  await drag(page, [320, 420], [520, 800]); // 380 high
  await page.keyboard.type('Huge');
  await page.keyboard.press('Enter');
  expect((await boardElements(page)).map((e) => e.fontSize)).toEqual([8, 72]);
});

test('a drag sizes that label only: it is not what the next new label starts as', async ({ page }) => {
  await drag(page, [320, 320], [520, 360]);
  await page.keyboard.type('Big');
  await page.keyboard.press('Enter');
  await page.mouse.click(900, 700);
  await page.keyboard.type('Plain');
  await page.keyboard.press('Enter');
  expect((await boardElements(page)).map((e) => e.fontSize)).toEqual([40, 14]);
});

test('a drag of a few pixels is still a click', async ({ page }) => {
  const at = toScreen(320, 320);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 2, at.y + 2);
  await page.mouse.up();
  await expect(page.locator('#label-size')).toHaveValue('14'); // not the 2px it was dragged
});

test('dragging an area gives up nothing when the label is left blank', async ({ page }) => {
  await drag(page, [320, 320], [520, 360]);
  await page.keyboard.press('Enter');
  expect(await boardElements(page)).toEqual([]);
  await expect(page.locator('#btn-undo')).toBeDisabled();
});

test('a plain click while panning or with another tool places nothing', async ({ page }) => {
  await page.click('#tool-select');
  await clickAt(page, 320, 320);
  await expect(field(page)).toBeHidden();
  expect(await boardElements(page)).toEqual([]);
});
