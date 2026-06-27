// ─────────────────────────────────────────────────────────────
//  D&D Whiteboard · app.js
// ─────────────────────────────────────────────────────────────

const GRID = 40; // px per grid cell (logical)

// ── State ─────────────────────────────────────────────────────
const state = {
  tool: 'select',
  strokeColor: '#e8dcc8',
  fillColor: 'transparent',
  strokeWidth: 2,
  // Viewport transform
  panX: 0,
  panY: 0,
  zoom: 1,
  // Interaction
  isPanning: false,
  panStart: null,
  isDragging: false,
  dragStart: null,
  // Selection
  selected: null,     // index into elements[]
  hoveredToken: null, // index
  // For in-progress draw
  preview: null,
  // Elements (shapes, tokens, doors, labels)
  elements: [],
  // Token drag
  tokenDrag: null,
  // Erase drag
  isErasing: false,
};

// ── Token colors pool ─────────────────────────────────────────
const TOKEN_COLORS = [
  '#e05c5c', '#5c8ae0', '#5cba6a', '#e0a85c',
  '#9a5ce0', '#5ce0d4', '#e05caa', '#c8e05c',
];
let tokenColorIdx = 0;

// ── Canvas setup ──────────────────────────────────────────────
const gridCanvas = document.getElementById('grid-canvas');
const mainCanvas = document.getElementById('main-canvas');
const iCanvas    = document.getElementById('interaction-canvas');
const gCtx = gridCanvas.getContext('2d');
const mCtx = mainCanvas.getContext('2d');
const iCtx = iCanvas.getContext('2d');

function resize() {
  [gridCanvas, mainCanvas, iCanvas].forEach(c => {
    c.width  = c.offsetWidth;
    c.height = c.offsetHeight;
  });
  drawGrid();
  drawMain();
}

window.addEventListener('resize', resize);

// ── Grid drawing ──────────────────────────────────────────────
function drawGrid() {
  const W = gridCanvas.width, H = gridCanvas.height;
  gCtx.clearRect(0, 0, W, H);

  const cellPx = GRID * state.zoom;
  const offsetX = ((state.panX % cellPx) + cellPx) % cellPx;
  const offsetY = ((state.panY % cellPx) + cellPx) % cellPx;

  gCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--dot-color').trim() || 'rgba(180,170,155,0.55)';

  const r = Math.max(1, cellPx * 0.04);

  for (let x = offsetX; x < W + cellPx; x += cellPx) {
    for (let y = offsetY; y < H + cellPx; y += cellPx) {
      gCtx.beginPath();
      gCtx.arc(x, y, r, 0, Math.PI * 2);
      gCtx.fill();
    }
  }
}

// ── Coordinate helpers ────────────────────────────────────────
function screenToWorld(sx, sy) {
  return {
    x: (sx - state.panX) / state.zoom,
    y: (sy - state.panY) / state.zoom,
  };
}

function worldToScreen(wx, wy) {
  return {
    x: wx * state.zoom + state.panX,
    y: wy * state.zoom + state.panY,
  };
}

function snapToGrid(v) {
  return Math.round(v / GRID) * GRID;
}

// ── Main draw ─────────────────────────────────────────────────
function drawMain() {
  const W = mainCanvas.width, H = mainCanvas.height;
  mCtx.clearRect(0, 0, W, H);

  mCtx.save();
  mCtx.translate(state.panX, state.panY);
  mCtx.scale(state.zoom, state.zoom);

  state.elements.forEach((el, idx) => {
    drawElement(mCtx, el, idx === state.selected);
  });

  // Selection highlight: semi-transparent blue box around selected element
  if (state.selected !== null && state.tool === 'select') {
    const el = state.elements[state.selected];
    if (el) {
      const bounds = getElementBounds(el);
      if (bounds) {
        const pad = 4;
        mCtx.save();
        mCtx.strokeStyle = 'rgba(80, 160, 255, 0.9)';
        mCtx.fillStyle   = 'rgba(80, 160, 255, 0.15)';
        mCtx.lineWidth   = 1.5 / state.zoom;
        mCtx.setLineDash([5 / state.zoom, 3 / state.zoom]);
        mCtx.beginPath();
        mCtx.rect(bounds.x - pad, bounds.y - pad, bounds.w + pad*2, bounds.h + pad*2);
        mCtx.fill();
        mCtx.stroke();
        mCtx.setLineDash([]);
        mCtx.restore();
      }
    }
  }

  // Preview shape while drawing
  if (state.preview) {
    drawElement(mCtx, state.preview, false, true);
  }

  mCtx.restore();
}

