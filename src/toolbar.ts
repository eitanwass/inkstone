// ── Tool selection & the contextual style panel ────────────────
// setTool() resets interaction state and toggles which style controls are
// visible — not every tool uses stroke/fill/width the same way (wall has
// no fill, labels have no fill or width), and labels repurpose the "Size"
// slider to mean font size instead of stroke width.

import { byId } from './dom';
import { state } from './state';
import { iCanvas } from './canvas';
import { drawMain } from './render';
import type { Tool } from './types';

export function setTool(name: Tool): void {
  state.tool = name;
  state.selected = [];
  state.preview = null;
  state.isDragging = false;
  state.isBoxSelecting = false;
  state.selectBox = null;
  state.eraseHover = null;
  document.querySelectorAll<HTMLElement>('.tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === name));
  document.body.className = `tool-${name}`;
  iCanvas.style.cursor = '';
  updateStylePanel();
  drawMain();
}

interface StylePanelRule {
  stroke: boolean;
  width: boolean;
  fill: boolean;
  preview: boolean;
}

const STYLE_PANEL_RULES: Partial<Record<Tool, StylePanelRule>> = {
  rect: { stroke: true, width: true, fill: true, preview: false },
  wall: { stroke: true, width: true, fill: false, preview: false },
  text: { stroke: true, width: true, fill: false, preview: true },
};

// The "Size" slider is shared: it controls stroke width for shapes, but
// font size for labels — same control, different unit, depending on tool.
const SIZE_SLIDER_RANGES: Record<string, { min: number; max: number }> = {
  default: { min: 1, max: 20 },
  text: { min: 10, max: 32 },
};

export function updateStylePanel() {
  const rule = STYLE_PANEL_RULES[state.tool];
  const panel = byId('style-panel');
  panel.classList.toggle('hidden', !rule);
  if (!rule) return;
  byId('style-group-width').classList.toggle('hidden', !rule.width);
  byId('style-divider-width').classList.toggle('hidden', !rule.width);
  byId('style-group-fill').classList.toggle('hidden', !rule.fill);
  byId('style-divider-fill').classList.toggle('hidden', !rule.fill);
  byId('style-group-preview').classList.toggle('hidden', !rule.preview);
  byId('style-divider-preview').classList.toggle('hidden', !rule.preview);

  if (rule.width) {
    const range = SIZE_SLIDER_RANGES[state.tool] || SIZE_SLIDER_RANGES.default;
    const value = state.tool === 'text' ? state.fontSize : state.strokeWidth;
    widthSlider.min = String(range.min);
    widthSlider.max = String(range.max);
    widthSlider.value = String(value);
    byId('stroke-width-val').textContent = String(value);
  }

  updateLabelPreview();
}

export function updateLabelPreview() {
  const preview = byId('label-preview-text');
  preview.style.color = state.strokeColor;
  preview.style.fontSize = `${state.fontSize}px`;
}

document.querySelectorAll<HTMLElement>('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTool(btn.dataset.tool as Tool);
  });
});

const widthSlider = byId<HTMLInputElement>('stroke-width');
widthSlider.addEventListener('input', () => {
  const value = parseInt(widthSlider.value);
  if (state.tool === 'text') state.fontSize = value;
  else state.strokeWidth = value;
  byId('stroke-width-val').textContent = widthSlider.value;
  updateLabelPreview();
});
