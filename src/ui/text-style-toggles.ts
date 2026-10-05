// ── The bold, italic and plate buttons ───────────────────────────
// The same three toggles sit in a label's card and in a token's (for its name), and will in the card of
// any other element that has text. Each card gives this its element and what to do with a change (set
// the flag, redraw, keep it as an undo step); this builds the buttons and keeps them showing the
// element's style.

import type { TextStyled } from '../core/types';
import { TEXT_STYLE_KEYS, type TextStyleKey } from '../elements/text-style';

export interface TextStyleTarget {
  get(): TextStyled | null; // the element the card is for, or none
  set(key: TextStyleKey, on: boolean): void;
}

const BUTTONS: Record<TextStyleKey, { name: string; text: string }> = {
  bold: { name: 'Bold', text: 'B' },
  italic: { name: 'Italic', text: 'I' },
  plate: { name: 'Background plate', text: 'A' },
};

// Fills `container` with the buttons; `refresh` marks the ones the element has on.
export function mountTextStyleToggles(container: HTMLElement, target: TextStyleTarget) {
  const buttons = new Map<TextStyleKey, HTMLButtonElement>();
  for (const key of TEXT_STYLE_KEYS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ts-toggle ts-${key}`;
    button.title = BUTTONS[key].name;
    button.setAttribute('aria-label', BUTTONS[key].name);
    button.setAttribute('aria-pressed', 'false');
    if (key === 'plate') {
      const chip = document.createElement('span'); // a letter on a plate, which is what it gives
      chip.textContent = BUTTONS[key].text;
      button.append(chip);
    } else {
      button.textContent = BUTTONS[key].text;
    }
    button.addEventListener('click', () => {
      const current = target.get();
      if (!current) return;
      target.set(key, !current[key]);
      refresh();
    });
    container.append(button);
    buttons.set(key, button);
  }

  function refresh(): void {
    const current = target.get();
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(!!current?.[key]));
  }

  return { refresh };
}