function drawElement(ctx, el, isSelected, isPreview = false) {
  ctx.save();
  ctx.globalAlpha = isPreview ? 0.55 : 1;
  ctx.strokeStyle = el.strokeColor || '#e8dcc8';
  ctx.fillStyle   = el.fillColor   || 'transparent';
  ctx.lineWidth   = el.strokeWidth  || 2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (isSelected) {
    ctx.shadowColor = '#c9a84c';
    ctx.shadowBlur  = 10;
  }

  switch (el.type) {
    case 'rect': {
      const { x, y, w, h } = el;
      if (el.fillColor && el.fillColor !== 'transparent') {
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'wall': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      // Draw endpoints as small dots
      ctx.fillStyle = el.strokeColor || '#e8dcc8';
      ctx.beginPath(); ctx.arc(el.x1, el.y1, (el.strokeWidth || 2) * 1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(el.x2, el.y2, (el.strokeWidth || 2) * 1.2, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'token': {
      const r = GRID * 0.42;
      // Shadow ring
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.fillStyle = el.color || '#e05c5c';
      ctx.fill();
      ctx.restore();

      // Rim
      ctx.beginPath();
      ctx.arc(el.x, el.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = lighten(el.color || '#e05c5c', 60);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Initials
      const label = el.name ? el.name.slice(0, 2).toUpperCase() : '?';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(r * 0.85)}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, el.x, el.y + 1);

      // Name below
      if (el.name) {
        ctx.font = `${Math.floor(r * 0.52)}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(el.name, el.x, el.y + r + 10);
      }
      break;
    }
    case 'door': {
      // Door sits ON the grid edge between two dots.
      // el.x,el.y = the grid dot where the door is anchored (snapped to dot)
      // el.dir = 'h' (horizontal wall, door opens vertically) or 'v' (vertical wall)
      const d = GRID;
      ctx.save();
      ctx.strokeStyle = el.strokeColor || '#c9a84c';
      ctx.lineWidth = (el.strokeWidth || 2);
      ctx.lineCap = 'round';

      if (el.dir === 'v') {
        // Wall runs top-to-bottom (x is shared); door opens to the right
        const x = el.x, y = el.y;
        // Two wall stubs on either side of the door gap
        ctx.beginPath();
        ctx.moveTo(x, y - d * 0.5);
        ctx.lineTo(x, y - d * 0.15);
        ctx.moveTo(x, y + d * 0.15);
        ctx.lineTo(x, y + d * 0.5);
        ctx.stroke();
        // Door panel (horizontal line = the door leaf, perpendicular to wall)
        ctx.beginPath();
        ctx.moveTo(x, y - d * 0.15);
        ctx.lineTo(x + d * 0.3, y - d * 0.15);
        ctx.stroke();
        // Swing arc
        ctx.beginPath();
        ctx.arc(x, y - d * 0.15, d * 0.3, 0, Math.PI * 0.5);
        ctx.lineWidth = (el.strokeWidth || 2) * 0.6;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // 'h': Wall runs left-to-right (y is shared); door opens downward
        const x = el.x, y = el.y;
        ctx.beginPath();
        ctx.moveTo(x - d * 0.5, y);
        ctx.lineTo(x - d * 0.15, y);
        ctx.moveTo(x + d * 0.15, y);
        ctx.lineTo(x + d * 0.5, y);
        ctx.stroke();
        // Door panel
        ctx.beginPath();
        ctx.moveTo(x - d * 0.15, y);
        ctx.lineTo(x - d * 0.15, y + d * 0.3);
        ctx.stroke();
        // Swing arc
        ctx.beginPath();
        ctx.arc(x - d * 0.15, y, d * 0.3, Math.PI * 0.5, Math.PI);
        ctx.lineWidth = (el.strokeWidth || 2) * 0.6;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      break;
    }
    case 'label': {
      ctx.font = `${(el.fontSize || 14)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = el.strokeColor || '#e8dcc8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (isSelected) {
        const m = ctx.measureText(el.text);
        ctx.save();
        ctx.fillStyle = 'rgba(201,168,76,0.15)';
        ctx.fillRect(el.x - 2, el.y - 2, m.width + 4, (el.fontSize || 14) + 4);
        ctx.restore();
        ctx.fillStyle = el.strokeColor || '#e8dcc8';
      }
      ctx.fillText(el.text, el.x, el.y);
      break;
    }
  }
  ctx.restore();
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function getElementBounds(el) {
  switch (el.type) {
    case 'rect':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'wall': {
      const x = Math.min(el.x1, el.x2), y = Math.min(el.y1, el.y2);
      return { x, y, w: Math.max(Math.abs(el.x2 - el.x1), 1), h: Math.max(Math.abs(el.y2 - el.y1), 1) };
    }
    case 'token': {
      const r = GRID * 0.45;
      return { x: el.x - r, y: el.y - r, w: r * 2, h: r * 2 };
    }
    case 'door':
      return { x: el.x - GRID * 0.5, y: el.y - GRID * 0.5, w: GRID, h: GRID };
    case 'label': {
      const approxW = el.text.length * (el.fontSize || 14) * 0.6;
      return { x: el.x, y: el.y, w: approxW, h: el.fontSize || 14 };
    }
  }
  return null;
}

// ── Hit testing ───────────────────────────────────────────────
function hitTest(wx, wy) {
  // Test in reverse order (top elements first)
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (hitElement(el, wx, wy)) return i;
  }
  return null;
}

function hitElement(el, wx, wy) {
  switch (el.type) {
    case 'rect': {
      const { x, y, w, h } = el;
      const rx = w < 0 ? x + w : x;
      const ry = h < 0 ? y + h : y;
      const rw = Math.abs(w), rh = Math.abs(h);
      return wx >= rx && wx <= rx + rw && wy >= ry && wy <= ry + rh;
    }
    case 'wall': {
      // Distance from point to segment
      const dx = el.x2 - el.x1, dy = el.y2 - el.y1;
      const len2 = dx*dx + dy*dy;
      if (len2 === 0) return dist(wx, wy, el.x1, el.y1) < 10;
      const t = Math.max(0, Math.min(1, ((wx-el.x1)*dx + (wy-el.y1)*dy) / len2));
      return dist(wx, wy, el.x1 + t*dx, el.y1 + t*dy) < 10 / state.zoom;
    }
    case 'token': {
      return dist(wx, wy, el.x, el.y) < GRID * 0.5;
    }
    case 'door': {
      return dist(wx, wy, el.x, el.y) < GRID * 0.6;
    }
    case 'label': {
      // Rough hit
      const fSize = el.fontSize || 14;
      const approxW = el.text.length * fSize * 0.6;
      return wx >= el.x - 2 && wx <= el.x + approxW && wy >= el.y - 2 && wy <= el.y + fSize + 2;
    }
  }
  return false;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Erase any element whose primary cell matches (cellX, cellY) — grid-snapped coords
function eraseAtCell(cellX, cellY) {
  // We test from top to bottom and remove the first hit in this cell
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const el = state.elements[i];
    if (elementOccupiesCell(el, cellX, cellY)) {
      state.elements.splice(i, 1);
      if (state.selected === i) state.selected = null;
      else if (state.selected > i) state.selected--;
      drawMain();
      return; // one per cell per stroke
    }
  }
}

function elementOccupiesCell(el, cellX, cellY) {
  // cellX/Y are top-left corners of the grid cell (multiples of GRID)
  switch (el.type) {
    case 'rect': {
      // Check if this cell overlaps the rect
      const rx = el.x, ry = el.y, rw = el.w, rh = el.h;
      return cellX < rx + rw && cellX + GRID > rx &&
             cellY < ry + rh && cellY + GRID > ry;
    }
    case 'wall': {
      // Wall: check if any part of the segment passes through this cell
      return segmentIntersectsCell(el.x1, el.y1, el.x2, el.y2, cellX, cellY, GRID);
    }
    case 'token': {
      const cx = snapToGrid(el.x - GRID / 2);
      const cy = snapToGrid(el.y - GRID / 2);
      return cx === cellX && cy === cellY;
    }
    case 'door': {
      return snapToGrid(el.x) === cellX && snapToGrid(el.y) === cellY;
    }
    case 'label': {
      const lx = snapToGrid(el.x);
      const ly = snapToGrid(el.y);
      return lx === cellX && ly === cellY;
    }
  }
  return false;
}

// Liang-Barsky / AABB segment vs cell check
function segmentIntersectsCell(x1, y1, x2, y2, cx, cy, size) {
  // Expand to cell bounds
  const minX = cx, maxX = cx + size, minY = cy, maxY = cy + size;
  const dx = x2 - x1, dy = y2 - y1;
  let tMin = 0, tMax = 1;
  for (const [p, q] of [[-dx, x1 - minX], [dx, maxX - x1], [-dy, y1 - minY], [dy, maxY - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) tMin = Math.max(tMin, t);
    else       tMax = Math.min(tMax, t);
    if (tMin > tMax) return false;
  }
  return true;
}

// ── Pointer events ────────────────────────────────────────────
let lastMoveW = { x: 0, y: 0 };

iCanvas.addEventListener('mousemove', onMouseMove);
iCanvas.addEventListener('mousedown', onMouseDown);
iCanvas.addEventListener('mouseup', onMouseUp);
iCanvas.addEventListener('wheel', onWheel, { passive: false });
iCanvas.addEventListener('contextmenu', onContextMenu);

function onMouseMove(e) {
  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  lastMoveW = world;

  // Update cursor pos display
  const gx = Math.round(world.x / GRID);
  const gy = Math.round(world.y / GRID);
  document.getElementById('cursor-pos').textContent = `${gx}, ${gy}`;

  if (state.isPanning) {
    state.panX = e.clientX - state.panStart.x;
    state.panY = e.clientY - state.panStart.y;
    drawGrid();
    drawMain();
    return;
  }

  // Token drag
  if (state.tokenDrag !== null) {
    const snapped = {
      x: snapToGrid(world.x) + GRID / 2,
      y: snapToGrid(world.y) + GRID / 2,
    };
    state.elements[state.tokenDrag].x = snapped.x;
    state.elements[state.tokenDrag].y = snapped.y;
    drawMain();
    return;
  }

  if (state.isErasing) {
    eraseAtCell(snapToGrid(world.x), snapToGrid(world.y));
    return;
  }

  if (state.isDragging && state.preview) {
    const snappedX = snapToGrid(world.x);
    const snappedY = snapToGrid(world.y);
    const s = state.dragStart;

    if (state.tool === 'rect') {
      state.preview.w = snappedX - s.x;
      state.preview.h = snappedY - s.y;
    } else if (state.tool === 'wall') {
      state.preview.x2 = snappedX;
      state.preview.y2 = snappedY;
    }
    drawMain();
    return;
  }

  // Hover highlight for select / token tool
  if (state.tool === 'select' || state.tool === 'token' || state.tool === 'erase') {
    const idx = hitTest(world.x, world.y);
    if (state.tool === 'token') {
      const prevHover = state.hoveredToken;
      state.hoveredToken = (idx !== null && state.elements[idx]?.type === 'token') ? idx : null;
      if (state.hoveredToken !== prevHover) drawMain();
    }
    // Set cursor for select
    if (state.tool === 'select') {
      iCanvas.style.cursor = (idx !== null) ? 'move' : 'default';
    }
    if (state.tool === 'erase') {
      iCanvas.style.cursor = (idx !== null) ? 'not-allowed' : 'cell';
    }
  }
}

function onMouseDown(e) {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle mouse or Alt+left = pan
    state.isPanning = true;
    state.panStart = { x: e.clientX - state.panX, y: e.clientY - state.panY };
    iCanvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);
  const snappedX = snapToGrid(world.x);
  const snappedY = snapToGrid(world.y);

  switch (state.tool) {
    case 'select': {
      const idx = hitTest(world.x, world.y);
      state.selected = idx;

      if (idx !== null && state.elements[idx].type === 'token') {
        state.tokenDrag = idx;
        iCanvas.style.cursor = 'grabbing';
      } else if (idx !== null) {
        // future: element drag
      }
      drawMain();
      break;
    }

    case 'erase': {
      // Erase the single element whose center/body covers the clicked grid cell
      eraseAtCell(snapToGrid(world.x), snapToGrid(world.y));
      state.isErasing = true;
      break;
    }

    case 'rect': {
      state.isDragging = true;
      state.dragStart = { x: snappedX, y: snappedY };
      state.preview = {
        type: 'rect',
        x: snappedX, y: snappedY, w: 0, h: 0,
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        strokeWidth: state.strokeWidth,
      };
      break;
    }

    case 'wall': {
      state.isDragging = true;
      state.dragStart = { x: snappedX, y: snappedY };
      state.preview = {
        type: 'wall',
        x1: snappedX, y1: snappedY,
        x2: snappedX, y2: snappedY,
        strokeColor: state.strokeColor,
        strokeWidth: state.strokeWidth,
      };
      break;
    }

    case 'token': {
      // Open name dialog first, then place
      openTokenDialog(snappedX + GRID/2, snappedY + GRID/2);
      break;
    }

    case 'door': {
      // Snap to nearest grid intersection (dot)
      const dotX = snapToGrid(world.x);
      const dotY = snapToGrid(world.y);
      // Determine direction: if click is closer to a horizontal edge use 'h', else 'v'
      const fracX = ((world.x % GRID) + GRID) % GRID; // 0..GRID within the cell
      const fracY = ((world.y % GRID) + GRID) % GRID;
      // Near left/right edge → vertical wall (dir 'v'), near top/bottom → horizontal (dir 'h')
      const nearHoriz = Math.min(fracY, GRID - fracY) < Math.min(fracX, GRID - fracX);
      state.elements.push({
        type: 'door',
        x: dotX, y: dotY,
        dir: nearHoriz ? 'h' : 'v',
        strokeColor: state.strokeColor,
        strokeWidth: state.strokeWidth,
      });
      drawMain();
      break;
    }

    case 'text': {
      openTextDialog(world.x, world.y);
      break;
    }
  }
}

function onMouseUp(e) {
  if (state.isErasing) {
    state.isErasing = false;
    return;
  }
  if (state.isPanning) {
    state.isPanning = false;
    iCanvas.style.cursor = '';
    return;
  }

  if (state.tokenDrag !== null) {
    state.tokenDrag = null;
    iCanvas.style.cursor = 'move';
    return;
  }

  if (!state.isDragging || !state.preview) return;

  state.isDragging = false;

  // Commit preview to elements if it has size
  const p = state.preview;
  let valid = false;

  if (p.type === 'rect') {
    valid = Math.abs(p.w) > GRID * 0.3 && Math.abs(p.h) > GRID * 0.3;
    if (valid) {
      // Normalize
      if (p.w < 0) { p.x += p.w; p.w = -p.w; }
      if (p.h < 0) { p.y += p.h; p.h = -p.h; }
    }
  } else if (p.type === 'wall') {
    valid = dist(p.x1, p.y1, p.x2, p.y2) > GRID * 0.3;
  }

  if (valid) state.elements.push({ ...p });
  state.preview = null;
  drawMain();
}

// ── Scroll to zoom ────────────────────────────────────────────
function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Zoom toward cursor
  const wx = (sx - state.panX) / state.zoom;
  const wy = (sy - state.panY) / state.zoom;

  state.zoom = Math.min(8, Math.max(0.15, state.zoom * factor));

  state.panX = sx - wx * state.zoom;
  state.panY = sy - wy * state.zoom;

  document.getElementById('zoom-label').textContent =
    `${Math.round(state.zoom * 100)}%`;

  drawGrid();
  drawMain();
}

// ── Context menu ──────────────────────────────────────────────
function onContextMenu(e) {
  e.preventDefault();
  hideContextMenus();

  const rect = iCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  const idx = hitTest(world.x, world.y);

  if (idx !== null && state.elements[idx].type === 'token') {
    showTokenContextMenu(e.clientX, e.clientY, idx);
  } else if (idx !== null) {
    state.selected = idx;
    drawMain();
    showElementContextMenu(e.clientX, e.clientY, idx);
  } else {
    // Right-click on empty canvas: for draw tools erase nearby, for others ignore
    // (We show nothing — contextual default described in spec is already covered by
    //  the per-tool right-click on elements above)
  }
}

function showElementContextMenu(cx, cy, idx) {
  const menu = document.getElementById('context-menu');
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
  menu._targetIdx = idx;
}

function showTokenContextMenu(cx, cy, idx) {
  const menu = document.getElementById('token-context-menu');
  menu.style.left = cx + 'px';
  menu.style.top  = cy + 'px';
  menu.classList.remove('hidden');
  menu._targetIdx = idx;
}

function hideContextMenus() {
  document.getElementById('context-menu').classList.add('hidden');
  document.getElementById('token-context-menu').classList.add('hidden');
}

document.addEventListener('click', hideContextMenus);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideContextMenus();
    state.preview = null;
    state.isDragging = false;
    state.selected = null;
    drawMain();
  }
});

