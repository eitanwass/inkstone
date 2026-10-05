import { expect, test } from '@playwright/test';
import { boardElements, placeLabel, resetBoard, worldToScreenFn } from './helpers.js';

// A label's text is edited in place: double-click it, press Enter on it, or choose "Edit Text" from its
// right-click menu, and a field appears right over it on the map. Enter or clicking away keeps the text
// (one undo step); Escape puts the old text back. There is no dialog. (Placing one is in label-place.spec.js.)

const field = (page) => page.locator('#label-editor');
const texts = async (page) => (await boardElements(page)).map((e) => e.text);

let at; // where the label is on the screen
let toScreen;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await placeLabel(page, toScreen, 160, 160, 'Throne Room');
  at = toScreen(172, 168); // inside the text
  await page.click('#tool-select');
});

test('double-clicking a label puts a field over it, on the map, with its text', async ({ page }) => {
  await expect(field(page)).toBeHidden();
  await page.mouse.dblclick(at.x, at.y);
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toHaveValue('Throne Room');
  await expect(field(page)).toBeFocused();
  await expect(page.locator('#text-label-overlay')).toBeHidden(); // no dialog

  // right where the label is, not off to one side
  const box = await field(page).boundingBox();
  const label = toScreen(160, 160);
  expect(Math.abs(box.x - label.x)).toBeLessThan(10);
  expect(Math.abs(box.y - label.y)).toBeLessThan(10);
});

test('Enter keeps the new text', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('Treasury');
  await page.keyboard.press('Enter');
  await expect(field(page)).toBeHidden();
  expect(await texts(page)).toEqual(['Treasury']);
});

test('clicking away keeps it too', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('Treasury');
  await page.mouse.click(700, 600);
  await expect(field(page)).toBeHidden();
  expect(await texts(page)).toEqual(['Treasury']);
});

test('Escape puts the old text back', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('Never mind');
  await page.keyboard.press('Escape');
  await expect(field(page)).toBeHidden();
  expect(await texts(page)).toEqual(['Throne Room']);
  await page.click('#btn-undo'); // nothing was recorded: the only step is placing it
  expect(await boardElements(page)).toEqual([]);
});

test('Enter with the label selected starts the edit, and with nothing selected does nothing', async ({
  page,
}) => {
  await page.keyboard.press('Enter');
  await expect(field(page)).toBeHidden();

  await page.mouse.click(at.x, at.y);
  await page.keyboard.press('Enter');
  await expect(field(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('Throne Room');
});

test('"Edit Text" is in a label’s right-click menu, and only there', async ({ page }) => {
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(page.locator('#ctx-edit-text')).toBeVisible();
  await page.click('#ctx-edit-text');
  await expect(field(page)).toBeFocused();
  await field(page).fill('Vault');
  await page.keyboard.press('Enter');
  expect(await texts(page)).toEqual(['Vault']);

  // a room's menu has no such item
  await page.click('#tool-rect');
  await page.mouse.move(400, 500);
  await page.mouse.down();
  await page.mouse.move(520, 580, { steps: 4 });
  await page.mouse.up();
  await page.click('#tool-select');
  await page.mouse.click(460, 540, { button: 'right' });
  await expect(page.locator('#context-menu')).toBeVisible();
  await expect(page.locator('#ctx-edit-text')).toBeHidden();
});

test('an edit is one undo step, and undo puts the old text back', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('Treasury');
  await page.keyboard.press('Enter');
  await page.click('#btn-undo');
  expect(await texts(page)).toEqual(['Throne Room']);
  await page.click('#btn-redo');
  expect(await texts(page)).toEqual(['Treasury']);
});

test('saving the same text, or blank, changes nothing and is no undo step', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  await page.keyboard.press('Enter'); // as it was
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('   ');
  await page.keyboard.press('Enter'); // blank
  expect(await texts(page)).toEqual(['Throne Room']);

  await page.click('#btn-undo'); // the only step left to undo is placing the label
  expect(await boardElements(page)).toEqual([]);
});

test('the field grows with the text, and follows the label when the map is zoomed', async ({ page }) => {
  await page.mouse.dblclick(at.x, at.y);
  const before = await field(page).boundingBox();

  await field(page).fill('Throne Room of the Forgotten King');
  const wider = await field(page).boundingBox();
  expect(wider.width).toBeGreaterThan(before.width + 40);

  // zooming in with the wheel (which doesn't end the edit) makes the field bigger, still over the label
  await page.mouse.move(900, 700); // over the map, not the field
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
  await expect(field(page)).toBeVisible();
  await expect.poll(async () => (await field(page).boundingBox()).width).toBeGreaterThan(wider.width * 1.3);
  const zoomed = await field(page).boundingBox();
  expect(zoomed.x).toBeLessThan(wider.x); // zoomed toward the cursor, so the label moved away from it
});

test('the edit is sent to a shared session as one change to the label', async ({ page }) => {
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
  await page.click('#tool-select');
  await page.mouse.dblclick(at.x, at.y);
  await field(page).fill('Treasury');
  await page.keyboard.press('Enter');

  await expect.poll(() => sent.at(-1)?.type).toBe('changes');
  expect(sent.at(-1).changes).toEqual([
    { t: 'set', el: expect.objectContaining({ type: 'label', text: 'Treasury' }) },
  ]);
});
