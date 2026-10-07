import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// A session is a table, and the table holds maps (the floors of a building) and is on one of them: joining puts
// your map away, bringing a map to the table moves everyone to it, the table's own maps are moved between from the
// Share popover, and a move by someone else changes your board without touching your own maps.

const modal = (page) => page.locator('#library-modal');
const myCards = (page) => page.locator('.library-card-wrap');
const mapName = (page) => page.locator('#map-name');
const tableMaps = (page) => page.locator('#share-maps .table-map-go');

// Loads the app with a stand-in relay (which has to be there before the page loads) that behaves like the real
// one for a table: it keeps the maps (`relay.maps`, each { id, name, elements }), which one is current, applies
// the changes it is sent to it, and tells everyone `switch` when the table moves. A room that already exists is
// made by setting `relay.maps` and `relay.current` any time before joining. It records what it is sent.
async function loadWithMockRelay(page) {
  const relay = { maps: [], current: '', received: [], sockets: [] };
  let rev = 0;
  const here = () => relay.maps.find((m) => m.id === relay.current);
  const list = () => relay.maps.map((m) => ({ id: m.id, name: m.name }));
  const contents = () => ({
    epoch: 'e1',
    rev,
    name: here().name,
    map: relay.current,
    maps: list(),
    elements: here().elements,
  });
  const toAll = (message) => {
    for (const ws of relay.sockets) ws.send(JSON.stringify(message));
  };
  relay.moveTo = (id) => {
    relay.current = id;
    rev++;
    toAll({ type: 'switch', ...contents() });
  };

  await page.routeWebSocket(/\/parties\//, (ws) => {
    relay.sockets.push(ws);
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      relay.received.push(message);
      if (message.type === 'hello') {
        if (relay.maps.length) rev ||= 3;
        ws.send(
          JSON.stringify(
            relay.maps.length
              ? { type: 'doc', fresh: false, ...contents() }
              : { type: 'doc', fresh: true, epoch: '', rev: 0, name: '', map: '', maps: [], elements: [] },
          ),
        );
      } else if (message.type === 'doc') {
        relay.maps = [{ id: message.map, name: message.name, elements: message.elements }];
        relay.current = message.map;
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: 0, fix: [] }));
      } else if (message.type === 'changes') {
        if (message.map && message.map !== relay.current) {
          ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev, fix: [] }));
          return;
        }
        for (const c of message.changes) {
          if (c.t === 'set') {
            const at = here().elements.findIndex((el) => el.id === c.el.id);
            if (at < 0) here().elements.push(c.el);
            else here().elements[at] = c.el;
          } else if (c.t === 'del') here().elements = here().elements.filter((el) => el.id !== c.id);
          else if (c.t === 'name') here().name = c.name;
        }
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: ++rev, fix: [] }));
      } else if (message.type === 'addmap') {
        if (!relay.maps.some((m) => m.id === message.map)) {
          // a full table lets its oldest map (not the one it is on) go, as the real relay does
          while (relay.maps.length >= 10) {
            const oldest = relay.maps.find((m) => m.id !== relay.current);
            relay.maps = relay.maps.filter((m) => m !== oldest);
          }
          relay.maps.push({ id: message.map, name: message.name, elements: message.elements });
        }
        relay.moveTo(message.map);
      } else if (message.type === 'goto') {
        if (message.map !== relay.current) relay.moveTo(message.map);
      } else if (message.type === 'dropmap') {
        relay.maps = relay.maps.filter((m) => m.id !== message.map || m.id === relay.current);
        toAll({ type: 'maps', current: relay.current, maps: list() });
      }
    });
  });
  await resetBoard(page);
  return relay;
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

async function openMine(page) {
  await page.click('#btn-library');
  await expect(modal(page)).toBeVisible();
  await page.click('#library-mine');
  await expect(page.locator('#library-new-map')).toBeVisible();
}

// Shares the map on the board (the mock room is fresh, so it becomes the table's first map).
async function share(page) {
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
}

// Brings a new, empty map to the table, confirming the question.
async function bringNewMap(page) {
  await openMine(page);
  await page.click('#library-new-map');
  await expect(page.locator('#modal-confirm')).toHaveText('Bring to the table');
  await page.click('#modal-confirm');
}

test('joining a table puts your map away in My Maps, and the table map takes its place', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Mine');
  const [room] = await boardElements(page);
  relay.maps = [
    { id: 'table-map', name: 'The Table', elements: [{ ...room, id: 'table-room', x: 400, y: 400 }] },
  ];
  relay.current = 'table-map';
  await page.click('#btn-join');
  await page.fill('#join-code-input', 'a-table-code');
  await page.click('#join-connect-btn');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect(mapName(page)).toHaveValue('The Table');
  expect((await boardElements(page)).map((el) => el.id)).toEqual(['table-room']);

  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
  await expect(myCards(page).filter({ hasText: 'Mine' })).toContainText('Kept just now');
  await expect(myCards(page).filter({ hasText: 'The Table' })).toContainText('On the board now');
  await page.keyboard.press('Escape');

  // Coming back to the same table (a reload) is the same map: nothing more is put away.
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
});

