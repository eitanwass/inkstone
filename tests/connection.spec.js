import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// Loads the app with a fake clock (so the socket's reconnect delay can be
// stepped through deterministically) and a stand-in for the relay. The relay
// accepts every connection and records it; like the real one, it hands a client
// that connects to a room with saved state a copy of it straight away.
//
// The WebSocket route must exist before the page loads, so this replaces the
// usual resetBoard call.
async function loadWithMockRelay(page, { roomState = null, onMessage = null } = {}) {
  await page.clock.install();
  const connections = [];
  await page.routeWebSocket(/\/parties\//, (ws) => {
    connections.push(ws);
    if (onMessage) ws.onMessage((message) => onMessage(connections.indexOf(ws), message));
    if (roomState !== null && connections.length > 1) ws.send(JSON.stringify(roomState));
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

test('edits made while offline are replaced by the shared map, and the user is told', async ({ page }) => {
  const connections = await loadWithMockRelay(page, { roomState: [] });
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');

  connections[0].close();
  await expect(page.locator('#collab-status')).toHaveText('Reconnecting…');
  await page.clock.pauseAt(new Date(Date.now() + 1000)); // hold the reconnect until we say so

  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);
  expect(await boardElements(page)).toHaveLength(1);

  await waitForReconnect(page);
  await expect(page.locator('#toast')).toContainText('changes you made while offline were replaced');
  await expect.poll(() => boardElements(page)).toEqual([]);
});

test('a reconnect never re-seeds the room with the creator’s local board', async ({ page }) => {
  const sent = [];
  const connections = await loadWithMockRelay(page, {
    onMessage: (connection, message) => sent.push({ connection, message }),
  });
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 320, 280);

  await page.click('#btn-share'); // the creator seeds the room once, on first connect
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await expect.poll(() => sent.filter((s) => s.connection === 0).length).toBe(1);

  connections[0].close();
  await waitForReconnect(page);
  await expect(page.locator('#collab-status')).toHaveText('Live');
  expect(sent.filter((s) => s.connection === 1)).toHaveLength(0);
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
