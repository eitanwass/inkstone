// ── Entry point ────────────────────────────────────────────────
// Owns canvas sizing and the load-time init sequence (restore the persisted
// board, center the view, show the welcome/restore toast). Also pulls in
// the pure-side-effect modules (color swatches, keyboard shortcuts) that
// nothing else imports, so their DOM wiring actually runs.

import '@fontsource-variable/inter'; // the UI and map-text font
import '@fontsource/eb-garamond/500.css'; // the wordmark
import { version } from '../package.json';
import { gridCanvas, iCanvas, mainCanvas } from './canvas';
import { resetView } from './controls';
import { byId } from './dom';
import { drawGrid } from './grid';
import { loadPersistedBoard, pushHistory } from './history';
import { drawMain } from './render';
import { FONT_FAMILY, state } from './state';
import { setTool } from './toolbar';

import './color-swatches';
import './shortcuts';
import './view-actions';
import './map-name';
import './collab';
import './changelog';
import './settings';

byId('version-label').textContent = `v${version}`;

function resize() {
  [gridCanvas, mainCanvas, iCanvas].forEach((c) => {
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
  });
  drawGrid();
  drawMain();
}

window.addEventListener('resize', resize);

window.addEventListener('load', () => {
  resize();
  setTool('select');
  resetView();

  const saved = loadPersistedBoard();
  if (saved) state.elements = saved;

  pushHistory();
  drawMain();

  // Page text waits for its font by itself, but canvas text doesn't: until the
  // font has loaded the canvas quietly draws and measures with a fallback. So
  // ask for the faces the canvas uses, and repaint once they're in.
  Promise.all([
    document.fonts.load(`14px ${FONT_FAMILY}`),
    document.fonts.load(`bold 14px ${FONT_FAMILY}`),
  ]).then(drawMain);
});
