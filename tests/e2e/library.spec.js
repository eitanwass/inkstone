import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boardElements, placeRoom, resetBoard, worldToScreenFn } from './helpers.js';

// The library: the open-book button under the logo and the panel it opens, with sample maps to start from.

const modal = (page) => page.locator('#library-modal');
const cards = (page) => page.locator('.library-card');

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
});

async function openLibrary(page) {
  await page.click('#btn-library');
  await expect(modal(page)).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
}

test('the open-book button sits under the logo and opens the library', async ({ page }) => {
  const button = page.locator('#btn-library');
  await expect(button).toHaveAccessibleName('Library');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const logo = await page.locator('#brand-mark').boundingBox();
  const book = await button.boundingBox();
  expect(book.y).toBeGreaterThan(logo.y + logo.height);
  expect(book.x).toBeLessThan(logo.x + 40);

  await button.click();
  await expect(modal(page)).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(modal(page).getByRole('heading', { name: 'Library' })).toBeVisible();
});

test('it lists the sample maps, and says models and tokens are coming', async ({ page }) => {
  await openLibrary(page);
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator('#library-count')).toHaveText('3 maps');
  await expect(page.locator('.library-card-title')).toContainText(['The Hall Keep', 'The Rusty Flagon']);

  const kinds = page.locator('.library-kind');
  await expect(kinds).toHaveText(['Maps', 'ModelsSoon', 'TokensSoon']);
  await expect(kinds.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(kinds.nth(1)).toBeDisabled();
  await expect(kinds.nth(2)).toBeDisabled();
});

test('every card is the same size, with the author in bold at the bottom and a long description cut short', async ({
  page,
}) => {
  await page.setViewportSize({ width: 920, height: 800 }); // narrow cards, so the long description needs a fourth line
  await openLibrary(page);
  const heights = await cards(page).evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size).toBe(1);

  const author = page.locator('.library-card-meta strong').first();
  await expect(author).toHaveText('Inkstone');
  expect(Number(await author.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(600);
  await expect(page.locator('.library-card-meta').first()).toHaveText('by Inkstone');

  // The author is at the foot of the card, below the description, on every card.
  const feet = await cards(page).evaluateAll((els) =>
    els.map((el) => {
      const card = el.getBoundingClientRect();
      const meta = el.querySelector('.library-card-meta').getBoundingClientRect();
      const desc = el.querySelector('.library-card-desc').getBoundingClientRect();
      return { gap: card.bottom - meta.bottom, below: meta.top >= desc.bottom };
    }),
  );
  for (const foot of feet) {
    expect(foot.gap).toBeLessThan(20);
    expect(foot.below).toBe(true);
  }

  // A description longer than three lines is cut with an ellipsis, and the whole of it is its tooltip.
  const long = cards(page).filter({ hasText: 'The Hall Keep' }).locator('.library-card-desc');
  expect(await long.evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe('3');
  expect(await long.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(long).toHaveAttribute('title', /ogre/);
});

test('the thumbnails load', async ({ page }) => {
  await openLibrary(page);
  const images = page.locator('.library-card img');
  for (let i = 0; i < (await images.count()); i++) {
    await images.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => images.nth(i).evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  }
});

test('the search filters the maps, and can be cleared', async ({ page }) => {
  await openLibrary(page);

  await page.fill('#library-search', 'tavern');
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#library-count')).toHaveText('1 of 3 maps');
  await expect(page.locator('.library-card-title')).toHaveText('The Rusty Flagon');

  await page.fill('#library-search', 'dragon');
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('#library-message')).toHaveText('Nothing matches those filters.');

  await page.click('#library-clear');
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator('#library-search')).toHaveValue('');
  await expect(page.locator('#library-clear')).toBeHidden();
});

test('choosing a map opens it as one undo step, names the map, and closes the library', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, 160, 120);
  expect(await boardElements(page)).toHaveLength(1);

  await openLibrary(page);
  await cards(page).filter({ hasText: 'The Rusty Flagon' }).click();
  await expect(modal(page)).toBeHidden();
  await expect(page.locator('#map-name')).toHaveValue('The Rusty Flagon');
  await expect(page.locator('#toast')).toContainText('Opened "The Rusty Flagon"');

  const elements = await boardElements(page);
  expect(elements.length).toBeGreaterThan(30);
  expect(elements.filter((el) => el.type === 'token').length).toBeGreaterThan(10);
  await expect(page.locator('#btn-library')).toBeFocused(); // back where it was

  // The Undo in the toast puts the room back.
  await page.click('#toast button');
  await expect.poll(async () => (await boardElements(page)).length).toBe(1);
  expect((await boardElements(page))[0]).toMatchObject({ type: 'rect' });
});

