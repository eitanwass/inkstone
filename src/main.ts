// ── Entry point ────────────────────────────────────────────────
// Owns canvas sizing and the load-time init sequence (restore the persisted
// board, center the view, show the welcome/restore toast). Also pulls in
// the pure-side-effect modules (color swatches, keyboard shortcuts) that
// nothing else imports, so their DOM wiring actually runs.

import { byId } from './dom';
import { state } from './state';
import { gridCanvas, mainCanvas, iCanvas } from './canvas';
import { drawMain } from './render';
import { drawGrid } from './grid';
import { setTool } from './toolbar';
import { resetView } from './view-actions';
import { loadPersistedBoard, pushHistory } from './history';
import { showToast } from './toast';
import { version } from '../package.json';

import './color-swatches';
import './shortcuts';
import './collab';

byId('version-label').textContent = `v${version}`;

function resize() {
  [gridCanvas, mainCanvas, iCanvas].forEach(c => {
    c.width  = c.offsetWidth;
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

  showToast(saved ? 'Welcome back! Your map was restored.' : 'Welcome! Right-click elements for options.');
});
