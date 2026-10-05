// ── Stroke/fill color pickers ─────────────────────────────────
// Built-in swatches live in the HTML. The "+" swatch opens a popover (native
// color input for a brand new pick, plus a small history of previously
// picked custom colors) anchored right next to the button — the history
// itself isn't injected into the swatch row, it only ever lives in the
// popover, like a browser color picker's "recent colors".

import { byId, qs } from '../core/dom';
import { state } from '../core/state';
import { storageGet, storageGetStrings, storageRemove, storageSet } from '../core/storage';
import { updateLabelPreview } from '../input/toolbar';
import { closePopover } from './popover';

// This app used to be called Tavern Map; carry any saved custom colors over
// from the old storage keys the first time they're seen.
function migrateLegacyKey(legacyKey: string, storageKey: string): void {
  const legacy = storageGet(legacyKey);
  if (legacy === null) return;
  if (storageGet(storageKey) === null) storageSet(storageKey, legacy);
  storageRemove(legacyKey);
}

function setupColorRow(
  containerId: string,
  addBtnId: string,
  popoverId: string,
  storageKey: string,
  legacyKey: string,
  onPick: (color: string) => void,
): void {
  migrateLegacyKey(legacyKey, storageKey);
  const container = byId(containerId);
  const addBtn = byId(addBtnId);
  const popover = byId(popoverId);
  const swatchesEl = qs(popover, '.color-popover-swatches');
  const newBtn = qs(popover, '.color-popover-new');

  function rememberColor(color: string): void {
    const recent = [color, ...storageGetStrings(storageKey).filter((c) => c !== color)].slice(0, 8);
    storageSet(storageKey, JSON.stringify(recent));
  }

  function selectColor(color: string): void {
    for (const x of container.querySelectorAll('.swatch')) {
      x.classList.remove('active');
      x.setAttribute('aria-pressed', 'false');
    }
    addBtn.classList.remove('active');
    const builtIn = [...container.querySelectorAll<HTMLElement>('.swatch:not(.swatch-add)')].find(
      (b) => b.dataset.color === color,
    );
    if (builtIn) {
      builtIn.classList.add('active');
      builtIn.setAttribute('aria-pressed', 'true');
    } else {
      addBtn.classList.add('active');
      addBtn.setAttribute('aria-pressed', 'true');
      addBtn.style.background = color;
    }
    onPick(color);
  }

  function renderPopoverSwatches() {
    swatchesEl.innerHTML = '';
    storageGetStrings(storageKey).forEach((color) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color;
      b.title = color;
      b.setAttribute('aria-label', color);
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
    addBtn.setAttribute('aria-expanded', 'true');
    const pw = popover.offsetWidth;
    popover.style.left = `${Math.min(r.right + 8, window.innerWidth - pw - 8)}px`;
    popover.style.top = `${r.top}px`;
  }

  function hidePopover() {
    closePopover(popover, addBtn);
  }

  container.querySelectorAll<HTMLElement>('.swatch:not(.swatch-add)').forEach((btn) => {
    btn.addEventListener('click', () => {
      addBtn.style.background = '';
      selectColor(btn.dataset.color ?? '');
    });
  });

  addBtn.addEventListener('click', (e) => {
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

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target as Node) && e.target !== addBtn) hidePopover();
  });
}

setupColorRow(
  'stroke-swatches',
  'stroke-custom-add',
  'stroke-color-popover',
  'inkstone-custom-stroke',
  'tavernmap-custom-stroke',
  (c) => {
    state.strokeColor = c;
    updateLabelPreview();
  },
);
setupColorRow(
  'fill-swatches',
  'fill-custom-add',
  'fill-color-popover',
  'inkstone-custom-fill',
  'tavernmap-custom-fill',
  (c) => {
    state.fillColor = c;
  },
);
