import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The map's background: a colour and/or a picture behind the grid dots, set from the right-click menu on the
// map. A new picture goes straight into adjusting (its own panel); the rest of the map can't touch it.

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

// A PNG of this size, made in the page so the test needs no files.
async function png(page, width, height, halves = false) {
  const base64 = await page.evaluate(
    ({ width, height, halves }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = halves ? '#ff0000' : '#5b7fa6'; // halves: red on the left, blue on the right
      ctx.fillRect(0, 0, width, height);
      if (halves) {
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(width / 2, 0, width / 2, height);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { width, height, halves },
  );
  return Buffer.from(base64, 'base64');
}

const backgrounds = async (page) => (await boardElements(page)).filter((el) => el.type === 'background');
const pictures = async (page) => (await backgrounds(page)).filter((el) => el.image);

const openMenu = async (page, x = 600, y = 450) => {
  await page.mouse.click(x, y, { button: 'right' });
  await expect(page.locator('#canvas-context-menu')).toBeVisible();
};

// Adds a picture the way a person does: right-click, Add image, choose a file. It then is being adjusted.
async function addPicture(page, width = 800, height = 400, halves = false) {
  await openMenu(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ctx-bg-add')]);
  await chooser.setFiles({
    name: 'map.png',
    mimeType: 'image/png',
    buffer: await png(page, width, height, halves),
  });
  await expect.poll(async () => (await pictures(page)).length).toBe(1);
  await expect(page.locator('#adjust-panel')).toBeVisible();
}

const finish = (page) => page.click('#adjust-done');

// The colour and alpha of the pixel at a point on a canvas (screen coordinates, device pixels).
const pixelAt = (page, canvasId, x, y) =>
  page.evaluate(
    ({ canvasId, x, y }) => {
      const canvas = document.getElementById(canvasId);
      const box = canvas.getBoundingClientRect();
      const scale = canvas.width / box.width;
      return [
        ...canvas
          .getContext('2d')
          .getImageData(Math.round((x - box.left) * scale), Math.round((y - box.top) * scale), 1, 1).data,
      ];
    },
    { canvasId, x, y },
  );

test('right-clicking the map offers the background; Settings has no Background tab; the dock has no picture button', async ({
  page,
}) => {
  await openMenu(page);
  await expect(page.locator('#ctx-bg-add')).toBeVisible();
  await expect(page.locator('#ctx-bg-add')).toContainText('Add image');
  await expect(page.locator('#ctx-bg-adjust')).toBeHidden(); // nothing to adjust or remove yet
  await expect(page.locator('#ctx-bg-remove')).toBeHidden();
  await expect(page.locator('#ctx-paste')).toBeHidden(); // nothing copied
  await expect(page.locator('#ctx-bg-colors .ctx-swatch')).toHaveCount(9); // eight and the ring
  await page.keyboard.press('Escape');
  await page.click('#btn-settings');
  await expect(page.locator('#settings-tabs [role="tab"]')).toHaveText(['Board', 'Conditions', 'Profile']);
  await expect(page.locator('#tool-image')).toHaveCount(0);
});

test('a chosen picture is the map background: in proportion, kept once, and straight into adjusting', async ({
  page,
}) => {
  await addPicture(page, 800, 400);
  const [el] = await pictures(page);
  expect(el.w / el.h).toBeCloseTo(2, 5);
  expect(el.opacity).toBeUndefined();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-images') ?? '{}'));
  expect(stored[el.image]).toMatch(/^data:image\/(webp|jpeg);base64,/);
  await expect(page.locator('#tool-dock')).toBeHidden();
  await expect(page.locator('#adjust-squares')).toHaveValue(String(el.w / 40));
  await expect(page.locator('#adjust-size')).toHaveText(`× ${el.h / 40} tall`);
});

test('it is drawn behind the grid dots, not on the layer with the drawing', async ({ page }) => {
  await addPicture(page);
  await finish(page);
  const [el] = await pictures(page);
  const toScreen = await worldToScreenFn(page);
  // a point inside the picture that is not on a dot
  const p = toScreen(el.x + el.w / 2 + 20, el.y + el.h / 2 + 20);
  await expect.poll(async () => (await pixelAt(page, 'grid-canvas', p.x, p.y))[3]).toBe(255);
  expect((await pixelAt(page, 'main-canvas', p.x, p.y))[3]).toBe(0);
});

test('while drawing it can not be pointed at: not selected, deleted, erased or in the way', async ({
  page,
}) => {
  await addPicture(page);
  await finish(page);
  const [el] = await pictures(page);
  const toScreen = await worldToScreenFn(page);
  const c = toScreen(el.x + el.w / 2, el.y + el.h / 2);

  await page.mouse.click(c.x, c.y); // with the select tool
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await page.click('#tool-erase');
  await page.mouse.click(c.x, c.y);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y + 60, { steps: 4 });
  await page.mouse.up();
  expect((await pictures(page))[0]).toEqual(el); // still there, and has not moved

  await placeRoom(page, toScreen, el.x + 40, el.y + 40, el.x + 160, el.y + 120); // and a room can be drawn over it
  expect((await boardElements(page)).map((e) => e.type)).toContain('rect');
});

test('right-clicking the picture is still the map menu, with Replace, Adjust and Remove', async ({
  page,
}) => {
  await addPicture(page);
  await finish(page);
  const [el] = await pictures(page);
  const toScreen = await worldToScreenFn(page);
  const c = toScreen(el.x + el.w / 2, el.y + el.h / 2);
  await openMenu(page, c.x, c.y);
  await expect(page.locator('#ctx-bg-add')).toContainText('Replace image');
  await expect(page.locator('#ctx-bg-adjust')).toBeVisible();
  await expect(page.locator('#ctx-bg-remove')).toBeVisible();
  await page.click('#ctx-bg-adjust');
  await expect(page.locator('#adjust-panel')).toBeVisible();
});

test('the panel: opacity, one undo step', async ({ page }) => {
  await addPicture(page);
  const [el] = await pictures(page);
  await expect(page.locator('#adjust-opacity')).toHaveValue('100');
  await page.locator('#adjust-opacity').fill('50');
  await expect(page.locator('#adjust-opacity-text')).toHaveText('50%');
  await expect.poll(async () => (await pictures(page))[0].opacity).toBe(0.5);
  await finish(page);
  const toScreen = await worldToScreenFn(page);
  const p = toScreen(el.x + el.w / 2 + 20, el.y + el.h / 2 + 20);
  const alpha = (await pixelAt(page, 'grid-canvas', p.x, p.y))[3];
  expect(alpha).toBeGreaterThan(110);
  expect(alpha).toBeLessThan(145);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await pictures(page))[0].opacity).toBeUndefined();
});