// ── Context menu actions ──────────────────────────────────────
document.getElementById('ctx-delete').addEventListener('click', () => {
  const menu = document.getElementById('context-menu');
  const idx = menu._targetIdx;
  if (idx != null) {
    state.elements.splice(idx, 1);
    state.selected = null;
    drawMain();
    showToast('Element deleted');
  }
});

document.getElementById('ctx-bring-front').addEventListener('click', () => {
  const menu = document.getElementById('context-menu');
  const idx = menu._targetIdx;
  if (idx != null) {
    const el = state.elements.splice(idx, 1)[0];
    state.elements.push(el);
    state.selected = state.elements.length - 1;
    drawMain();
  }
});

document.getElementById('ctx-send-back').addEventListener('click', () => {
  const menu = document.getElementById('context-menu');
  const idx = menu._targetIdx;
  if (idx != null) {
    const el = state.elements.splice(idx, 1)[0];
    state.elements.unshift(el);
    state.selected = 0;
    drawMain();
  }
});

document.getElementById('ctx-duplicate').addEventListener('click', () => {
  const menu = document.getElementById('context-menu');
  const idx = menu._targetIdx;
  if (idx != null) {
    const el = JSON.parse(JSON.stringify(state.elements[idx]));
    // Offset duplicate
    const OFFSET = GRID;
    if ('x' in el) el.x += OFFSET;
    if ('y' in el) el.y += OFFSET;
    if ('x1' in el) { el.x1 += OFFSET; el.x2 += OFFSET; }
    state.elements.push(el);
    state.selected = state.elements.length - 1;
    drawMain();
  }
});

