import { expect, test } from '@playwright/test';
import { boardElements, placeLabel, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// Click a label and its card appears next to it, with its size and its colour. A change shows on the map
// as it is made and is one undo step.

const card = (page) => page.locator('#label-card');
const label = async (page) => (await boardElements(page))[0];

let at; // inside the label on the screen
let toScreen;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await placeLabel(page, toScreen, 320, 320, 'Throne Room');
  at = toScreen(332, 328);
  await page.click('#tool-select');
});

const select = (page) => page.mouse.click(at.x, at.y);

test.describe('showing', () => {
  test('is not there until a label is clicked, and is above it', async ({ page }) => {
    await expect(card(page)).toBeHidden();
    await select(page);
    await expect(card(page)).toBeVisible();
    const box = await card(page).boundingBox();
    expect(box.y + box.height).toBeLessThan(toScreen(320, 320).y); // above the label
  });

  test('goes when something else is selected or nothing is, and is not for other tools', async ({ page }) => {
    await select(page);
    await expect(card(page)).toBeVisible();
    await page.mouse.click(900, 700); // empty map
    await expect(card(page)).toBeHidden();

    await placeRoom(page, toScreen, 640, 160, 800, 280);
    await page.click('#tool-select');
    await select(page);
    await page.keyboard.down('Shift');
    await page.mouse.click(...(({ x, y }) => [x, y])(toScreen(700, 220)));
    await page.keyboard.up('Shift');
    await expect(card(page)).toBeHidden(); // two things selected

    await page.mouse.click(900, 700);
    await select(page);
    await page.click('#tool-rect');
    await expect(card(page)).toBeHidden();
  });

  test('follows the label when the map is zoomed', async ({ page }) => {
    await select(page);
    const before = await card(page).boundingBox();
    await page.mouse.move(900, 700);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
    await expect.poll(async () => (await card(page).boundingBox()).x).not.toBe(before.x);
  });

  test('is there with the in-place field, and does not stop it', async ({ page }) => {
    await page.mouse.dblclick(at.x, at.y);
    await expect(page.locator('#label-editor')).toBeVisible();
    await expect(card(page)).toBeVisible();
  });
});

test.describe('size', () => {
  test('starts at the label’s own size and moves it, as one undo step', async ({ page }) => {
    await select(page);
    await expect(page.locator('#label-size')).toHaveValue('14');
    await expect(page.locator('#label-size-value')).toHaveText('14');

    await page.locator('#label-size').fill('32');
    await expect(page.locator('#label-size-value')).toHaveText('32');
    expect((await label(page)).fontSize).toBe(32);

    await page.click('#btn-undo');
    expect((await label(page)).fontSize).toBe(14);
    await page.click('#btn-redo');
    expect((await label(page)).fontSize).toBe(32);
  });

  test('stays where it is while the size is changed, instead of following the label as it grows', async ({
    page,
  }) => {
    await select(page);
    const before = await card(page).boundingBox();
    const slider = await page.locator('#label-size').boundingBox();
    // drag the slider by hand, as a player does, from one end to the other and back
    await page.mouse.move(slider.x + 4, slider.y + slider.height / 2);
    await page.mouse.down();
    for (const frac of [0.2, 0.5, 0.9, 0.3]) {
      await page.mouse.move(slider.x + slider.width * frac, slider.y + slider.height / 2, { steps: 4 });
      expect(await card(page).boundingBox()).toEqual(before);
    }
    await page.mouse.up();
    expect((await label(page)).fontSize).not.toBe(14);
    expect(await card(page).boundingBox()).toEqual(before); // and not after it is let go either
  });

  test('is read from a label that has no size of its own (an older save)', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem(
        'inkstone-board',
        JSON.stringify([{ type: 'label', x: 320, y: 320, text: 'Old' }]),
      ),
    );
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.click('#tool-select');
    await page.mouse.click(332, 328);
    await expect(page.locator('#label-size')).toHaveValue('14');
  });
});

test.describe('colour', () => {
  test('a swatch recolours the label, is marked, and is one undo step', async ({ page }) => {
    await select(page);
    const gold = page.getByRole('button', { name: 'Gold' });
    await expect(page.getByRole('button', { name: 'Parchment' })).toHaveAttribute('aria-pressed', 'true');

    await gold.click();
    expect((await label(page)).strokeColor).toBe('#c9a84c');
    await expect(gold).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Parchment' })).toHaveAttribute('aria-pressed', 'false');

    await page.click('#btn-undo');
    expect((await label(page)).strokeColor).toBe('#e8dcc8');
  });

  test('the ring takes any colour, and is marked when it is not one of the swatches', async ({ page }) => {
    await select(page);
    await page.locator('#label-color-custom').fill('#123456');
    expect((await label(page)).strokeColor).toBe('#123456');
    await expect(page.locator('#label-colors .token-swatch-custom')).toHaveClass(/selected/);
    for (const swatch of await page.locator('#label-colors button').all()) {
      await expect(swatch).toHaveAttribute('aria-pressed', 'false');
    }
    await page.click('#btn-undo');
    expect((await label(page)).strokeColor).toBe('#e8dcc8');
  });

  test('picking the colour it already has is not an edit', async ({ page }) => {
    await select(page);
    await page.getByRole('button', { name: 'Parchment' }).click();
    await page.click('#btn-undo'); // the only step left is placing the label
    expect(await boardElements(page)).toEqual([]);
  });
});

test('a change is sent to a shared session as one change to the label', async ({ page }) => {
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
  await select(page);
  await page.getByRole('button', { name: 'Gold' }).click();

  await expect.poll(() => sent.at(-1)?.type).toBe('changes');
  expect(sent.at(-1).changes).toEqual([
    { t: 'set', el: expect.objectContaining({ type: 'label', strokeColor: '#c9a84c' }) },
  ]);
});