test('the Share popover lists the maps at the table, the one it is on marked', async ({ page }) => {
  await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Ground floor');
  await share(page);
  await expect(tableMaps(page)).toHaveText(['Ground floor']);
  await expect(tableMaps(page).first()).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#share-maps .table-map-remove')).toHaveCount(0); // not the one it is on
});

test('bringing a new map to the table asks, then moves everyone to it, and the old one stays at the table', async ({
  page,
}) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Ground floor');
  await share(page);
  await page.keyboard.press('Escape');

  await openMine(page);
  await page.click('#library-new-map');
  await expect(page.locator('#modal-message')).toContainText('Bring a new, empty map to the table?');
  await expect(page.locator('#modal-message')).toContainText('Everyone at the table will see it');
  await page.click('#modal-cancel'); // nothing moves
  await expect(mapName(page)).toHaveValue('Ground floor');
  expect(relay.received.some((m) => m.type === 'addmap')).toBe(false);

  await bringNewMap(page);
  await expect(page.locator('#toast')).toContainText('The table moved to "Untitled map"');
  await expect(mapName(page)).toHaveValue('');
  expect(await boardElements(page)).toHaveLength(0);
  const add = relay.received.find((m) => m.type === 'addmap');
  expect(add).toMatchObject({ name: '', elements: [] });
  await expect(page.locator('#collab-status')).toHaveText('Live'); // still at the table

  // The table holds both; nothing was put away in your own maps, as the old floor is the table's.
  await page.click('#btn-share');
  await expect(tableMaps(page)).toHaveText(['Ground floor', 'Untitled map']);
  await page.keyboard.press('Escape');
  await page.click('#btn-library');
  await expect(page.locator('#library-mine')).toHaveAttribute('aria-pressed', 'false'); // nothing parked
});

test('moving between the maps at the table is at once, with no question, and each is as it was left', async ({
  page,
}) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Ground floor');
  await share(page);
  await page.keyboard.press('Escape');
  await bringNewMap(page);
  await rename(page, 'Upstairs');
  await drawRoom(page, 240);
  await drawRoom(page, 300);
  expect(await boardElements(page)).toHaveLength(2);

  await page.click('#btn-share');
  await tableMaps(page).filter({ hasText: 'Ground floor' }).click();
  await expect(page.locator('#modal-overlay')).toBeHidden(); // no question
  await expect(mapName(page)).toHaveValue('Ground floor');
  expect(relay.received.filter((m) => m.type === 'goto')).toEqual([{ type: 'goto', map: relay.maps[0].id }]);
  await expect.poll(async () => (await boardElements(page)).length).toBe(1);
  await expect(page.locator('#btn-undo')).toBeDisabled(); // undo starts again on each map

  await tableMaps(page).filter({ hasText: 'Upstairs' }).click();
  await expect(mapName(page)).toHaveValue('Upstairs');
  await expect.poll(async () => (await boardElements(page)).length).toBe(2);
});

test('a map of yours is brought to the table as a copy: it stays in My Maps', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Dungeon');
  await openMine(page);
  await page.click('#library-new-map'); // Dungeon is parked in My Maps
  await drawRoom(page, 200);
  await rename(page, 'Tavern');
  await share(page);
  await page.keyboard.press('Escape');

  await openMine(page);
  await myCards(page).filter({ hasText: 'Dungeon' }).locator('.library-card').click();
  await expect(page.locator('#modal-message')).toContainText('Bring "Dungeon" to the table?');
  await page.click('#modal-confirm');
  await expect(mapName(page)).toHaveValue('Dungeon');
  const add = relay.received.find((m) => m.type === 'addmap');
  expect(add.name).toBe('Dungeon');
  expect(add.elements).toHaveLength(1);

  await page.click('#btn-library');
  await expect(myCards(page).filter({ hasText: 'Dungeon' })).toHaveCount(2); // the copy on the board, and yours
});

test('a sample brought to the table asks too, and the table gets it', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await share(page);
  await page.keyboard.press('Escape');
  await page.click('#btn-library');
  await page.locator('.library-card', { hasText: 'The Rusty Flagon' }).click();
  await expect(page.locator('#modal-message')).toContainText('Bring "The Rusty Flagon" to the table?');
  await page.click('#modal-confirm');
  await expect(mapName(page)).toHaveValue('The Rusty Flagon');
  expect(relay.received.find((m) => m.type === 'addmap').elements.length).toBeGreaterThan(30);
});

