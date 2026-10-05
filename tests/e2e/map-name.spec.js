import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

const NAME_KEY = 'inkstone-map-name';
const savedName = (page) => page.evaluate((key) => localStorage.getItem(key), NAME_KEY);

async function rename(page, text) {
  await page.click('#map-name');
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test.describe('naming a map', () => {
  test.beforeEach(async ({ page }) => {
    await resetBoard(page);
  });

  test('an unnamed map says "Untitled map", centred at the top', async ({ page }) => {
    await expect(page.locator('#map-name')).toHaveValue('');
    await expect(page.locator('#map-name')).toHaveAttribute('placeholder', 'Untitled map');
    expect(await page.title()).toBe('Inkstone');

    const viewport = page.viewportSize();
    const box = await page.locator('#map-title').boundingBox();
    expect(box.x + box.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(box.y).toBeLessThan(40);
  });

  test('clicking the name edits it; Enter commits it to the field, the tab title and storage', async ({
    page,
  }) => {
    await rename(page, 'The Sunken Crypt');
    await expect(page.locator('#map-name')).toHaveValue('The Sunken Crypt');
    await expect(page.locator('#map-name')).not.toBeFocused();
    expect(await page.title()).toBe('The Sunken Crypt – Inkstone');
    expect(await savedName(page)).toBe('The Sunken Crypt');
  });

  test('the name survives a reload', async ({ page }) => {
    await rename(page, 'Goblin Warren');
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await expect(page.locator('#map-name')).toHaveValue('Goblin Warren');
    expect(await page.title()).toBe('Goblin Warren – Inkstone');
  });

  test('Escape puts the old name back; clicking away keeps what you typed', async ({ page }) => {
    await rename(page, 'First');

    await page.click('#map-name');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Second');
    await page.keyboard.press('Escape');
    await expect(page.locator('#map-name')).toHaveValue('First');
    expect(await savedName(page)).toBe('First');

    await page.click('#map-name');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Third');
    await page.mouse.click(300, 400); // somewhere on the map
    await expect(page.locator('#map-name')).toHaveValue('Third');
    expect(await savedName(page)).toBe('Third');
  });

  test('names are tidied: trimmed, spaces collapsed, cut at 60 characters', async ({ page }) => {
    await rename(page, '   The    Sunken \t  Crypt   ');
    await expect(page.locator('#map-name')).toHaveValue('The Sunken Crypt');

    await rename(page, 'x'.repeat(100));
    expect((await page.locator('#map-name').inputValue()).length).toBe(60);
  });

  test('clearing the name goes back to "Untitled map" and forgets it', async ({ page }) => {
    await rename(page, 'Temporary');
    await rename(page, '   ');
    await expect(page.locator('#map-name')).toHaveValue('');
    expect(await savedName(page)).toBeNull();
    expect(await page.title()).toBe('Inkstone');
  });

  test('an exported PNG is named after the map', async ({ page }) => {
    const exported = async () => {
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
      return download.suggestedFilename();
    };
    expect(await exported()).toBe('inkstone-map.png');

    await rename(page, 'The Sunken Crypt of Vael!');
    expect(await exported()).toBe('the-sunken-crypt-of-vael.png');
  });

  test('a saved name that is too long or messy is cleaned up on load', async ({ page }) => {
    await page.evaluate((key) => localStorage.setItem(key, `  ${'A'.repeat(100)}  `), NAME_KEY);
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await expect(page.locator('#map-name')).toHaveValue('A'.repeat(60));
  });

  test('an older save with no name loads as an unnamed map', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('inkstone-board', JSON.stringify([{ type: 'rect', x: 0, y: 0, w: 80, h: 80 }]));
      localStorage.removeItem('inkstone-map-name');
    });
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await expect(page.locator('#map-name')).toHaveValue('');
    expect(await boardElements(page)).toHaveLength(1);
  });

  test('renaming is not an undo step, and undo never touches the name', async ({ page }) => {
    await expect(page.locator('#btn-undo')).toBeDisabled();
    await rename(page, 'Named first');
    await expect(page.locator('#btn-undo')).toBeDisabled(); // renaming alone creates nothing to undo

    const toScreen = await worldToScreenFn(page);
    await placeRoom(page, toScreen, 160, 160, 320, 280);
    await rename(page, 'Renamed after');
    await page.click('#btn-undo');

    expect(await boardElements(page)).toHaveLength(0); // the room was undone...
    await expect(page.locator('#map-name')).toHaveValue('Renamed after'); // ...the name was not
    await page.click('#btn-redo');
    expect(await boardElements(page)).toHaveLength(1);
    await expect(page.locator('#map-name')).toHaveValue('Renamed after');
  });

  test('typing in the name does not trigger shortcuts or edit the map', async ({ page }) => {
    const toScreen = await worldToScreenFn(page);
    await placeRoom(page, toScreen, 160, 160, 320, 280);
    await page.click('#tool-select');
    const inside = toScreen(240, 220);
    await page.mouse.click(inside.x, inside.y); // select the room

    await page.click('#map-name');
    await page.keyboard.type('rwtle'); // each letter is a tool shortcut elsewhere
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
    expect(await boardElements(page)).toHaveLength(1); // the selected room wasn't deleted
    await expect(page.locator('#map-name')).toHaveValue('rwtl');
  });

  test('is labelled for assistive technology', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'Map name' })).toBeVisible();
  });
});

// ── live sessions ─────────────────────────────────────────────────