// Token context menu
document.getElementById('ctx-token-delete').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;

  const name = state.elements[idx].name || 'this token';
  showConfirm(`Remove token "${name}"?`, () => {
    state.elements.splice(idx, 1);
    state.selected = null;
    drawMain();
    showToast('Token removed');
  });
});

document.getElementById('ctx-token-rename').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;
  const token = state.elements[idx];
  const newName = prompt('Rename token:', token.name || '');
  if (newName !== null) {
    token.name = newName.trim().slice(0, 20) || token.name;
    drawMain();
  }
});

document.getElementById('ctx-token-color').addEventListener('click', () => {
  const menu = document.getElementById('token-context-menu');
  const idx = menu._targetIdx;
  if (idx == null) return;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = state.elements[idx].color || '#e05c5c';
  picker.click();
  picker.addEventListener('change', () => {
    state.elements[idx].color = picker.value;
    drawMain();
  });
});

// ── Confirm modal ─────────────────────────────────────────────
let confirmCallback = null;

function showConfirm(msg, onConfirm) {
  document.getElementById('modal-message').textContent = msg;
  document.getElementById('modal-overlay').classList.remove('hidden');
  confirmCallback = onConfirm;
}

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  confirmCallback = null;
});

// ── Token dialog ──────────────────────────────────────────────
let pendingToken = null;