test('the panel: a typed width sets the size, keeps the proportions, and is one undo step', async ({
  page,
}) => {
  await addPicture(page, 800, 400);
  const [before] = await pictures(page);
  await page.locator('#adjust-squares').fill('20');
  await page.locator('#adjust-squares').press('Enter');
  await expect(page.locator('#adjust-size')).toHaveText('× 10 tall');
  const [after] = await pictures(page);
  expect([after.w, after.h]).toEqual([800, 400]);
  expect([after.x, after.y]).toEqual([before.x, before.y]);
  await finish(page);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await pictures(page))[0].w).toBe(before.w);
});

test('rotating by 90 degrees: the box turns about its middle, the picture turns with it, four turns is the start', async ({
  page,
}) => {
  await addPicture(page, 800, 400, true);
  const [start] = await pictures(page);
  const toScreen = await worldToScreenFn(page);
  const cx = start.x + start.w / 2;
  const cy = start.y + start.h / 2;
  const colourAt = async (wx, wy) => {
    const p = toScreen(wx, wy);
    const [r, g, b] = await pixelAt(page, 'grid-canvas', p.x, p.y);
    // The picture is kept compressed, so a colour is only close to what was drawn.
    return r > 200 && g < 60 && b < 60 ? 'red' : b > 200 && r < 60 && g < 60 ? 'blue' : [r, g, b];
  };
  // not turned: red on the left, blue on the right
  await expect.poll(() => colourAt(cx - start.w / 4 + 7, cy + 7)).toBe('red');
  await expect.poll(() => colourAt(cx + start.w / 4 + 7, cy + 7)).toBe('blue');

  await page.click('#adjust-rotate-right'); // a quarter turn clockwise: the left edge is now the top
  const [turned] = await pictures(page);
  expect(turned.rotation).toBe(1);
  expect([turned.w, turned.h]).toEqual([start.h, start.w]); // swapped
  expect([turned.x + turned.w / 2, turned.y + turned.h / 2]).toEqual([cx, cy]); // about the middle
  await expect.poll(() => colourAt(cx + 7, cy - turned.h / 4 + 7)).toBe('red');
  await expect.poll(() => colourAt(cx + 7, cy + turned.h / 4 + 7)).toBe('blue');
  await expect(page.locator('#adjust-size')).toHaveText(`× ${turned.h / 40} tall`);

  await page.click('#adjust-rotate-left');
  await page.click('#adjust-rotate-left'); // back, and a quarter turn the other way: the left edge is now the bottom
  const [other] = await pictures(page);
  expect(other.rotation).toBe(3);
  await expect.poll(() => colourAt(cx + 7, cy + other.h / 4 + 7)).toBe('red');

  await page.click('#adjust-rotate-right'); // three quarters and one more is the whole turn
  const [again] = await pictures(page);
  expect(again.rotation).toBeUndefined(); // no turn is left off
  expect([again.x, again.y, again.w, again.h]).toEqual([start.x, start.y, start.w, start.h]);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z'); // each turn was an undo step
  await expect.poll(async () => (await pictures(page))[0].rotation).toBe(3);
});

