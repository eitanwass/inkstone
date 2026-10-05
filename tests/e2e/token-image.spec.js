import { expect, test } from '@playwright/test';
import { boardElements, placeToken, resetBoard, worldToScreenFn } from './helpers.js';

// A token can carry a picture, chosen in its card: cropped and shrunk, one undo step, kept on reload.

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

test('choosing a file puts a small picture on the token, and Remove takes it off', async ({ page }) => {
  await expect(page.locator('#token-image-remove')).toBeHidden();
  await page.setInputFiles('#token-image-file', {
    name: 'face.png',
    mimeType: 'image/png',
    buffer: await makePng(page),
  });
  await expect(page.locator('#token-image-preview')).toBeVisible();
  const [image] = await images(page);
  expect(image).toMatch(/^data:image\/(webp|jpeg);base64,/);
  expect(image.length).toBeLessThan(100_000);

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
