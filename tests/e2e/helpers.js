// Shared setup + actions for the Inkstone test suite. Every test interacts
// with the app the same way a player would (click toolbar buttons, drag on
// the canvas) rather than reaching into module internals — there's no
// exposed JS API to call directly, and DOM/canvas interaction is what
// actually exercises the code paths worth regression-testing.

// A fresh browser: nothing saved. The player already has a name, so sharing and joining don't stop to
// ask for one ({ named: false } for the tests of that).
export async function resetBoard(page, { named = true } = {}) {
  await page.goto('/');
  await page.evaluate((named) => {
    localStorage.clear();
    try {
      if (named)
        localStorage.setItem('inkstone-player', JSON.stringify({ id: 'tester0001', name: 'Tester One' }));
    } catch {
      // the tests of a browser that refuses to save make setItem throw
    }
  }, named);
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(300); // let layout/webfont settle before reading boundingBox()
}

// World (logical, grid-unit) coords -> screen coords, matching resetView()'s
// pan formula (panX/Y = 10% of canvas size, zoom = 1) so tests can target
// exact grid cells without re-deriving the canvas's on-screen position.
export async function worldToScreenFn(page) {
  const box = await page.locator('#interaction-canvas').boundingBox();
  const panX = box.width * 0.1,
    panY = box.height * 0.1;
  return (wx, wy) => ({ x: box.x + panX + wx, y: box.y + panY + wy });
}

export function boardElements(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-board') || '[]'));
}

export async function placeRoom(page, toScreen, x1, y1, x2, y2) {
  await page.click('#tool-rect');
  let p = toScreen(x1, y1);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = toScreen(x2, y2);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
}

export async function placeWall(page, toScreen, x1, y1, x2, y2) {
  await page.click('#tool-wall');
  let p = toScreen(x1, y1);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = toScreen(x2, y2);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
}

// Places a token with the token tool (dragging out to dragTo makes it bigger). A token is placed
// with no name; pass one to give it a name afterwards, the way a player would: click it and type in
// the card that appears above it. The token tool is back in use afterwards.
export async function placeToken(page, toScreen, x, y, name, dragTo) {
  await page.click('#tool-token');
  let p = toScreen(x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  if (dragTo) {
    p = toScreen(dragTo.x, dragTo.y);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  await page.mouse.up();
  if (!name) return;

  // A token's centre is the clicked cell's origin plus half a cell.
  const centre = toScreen(Math.round(x / 40) * 40 + 20, Math.round(y / 40) * 40 + 20);
  await page.click('#tool-select');
  await page.mouse.click(centre.x, centre.y);
  await page.fill('#token-name-field', name);
  await page.keyboard.press('Enter');
  await page.click('#tool-token');
}

export async function placeLabel(page, toScreen, x, y, text) {
  await page.click('#tool-text');
  const p = toScreen(x, y);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('#label-editor:not(.hidden)');
  await page.fill('#label-editor', text);
  await page.keyboard.press('Enter');
}

// Playwright's touchscreen API only does taps, so multi-touch gestures are
// driven by dispatching touch-type PointerEvents on the canvas directly (which
// is what the app's own handlers listen for).
export function touch(page, type, pointerId, x, y) {
  return page.evaluate(
    ([type, pointerId, x, y]) => {
      document.getElementById('interaction-canvas').dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [type, pointerId, x, y],
  );
}
