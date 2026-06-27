// Shared setup + actions for the Inkstone test suite. Every test interacts
// with the app the same way a user would (click toolbar buttons, drag on
// the canvas) rather than reaching into module internals — there's no
// exposed JS API to call directly, and DOM/canvas interaction is what
// actually exercises the code paths worth regression-testing.

export async function resetBoard(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.waitForTimeout(300); // let layout/webfont settle before reading boundingBox()
}

// World (logical, grid-unit) coords -> screen coords, matching resetView()'s
// pan formula (panX/Y = 10% of canvas size, zoom = 1) so tests can target
// exact grid cells without re-deriving the canvas's on-screen position.
export async function worldToScreenFn(page) {
  const box = await page.locator('#interaction-canvas').boundingBox();
  const panX = box.width * 0.1, panY = box.height * 0.1;
  return (wx, wy) => ({ x: box.x + panX + wx, y: box.y + panY + wy });
}

export function boardElements(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-board') || '[]'));
}

export async function placeRoom(page, toScreen, x1, y1, x2, y2) {
  await page.click('#tool-rect');
  let p = toScreen(x1, y1);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(x2, y2);
  await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();
}

export async function placeWall(page, toScreen, x1, y1, x2, y2) {
  await page.click('#tool-wall');
  let p = toScreen(x1, y1);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  p = toScreen(x2, y2);
  await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();
}

export async function placeToken(page, toScreen, x, y, name, dragTo) {
  await page.click('#tool-token');
  let p = toScreen(x, y);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  if (dragTo) {
    p = toScreen(dragTo.x, dragTo.y);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  }
  await page.mouse.up();
  await page.waitForSelector('#token-name-overlay:not(.hidden)');
  await page.fill('#token-name-input', name);
  await page.click('#token-name-confirm');
}

export async function placeLabel(page, toScreen, x, y, text) {
  await page.click('#tool-text');
  const p = toScreen(x, y);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('#text-label-overlay:not(.hidden)');
  await page.fill('#text-label-input', text);
  await page.click('#text-label-confirm');
}
