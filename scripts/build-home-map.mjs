// Renders the map shown at the top of the home page, using the editor itself.
//
//   npm run build:home-map
//
// Writes public/home-map.jpg. The map (HALL_KEEP in sample-maps.mjs) is made of the same elements the editor saves, put in
// the browser's storage and drawn by the real app with its panels hidden, so the picture is always
// what the editor can do. Token pictures are painted here and kept in the editor's own image store,
// the way a picture a player chose would be. Don't edit the JPG by hand: change the map there and run
// this again.

import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { HALL_KEEP, paintPortraits } from './sample-maps.mjs';

const BOARD = HALL_KEEP;

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 740 }, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:5199/draw/');
  await page.evaluate(
    async ({ board, paintSource }) => {
      localStorage.clear();
      // The pictures go through the editor's own image store, so a token holds only an id.
      const { addImage } = await import('/src/elements/token-image.ts');
      const paint = new Function(`return (${paintSource})`)();
      const kinds = [...new Set(board.flatMap((el) => (el.portrait ? [el.portrait] : [])))];
      const pictures = paint(kinds);
      for (const el of board) {
        if (!el.portrait) continue;
        el.image = addImage(pictures[el.portrait]);
        delete el.portrait;
      }
      localStorage.setItem('inkstone-board', JSON.stringify(board));
      localStorage.setItem('inkstone-hint-seen', '1');
      localStorage.setItem('inkstone-player', JSON.stringify({ id: 'homepage01', name: 'Mira' }));
    },
    { board: BOARD, paintSource: paintPortraits.toString() },
  );
  await page.reload();
  await page.waitForSelector('#tool-rect');
  await page.addStyleTag({
    content: 'header, nav, footer, #toast, #first-visit-hint, #hud { display: none !important; }',
  });
  await page.keyboard.press('f'); // fit the whole map
  for (let i = 0; i < 1; i++) await page.keyboard.press('+'); // closer: the fit leaves wide margins
  await page.waitForTimeout(800); // the fonts and the pictures
  await page.screenshot({ path: 'public/home-map.jpg', type: 'jpeg', quality: 86 });
  console.log('Wrote public/home-map.jpg');
} finally {
  await browser.close();
  await server.close();
}
