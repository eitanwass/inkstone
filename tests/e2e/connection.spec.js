import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// Loads the app with a fake clock (so the socket's reconnect delay can be
// stepped through deterministically) and a stand-in for the relay. The relay
// accepts every connection and records it, and answers like the real one: the
// first connection finds a fresh room, which the app gives its map (acknowledged
// as revision 0); a later one is caught up with `catchup`, and an edit sent
// is acknowledged with `fix`, the room's version of what it refused.
//
// The WebSocket route must exist before the page loads, so this replaces the
// usual resetBoard call.
async function loadWithMockRelay(page, { catchup = () => [], fix = () => [], onMessage = null } = {}) {
  await page.clock.install();
  const connections = [];
  let rev = 0;
  await page.routeWebSocket(/\/parties\//, (ws) => {
    const index = connections.length;
    connections.push(ws);
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      onMessage?.(index, message);
      if (message.type === 'hello') {
        ws.send(
          JSON.stringify(
            index === 0
              ? { type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }
              : { type: 'catchup', epoch: 'e1', rev: ++rev, changes: catchup() },
          ),
        );
      } else if (message.type === 'doc') {
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: 0, fix: [] }));
      } else if (message.type === 'changes') {
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: ++rev, fix: fix() }));
      }
    });
  });
  await resetBoard(page);
  return connections;
}

// Steps the fake clock a second at a time until the app is connected again.
// One big jump wouldn't work: the socket's own connection timeout would expire
// in the same jump, before the (real, asynchronous) open could arrive.
async function waitForReconnect(page) {
  const status = page.locator('#collab-status');
  for (let i = 0; i < 20; i++) {
    if ((await status.textContent())?.trim() === 'Live') return;
    await page.clock.runFor(1000);
    await page.waitForTimeout(100);
  }
}

test('the status follows the connection: live, reconnecting, live again', async ({ page }) => {
  const connections = await loadWithMockRelay(page);
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');

  connections[0].close();
  await expect(page.locator('#collab-status')).toHaveText('Reconnecting…');
  await expect(page.locator('#collab-status')).toHaveAttribute('data-state', 'reconnecting');
  await expect(page.locator('#toast')).toContainText('Connection lost');

  await waitForReconnect(page);
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect(page.locator('#collab-status')).toHaveAttribute('data-state', 'live');
  await expect(page.locator('#toast')).toHaveText('Reconnected');
});

test('edits made while offline are sent on reconnect, on top of what the room changed', async ({ page }) => {
  const theirToken = { type: 'token', id: 'their-token', x: 400, y: 400 };
  const sent = [];
  const connections = await loadWithMockRelay(page, {
    catchup: () => [{ t: 'set', el: theirToken }], // someone added a token while we were away
    onMessage: (connection, message) => sent.push({ connection, message }),
  });
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');

  connections[0].close();
  await expect(page.locator('#collab-status')).toHaveText('Reconnecting…');
  await page.clock.pauseAt(new Date(Date.now() + 1000)); // hold the reconnect until we say so

  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  expect((await boardElements(page)).map((e) => e.type)).toEqual(['rect']);

  await waitForReconnect(page);
  // the room's change arrived, our room is still there, and it was sent on top, built on revision 0
  await expect.poll(async () => (await boardElements(page)).map((e) => e.type)).toEqual(['rect', 'token']);
  const batch = sent.find((s) => s.connection === 1 && s.message.type === 'changes')?.message;
  expect(batch.base).toBe(0);
  expect(batch.changes.map((c) => [c.t, c.el.type])).toEqual([['set', 'rect']]);
  await expect(page.locator('#toast')).toContainText('your changes while offline were added');
});

test('an offline edit to something someone else changed is replaced by their version', async ({ page }) => {
  let original;
  const peerVersion = () => ({ ...original, x: original.x + 40 });
  const connections = await loadWithMockRelay(page, {
    catchup: () => [{ t: 'set', el: peerVersion() }], // while we were away, someone moved it
    fix: () => [{ t: 'set', el: peerVersion() }], // and so the room refuses our edit and says so
  });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  [original] = await boardElements(page);

  connections[0].close();
  await expect(page.locator('#collab-status')).toHaveText('Reconnecting…');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.click('#tool-select');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete'); // offline, we delete it
  expect(await boardElements(page)).toEqual([]);

  await waitForReconnect(page);
  await expect.poll(() => boardElements(page)).toEqual([peerVersion()]);
  await expect(page.locator('#toast')).toContainText('Someone else changed that first');
});

test('a reconnect never re-seeds the room with the creator’s local board', async ({ page }) => {
  const sent = [];
  const connections = await loadWithMockRelay(page, {
    onMessage: (connection, message) => sent.push({ connection, type: message.type }),
  });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#btn-share'); // the creator seeds the room once, on first connect
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect
    .poll(() => sent.filter((s) => s.connection === 0).map((s) => s.type))
    .toEqual(['hello', 'doc']);

  connections[0].close();
  await waitForReconnect(page);
  await expect(page.locator('#collab-status')).toHaveText('Live');
  // it only says hello: nothing to seed, and nothing changed while it was away
  expect(sent.filter((s) => s.connection === 1).map((s) => s.type)).toEqual(['hello']);
});

