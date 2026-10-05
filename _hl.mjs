import fs from 'node:fs';

const sub = (file, a, b) => {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(a)) throw new Error(`${file}: ${a.slice(0, 70)}`);
  fs.writeFileSync(file, s.replace(a, b));
};

// ── state: no hoverLocked ──
let s = fs.readFileSync('src/core/state.ts', 'utf8');
s = s.replace(/  \/\/ The locked element the pointer is over[^\n]*\n(?:  \/\/[^\n]*\n)*  hoverLocked: number \| null;\n/, '');
s = s.replace(`  hoverLocked: null,\n`, '');
if (s.includes('hoverLocked')) throw new Error('state still has hoverLocked');
fs.writeFileSync('src/core/state.ts', s);
sub('src/input/toolbar.ts', `  state.hoverLocked = null;\n`, '');

// ── pointer.ts: back to how it was ──
const p = 'src/input/pointer.ts';
let t = fs.readFileSync(p, 'utf8');
t = t.replace(
  /      \/\/ A locked element can't be clicked, but it is there: a faded lock on its corner says why\.\n[\s\S]*?      \}\n(    \}\n  \})/,
  '$1',
);
t = t.replace(`import { hitTest, hitTestAny } from '../elements';`, `import { hitTest } from '../elements';`);
t = t.replace(`import { isLocked } from '../elements/layer';\n`, '');
t = t.replace(
  /iCanvas\.addEventListener\('pointerleave', \(\) => \{\n  hideConditionsTip\(\);\n  if \(state\.hoverLocked !== null\) \{\n    state\.hoverLocked = null;\n    drawMain\(\);\n  \}\n\}\);/,
  `iCanvas.addEventListener('pointerleave', hideConditionsTip);`,
);
if (t.includes('hoverLocked') || t.includes('hitTestAny')) throw new Error('pointer still has it');
fs.writeFileSync(p, t);

// ── lock-hint.ts follows the pointer itself ──
const l = 'src/ui/lock-hint.ts';
sub(
  l,
  `// A faded padlock on the top right corner of the locked element the pointer is over (with the select tool:
// see state.hoverLocked), a fixed size on screen whatever the zoom, on a small dark disc so it reads over
// any colour. It is a small element laid over the map, not drawn on the canvas, so that CSS fades it in
// (lock-hint.css) and the browser does the animation. It is positioned from render.ts's onMainDrawn hook,
// which is registered rather than imported to keep the module chain one-way.`,
  `// A faded padlock on the top right corner of the locked element the mouse is over (with the select tool),
// a fixed size on screen whatever the zoom, on a small dark disc so it reads over any colour. It is a small
// element laid over the map, not drawn on the canvas, so that CSS fades it in (lock-hint.css) and the
// browser does the animation. It follows the mouse itself, and is positioned again after every redraw
// (render.ts's onMainDrawn hook, registered rather than imported to keep the module chain one-way), so it
// stays on its element as the map is panned or zoomed under a mouse that hasn't moved.`,
);
sub(
  l,
  `function update(): void {
  const el = state.tool === 'select' && state.hoverLocked !== null ? state.elements[state.hoverLocked] : undefined;
  const bounds = el && isLocked(el) ? getElementBounds(el) : null;`,
  `// Where the mouse is over the map (client coordinates), with no button held, or null.
let mouse: { x: number; y: number } | null = null;

// The locked element under the mouse, if the select tool is in use and the mouse is idle over the map.
function lockedUnderMouse() {
  if (!mouse || state.tool !== 'select') return undefined;
  const world = clientToWorld(mouse.x, mouse.y);
  const idx = hitTestAny(world.x, world.y);
  const el = idx === null ? undefined : state.elements[idx];
  return el && isLocked(el) ? el : undefined;
}

function update(): void {
  const el = lockedUnderMouse();
  const bounds = el ? getElementBounds(el) : null;`,
);
sub(
  l,
  `onMainDrawn(update);`,
  `iCanvas.addEventListener('pointermove', (e) => {
  mouse = e.pointerType === 'mouse' && e.buttons === 0 ? { x: e.clientX, y: e.clientY } : null; // not while dragging, or for a finger
  update();
});
iCanvas.addEventListener('pointerleave', () => {
  mouse = null;
  update();
});

onMainDrawn(update);`,
);
sub(l, `import { iCanvas } from '../core/canvas';`, `import { clientToWorld, iCanvas } from '../core/canvas';`);
sub(l, `import { getElementBounds } from '../elements';`, `import { getElementBounds, hitTestAny } from '../elements';`);
