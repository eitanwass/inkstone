import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, placeToken, placeWall, resetBoard, worldToScreenFn } from './helpers.js';

// Locking: from the right-click menus. A locked element can't be selected, moved or erased and clicks go
// through it; it can be right-clicked (the usual menu, with everything faded out but Unlock), and a faded
// lock fades in on it when the pointer is over it.

let toScreen;
let big; // a point inside the big room that is not inside the small one on top of it
let small; // a point inside the small room

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 160, 160, 640, 480); // the background
  await placeRoom(page, toScreen, 280, 240, 400, 320); // on top of it
  big = toScreen(560, 440);
  small = toScreen(300, 260);
  await page.click('#tool-select');
});

const locked = async (page) => (await boardElements(page)).map((e) => !!e.locked);
const rightClick = (page, p) => page.mouse.click(p.x, p.y, { button: 'right' });
const lock = async (page, at) => {
  await rightClick(page, at);
  await page.click('#ctx-lock');
};

test.describe('locking', () => {
  test('Lock in a right-click menu locks it, lets go of it, and says how to undo it', async ({ page }) => {
    await page.mouse.click(big.x, big.y);
    await lock(page, big);
    expect(await locked(page)).toEqual([true, false]);
    await expect(page.locator('#toast')).toContainText('Locked');
    await expect(page.locator('#toast')).toContainText('right-click it to unlock');
  });

  test('Lock applies to everything selected, as one step', async ({ page }) => {
    await page.keyboard.press('Control+a');
    await lock(page, small);
    expect(await locked(page)).toEqual([true, true]);
    await page.click('#btn-undo');
    expect(await locked(page)).toEqual([false, false]);
  });

  test('a click goes through a locked element to what is under it, or to nothing', async ({ page }) => {
    await lock(page, big);
    await page.mouse.click(big.x, big.y); // nothing is under it now
    await page.keyboard.press('Delete');
    expect((await boardElements(page)).length).toBe(2); // nothing was selected to delete

    // a click on the small room inside it still selects the small one
    await page.mouse.click(small.x, small.y);
    await page.keyboard.press('Delete');
    expect((await boardElements(page)).length).toBe(1);
  });

  test('a locked element is not moved by dragging where it is', async ({ page }) => {
    await lock(page, big);
    const before = (await boardElements(page))[0];
    await page.mouse.move(big.x, big.y);
    await page.mouse.down();
    await page.mouse.move(big.x + 120, big.y + 80, { steps: 5 });
    await page.mouse.up();
    const after = (await boardElements(page))[0];
    expect([after.x, after.y]).toEqual([before.x, before.y]);
  });

  test('a locked element is out of the eraser’s reach', async ({ page }) => {
    await lock(page, big);
    await page.click('#tool-erase');
    await page.mouse.click(big.x, big.y);
    expect((await boardElements(page)).length).toBe(2);
  });

  test('Select All and a box select leave a locked element out', async ({ page }) => {
    await lock(page, big);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    expect(await locked(page)).toEqual([true]); // only the other one went

    await page.keyboard.press('Control+z');
    await page.mouse.move(100, 100);
    await page.mouse.down();
    await page.mouse.move(900, 600, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press('Delete');
    expect(await locked(page)).toEqual([true]);
  });

  test('a token can be locked from its own menu', async ({ page }) => {
    await placeToken(page, toScreen, 520, 200, 'Goblin');
    await page.click('#tool-select');
    const at = toScreen(540, 220);
    await rightClick(page, at);
    await page.click('#ctx-token-lock');
    expect((await boardElements(page)).find((e) => e.type === 'token').locked).toBe(true);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('#token-card')).toBeHidden(); // the click went through it
  });

  test('walls can be locked too', async ({ page }) => {
    await placeWall(page, toScreen, 720, 160, 720, 480);
    await page.click('#tool-select');
    const at = toScreen(720, 300);
    await page.mouse.click(at.x, at.y);
    await lock(page, at);
    expect((await boardElements(page)).find((e) => e.type === 'wall').locked).toBe(true);
  });

  test('the menus offer Lock and nothing to hide', async ({ page }) => {
    await rightClick(page, small);
    await expect(page.locator('#ctx-lock')).toBeVisible();
    await expect(page.locator('#ctx-hide')).toHaveCount(0);
    await expect(page.locator('#btn-layers')).toHaveCount(0);
  });
});