test('adjusting: drag to move, corner to resize, arrows nudge, Done finishes', async ({ page }) => {
  await addPicture(page, 800, 400);
  const [start] = await pictures(page);
  const toScreen = await worldToScreenFn(page);
  const c = toScreen(start.x + start.w / 2, start.y + start.h / 2);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 13, c.y + 7, { steps: 5 });
  await page.mouse.up();
  const [moved] = await pictures(page);
  expect([moved.x - start.x, moved.y - start.y]).toEqual([13, 7]); // to the pixel, not to a cell

  const se = toScreen(moved.x + moved.w, moved.y + moved.h);
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  await page.mouse.move(se.x - 101, se.y - 3, { steps: 5 });
  await page.mouse.up();
  const [sized] = await pictures(page);
  expect(sized.w).toBe(moved.w - 101);
  expect(sized.w / sized.h).toBeCloseTo(2, 5);
  expect([sized.x, sized.y]).toEqual([moved.x, moved.y]); // the opposite corner stays
  await expect(page.locator('#adjust-squares')).toHaveValue(String(Math.round((sized.w / 40) * 100) / 100));

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const [nudged] = await pictures(page);
  expect([nudged.x - sized.x, nudged.y - sized.y]).toEqual([1, 10]);

  await finish(page);
  await expect(page.locator('#adjust-panel')).toBeHidden();
  await expect(page.locator('#tool-dock')).toBeVisible();
  const c2 = toScreen(nudged.x + nudged.w / 2, nudged.y + nudged.h / 2); // and it is out of reach again
  await page.mouse.move(c2.x, c2.y);
  await page.mouse.down();
  await page.mouse.move(c2.x + 50, c2.y, { steps: 3 });
  await page.mouse.up();
  expect((await pictures(page))[0].x).toBe(nudged.x);
});

