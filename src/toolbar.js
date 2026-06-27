// ── Tool selection & the contextual style panel ────────────────
// setTool() resets interaction state and toggles which style controls are
// visible — not every tool uses stroke/fill/width the same way (wall has
// no fill, labels have no fill or width), and labels repurpose the "Size"
// slider to mean font size instead of stroke width.

import { state } from './state.js';
import { iCanvas } from './canvas.js';
import { drawMain } from './render.js';

export function setTool(name) {
  state.tool = name;
  state.selected = [];
  state.preview = null;
  state.isDragging = false;
  state.isBoxSelecting = false;
  state.selectBox = null;
  state.eraseHover = null;
  document.querySelectorAll('.tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === name));
  document.body.className = `tool-${name}`;
  iCanvas.style.cursor = '';
  updateStylePanel();
  drawMain();
}

const STYLE_PANEL_RULES = {
  rect: { stroke: true, width: true, fill: true, preview: false },
  wall: { stroke: true, width: true, fill: false, preview: false },
  text: { stroke: true, width: true, fill: false, preview: true },
};

// The "Size" slider is shared: it controls stroke width for shapes, but
// font size for labels — same control, different unit, depending on tool.
const SIZE_SLIDER_RANGES = {
  default: { min: 1, max: 20 },
  text: { min: 10, max: 32 },
};

export function updateStylePanel() {
  const rule = STYLE_PANEL_RULES[state.tool];
  const panel = document.getElementById('style-panel');
  panel.classList.toggle('hidden', !rule);
  if (!rule) return;
  document.getElementById('style-group-width').classList.toggle('hidden', !rule.width);
  document.getElementById('style-divider-width').classList.toggle('hidden', !rule.width);
  document.getElementById('style-group-fill').classList.toggle('hidden', !rule.fill);
  document.getElementById('style-divider-fill').classList.toggle('hidden', !rule.fill);
  document.getElementById('style-group-preview').classList.toggle('hidden', !rule.preview);
  document.getElementById('style-divider-preview').classList.toggle('hidden', !rule.preview);

  if (rule.width) {
    const range = SIZE_SLIDER_RANGES[state.tool] || SIZE_SLIDER_RANGES.default;
    const value = state.tool === 'text' ? state.fontSize : state.strokeWidth;
    widthSlider.min = range.min;
    widthSlider.max = range.max;
    widthSlider.value = value;
    document.getElementById('stroke-width-val').textContent = value;
  }

  updateLabelPreview();
}

export function updateLabelPreview() {
  const preview = document.getElementById('label-preview-text');
  preview.style.color = state.strokeColor;
  preview.style.fontSize = `${state.fontSize}px`;
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTool(btn.dataset.tool);
  });
});

const widthSlider = document.getElementById('stroke-width');
widthSlider.addEventListener('input', () => {
  const value = parseInt(widthSlider.value);
  if (state.tool === 'text') state.fontSize = value;
  else state.strokeWidth = value;
  document.getElementById('stroke-width-val').textContent = widthSlider.value;
  updateLabelPreview();
});