test.describe('unlocking', () => {
  test('right-clicking a locked element gives its usual menu, faded out but for Unlock', async ({ page }) => {
    await lock(page, big);
    await rightClick(page, big);
    await expect(page.locator('#context-menu')).toBeVisible();
    for (const id of ['#ctx-copy', '#ctx-duplicate', '#ctx-delete', '#ctx-bring-front', '#ctx-send-back']) {
      await expect(page.locator(id)).toHaveClass(/disabled/);
      await expect(page.locator(id)).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(page.locator('#ctx-lock')).not.toHaveClass(/disabled/);
    await expect(page.locator('#ctx-lock')).toHaveText('Unlock');
    await expect(page.locator('#ctx-lock use')).toHaveAttribute('href', '/icons.svg#icon-unlock');
  });

  test('Unlock unlocks it as one undo step, and it can be clicked again', async ({ page }) => {
    await lock(page, big);
    await rightClick(page, big);
    await page.click('#ctx-lock');
    expect(await locked(page)).toEqual([false, false]);
    await page.mouse.click(big.x, big.y);
    await page.keyboard.press('Delete');
    expect((await boardElements(page)).length).toBe(1);

    await page.click('#btn-undo'); // the delete
    await page.click('#btn-undo'); // the unlock
    expect((await locked(page))[0]).toBe(true);
  });

  test('the faded items do nothing when clicked', async ({ page }) => {
    await lock(page, big);
    await rightClick(page, big);
    await page.click('#ctx-delete', { force: true });
    expect(await locked(page)).toEqual([true, false]);
    expect((await boardElements(page)).length).toBe(2);
  });

  test('a locked token has the token menu, faded the same way, and is unlocked from it', async ({ page }) => {
    await placeToken(page, toScreen, 520, 200, 'Goblin');
    await page.click('#tool-select');
    const at = toScreen(540, 220);
    await rightClick(page, at);
    await page.click('#ctx-token-lock');
    await rightClick(page, at);
    await expect(page.locator('#token-context-menu')).toBeVisible();
    for (const id of [
      '#ctx-token-delete',
      '#ctx-token-rename',
      '#ctx-token-color',
      '#ctx-token-conditions',
      '#ctx-token-duplicate',
    ]) {
      await expect(page.locator(id)).toHaveClass(/disabled/);
    }
    await expect(page.locator('#ctx-token-lock')).toHaveText('Unlock');
    await page.click('#ctx-token-lock');
    expect((await boardElements(page)).find((e) => e.type === 'token').locked).toBeUndefined();
  });

  test('a locked label keeps its Edit Text item, faded', async ({ page }) => {
    await page.click('#tool-text');
    const p = toScreen(500, 400);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.type('Hall');
    await page.keyboard.press('Enter');
    await page.click('#tool-select');
    const at = toScreen(510, 406);
    await lock(page, at);
    await rightClick(page, at);
    await expect(page.locator('#ctx-edit-text')).toBeVisible();
    await expect(page.locator('#ctx-edit-text')).toHaveClass(/disabled/);
  });

  test('an unlocked element on top of a locked one gets the usual menu, not the faded one', async ({
    page,
  }) => {
    await lock(page, big);
    await rightClick(page, small); // the small room, on top of the locked big one
    await expect(page.locator('#context-menu')).toBeVisible();
    await expect(page.locator('#ctx-copy')).not.toHaveClass(/disabled/);
    await expect(page.locator('#ctx-lock')).toHaveText('Lock');
  });

  test('the menu is back to normal for the next element after a locked one', async ({ page }) => {
    await lock(page, big);
    await rightClick(page, big);
    await page.keyboard.press('Escape');
    await page.mouse.click(900, 700); // closes it
    await rightClick(page, small);
    await expect(page.locator('#ctx-delete')).not.toHaveClass(/disabled/);
    await expect(page.locator('#ctx-lock')).toHaveText('Lock');
  });

  test('Lock has an icon in the site’s style, not a coloured emoji', async ({ page }) => {
    await rightClick(page, small);
    await expect(page.locator('#ctx-lock use')).toHaveAttribute('href', '/icons.svg#icon-lock');
    expect((await page.locator('#ctx-lock').innerText()).trim()).toBe('Lock'); // no emoji in the text
    await expect(page.locator('#ctx-lock svg')).toHaveCSS('width', '14px');
  });
});

test.describe('the lock on a locked element', () => {
  const cornerClip = () => {
    const corner = toScreen(640, 160); // the big room's top right corner
    return { x: corner.x - 40, y: corner.y - 4, width: 44, height: 44 };
  };

  const hint = (page) => page.locator('#lock-hint');
  const opacity = (page) => hint(page).evaluate((el) => Number(getComputedStyle(el).opacity));

  test('fades in, by CSS, on the corner while the pointer is over it', async ({ page }) => {
    await lock(page, big);
    await page.mouse.move(900, 700);
    await expect.poll(() => opacity(page)).toBe(0);
    await expect(hint(page)).toHaveCSS('transition-property', 'opacity'); // the browser does the fade

    // note the opacity on every frame from now on, to see that it arrives gradually
    await page.evaluate(() => {
      window.__opacities = [];
      const el = document.getElementById('lock-hint');
      const sample = () => {
        window.__opacities.push(Number(getComputedStyle(el).opacity));
        requestAnimationFrame(sample);
      };
      sample();
    });
    await page.mouse.move(big.x, big.y);
    await expect.poll(() => opacity(page)).toBeCloseTo(0.6, 2);

    const seen = await page.evaluate(() => window.__opacities);
    expect(seen[0]).toBe(0);
    expect(seen.some((o) => o > 0 && o < 0.6)).toBe(true); // partway on the way in
    expect(Math.max(...seen)).toBeCloseTo(0.6, 2);
  });

  test('sits at the top right corner of the element, inside it', async ({ page }) => {
    await lock(page, big);
    await page.mouse.move(big.x, big.y);
    await expect(hint(page)).toHaveClass(/shown/);
    const box = await hint(page).boundingBox();
    const corner = toScreen(640, 160);
    expect(box.x + box.width).toBeLessThanOrEqual(corner.x);
    expect(box.x + box.width).toBeGreaterThan(corner.x - 30);
    expect(box.y).toBeGreaterThanOrEqual(corner.y);
    expect(box.y).toBeLessThan(corner.y + 30);
  });

  test('sits just outside the corner of a small element, so it does not cover it', async ({ page }) => {
    await placeToken(page, toScreen, 520, 200, 'Goblin');
    await page.click('#tool-select');
    const at = toScreen(540, 220);
    await rightClick(page, at);
    await page.click('#ctx-token-lock');
    await page.mouse.move(at.x, at.y);
    await expect(hint(page)).toHaveClass(/shown/);
    const box = await hint(page).boundingBox();
    const token = toScreen(540, 220);
    expect(Math.hypot(box.x + box.width / 2 - token.x, box.y + box.height / 2 - token.y)).toBeGreaterThan(17); // past the disc's edge
  });

  test('stays on the corner of its element when the map is zoomed under a mouse that has not moved', async ({
    page,
  }) => {
    await lock(page, big);
    await page.mouse.move(big.x, big.y);
    await expect(hint(page)).toHaveClass(/shown/);
    const before = await hint(page).boundingBox();
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 100); // zoom out around the mouse
    await expect.poll(async () => (await hint(page).boundingBox()).x).not.toBe(before.x);
    await expect(hint(page)).toHaveClass(/shown/);
  });

  test('is not shown while a button is held (dragging), or after the mouse leaves the map', async ({
    page,
  }) => {
    await lock(page, big);
    await page.mouse.move(big.x, big.y);
    await expect(hint(page)).toHaveClass(/shown/);
    await page.mouse.move(big.x + 10, big.y + 10);
    await page.mouse.down();
    await page.mouse.move(big.x + 40, big.y + 30, { steps: 3 });
    await expect(hint(page)).not.toHaveClass(/shown/);
    await page.mouse.up();
    await page.mouse.move(900, 700);
    await expect(hint(page)).not.toHaveClass(/shown/);
  });

  test('is not an obstacle: clicks pass through it', async ({ page }) => {
    await expect(hint(page)).toHaveCSS('pointer-events', 'none');
  });

  test('is not shown for an element that is not locked', async ({ page }) => {
    await page.mouse.move(900, 700);
    const clip = cornerClip();
    const without = await page.screenshot({ clip });
    await page.mouse.move(big.x, big.y);
    await page.waitForTimeout(400);
    expect((await page.screenshot({ clip })).equals(without)).toBe(true);
  });

  test('goes when the pointer leaves', async ({ page }) => {
    await lock(page, big);
    await page.mouse.move(900, 700);
    const clip = cornerClip();
    await page.waitForTimeout(300);
    const without = await page.screenshot({ clip });
    await page.mouse.move(big.x, big.y);
    await expect.poll(async () => (await page.screenshot({ clip })).equals(without)).toBe(false);
    await page.mouse.move(900, 700);
    await expect.poll(async () => (await page.screenshot({ clip })).equals(without)).toBe(true);
  });
});

test('locked survives a reload, and is sent to a shared session as a change to the element', async ({
  page,
}) => {
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
  await lock(page, big);

  await expect.poll(() => sent.at(-1)?.type).toBe('changes');
  expect(sent.at(-1).changes).toEqual([
    { t: 'set', el: expect.objectContaining({ type: 'rect', locked: true }) },
  ]);

  await page.reload();
  await page.waitForSelector('#tool-rect');
  expect((await locked(page))[0]).toBe(true);
});
