import { expect, test } from '@playwright/test';
import { resetBoard } from './helpers.js';

// Pointers go over their own socket (/cursors/<room>), apart from the one that carries the map. The relay
// is a stand-in that records what the page sends and can send pointers back.

async function shared(page) {
  const sent = [];
  const sockets = [];
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      if (JSON.parse(raw).type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
        ws.send(JSON.stringify({ type: 'presence', count: 1, people: [{ id: 'zed', name: 'Zed' }] }));
      }
    });
  });
  await page.routeWebSocket(/\/cursors\//, (ws) => {
    sockets.push(ws);
    ws.onMessage((raw) => sent.push(JSON.parse(raw)));
  });
  await resetBoard(page);
  await page.click('#btn-share');
  await expect(page.locator('#people .person')).toHaveCount(1);
  await expect.poll(() => sent.length).toBeGreaterThan(0); // the hello
  return { sent, sockets };
}

test('our pointer is sent over the cursors socket, in world units, not too often', async ({ page }) => {
  const { sent } = await shared(page);
  expect(sent[0]).toMatchObject({ type: 'hello' });

  const box = await page.locator('#interaction-canvas').boundingBox();
  const panX = box.width * 0.1;
  const panY = box.height * 0.1;
  for (let i = 0; i < 30; i++) await page.mouse.move(box.x + 300 + i, box.y + 300);
  await expect.poll(() => sent.filter((m) => m.type === 'cursor').length).toBeGreaterThan(0);
  const cursors = sent.filter((m) => m.type === 'cursor');
  expect(cursors.length).toBeLessThan(30); // throttled
  await expect
    .poll(() => sent.filter((m) => m.type === 'cursor').at(-1))
    .toEqual({ type: 'cursor', x: Math.round(329 - panX), y: Math.round(300 - panY) }); // where it stopped

  await page.mouse.move(box.x - 5, box.y + 300); // off the map
  await expect.poll(() => sent.some((m) => m.type === 'hide')).toBe(true);
});

test("someone else's pointer is shown with their name, follows the map, and goes when they do", async ({
  page,
}) => {
  const { sockets } = await shared(page);
  const box = await page.locator('#interaction-canvas').boundingBox();
  const panX = box.width * 0.1;
  sockets[0].send(JSON.stringify({ type: 'cursor', cid: 'tab2', id: 'zed', x: 200, y: 120 }));

  const cursor = page.locator('#cursors .cursor');
  await expect(cursor).toHaveCount(1);
  await expect(cursor.locator('.cursor-name')).toHaveText('Zed');
  await expect.poll(async () => (await cursor.boundingBox())?.x).toBeCloseTo(box.x + panX + 200, 0);

  // Zooming the map moves it with the map.
  await page.click('#btn-zoom-in');
  await expect.poll(async () => (await cursor.boundingBox())?.x).not.toBeCloseTo(box.x + panX + 200, 0);

  sockets[0].send(JSON.stringify({ type: 'gone', cid: 'tab2' }));
  await expect(cursor).toHaveCount(0);
});

test('garbage from the relay is ignored', async ({ page }) => {
  const { sockets } = await shared(page);
  for (const bad of ['nope', '{"type":"cursor","cid":"t","id":"zed","x":"a","y":1}', '{"type":"x"}']) {
    sockets[0].send(bad);
  }
  await page.waitForTimeout(200);
  await expect(page.locator('#cursors .cursor')).toHaveCount(0);
});
