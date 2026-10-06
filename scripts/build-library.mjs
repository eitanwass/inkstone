// Builds the library's sample maps, using the editor itself.
//
//   npm run build:library
//
// For each map in SAMPLES (scripts/sample-maps.mjs) it writes, into public/library/:
//   maps/<id>.inkstone.json   the map as a map file (what "Save" makes, so opening it is "Open")
//   thumbs/<id>.jpg           a picture of it, drawn by the real editor with its panels hidden
// and index.json, the list the library panel reads (see src/core/library.ts for what an item is).
// Token pictures are painted in the page and kept through the editor's own image store, so they
// travel in the map file the way a player's own would. Don't edit the output by hand: change the maps
// in sample-maps.mjs and run this again. The generated files are committed, so a normal build never
// needs the script.

import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { paintPortraits, SAMPLES } from './sample-maps.mjs';

const OUT = 'public/library';
mkdirSync(`${OUT}/maps`, { recursive: true });
mkdirSync(`${OUT}/thumbs`, { recursive: true });

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const items = [];
try {
  // Laid out at 1200x780 and saved at half that: 600x390, the shape of a card's picture.
  const page = await browser.newPage({ viewport: { width: 1200, height: 780 }, deviceScaleFactor: 0.5 });
  for (const sample of SAMPLES) {
    await page.goto('http://localhost:5199/draw/');
    const { board, images } = await page.evaluate(
      async ({ board, paintSource }) => {
        localStorage.clear();
        const { addImage, getImageData } = await import('/src/elements/token-image.ts');
        const paint = new Function(`return (${paintSource})`)();
        const kinds = [...new Set(board.flatMap((el) => (el.portrait ? [el.portrait] : [])))];
        const pictures = paint(kinds);
        const images = {};
        for (const el of board) {
          if (!el.portrait) continue;
          el.image = addImage(pictures[el.portrait]);
          images[el.image] = getImageData(el.image);
          delete el.portrait;
        }
        localStorage.setItem('inkstone-board', JSON.stringify(board));
        localStorage.setItem('inkstone-hint-seen', '1');
        localStorage.setItem('inkstone-player', JSON.stringify({ id: 'library0001', name: 'Mira' }));
        return { board, images };
      },
      { board: sample.board, paintSource: paintPortraits.toString() },
    );

    await page.reload();
    await page.waitForSelector('#tool-rect');
    await page.addStyleTag({
      content: 'header, nav, footer, #toast, #first-visit-hint, #hud { display: none !important; }',
    });
    await page.keyboard.press('f'); // fit the whole map
    await page.waitForTimeout(800); // the fonts and the pictures
    await page.screenshot({ path: `${OUT}/thumbs/${sample.id}.jpg`, type: 'jpeg', quality: 78 });

    // The map file, written by the editor's own code so the format can't drift.
    const text = await page.evaluate(
      async ({ name, board, images }) => {
        const { serializeMap } = await import('/src/core/map-file.ts');
        return serializeMap({ name, elements: board, images });
      },
      { name: sample.name, board, images },
    );
    writeFileSync(`${OUT}/maps/${sample.id}.inkstone.json`, `${text}\n`);

    items.push({
      id: sample.id,
      kind: 'map',
      title: sample.name,
      description: sample.description,
      file: `/library/maps/${sample.id}.inkstone.json`,
      thumbnail: `/library/thumbs/${sample.id}.jpg`,
      author: 'Inkstone',
    });
    console.log(`Wrote ${sample.id}`);
  }
  writeFileSync(`${OUT}/index.json`, `${JSON.stringify({ version: 1, items }, null, 2)}\n`);
  console.log(`Wrote ${OUT}/index.json`);
} finally {
  await browser.close();
  await server.close();
}
