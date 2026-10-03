import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

// A shared map's invite link carries the map's name as ?map=..., so that pasting
// the link into a chat can show the name in the preview (see api/share.ts).

const param = (page, key) => new URL(page.url()).searchParams.get(key);

async function rename(page, text) {
  await page.click('#map-name');
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

// A stand-in relay; the route has to exist before the page loads.
async function loadWithRelay(page) {
  const connections = [];
  await page.routeWebSocket(/\/parties\//, (ws) => connections.push(ws));
  await resetBoard(page);
  return connections;
}

async function share(page) {
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  await page.keyboard.press('Escape');
}

test('while the map is not shared, renaming leaves the address alone', async ({ page }) => {
  await loadWithRelay(page);
  await rename(page, 'The Sunken Crypt');
  expect(new URL(page.url()).search).toBe('');
});

test('a shared map’s link gets the name, follows renames, and drops it when the name is cleared', async ({
  page,
}) => {
  await loadWithRelay(page);
  await share(page);
  expect(param(page, 'session')).toBeTruthy();
  expect(param(page, 'map')).toBeNull(); // unnamed so far

  await rename(page, 'The Sunken Crypt');
  expect(param(page, 'map')).toBe('The Sunken Crypt');

  await rename(page, 'Goblin Warren');
  expect(param(page, 'map')).toBe('Goblin Warren');

  await rename(page, '   ');
  expect(param(page, 'map')).toBeNull();
  expect(param(page, 'session')).toBeTruthy(); // the session itself is untouched
});

test('a map that already has a name puts it in the link the moment it is shared', async ({ page }) => {
  await loadWithRelay(page);
  await rename(page, 'Named before sharing');
  expect(new URL(page.url()).search).toBe('');

  await share(page);
  expect(param(page, 'map')).toBe('Named before sharing');
});

test('names with spaces and punctuation are safely encoded in the link', async ({ page }) => {
  await loadWithRelay(page);
  await share(page);
  await rename(page, 'Café & Crypt? #2 = 100%');

  expect(param(page, 'map')).toBe('Café & Crypt? #2 = 100%'); // reads back exactly
  expect(page.url()).not.toContain('Café & Crypt'); // but it is not written raw
  expect(page.url()).toContain('%26'); // the ampersand is encoded, so it can't split the query
});

test('the link keeps up with a rename made by someone else', async ({ page }) => {
  const connections = await loadWithRelay(page);
  await share(page);
  connections[0].send(JSON.stringify({ name: 'From a friend', elements: [] }));

  await expect.poll(() => param(page, 'map')).toBe('From a friend');
});

test('opening a link with an out-of-date name corrects it once the room reports its real name', async ({
  page,
}) => {
  const connections = [];
  await page.routeWebSocket(/\/parties\//, (ws) => connections.push(ws));
  await page.goto('/?session=abc123&map=Old%20name');
  await page.waitForSelector('#tool-rect');
  await expect(page.locator('#collab-status')).toHaveText('Live');
  expect(param(page, 'map')).toBe('Old name'); // not touched until the room has spoken

  connections[0].send(JSON.stringify({ name: 'Current name', elements: [] }));
  await expect.poll(() => param(page, 'map')).toBe('Current name');
  await expect(page.locator('#map-name')).toHaveValue('Current name');

  connections[0].send(JSON.stringify({ name: '', elements: [] }));
  await expect.poll(() => param(page, 'map')).toBeNull();
});

test('Copy Link copies the address including the name', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loadWithRelay(page);
  await rename(page, 'The Sunken Crypt');
  await page.click('#btn-share');
  await expect(page.locator('#collab-status')).toHaveText('Live');

  await page.click('#share-copy-link');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(page.url());
  expect(new URL(copied).searchParams.get('map')).toBe('The Sunken Crypt');
});

test('pasting a full invite link, name included, still joins the right session', async ({ page }) => {
  await loadWithRelay(page);
  await page.click('#btn-join');
  await page.fill('#join-code-input', 'https://inkstone.example/?session=room-42&map=The%20Sunken%20Crypt');
  await page.click('#join-connect-btn');

  await expect(page.locator('#collab-status')).toHaveText('Live');
  expect(param(page, 'session')).toBe('room-42');
});
