import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// A token can carry a picture, chosen in its card: cropped and shrunk, one undo step, kept on reload.
// The picture is kept once in the image store (`inkstone-images`); the token holds only its id.

// A real PNG (4x2), drawn by the browser so it is certain to decode.
const makePng = async (page) =>
  Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 2;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#c33';
      ctx.fillRect(0, 0, 4, 2);
      return c.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );

let tokenAt;

test.beforeEach(async ({ page }) => {
  await resetBoard(page);
  const toScreen = await worldToScreenFn(page);
  await placeToken(page, toScreen, 160, 160);
  tokenAt = toScreen(180, 180);
  await page.click('#tool-select');
  await page.mouse.click(tokenAt.x, tokenAt.y);
});

const images = async (page) => (await boardElements(page)).map((t) => t.image);
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('inkstone-images') || '{}'));

test('choosing a file gives the token a picture, kept once in the store, and Remove takes it off', async ({
  page,
}) => {
  await expect(page.locator('#token-image-remove')).toBeHidden();
  await page.setInputFiles('#token-image-file', {
    name: 'face.png',
    mimeType: 'image/png',
    buffer: await makePng(page),
  });
  await expect(page.locator('#token-image-preview')).toBeVisible();
  const [image] = await images(page);
  expect(image).toMatch(/^[0-9a-f]+$/); // an id, not the picture
  const pictures = await store(page);
  expect(Object.keys(pictures)).toEqual([image]);
  expect(pictures[image]).toMatch(/^data:image\/(webp|jpeg);base64,/);
  expect(pictures[image].length).toBeLessThan(100_000);

  await page.reload();
  await page.waitForSelector('#tool-rect');
  expect(await images(page)).toEqual([image]);

  await page.mouse.click(tokenAt.x, tokenAt.y);
  await page.click('#token-image-remove');
  expect(await images(page)).toEqual([undefined]);
  await expect(page.locator('#token-image-preview')).toBeHidden(); // not left behind, full size, in the button
});

test('a file that is not a picture is refused with a message', async ({ page }) => {
  await page.setInputFiles('#token-image-file', {
    name: 'x.png',
    mimeType: 'image/png',
    buffer: Buffer.from('nope'),
  });
  await expect(page.locator('#toast')).toContainText("Couldn't read that image");
  expect(await images(page)).toEqual([undefined]);
});

test('undo takes the picture off again', async ({ page }) => {
  await page.setInputFiles('#token-image-file', {
    name: 'face.png',
    mimeType: 'image/png',
    buffer: await makePng(page),
  });
  await expect(page.locator('#token-image-preview')).toBeVisible();
  await page.keyboard.press('Control+z');
  expect(await images(page)).toEqual([undefined]);
});

test('moving the token, or copying it, does not copy the picture', async ({ page }) => {
  await page.setInputFiles('#token-image-file', {
    name: 'face.png',
    mimeType: 'image/png',
    buffer: await makePng(page),
  });
  await expect(page.locator('#token-image-preview')).toBeVisible();
  const [image] = await images(page);

  await page.mouse.move(tokenAt.x, tokenAt.y);
  await page.mouse.down();
  await page.mouse.move(tokenAt.x + 120, tokenAt.y + 80, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Control+d');
  expect(await images(page)).toEqual([image, image]); // two tokens, one id
  expect(Object.keys(await store(page))).toEqual([image]); // one picture
  expect(JSON.stringify(await boardElements(page))).not.toContain('data:image');
});

test('a board saved with the picture inside the token is moved to the store on load', async ({ page }) => {
  const data = 'data:image/png;base64,iVBORw0KGgo=';
  await page.evaluate((data) => {
    localStorage.setItem('inkstone-board', JSON.stringify([{ type: 'token', x: 180, y: 180, image: data }]));
  }, data);
  await page.reload();
  await page.waitForSelector('#tool-rect');
  const [image] = await images(page);
  expect(image).toMatch(/^[0-9a-f]+$/);
  expect((await store(page))[image]).toBe(data);
});