test('a turned picture resizes like any other: the opposite corner stays and the proportions hold', async ({
  page,
}) => {
  await addPicture(page, 800, 400);
  await page.locator('#adjust-squares').fill('10');
  await page.locator('#adjust-squares').press('Enter');
  const toScreen = await worldToScreenFn(page);
  for (const turns of [1, 2, 3]) {
    await page.click('#adjust-rotate-right');
    const [before] = await pictures(page);
    expect(before.rotation).toBe(turns);
    const se = toScreen(before.x + before.w, before.y + before.h);
    await page.mouse.move(se.x, se.y);
    await page.mouse.down();
    await page.mouse.move(se.x + 60, se.y + 30, { steps: 6 });
    await page.mouse.up();
    const [after] = await pictures(page);
    expect([after.x, after.y]).toEqual([before.x, before.y]); // the corner opposite the one dragged stays
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.w).toBeLessThan(before.w + 100); // not a jump
    expect(after.w / after.h).toBeCloseTo(before.w / before.h, 5);
  }
});

test('adjusting: Shift snaps a move and a resize to the grid', async ({ page }) => {
  await addPicture(page, 800, 400);
  const toScreen = await worldToScreenFn(page);
  const [start] = await pictures(page);

  // Shift held from before the press: the picture is still moved (not toggled out of the selection)
  const c = toScreen(start.x + start.w / 2, start.y + start.h / 2);
  await page.keyboard.down('Shift');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 53, c.y + 27, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const [moved] = await pictures(page);
  expect(moved.x).not.toBe(start.x);
  expect([moved.x % 40, moved.y % 40]).toEqual([0, 0]); // its top left corner is on the grid

  const se = toScreen(moved.x + moved.w, moved.y + moved.h);
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(se.x - 97, se.y - 11, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const [sized] = await pictures(page);
  expect(sized.w).not.toBe(moved.w);
  expect((sized.x + sized.w) % 40).toBe(0); // the dragged edge is on a grid line
  expect(sized.w / sized.h).toBeCloseTo(2, 5);
});

// A scan with a printed grid (`period` pixels a square, first lines at `offset`) and rooms and labels over it.
async function gridPng(
  page,
  { width = 1200, height = 800, period = 53.3, periodY = period, offset = [17.5, 9.2], grid = true } = {},
) {
  const base64 = await page.evaluate(
    ({ width, height, period, periodY, offset, grid }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#e4d8bd';
      ctx.fillRect(0, 0, width, height);
      if (grid) {
        ctx.strokeStyle = 'rgba(70, 60, 40, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = offset[0]; x < width; x += period) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = offset[1]; y < height; y += periodY) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = '#2b2418';
      ctx.fillStyle = '#2b2418';
      ctx.lineWidth = 7;
      ctx.font = '22px serif';
      for (let i = 0; i < 14; i++) {
        ctx.strokeRect(
          40 + ((i * 197) % (width - 300)),
          30 + ((i * 131) % (height - 200)),
          150 + ((i * 37) % 120),
          90 + ((i * 53) % 80),
        );
        ctx.fillText(`Room ${i}`, 60 + ((i * 251) % (width - 200)), 80 + ((i * 97) % (height - 120)));
      }
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { width, height, period, periodY, offset, grid },
  );
  return Buffer.from(base64, 'base64');
}

async function addGridPicture(page, options) {
  await openMenu(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ctx-bg-add')]);
  await chooser.setFiles({ name: 'scan.png', mimeType: 'image/png', buffer: await gridPng(page, options) });
  await expect.poll(async () => (await pictures(page)).length).toBe(1);
  await expect(page.locator('#adjust-panel')).toBeVisible();
}

test('Fit to grid: the picture is sized so its squares are ours, and its lines land on ours', async ({
  page,
}) => {
  await addGridPicture(page, { width: 1200, period: 53.3, offset: [17.5, 9.2] });
  const [before] = await pictures(page);
  await page.click('#adjust-fit');
  await expect(page.locator('#toast')).toContainText('Fitted to the grid');
  const [after] = await pictures(page);
  const scale = 40 / 53.3; // world units per picture pixel
  expect(Math.abs(after.w - 1200 * scale)).toBeLessThan(1200 * scale * 0.004); // 22.5 squares across
  expect(after.w / after.h).toBeCloseTo(before.w / before.h, 5);
  // the first vertical and horizontal lines are on grid lines, within a pixel
  const off = (v) => Math.min(((v % 40) + 40) % 40, 40 - (((v % 40) + 40) % 40));
  expect(off(after.x + 17.5 * scale)).toBeLessThan(1.5);
  expect(off(after.y + 9.2 * scale)).toBeLessThan(1.5);
  await expect(page.locator('#adjust-squares')).toHaveValue(String(Math.round((after.w / 40) * 100) / 100));
  await finish(page);
  await page.keyboard.press('Control+z'); // one undo step
  await expect.poll(async () => (await pictures(page))[0].w).toBe(before.w);
});

test('Fit to grid stretches a picture whose squares are wider than tall, so they come out square', async ({
  page,
}) => {
  await addGridPicture(page, { width: 1200, height: 800, period: 50, periodY: 56, offset: [12, 20] });
  const [before] = await pictures(page);
  await page.click('#adjust-fit');
  await expect(page.locator('#toast')).toContainText('Fitted to the grid');
  const [after] = await pictures(page);
  expect(Math.abs(after.w - (1200 * 40) / 50)).toBeLessThan(((1200 * 40) / 50) * 0.006); // 24 squares across
  expect(Math.abs(after.h - (800 * 40) / 56)).toBeLessThan(((800 * 40) / 56) * 0.006); // 14.3 down
  expect(after.w / after.h).not.toBeCloseTo(before.w / before.h, 1); // its proportions changed
});

test('Fit to grid works on a turned picture, and keeps it turned', async ({ page }) => {
  await addGridPicture(page, { width: 1200, height: 800, period: 61.7, offset: [20, 30] });
  await page.click('#adjust-rotate-right');
  const [turned] = await pictures(page);
  await page.click('#adjust-fit');
  await expect(page.locator('#toast')).toContainText('Fitted to the grid');
  const [after] = await pictures(page);
  expect(after.rotation).toBe(1);
  // now 800 pixels across and 1200 down (turned), 61.7 pixels a square
  expect(Math.abs(after.w - (800 * 40) / 61.7)).toBeLessThan(((800 * 40) / 61.7) * 0.004);
  expect(after.w / after.h).toBeCloseTo(turned.w / turned.h, 5);
});

test('Fit to grid on a picture with no grid says so and changes nothing', async ({ page }) => {
  await addGridPicture(page, { grid: false });
  const [before] = await pictures(page);
  await page.click('#adjust-fit');
  await expect(page.locator('#toast')).toContainText("Couldn't find a grid");
  expect((await pictures(page))[0]).toEqual(before);
});

test('while adjusting, the rest of the map can not be touched, there is no map menu, and Escape finishes', async ({
  page,
}) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  await addPicture(page);
  await page.keyboard.press('Control+a');
  await page.mouse.click(700, 500, { button: 'right' });
  await expect(page.locator('#canvas-context-menu')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#adjust-panel')).toBeHidden();
  expect((await boardElements(page)).filter((e) => e.type === 'rect')).toHaveLength(1);
});

test('replacing keeps how faint it is; removing takes the picture away and keeps a colour', async ({
  page,
}) => {
  await addPicture(page);
  await page.locator('#adjust-opacity').fill('40');
  await expect.poll(async () => (await pictures(page))[0].opacity).toBe(0.4);
  const [first] = await pictures(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#adjust-replace')]);
  await chooser.setFiles({ name: 'other.png', mimeType: 'image/png', buffer: await png(page, 300, 300) });
  await expect.poll(async () => (await pictures(page))[0].image).not.toBe(first.image);
  expect(await backgrounds(page)).toHaveLength(1); // still just one
  expect((await pictures(page))[0].opacity).toBe(0.4);

  await finish(page);
  await openMenu(page);
  await page.click('#ctx-bg-colors [data-color="#1c1f26"]'); // Night
  await expect.poll(async () => (await backgrounds(page))[0].color).toBe('#1c1f26');
  await openMenu(page);
  await page.click('#ctx-bg-remove');
  const [only] = await backgrounds(page);
  expect(only).toMatchObject({ color: '#1c1f26', x: 0, y: 0, w: 0, h: 0 });
  expect(only.image).toBeUndefined();
});

test('a colour: chosen from the menu, behind everything, marked in the menu, and one undo step', async ({
  page,
}) => {
  await openMenu(page);
  await expect(page.locator('#ctx-bg-colors [data-color="#e9e4da"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#ctx-bg-colors [data-color="#1c1f26"]'); // Night
  await expect(page.locator('#canvas-context-menu')).toBeHidden();
  expect(await backgrounds(page)).toEqual([
    expect.objectContaining({ type: 'background', color: '#1c1f26', x: 0, y: 0, w: 0, h: 0 }),
  ]);
  const toScreen = await worldToScreenFn(page);
  const p = toScreen(20, 20); // between dots
  await expect
    .poll(async () => (await pixelAt(page, 'grid-canvas', p.x, p.y)).slice(0, 3))
    .toEqual([28, 31, 38]);

  await openMenu(page);
  await expect(page.locator('#ctx-bg-colors [data-color="#1c1f26"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await backgrounds(page)).length).toBe(0);
});

test('the default parchment takes the colour away again, and any colour can be picked with the ring', async ({
  page,
}) => {
  await openMenu(page);
  await page.click('#ctx-bg-colors [data-color="#a9c0d6"]'); // Sky
  await expect.poll(async () => (await backgrounds(page)).length).toBe(1);
  await openMenu(page);
  await page.click('#ctx-bg-colors [data-color="#e9e4da"]'); // Parchment
  await expect.poll(async () => (await backgrounds(page)).length).toBe(0);

  await openMenu(page);
  await page.locator('#ctx-bg-color-custom').fill('#336699');
  await expect.poll(async () => (await backgrounds(page))[0]?.color).toBe('#336699');
  await expect(page.locator('#canvas-context-menu')).toBeHidden(); // closed once the picker is done
});

test('a dark colour gets light dots so the grid still shows', async ({ page }) => {
  await openMenu(page);
  await page.click('#ctx-bg-colors [data-color="#1c1f26"]');
  const toScreen = await worldToScreenFn(page);
  const dot = toScreen(0, 0);
  await expect
    .poll(async () => {
      const [r, g, b] = await pixelAt(page, 'grid-canvas', dot.x, dot.y);
      return r + g + b;
    })
    .toBeGreaterThan(28 + 31 + 38 + 20);
});

test('Paste is in the menu only when something is copied, and still works', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 280, 240);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await openMenu(page, 700, 500);
  await expect(page.locator('#ctx-paste')).toBeVisible();
  await page.click('#ctx-paste');
  expect((await boardElements(page)).filter((e) => e.type === 'rect')).toHaveLength(2);
});

test('a file that is not a picture is refused and changes nothing', async ({ page }) => {
  await openMenu(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ctx-bg-add')]);
  await chooser.setFiles({
    name: 'notes.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not an image'),
  });
  await expect(page.locator('#toast')).toContainText("can't be used as a picture");
  expect(await boardElements(page)).toHaveLength(0);
  await expect(page.locator('#adjust-panel')).toBeHidden();
});

test('a big picture is shrunk to fit the limits', async ({ page }) => {
  await addPicture(page, 4000, 3000);
  const [el] = await pictures(page);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-images') ?? '{}'));
  expect(stored[el.image].length).toBeLessThanOrEqual(800_000);
  expect(el.w / el.h).toBeCloseTo(4 / 3, 2);
});

test('saving the map to a file takes the picture and the colour along', async ({ page }) => {
  await addPicture(page);
  await finish(page);
  await openMenu(page);
  await page.click('#ctx-bg-colors [data-color="#46525e"]');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save-file')]);
  const file = JSON.parse(await readFile(await download.path(), 'utf8'));
  const [el] = file.elements;
  expect(el).toMatchObject({ type: 'background', color: '#46525e' });
  expect(Object.keys(file.images)).toEqual([el.image]);
});

test('in a shared map the picture goes to the room once, and the change carries only its id', async ({
  page,
}) => {
  const sent = [];
  await page.routeWebSocket(/\/parties\//, (ws) => {
    ws.onMessage((raw) => {
      const message = JSON.parse(raw);
      sent.push(message);
      if (message.type === 'hello') {
        ws.send(JSON.stringify({ type: 'doc', fresh: true, epoch: '', rev: 0, name: '', elements: [] }));
      } else if (message.type === 'doc') {
        ws.send(JSON.stringify({ type: 'ack', epoch: 'e1', rev: 0, fix: [] }));
      }
    });
  });
  await resetBoard(page);
  await page.click('#btn-share');
  await expect.poll(() => sent.some((m) => m.type === 'doc')).toBe(true);
  await page.keyboard.press('Escape');
  await page.mouse.click(300, 600); // away from the share popover

  await addPicture(page);
  const [el] = await pictures(page);
  await expect.poll(() => sent.filter((m) => m.type === 'image').length).toBe(1);
  expect(sent.find((m) => m.type === 'image').id).toBe(el.image);
  expect(JSON.stringify(sent.find((m) => m.type === 'changes'))).not.toContain('data:image');
  await page.locator('#adjust-opacity').fill('50'); // a later change does not send the picture again
  await page.waitForTimeout(300);
  expect(sent.filter((m) => m.type === 'image')).toHaveLength(1);
});

// The name, the logo and the readout are written straight on the map, so they have to stay readable
// whatever color the map is.
const PARCHMENT = [233, 228, 218];
const DARK = [28, 26, 23];

// WCAG contrast of each piece of text against the map color, counting the readout's own fade.
function contrasts(page, map) {
  return page.evaluate((map) => {
    const rgb = (css) =>
      css
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (c) =>
      c
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (selector) => {
      const el = document.querySelector(selector);
      const fade = Number(getComputedStyle(el.closest('#hud-meta') ?? el).opacity);
      const text = rgb(getComputedStyle(el).color).map((v, i) => v * fade + map[i] * (1 - fade));
      const [high, low] = [luminance(text), luminance(map)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    };
    return {
      dark: document.body.classList.contains('map-dark'),
      logo: ratio('#brand-mark span'),
      name: ratio('#map-name'),
      coords: ratio('#hud-coords span'),
    };
  }, map);
}

test('the text on the map is readable on a dark map color, and on the default one', async ({ page }) => {
  await page.fill('#map-name', 'The Sunken Crypt');
  await page.press('#map-name', 'Enter');
  const light = await contrasts(page, PARCHMENT);
  expect(light.dark).toBe(false);
  expect(light.logo).toBeGreaterThan(4.5);
  expect(light.name).toBeGreaterThan(4.5);

  await page.evaluate(() => {
    localStorage.setItem(
      'inkstone-board',
      JSON.stringify([{ type: 'background', x: 0, y: 0, w: 0, h: 0, color: '#1c1a17' }]),
    );
  });
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(600); // the text's color eases over
  const dark = await contrasts(page, DARK);
  expect(dark.dark).toBe(true);
  expect(dark.logo).toBeGreaterThan(4.5);
  expect(dark.name).toBeGreaterThan(4.5);
  expect(dark.coords).toBeGreaterThan(3); // the readout is meant to be faint
});