test('a move by someone else changes your board, and never touches the maps in My Maps', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Mine');
  await openMine(page);
  await page.click('#library-new-map'); // Mine is put away
  await drawRoom(page, 200);
  await rename(page, 'Tavern');
  await share(page);
  await page.keyboard.press('Escape');
  const [oldRoom] = await boardElements(page);

  // Someone at the table brings the cellar and moves everyone to it.
  relay.maps.push({
    id: 'cellar',
    name: 'The Cellar',
    elements: [{ ...oldRoom, id: 'cellar-room', x: 200 }],
  });
  relay.moveTo('cellar');
  await expect(page.locator('#toast')).toContainText('The table moved to "The Cellar"');
  await expect(mapName(page)).toHaveValue('The Cellar');
  expect((await boardElements(page)).map((el) => el.id)).toEqual(['cellar-room']);
  await expect(page.locator('#btn-undo')).toBeDisabled(); // undo starts again from the new map

  // Your own map is where you left it; the old floor is the table's, kept in the room.
  await page.click('#btn-library');
  await expect(myCards(page)).toHaveCount(2);
  await expect(myCards(page).filter({ hasText: 'Mine' })).toBeVisible();
  await expect(myCards(page).filter({ hasText: 'The Cellar' })).toContainText('On the board now');
  await page.keyboard.press('Escape');
  await page.click('#btn-share');
  await expect(tableMaps(page)).toHaveText(['Tavern', 'The Cellar']);
});

test('taking a map off the table asks first, and cannot be done to the one the table is on', async ({
  page,
}) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Ground floor');
  await share(page);
  await page.keyboard.press('Escape');
  await bringNewMap(page);
  await rename(page, 'Upstairs');

  await page.click('#btn-share');
  await expect(page.locator('#share-maps .table-map-remove')).toHaveCount(1); // only Ground floor
  await page.getByRole('button', { name: 'Take Ground floor off the table' }).click();
  await expect(page.locator('#modal-message')).toContainText('Take "Ground floor" off the table?');
  await page.click('#modal-cancel');
  expect(relay.received.some((m) => m.type === 'dropmap')).toBe(false);

  await page.click('#btn-share');
  await page.getByRole('button', { name: 'Take Ground floor off the table' }).click();
  await page.click('#modal-confirm');
  await expect.poll(() => relay.received.some((m) => m.type === 'dropmap')).toBe(true);
  await page.click('#btn-share');
  await expect(tableMaps(page)).toHaveText(['Upstairs']);
});

test('the one it is on at the table is not a map of yours to delete from My Maps', async ({ page }) => {
  await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Shared');
  await share(page);
  await page.keyboard.press('Escape');
  await openMine(page);
  const here = myCards(page).filter({ hasText: 'On the board now' });
  await here.hover();
  await here.getByRole('button', { name: 'Delete Shared' }).click();
  await page.click('#modal-confirm');
  await expect(page.locator('#toast')).toContainText('That map is at the table');
  await expect(mapName(page)).toHaveValue('Shared');
});

test('a full table rotates quietly: the oldest map goes, and nobody is told', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Floor 1');
  await share(page);
  await page.keyboard.press('Escape');
  const [room] = await boardElements(page);
  for (let i = 2; i <= 10; i++) {
    relay.maps.push({ id: `floor-${i}`, name: `Floor ${i}`, elements: [{ ...room, id: `r${i}` }] });
  }
  await page.click('#share-leave'); // (the list is the room's; a fresh look at it follows)
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect(tableMaps(page)).toHaveCount(10);
  await page.keyboard.press('Escape');

  await openMine(page);
  await page.click('#library-new-map');
  await expect(page.locator('#modal-message')).toHaveText(
    'Bring a new, empty map to the table? Everyone at the table will see it.',
  ); // not a word about what goes to make room
  await page.click('#modal-confirm');
  await expect(page.locator('#toast')).toHaveText('The table moved to "Untitled map"');
  await page.click('#btn-share');
  await expect(tableMaps(page)).toHaveCount(10);
  await expect(tableMaps(page).filter({ hasText: 'Floor 2' })).toHaveCount(0);
});

test('an ordinary change from someone else is not a move: no toast, undo untouched', async ({ page }) => {
  const relay = await loadWithMockRelay(page);
  await drawRoom(page);
  await share(page);
  const undoWasEnabled = await page.locator('#btn-undo').isEnabled();
  relay.sockets[0].send(
    JSON.stringify({ type: 'changes', rev: 1, changes: [{ t: 'name', name: 'Renamed by someone' }] }),
  );
  await expect(mapName(page)).toHaveValue('Renamed by someone');
  await expect(page.locator('#toast')).not.toContainText('The table moved');
  expect(await page.locator('#btn-undo').isEnabled()).toBe(undoWasEnabled);
});

test('Leave session ends it and keeps the map on the board as yours', async ({ page }) => {
  await loadWithMockRelay(page);
  await drawRoom(page);
  await rename(page, 'Shared');
  await share(page);
  expect(page.url()).toContain('session=');

  await page.click('#share-leave');
  await expect(page.locator('#collab-status')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Left the session');
  expect(page.url()).not.toContain('session=');
  expect(await boardElements(page)).toHaveLength(1);
  await expect(mapName(page)).toHaveValue('Shared');

  // At no table now, so moving to another map just moves: no question.
  await openMine(page);
  await page.click('#library-new-map');
  await expect(page.locator('#modal-overlay')).toBeHidden();
  await expect(mapName(page)).toHaveValue('');
});
