import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// My Maps: several maps in this browser, in the library under a line of their own.

const modal = (page) => page.locator('#library-modal');
const myCards = (page) => page.locator('.library-card-wrap');
const mapName = (page) => page.locator('#map-name');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function openMine(page) {
  await page.click('#btn-library');
  await expect(modal(page)).toBeVisible();
  await page.click('#library-mine');
  await expect(page.locator('#library-new-map')).toBeVisible();
}

async function rename(page, text) {
  await page.click('#map-name');
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

async function drawRoom(page, x2 = 160) {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, x2, 120);
}

test('My Maps is a section above a line, apart from the library types, and lists the map on the board', async ({
  page,
}) => {
  await page.click('#btn-library');
  await expect(modal(page)).toBeVisible();
  const mine = page.locator('#library-mine');
  await expect(mine).toHaveText('My Maps');
  await expect(page.locator('#library-kinds .library-separator')).toHaveCount(1);
  const [mineBox, lineBox, mapsBox] = await Promise.all([
    mine.boundingBox(),
    page.locator('.library-separator').boundingBox(),
    page.locator('.library-kind').first().boundingBox(),
  ]);
  expect(lineBox.y).toBeGreaterThan(mineBox.y + mineBox.height - 1);
  expect(mapsBox.y).toBeGreaterThan(lineBox.y);

  // Only one map so far, so it opens on the samples, as it always did.
  await expect(mine).toHaveAttribute('aria-pressed', 'false');
  await mine.click();
  await expect(mine).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.library-kind[aria-pressed="true"]')).toHaveCount(0);
  await expect(myCards(page)).toHaveCount(1);
  await expect(page.locator('#library-count')).toHaveText('1 map');
  await expect(myCards(page).first()).toContainText('Untitled map');
  await expect(myCards(page).first()).toContainText('On the board now');
});

test('a new map is empty, and the one you were on is kept, with its name and a picture', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'The Sunken Crypt');

  await openMine(page);
  await page.click('#library-new-map');
  await expect(modal(page)).toBeHidden();
  await expect(page.locator('#toast')).toContainText('New map');
  expect(await boardElements(page)).toHaveLength(0);
  await expect(mapName(page)).toHaveValue('');

  await page.click('#btn-library');
  await expect(page.locator('#library-mine')).toHaveAttribute('aria-pressed', 'true'); // there is more than one now
  await expect(myCards(page)).toHaveCount(2);
  await expect(myCards(page).nth(0)).toContainText('Untitled map');
  await expect(myCards(page).nth(0)).toContainText('On the board now');
  const crypt = myCards(page).filter({ hasText: 'The Sunken Crypt' });
  await expect(crypt).toContainText('Kept just now');
  await expect(crypt.locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
});

test('switching brings a map back as it was, and the other one is kept in its place', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'First');
  await openMine(page);
  await page.click('#library-new-map');
  await drawRoom(page, 240);
  await drawRoom(page, 280);
  await rename(page, 'Second');
  expect(await boardElements(page)).toHaveLength(2);

  await page.click('#btn-library');
  await myCards(page).filter({ hasText: 'First' }).locator('.library-card').click();
  await expect(modal(page)).toBeHidden();
  await expect(mapName(page)).toHaveValue('First');
  expect(await boardElements(page)).toHaveLength(1);
  await expect(page.locator('#toast')).toContainText('Opened "First"');

  // Undo can't go back into the other map, and Second is waiting.
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await page.click('#btn-library');
  await myCards(page).filter({ hasText: 'Second' }).locator('.library-card').click();
  await expect(mapName(page)).toHaveValue('Second');
  expect(await boardElements(page)).toHaveLength(2);
});

test('the map on the board survives a reload as before, whichever map it is', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'First');
  await openMine(page);
  await page.click('#library-new-map');
  await drawRoom(page, 200);
  await rename(page, 'Second');
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(mapName(page)).toHaveValue('Second');
  expect(await boardElements(page)).toHaveLength(1);
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
});

test('a blank map is not kept when you leave it', async ({ page }) => {
  await openMine(page);
  await page.click('#library-new-map'); // the map on the board is blank already: nothing changes
  await openMine(page);
  await expect(myCards(page)).toHaveCount(1);
  await page.keyboard.press('Escape');

  await drawRoom(page);
  await openMine(page);
  await page.click('#library-new-map'); // the room is kept, and the board is blank
  await openMine(page);
  await expect(myCards(page)).toHaveCount(2);
  await page.click('#library-new-map'); // blank again: not another map
  await openMine(page);
  await expect(myCards(page)).toHaveCount(2);
});