function openTokenDialog(wx, wy) {
  pendingToken = { x: wx, y: wy };
  document.getElementById('token-name-input').value = '';
  document.getElementById('token-name-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('token-name-input').focus(), 50);
}

function placeToken(name) {
  if (!pendingToken) return;
  state.elements.push({
    type: 'token',
    x: pendingToken.x,
    y: pendingToken.y,
    name: name || '?',
    color: TOKEN_COLORS[tokenColorIdx % TOKEN_COLORS.length],
  });
  tokenColorIdx++;
  pendingToken = null;
  drawMain();
  showToast(`Token "${name}" placed`);
}

document.getElementById('token-name-confirm').addEventListener('click', () => {
  const name = document.getElementById('token-name-input').value.trim();
  document.getElementById('token-name-overlay').classList.add('hidden');
  placeToken(name || '?');
});

document.getElementById('token-name-cancel').addEventListener('click', () => {
  document.getElementById('token-name-overlay').classList.add('hidden');
  pendingToken = null;
});

document.getElementById('token-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('token-name-confirm').click();
  if (e.key === 'Escape') document.getElementById('token-name-cancel').click();
});

// ── Text dialog ───────────────────────────────────────────────
let pendingTextPos = null;

function openTextDialog(wx, wy) {
  pendingTextPos = { x: wx, y: wy };
  document.getElementById('text-label-input').value = '';
  document.getElementById('text-label-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('text-label-input').focus(), 50);
}

document.getElementById('text-label-confirm').addEventListener('click', () => {
  const text = document.getElementById('text-label-input').value.trim();
  document.getElementById('text-label-overlay').classList.add('hidden');
  if (text && pendingTextPos) {
    state.elements.push({
      type: 'label',
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      text,
      fontSize: 14,
      strokeColor: state.strokeColor,
    });
    drawMain();
  }
  pendingTextPos = null;
});

document.getElementById('text-label-cancel').addEventListener('click', () => {
  document.getElementById('text-label-overlay').classList.add('hidden');
  pendingTextPos = null;
});

document.getElementById('text-label-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('text-label-confirm').click();
  if (e.key === 'Escape') document.getElementById('text-label-cancel').click();
});