test.describe('the name in a shared session', () => {
  // A stand-in relay that records what the app sends and lets the test send
  // messages back. The route must exist before the page loads.
  async function loadWithRelay(page) {
    const connections = [];
    const sent = [];
    await page.routeWebSocket(/\/parties\//, (ws) => {
      connections.push(ws);
      ws.onMessage((message) => sent.push(JSON.parse(message)));
    });
    await resetBoard(page);
    await page.click('#btn-share');
    await expect(page.locator('#collab-status')).toHaveText('Live');
    // sharing a map with nothing in it still seeds the room once
    await expect.poll(() => sent.length).toBe(1);
    return { connections, sent };
  }

  test('typing sends nothing; finishing sends the name once, with the unchanged map', async ({ page }) => {
    const { sent } = await loadWithRelay(page);
    expect(sent[0]).toEqual({ name: '', elements: [] }); // the seed

    await page.click('#map-name');
    await page.keyboard.type('The Sunken Crypt', { delay: 20 });
    await page.waitForTimeout(250);
    expect(sent).toHaveLength(1); // not one message per letter

    await page.keyboard.press('Enter');
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toEqual({ name: 'The Sunken Crypt', elements: [] });
  });

  test('cancelling a rename sends nothing', async ({ page }) => {
    const { sent } = await loadWithRelay(page);
    await page.click('#map-name');
    await page.keyboard.type('Never mind');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    expect(sent).toHaveLength(1);
  });

  test("a peer's rename arrives without becoming an undo step", async ({ page }) => {
    const { connections } = await loadWithRelay(page);
    connections[0].send(JSON.stringify({ name: 'From a friend', elements: [] }));

    await expect(page.locator('#map-name')).toHaveValue('From a friend');
    expect(await page.title()).toBe('From a friend – Inkstone');
    expect(await savedName(page)).toBe('From a friend');
    await expect(page.locator('#btn-undo')).toBeDisabled();
  });

  test('messages from older clients, with no name, leave the name alone', async ({ page }) => {
    const { connections } = await loadWithRelay(page);
    await rename(page, 'Mine');

    connections[0].send(JSON.stringify([{ type: 'rect', x: 0, y: 0, w: 80, h: 80 }]));
    await expect.poll(() => boardElements(page)).toHaveLength(1);
    await expect(page.locator('#map-name')).toHaveValue('Mine');
  });

  test('a name that is not text is ignored, but the map in the message is still applied', async ({
    page,
  }) => {
    const { connections } = await loadWithRelay(page);
    await rename(page, 'Mine');

    connections[0].send(JSON.stringify({ name: 42, elements: [{ type: 'rect', x: 0, y: 0, w: 80, h: 80 }] }));
    await expect.poll(() => boardElements(page)).toHaveLength(1);
    await expect(page.locator('#map-name')).toHaveValue('Mine');
  });

  test("a peer's rename never overwrites what you are typing", async ({ page }) => {
    const { connections } = await loadWithRelay(page);
    await page.click('#map-name');
    await page.keyboard.type('Half writ');

    connections[0].send(JSON.stringify({ name: 'Peer name', elements: [] }));
    await page.waitForTimeout(300);
    await expect(page.locator('#map-name')).toHaveValue('Half writ'); // untouched while you type
    expect(await page.title()).toBe('Peer name – Inkstone'); // but the shared name is known

    await page.keyboard.press('Escape'); // give up on your edit: the peer's name shows
    await expect(page.locator('#map-name')).toHaveValue('Peer name');
  });
});

// ── layout ────────────────────────────────────────────────────────

const overlaps = (a, b) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const viewports = [
  [1440, 900],
  [1100, 700],
  [1001, 700],
  [1000, 700],
  [900, 700],
  [700, 700],
  [390, 844],
  [844, 390], // a phone on its side
];

test.describe('the map name never collides with the other controls', () => {
  for (const [width, height] of viewports) {
    test(`at ${width}x${height}, with a long name, shared or not`, async ({ page }) => {
      await page.routeWebSocket(/\/parties\//, () => {});
      await page.setViewportSize({ width, height });
      await resetBoard(page);
      await rename(page, 'The Forgotten Halls of the Thrice-Cursed Archmage');

      for (const sharing of [false, true]) {
        if (sharing) {
          await page.click('#btn-share');
          await expect(page.locator('#collab-status')).toBeVisible();
          await page.keyboard.press('Escape');
        }
        const title = await page.locator('#map-title').boundingBox();
        expect(title.x, 'starts on screen').toBeGreaterThanOrEqual(0);
        expect(title.x + title.width, 'ends on screen').toBeLessThanOrEqual(width);

        const others = ['#action-cluster'];
        if (await page.locator('#brand-mark').isVisible()) others.push('#brand-mark');
        if (sharing) others.push('#collab-status');
        for (const selector of others) {
          const box = await page.locator(selector).boundingBox();
          expect(overlaps(title, box), `${selector} overlaps the map name (sharing: ${sharing})`).toBe(false);
        }
      }
    });
  }

  test('on a wide screen the name shares the top row; on narrower ones it moves below', async ({ page }) => {
    const rowOf = async () => {
      const title = await page.locator('#map-title').boundingBox();
      const cluster = await page.locator('#action-cluster').boundingBox();
      return { title, cluster };
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetBoard(page);
    let { title, cluster } = await rowOf();
    expect(title.y).toBeLessThan(cluster.y + cluster.height); // same row

    await page.setViewportSize({ width: 900, height: 700 });
    ({ title, cluster } = await rowOf());
    expect(title.y).toBeGreaterThanOrEqual(cluster.y + cluster.height); // beneath it
  });

  test('a toast does not cover the map name', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetBoard(page);
    await page.click('#btn-export'); // raises a toast ("Map exported!")
    await expect(page.locator('#toast.visible')).toBeVisible();
    const title = await page.locator('#map-title').boundingBox();
    const toast = await page.locator('#toast').boundingBox();
    expect(overlaps(title, toast)).toBe(false);
  });
});