// A token with a picture in a live session: the picture goes over once, on its own, and is asked for by
// whoever needs it. (Placing the token and choosing the file are the same steps as in token-image.spec.js.)
test('a picture is sent once, before the token that uses it, and never again when the token moves', async ({
  page,
}) => {
  const sent = [];
  await loadWithMockRelay(page, { onMessage: (_connection, message) => sent.push(message) });
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  await page.click('#tool-select');
  await page.mouse.click(toScreen(180, 180).x, toScreen(180, 180).y);
  await page.setInputFiles('#token-image-file', {
    name: 'face.png',
    mimeType: 'image/png',
    buffer: await page
      .evaluate(() => {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        return Array.from(atob(c.toDataURL('image/png').split(',')[1]), (ch) => ch.charCodeAt(0));
      })
      .then((bytes) => Buffer.from(bytes)),
  });
  await expect(page.locator('#token-image-preview')).toBeVisible();

  // move it, then move it again
  for (const dx of [80, 80]) {
    const at = (await boardElements(page))[0];
    const from = toScreen(at.x, at.y);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y, { steps: 5 });
    await page.mouse.up();
  }

  const types = sent.map((m) => m.type);
  expect(types.filter((t) => t === 'image')).toHaveLength(1);
  const image = sent.find((m) => m.type === 'image');
  expect(image.data).toMatch(/^data:image\/(webp|jpeg);base64,/);
  // it went before the first change that used it, and no change carries it
  const firstUse = sent.findIndex((m) => m.type === 'changes' && JSON.stringify(m).includes(image.id));
  expect(sent.findIndex((m) => m.type === 'image')).toBeLessThan(firstUse);
  expect(JSON.stringify(sent.filter((m) => m.type === 'changes'))).not.toContain('data:image');
});

test('a token that arrives with a picture we do not have asks for it, and keeps it when it comes', async ({
  page,
}) => {
  const asked = [];
  const connections = await loadWithMockRelay(page, {
    onMessage: (_connection, message) => asked.push(message),
  });
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    return c.toDataURL('image/png');
  });
  // its id is the picture's hash, which the app itself says
  const id = await page.evaluate(
    async (data) => (await import('/src/core/image-data.ts')).hashImage(data),
    data,
  );
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');

  const token = (image) => ({ type: 'token', id: 't1', x: 180, y: 180, image });
  connections[0].send(JSON.stringify({ type: 'changes', rev: 1, changes: [{ t: 'set', el: token(id) }] }));
  await expect.poll(() => asked.find((m) => m.type === 'getimages')?.ids).toEqual([id]);
  expect(await page.evaluate(() => localStorage.getItem('inkstone-images'))).toBeNull();

  // a picture that isn't what its id says is refused, and then the real one is kept
  connections[0].send(JSON.stringify({ type: 'image', id, data: 'data:image/png;base64,AAAA' }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => localStorage.getItem('inkstone-images'))).toBeNull();
  connections[0].send(JSON.stringify({ type: 'image', id, data }));
  await expect
    .poll(async () =>
      Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-images')))),
    )
    .toEqual([id]);
});

test('the red live indicator appears under the action cluster only while the map is shared', async ({
  page,
}) => {
  const connections = await loadWithMockRelay(page);
  const indicator = page.locator('#collab-status');
  await expect(indicator).toBeHidden();

  await page.click('#btn-share');
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveText('Live');
  await expect(page.locator('#collab-status .live-dot')).toHaveCSS('background-color', 'rgb(229, 72, 77)');

  // It sits in the right-hand column below the action cluster, just left of the save indicator,
  // which is the one flush with the cluster's right edge.
  const cluster = await page.locator('#action-cluster').boundingBox();
  const pill = await indicator.boundingBox();
  const saveChip = await page.locator('#save-status').boundingBox();
  expect(pill.y).toBeGreaterThanOrEqual(cluster.y + cluster.height);
  expect(pill.x + pill.width).toBeLessThanOrEqual(saveChip.x);
  expect(saveChip.x + saveChip.width).toBeCloseTo(cluster.x + cluster.width, 0);

  // A dropped connection is no longer "live": the dot stops being red.
  connections[0].close();
  await expect(indicator).toHaveText('Reconnecting…');
  await expect(page.locator('#collab-status .live-dot')).not.toHaveCSS(
    'background-color',
    'rgb(229, 72, 77)',
  );
});

test('the Live pill shows how many are connected, with an identicon for each, you first', async ({
  page,
}) => {
  const connections = await loadWithMockRelay(page);
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-player')).id);

  const presence = (players, count = players.length) =>
    connections[0].send(JSON.stringify({ type: 'presence', count, players }));
  presence([
    { id: 'zed', name: 'Zed' },
    { id: me, name: 'Quiet Heron' },
  ]);
  await expect(page.locator('#collab-status')).toContainText('2');
  await expect(page.locator('#players .player')).toHaveCount(2);
  await expect(page.locator('#players .player').first()).toHaveAttribute('aria-label', 'Quiet Heron (you)');
  await expect(page.locator('#players .player svg').first()).toBeVisible();

  presence([{ id: me, name: 'Quiet Heron' }], 12); // more than are listed
  await expect(page.locator('#players .player-more')).toHaveText('+11');

  connections[0].close();
  await expect(page.locator('#players .player')).toHaveCount(0);
});
