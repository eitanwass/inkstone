// ── Stroke/fill color pickers ─────────────────────────────────
// Built-in swatches live in the HTML. The "+" swatch opens a popover (native
// color input for a brand new pick, plus a small history of previously
// picked custom colors) anchored right next to the button — the history
// itself isn't injected into the swatch row, it only ever lives in the
// popover, like a browser color picker's "recent colors".

import { state } from './state.js';
import { updateLabelPreview } from './toolbar.js';

function setupColorRow(containerId, addBtnId, popoverId, storageKey, onPick) {
  const container = document.getElementById(containerId);
  const addBtn = document.getElementById(addBtnId);
  const popover = document.getElementById(popoverId);
  const swatchesEl = popover.querySelector('.color-popover-swatches');
  const newBtn = popover.querySelector('.color-popover-new');

  function getHistoryColors() {
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  }

  function rememberColor(color) {
    const recent = [color, ...getHistoryColors().filter(c => c !== color)].slice(0, 8);
    localStorage.setItem(storageKey, JSON.stringify(recent));
  }

  function selectColor(color) {
    container.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
    addBtn.classList.remove('active');
    const builtIn = [...container.querySelectorAll('.swatch:not(.swatch-add)')]
      .find(b => b.dataset.color === color);
    if (builtIn) {
      builtIn.classList.add('active');
    } else {
      addBtn.classList.add('active');
      addBtn.style.background = color;
    }
    onPick(color);
  }

  function renderPopoverSwatches() {
    swatchesEl.innerHTML = '';
    getHistoryColors().forEach(color => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      b.title = color;
      b.addEventListener('click', () => {
        rememberColor(color);
        selectColor(color);
        hidePopover();
      });
      swatchesEl.appendChild(b);
    });
  }

  function showPopover() {
    renderPopoverSwatches();
    const r = addBtn.getBoundingClientRect();
    popover.classList.remove('hidden');
    const pw = popover.offsetWidth;
    popover.style.left = `${Math.min(r.right + 8, window.innerWidth - pw - 8)}px`;
    popover.style.top = `${r.top}px`;
  }

  function hidePopover() {
    popover.classList.add('hidden');
  }

  container.querySelectorAll('.swatch:not(.swatch-add)').forEach(btn => {
    btn.addEventListener('click', () => {
      addBtn.style.background = '';
      selectColor(btn.dataset.color);
    });
  });

  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (popover.classList.contains('hidden')) showPopover();
    else hidePopover();
  });

  newBtn.addEventListener('click', () => {
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = '#888888';
    picker.addEventListener('change', () => {
      rememberColor(picker.value);
      selectColor(picker.value);
      hidePopover();
    });
    picker.click();
  });

  document.addEventListener('click', e => {
    if (!popover.contains(e.target) && e.target !== addBtn) hidePopover();
  });
}

setupColorRow('stroke-swatches', 'stroke-custom-add', 'stroke-color-popover', 'tavernmap-custom-stroke', c => { state.strokeColor = c; updateLabelPreview(); });
setupColorRow('fill-swatches',   'fill-custom-add',   'fill-color-popover',   'tavernmap-custom-fill',   c => state.fillColor = c);