test('a map with token pictures keeps them', async ({ page }) => {
  await openLibrary(page);
  await cards(page).filter({ hasText: 'The Hall Keep' }).click();
  await expect(modal(page)).toBeHidden();
  const tokens = (await boardElements(page)).filter((el) => el.type === 'token');
  expect(tokens.some((t) => typeof t.image === 'string')).toBe(true);
  const stored = await page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('inkstone-images') || '{}')),
  );
  for (const t of tokens.filter((t) => t.image)) expect(stored).toContain(t.image);
});

test('Escape, the close button and a click on the page behind close it', async ({ page }) => {
  const button = page.locator('#btn-library');
  await openLibrary(page);
  await page.keyboard.press('Escape');
  await expect(modal(page)).toBeHidden();
  await expect(button).toBeFocused();

  await openLibrary(page);
  await page.click('#library-close');
  await expect(modal(page)).toBeHidden();

  await openLibrary(page);
  await page.mouse.click(5, 450);
  await expect(modal(page)).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('keys do not act on the map behind the open library', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, 160, 120);
  await page.keyboard.press('Control+a');
  await openLibrary(page);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  expect(await boardElements(page)).toHaveLength(1);
});

test('if the list can not be loaded it says so, and loads when tried again', async ({ page }) => {
  await page.route('**/library/index.json', (route) => route.abort());
  await page.click('#btn-library');
  await expect(page.locator('#library-message')).toContainText("Couldn't load the library");
  await page.unroute('**/library/index.json');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(cards(page)).toHaveCount(3);
});

test('if a map can not be fetched it says so and leaves the map as it was', async ({ page }) => {
  const toScreen = await worldToScreenFn(page);
  await placeRoom(page, toScreen, 40, 40, 160, 120);
  await openLibrary(page);
  await page.route('**/library/maps/*', (route) => route.abort());
  await cards(page).first().click();
  await expect(page.locator('#toast')).toContainText("Couldn't open that map");
  await expect(modal(page)).toBeVisible();
  await expect(cards(page).first()).toBeEnabled();
  expect(await boardElements(page)).toHaveLength(1);
});

// Whatever index.json lists must be there: a map file the editor accepts, and a picture.
test('every item in the library list has a map file and a thumbnail that load', async ({ request }) => {
  const index = await (await request.get('/library/index.json')).json();
  expect(index.items.length).toBeGreaterThanOrEqual(3);
  for (const item of index.items) {
    const file = await request.get(item.file);
    expect(file.status(), item.file).toBe(200);
    const map = await file.json();
    expect(map.format, item.file).toBe('inkstone-map');
    expect(map.elements.length, item.file).toBeGreaterThan(5);
    const thumbnail = await request.get(item.thumbnail);
    expect(thumbnail.status(), item.thumbnail).toBe(200);
    expect(thumbnail.headers()['content-type']).toMatch(/image\/jpeg/);
  }
});

test('on a phone the library fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await resetBoard(page);
  await openLibrary(page);
  const box = await modal(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(cards(page).first()).toBeVisible();
});

test('the library has no accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLibrary(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});
