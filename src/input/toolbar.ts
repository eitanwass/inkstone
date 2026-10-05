// ── Tool selection & the contextual style panel ────────────────
// setTool() resets interaction state and toggles which style controls are
// visible — not every tool uses stroke/fill/width the same way (a wall has
// no fill). The text tool has no panel: a label's size and colour are set in its own card.

import { iCanvas } from '../core/canvas';
import { byId } from '../core/dom';
import { state } from '../core/state';
import type { Tool } from '../core/types';
import { drawMain } from '../draw/render';

export function setTool(name: Tool): void {
  state.tool = name;
  state.selected = [];
  state.preview = null;
  state.isDragging = false;
  state.isBoxSelecting = false;
  state.selectBox = null;
  state.eraseHover = null;
  state.ruler = null;
  state.isMeasuring = false;
  state.adjustingBackground = false;
  document.documentElement.classList.remove('adjusting-background');
  document.querySelectorAll<HTMLElement>('.tool-btn[data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === name);
    b.setAttribute('aria-pressed', String(b.dataset.tool === name));
  });
  document.body.className = `tool-${name}`;
  iCanvas.style.cursor = '';
  updateStylePanel();
  drawMain();
}

interface StylePanelRule {
  stroke: boolean;
  width: boolean;
  fill: boolean;
}

const STYLE_PANEL_RULES: Partial<Record<Tool, StylePanelRule>> = {
  rect: { stroke: true, width: true, fill: true },
  wall: { stroke: true, width: true, fill: false },
};

const WIDTH_RANGE = { min: 1, max: 20 }; // the "Size" slider is the stroke width

export function updateStylePanel() {
  const rule = STYLE_PANEL_RULES[state.tool];
  const panel = byId('style-panel');
  panel.classList.toggle('hidden', !rule);
  if (!rule) return;
  byId('style-group-width').classList.toggle('hidden', !rule.width);
  byId('style-divider-width').classList.toggle('hidden', !rule.width);
  byId('style-group-fill').classList.toggle('hidden', !rule.fill);
  byId('style-divider-fill').classList.toggle('hidden', !rule.fill);

  if (rule.width) {
    widthSlider.min = String(WIDTH_RANGE.min);
    widthSlider.max = String(WIDTH_RANGE.max);
    widthSlider.value = String(state.strokeWidth);
    byId('stroke-width-val').textContent = String(state.strokeWidth);
  }
}

document.querySelectorAll<HTMLElement>('.tool-btn[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setTool(btn.dataset.tool as Tool);
  });
});

const widthSlider = byId<HTMLInputElement>('stroke-width');
widthSlider.addEventListener('input', () => {
  state.strokeWidth = parseInt(widthSlider.value, 10);
  byId('stroke-width-val').textContent = widthSlider.value;
});