// ── Toolbar buttons ───────────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTool(btn.dataset.tool);
  });
});

function setTool(name) {
  state.tool = name;
  state.selected = null;
  state.preview = null;
  state.isDragging = false;
  document.querySelectorAll('.tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === name));
  document.body.className = `tool-${name}`;
  iCanvas.style.cursor = '';
  drawMain();
}

// ── Color swatches ────────────────────────────────────────────
document.querySelectorAll('#stroke-swatches .swatch').forEach(s => {
  s.addEventListener('click', () => {
    document.querySelectorAll('#stroke-swatches .swatch').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    state.strokeColor = s.dataset.color;
  });
});

document.querySelectorAll('#fill-swatches .swatch').forEach(s => {
  s.addEventListener('click', () => {
    document.querySelectorAll('#fill-swatches .swatch').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
    state.fillColor = s.dataset.color;
  });
});

const widthSlider = document.getElementById('stroke-width');
widthSlider.addEventListener('input', () => {
  state.strokeWidth = parseInt(widthSlider.value);
  document.getElementById('stroke-width-val').textContent = widthSlider.value;
});

// ── Action buttons ────────────────────────────────────────────
document.getElementById('btn-reset-view').addEventListener('click', () => {
  state.panX = 0; state.panY = 0; state.zoom = 1;
  document.getElementById('zoom-label').textContent = '100%';
  drawGrid(); drawMain();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  showConfirm('Clear all elements from the map?', () => {
    state.elements = [];
    state.selected = null;
    drawMain();
    showToast('Map cleared');
  });
});

document.getElementById('btn-export').addEventListener('click', () => {
  // Render to offscreen canvas at 2x resolution
  const W = mainCanvas.width, H = mainCanvas.height;
  const off = document.createElement('canvas');
  off.width = W * 2; off.height = H * 2;
  const ctx = off.getContext('2d');

  // Background
  ctx.fillStyle = '#f5f2ee';
  ctx.fillRect(0, 0, off.width, off.height);

  // Grid
  ctx.save();
  ctx.scale(2, 2);
  const cellPx = GRID * state.zoom;
  const offsetX = ((state.panX % cellPx) + cellPx) % cellPx;
  const offsetY = ((state.panY % cellPx) + cellPx) % cellPx;
  ctx.fillStyle = 'rgba(180,170,155,0.45)';
  const r = Math.max(1, cellPx * 0.04);
  for (let x = offsetX; x < W + cellPx; x += cellPx)
    for (let y = offsetY; y < H + cellPx; y += cellPx) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  ctx.translate(state.panX, state.panY);
  ctx.scale(state.zoom, state.zoom);
  state.elements.forEach(el => drawElement(ctx, el, false));
  ctx.restore();

  off.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dnd-map.png';
    a.click();
  });
  showToast('Map exported!');
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const map = { v: 'select', r: 'rect', w: 'wall', t: 'token', d: 'door', l: 'text', e: 'erase' };
  if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);

  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected !== null) {
    const el = state.elements[state.selected];
    if (el?.type === 'token') {
      showConfirm(`Remove token "${el.name}"?`, () => {
        state.elements.splice(state.selected, 1);
        state.selected = null;
        drawMain();
      });
    } else {
      state.elements.splice(state.selected, 1);
      state.selected = null;
      drawMain();
    }
  }

  // Ctrl+Z undo (simple single-step)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (state.elements.length > 0) {
      state._undoStack = state._undoStack || [];
      state._undoStack.push(state.elements.pop());
      state.selected = null;
      drawMain();
      showToast('Undo');
    }
    e.preventDefault();
  }

  // Ctrl+Shift+Z redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
    if (state._undoStack?.length) {
      state.elements.push(state._undoStack.pop());
      drawMain();
      showToast('Redo');
    }
    e.preventDefault();
  }
});

// ── Toast ─────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('visible'), 1800);
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('load', () => {
  resize();
  setTool('select');

  // Center the origin roughly in the viewport
  const cw = iCanvas.offsetWidth, ch = iCanvas.offsetHeight;
  state.panX = cw * 0.1;
  state.panY = ch * 0.1;
  drawGrid();
  drawMain();

  showToast('Welcome! Right-click elements for options.');
});