test('deleting a kept map asks first, and forgets it for good', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'Doomed');
  await openMine(page);
  await page.click('#library-new-map');
  await page.click('#btn-library');
  const doomed = myCards(page).filter({ hasText: 'Doomed' });
  await doomed.hover();
  await doomed.getByRole('button', { name: 'Delete Doomed' }).click();
  await expect(page.locator('#modal-message')).toContainText('Delete "Doomed"?');

  await page.click('#modal-cancel'); // it is still there
  await expect(myCards(page)).toHaveCount(2);

  await doomed.hover();
  await doomed.getByRole('button', { name: 'Delete Doomed' }).click();
  await page.click('#modal-confirm');
  await expect(myCards(page)).toHaveCount(1);
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('inkstone-map:')),
  );
  expect(keys).toEqual([]);
});

test('deleting the map on the board puts the one kept most recently there', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'Kept');
  await openMine(page);
  await page.click('#library-new-map');
  await drawRoom(page, 220);
  await rename(page, 'Here');

  await page.click('#btn-library');
  const here = myCards(page).filter({ hasText: 'On the board now' });
  await here.hover();
  await here.getByRole('button', { name: 'Delete Here' }).click();
  await page.click('#modal-confirm');
  await expect(mapName(page)).toHaveValue('Kept');
  expect(await boardElements(page)).toHaveLength(1);
  await expect(myCards(page)).toHaveCount(1);
});

test('the search finds your maps by name', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'The Sunken Crypt');
  await openMine(page);
  await page.click('#library-new-map');
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
  await page.fill('#library-search', 'crypt');
  await expect(myCards(page)).toHaveCount(1);
  await expect(page.locator('#library-count')).toHaveText('1 of 2 maps');
  await page.fill('#library-search', 'dragon');
  await expect(page.locator('#library-message')).toHaveText('Nothing matches those filters.');
});

test('a map that was saved before there were several is the first one, untouched', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'inkstone-board',
      JSON.stringify([{ type: 'label', x: 320, y: 320, text: 'Old', fontSize: 20 }]),
    );
    localStorage.setItem('inkstone-map-name', 'From before');
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(mapName(page)).toHaveValue('From before');
  await page.click('#btn-library');
  await page.click('#library-mine');
  await expect(myCards(page)).toHaveCount(1);
  await expect(myCards(page).first()).toContainText('From before');
});

test('a broken index or a missing map is dealt with, not trusted', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'inkstone-maps',
      '{"current":"m-1","maps":[{"id":"m-gone","name":"Ghost","updated":1}]}',
    );
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.click('#btn-library');
  await page.click('#library-mine');
  await expect(myCards(page)).toHaveCount(2);
  await myCards(page).filter({ hasText: 'Ghost' }).locator('.library-card').click();
  await expect(page.locator('#toast')).toContainText("Couldn't open that map");
  await page.click('#btn-library');
  await page.click('#library-mine');
  await expect(myCards(page)).toHaveCount(1);

  await page.evaluate(() => localStorage.setItem('inkstone-maps', 'not json'));
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.click('#btn-library');
  await page.click('#library-mine');
  await expect(myCards(page)).toHaveCount(1);
});

test('a sample opens as a map of its own and the map you were on stays in My Maps', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'Mine');
  await page.click('#btn-library');
  await page.locator('.library-card', { hasText: 'The Rusty Flagon' }).click();
  await expect(mapName(page)).toHaveValue('The Rusty Flagon');
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
  await expect(myCards(page).filter({ hasText: 'Mine' })).toBeVisible();
});

test('the library with My Maps open has no accessibility problems', async ({ page }) => {
  await drawRoom(page);
  await rename(page, 'First');
  await openMine(page);
  await page.click('#library-new-map');
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
  const results = await new AxeBuilder({ page }).include('#library-modal').analyze();
  expect(results.violations).toEqual([]);
});

// A stand-in relay: gives a fresh room to whoever says hello, and acknowledges what it is sent.
async function shareWithMockRelay(page) {
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (message.type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
      } else if (message.type === 'doc' || message.type === 'changes') {
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: 0, fix: [] }));
      }
    });
  });
  await resetBoard(page);
  await drawRoom(page);
  await rename(page, 'Shared');
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await page.keyboard.press('Escape');
}

test('moving to another map while the board is shared live asks first, and leaving ends the session', async ({
  page,
}) => {
  await shareWithMockRelay(page);
  expect(page.url()).toContain('session=');

  await openMine(page);
  await page.click('#library-new-map');
  await expect(page.locator('#modal-message')).toContainText('shared live');
  await expect(page.locator('#modal-confirm')).toHaveText('Leave session');

  await page.click('#modal-cancel'); // nothing changed: still in the session, on the same map
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect(mapName(page)).toHaveValue('Shared');

  await openMine(page);
  await page.click('#library-new-map');
  await page.click('#modal-confirm');
  await expect(page.locator('#collab-status')).toBeHidden();
  expect(page.url()).not.toContain('session=');
  expect(await boardElements(page)).toHaveLength(0);

  // The shared map was kept, as a map of yours.
  await page.click('#btn-library');
  await expect(myCards(page).filter({ hasText: 'Shared' })).toBeVisible();
});
