// ── Entry point ────────────────────────────────────────────────
// Owns canvas sizing and the load-time init sequence (restore the persisted
// board, center the view, show the welcome/restore toast). Also pulls in
// the pure-side-effect modules (color swatches, keyboard shortcuts) that
// nothing else imports, so their DOM wiring actually runs.

import '@fontsource-variable/inter'; // the UI and map-text font
import '@fontsource/eb-garamond/500.css'; // the wordmark
import { version } from '../package.json';
import { gridCanvas, iCanvas, mainCanvas } from './core/canvas';
import { byId } from './core/dom';
import { FONT_FAMILY, state } from './core/state';
import { drawGrid } from './draw/grid';
import { drawMain } from './draw/render';
import { resetView } from './input/controls';
import { loadPersistedBoard, pushHistory } from './input/history';
import { setTool } from './input/toolbar';

import './ui/color-swatches';
import './input/shortcuts';
import './ui/view-actions';
import './ui/action-more';
import './ui/adjust-panel';
import './ui/background';
import './ui/map-name';
import './ui/table-maps';
import './collab/collab';
import './ui/changelog';
import './ui/feedback';
import './ui/library';
import './settings';
import './ui/label-card';
import './ui/lock-hint';
import './ui/label-editor';
import './ui/token-card';
import { setImageLoadedListener } from './elements/token-image';

setImageLoadedListener(drawMain);
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
