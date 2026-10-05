import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The settings menu and its Board panel: the unit and the size of a square, which the ruler and the
// size rulers read. #measure-readout carries the text the canvas draws (see ruler.spec.js).

const modal = (page) => page.locator('#settings-modal');
const perCell = (page) => page.locator('#board-per-cell');
const readout = (page) => page.locator('#measure-readout');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function measure(page, squares) {
  const toScreen = await worldToScreenFn(page);
  const a = toScreen(200, 200);
  const b = toScreen(200 + squares * 40, 200);
  await page.keyboard.press('m');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test.describe('opening and closing', () => {
  test('the gear button opens it, and the close button, Escape or the backdrop close it', async ({
    page,
  }) => {
    await expect(modal(page)).toBeHidden();
    await page.click('#btn-settings');
    await expect(modal(page)).toBeVisible();
    await expect(modal(page)).toBeFocused();

    await page.click('#settings-close');
    await expect(modal(page)).toBeHidden();

    await page.click('#btn-settings');
    await page.keyboard.press('Escape');
    await expect(modal(page)).toBeHidden();

    await page.click('#btn-settings');
    await page.mouse.click(5, 5); // the blurred page outside the box
    await expect(modal(page)).toBeHidden();
  });

  test('focus stays inside while it is open and goes back to the gear when it closes', async ({ page }) => {
    await page.click('#btn-settings');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      document.getElementById('settings-modal').contains(document.activeElement),
    );
    expect(inside).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-settings')).toBeFocused();
  });

  test('is a labelled dialog with the Board panel selected', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(modal(page)).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#settings-tab-board')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#settings-panel-board')).toBeVisible();
    await expect(page.locator('#settings-panel-board')).toContainText('Saved in this browser');
  });

  test('keys pressed in it are not shortcuts: no nudging the map, no changing tool, no zooming', async ({
    page,
  }) => {
    const toScreen = await worldToScreenFn(page);
    await placeRoom(page, toScreen, 160, 160, 320, 280);
    await page.keyboard.press('v');
    await page.keyboard.press('Control+a'); // everything is selected
    const before = await boardElements(page);

    await page.click('#btn-settings');
    await expect(modal(page)).toBeFocused(); // focus starts on the dialog itself, not on a field
    for (const key of ['ArrowRight', 'ArrowDown', 'r', 'w', 'm', 'f', '+', 'Delete']) {
      await page.keyboard.press(key);
    }
    await page.locator('#settings-tab-board').focus(); // and on its tab button
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('t');
    await page.keyboard.press('Escape');

    expect(await boardElements(page)).toEqual(before); // not moved, not deleted
    await expect(page.locator('#tool-select')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#zoom-label')).toHaveText('100%');
  });

  test('the shortcuts work again once it is closed', async ({ page }) => {
    await page.click('#btn-settings');
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await expect(page.locator('#tool-rect')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('the Board panel', () => {
  test('starts as feet, 5 a square, with an example in those terms', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(page.locator('#board-units input[value="ft"]')).toBeChecked();
    await expect(perCell(page)).toHaveValue('5');
    await expect(page.locator('#board-example')).toHaveText('A room 6 squares wide is 30 ft wide.');
  });

  test('the units and the size of a square share one line, the size to the right', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('#btn-settings');
    const units = await page.locator('#board-units').boundingBox();
    const size = await perCell(page).boundingBox();
    expect(size.x).toBeGreaterThan(units.x + units.width); // to the right of the units
    expect(Math.abs(size.y + size.height / 2 - (units.y + units.height / 2))).toBeLessThan(8); // level with them
  });

  test('the ruler uses the size of a square that is set', async ({ page }) => {
    await page.click('#btn-settings');
    await perCell(page).fill('10');
    await page.keyboard.press('Escape');
    await measure(page, 3);
    await expect(readout(page)).toHaveText('30 ft'); // 3 squares at 10 ft
  });

  test("changing the unit changes what the ruler says, starting from that unit's usual square", async ({
    page,
  }) => {
    await page.click('#btn-settings');
    await page.locator('#board-units label', { hasText: 'Meters' }).click();
    await expect(perCell(page)).toHaveValue('1.5');
    await expect(page.locator('#board-example')).toHaveText('A room 6 squares wide is 9 m wide.');
    await page.keyboard.press('Escape');
    await measure(page, 4);
    await expect(readout(page)).toHaveText('6 m');

    await page.click('#btn-settings');
    await page.locator('#board-units label', { hasText: 'Squares' }).click();
    await expect(perCell(page)).toHaveValue('1');
    await page.keyboard.press('Escape');
    await measure(page, 4);
    await expect(readout(page)).toHaveText('4 sq');
  });

  test('a ruler already on the map is read in the new scale straight away', async ({ page }) => {
    await measure(page, 4);
    await expect(readout(page)).toHaveText('20 ft');
    await page.click('#btn-settings');
    await perCell(page).fill('2.5');
    await expect(readout(page)).toHaveText('10 ft');
  });

  test('the sizes of a shape being drawn follow it too', async ({ page }) => {
    await page.click('#btn-settings');
    await perCell(page).fill('1');
    await page.keyboard.press('Escape');
    const toScreen = await worldToScreenFn(page);
    const a = toScreen(160, 160);
    const b = toScreen(160 + 6 * 40, 160 + 4 * 40);
    await page.keyboard.press('r');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await expect(readout(page)).toHaveText('6 ft × 4 ft');
    await page.mouse.up();
  });

  test('a size that cannot be one is flagged and not applied; leaving the field restores the last good one', async ({
    page,
  }) => {
    await page.click('#btn-settings');
    for (const bad of ['0', '-3', '', '5000']) {
      await perCell(page).fill(bad);
      await expect(perCell(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#board-example')).toHaveText('A room 6 squares wide is 30 ft wide.');
    }
    await page.locator('#settings-title').click(); // leave the field, still holding the last bad entry
    await expect(perCell(page)).toHaveValue('5');
    await expect(perCell(page)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('half a square and decimals are fine, and show up to one decimal', async ({ page }) => {
    await page.click('#btn-settings');
    await perCell(page).fill('2.5');
    await page.keyboard.press('Escape');
    await measure(page, 3);
    await expect(readout(page)).toHaveText('7.5 ft');
  });
});

test.describe('the D&D diagonal rule', () => {
  const rule = (page) => page.locator('#board-dnd-diagonals');

  async function measureDiagonal(page, squares) {
    const toScreen = await worldToScreenFn(page);
    const a = toScreen(200, 200);
    const b = toScreen(200 + squares * 40, 200 + squares * 40);
    await page.keyboard.press('m');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
  }

  test('is on to begin with, and shows what it does with an example', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(rule(page)).toBeChecked();
    await expect(page.locator('#board-diagonal-example')).toHaveText(
      'A line 4 squares across and 4 down is 30 ft.',
    );
  });

  test('is a switch, not a tick box', async ({ page }) => {
    await page.click('#btn-settings');
    await expect(rule(page)).toHaveAttribute('role', 'switch');
    const track = await page.locator('.switch-track').boundingBox();
    expect(track.width).toBeGreaterThan(track.height * 1.5); // a pill, drawn wider than tall
    const knobOn = await page
      .locator('.switch-track')
      .evaluate((el) => getComputedStyle(el, '::after').transform);
    await rule(page).uncheck();
    // The knob slides across; wait for it to arrive rather than guess how long that takes.
    await expect
      .poll(() => page.locator('.switch-track').evaluate((el) => getComputedStyle(el, '::after').transform))
      .not.toBe(knobOn);
  });

  test('the explanation is a ? that shows it on hover, and on keyboard focus', async ({ page }) => {
    await page.click('#btn-settings');
    const hint = page.locator('#board-diagonals-note');
    const help = page.getByRole('button', { name: 'About the D&D diagonal rules' });
    await expect(hint).toBeHidden(); // no long description cluttering the panel
    await expect(help).toHaveText('?');

    await help.hover();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('first diagonal square counts as 1, the next as 2');
    await expect(hint).toContainText('Dungeon Master');

    await page.locator('#settings-title').hover(); // away again
    await expect(hint).toBeHidden();

    await help.focus(); // someone using the keyboard gets it too
    await expect(hint).toBeVisible();
    await expect(help).toHaveAttribute('aria-describedby', 'board-diagonals-note'); // and a screen reader reads it
    await page.locator('#board-per-cell').focus();
    await expect(hint).toBeHidden();
  });

  test('the explanation does not push the panel around or fall off the dialog', async ({ page }) => {
    await page.click('#btn-settings');
    await page.waitForTimeout(300); // let the dialog finish scaling in before measuring it
    const before = await page.locator('#board-diagonal-example').boundingBox();
    await page.getByRole('button', { name: 'About the D&D diagonal rules' }).hover();
    const hint = await page.locator('#board-diagonals-note').boundingBox();
    const dialog = await modal(page).boundingBox();
    expect(await page.locator('#board-diagonal-example').boundingBox()).toEqual(before); // nothing moved
    expect(hint.x).toBeGreaterThanOrEqual(dialog.x);
    expect(hint.x + hint.width).toBeLessThanOrEqual(dialog.x + dialog.width);
    expect(hint.y + hint.height).toBeLessThanOrEqual(dialog.y + dialog.height);
  });

  test('turning it off changes the example and the ruler to the straight line, and on again back', async ({
    page,
  }) => {
    await measureDiagonal(page, 4);
    await expect(readout(page)).toHaveText('30 ft'); // 4 across and 4 down: 1 + 2 + 1 + 2 squares

    await page.click('#btn-settings');
    await rule(page).uncheck();
    await expect(page.locator('#board-diagonal-example')).toHaveText(
      'A line 4 squares across and 4 down is 28.3 ft.',
    );
    await expect(readout(page)).toHaveText('28.3 ft'); // the ruler already on the map is read the new way
    await page.keyboard.press('Escape');

    await page.keyboard.press('Escape'); // clear the ruler
    await measureDiagonal(page, 2);
    await expect(readout(page)).toHaveText('14.1 ft'); // as the crow flies

    await page.click('#btn-settings');
    await rule(page).check();
    await expect(readout(page)).toHaveText('15 ft'); // 1 + 2 = 3 squares
  });

  test('a wall drawn on the diagonal follows it too, either way', async ({ page }) => {
    const drawWall = async () => {
      const toScreen = await worldToScreenFn(page);
      const a = toScreen(160, 160);
      const b = toScreen(160 + 4 * 40, 160 + 4 * 40);
      await page.keyboard.press('w');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 6 });
    };
    await drawWall();
    await expect(readout(page)).toHaveText('30 ft'); // the D&D way, by default
    await page.mouse.up();

    await page.click('#btn-settings');
    await rule(page).uncheck();
    await page.keyboard.press('Escape');
    await drawWall();
    await expect(readout(page)).toHaveText('28.3 ft');
    await page.mouse.up();
  });

  test('does not touch the sides of a room, which are never diagonal', async ({ page }) => {
    await page.click('#btn-settings');
    await rule(page).uncheck(); // it makes no difference which way it is set
    await page.keyboard.press('Escape');
    const toScreen = await worldToScreenFn(page);
    const a = toScreen(160, 160);
    const b = toScreen(160 + 6 * 40, 160 + 4 * 40);
    await page.keyboard.press('r');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await expect(readout(page)).toHaveText('30 ft × 20 ft');
    await page.mouse.up();
  });

  test('can be switched with the keyboard', async ({ page }) => {
    await page.click('#btn-settings');
    await rule(page).focus();
    await page.keyboard.press('Space');
    await expect(rule(page)).not.toBeChecked(); // it starts on
    await page.keyboard.press('Space');
    await expect(rule(page)).toBeChecked();
  });

  test('turned off, it stays off across a reload', async ({ page }) => {
    await page.click('#btn-settings');
    await rule(page).uncheck();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await measureDiagonal(page, 4);
    await expect(readout(page)).toHaveText('28.3 ft');
    await page.click('#btn-settings');
    await expect(rule(page)).not.toBeChecked();
  });

  test('changing the unit keeps the rule, on or off', async ({ page }) => {
    await page.click('#btn-settings');
    await page.locator('#board-units label', { hasText: 'Meters' }).click();
    await expect(rule(page)).toBeChecked();
    await expect(page.locator('#board-diagonal-example')).toHaveText(
      'A line 4 squares across and 4 down is 9 m.',
    ); // 6 squares at 1.5 m

    await rule(page).uncheck();
    await page.locator('#board-units label', { hasText: 'Feet' }).click();
    await expect(rule(page)).not.toBeChecked();
    await expect(page.locator('#board-diagonal-example')).toHaveText(
      'A line 4 squares across and 4 down is 28.3 ft.',
    );
  });

  test('a stored value of the wrong kind leaves it on, as it starts', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('inkstone-board-settings', '{"unit":"ft","perCell":5,"dndDiagonals":"no"}'),
    );
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.click('#btn-settings');
    await expect(rule(page)).toBeChecked();
  });

  test('settings saved before this one existed (no diagonal rule stored) get it on', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('inkstone-board-settings', '{"unit":"m","perCell":2}'));
    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.click('#btn-settings');
    await expect(rule(page)).toBeChecked();
    await expect(page.locator('#board-units input[value="m"]')).toBeChecked(); // the rest is kept
  });
});

test.describe('keeping it', () => {
  test('survives a reload, and the example and the ruler use it', async ({ page }) => {
    await page.click('#btn-settings');
    await page.locator('#board-units label', { hasText: 'Meters' }).click();
    await perCell(page).fill('2');
    await page.keyboard.press('Escape');

    await page.reload();
    await page.waitForSelector('#tool-rect');
    await measure(page, 5);
    await expect(readout(page)).toHaveText('10 m');
    await page.click('#btn-settings');
    await expect(page.locator('#board-units input[value="m"]')).toBeChecked();
    await expect(perCell(page)).toHaveValue('2');
  });

  test('a damaged saved value is ignored: feet and 5 a square', async ({ page }) => {
    for (const raw of [
      'not json',
      '{"unit":"furlongs","perCell":5}',
      '{"unit":"ft","perCell":-2}',
      '42',
      'null',
    ]) {
      await page.evaluate((value) => localStorage.setItem('inkstone-board-settings', value), raw);
      await page.reload();
      await page.waitForSelector('#tool-rect');
      await measure(page, 2);
      await expect(readout(page)).toHaveText('10 ft');
    }
  });

  test('is not part of the map: no undo step, nothing saved with the board', async ({ page }) => {
    await page.click('#btn-settings');
    await perCell(page).fill('10');
    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-undo')).toBeDisabled();
    expect(await boardElements(page)).toHaveLength(0);
  });
});

test('changing a board setting says "Saved"', async ({ page }) => {
  await resetBoard(page);
  await page.click('#btn-settings');
  await expect(page.locator('#settings-saved')).toHaveCSS('opacity', '0');
  await page.click('#board-units label:has-text("Meters")');
  await expect(page.locator('#settings-saved')).toHaveText('Saved');
  await expect(page.locator('#settings-saved')).toHaveCSS('opacity', '1');
});
