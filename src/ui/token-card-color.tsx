// ── The token card's color ─────────────────────────────────────
// The token palette as swatches, then a ring that opens the browser's own picker for any color.
// A choice is kept at once as one undo step.

import type { Ref } from 'preact';
import { useRef } from 'preact/hooks';
import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { PALETTE } from '../elements/token';
import { pushHistory } from '../input/history';

const colorOf = (token: TokenElement): string => (token.color || PALETTE[0].hex).toLowerCase();

export function TokenColors({
  token,
  containerRef,
}: {
  token: TokenElement;
  containerRef: Ref<HTMLDivElement>;
}) {
  const current = colorOf(token);
  // The browser's own picker fires 'input' each time a color is clicked in it, and 'change' only when it
  // is closed. So the token follows every click as it is made, and the whole visit to the picker is one
  // undo step, kept when the picker closes (by 'change', or by the field losing focus, which is what a
  // picker that is dismissed some other way leaves behind).
  const picking = useRef<{ token: TokenElement; original: string } | null>(null);

  const setColor = (hex: string) => {
    if (colorOf(token) === hex.toLowerCase()) return;
    token.color = hex;
    drawMain();
    pushHistory();
  };

  const finishPicking = () => {
    const visit = picking.current;
    if (!visit) return;
    picking.current = null;
    if (state.elements.includes(visit.token) && colorOf(visit.token) !== visit.original) pushHistory();
  };

  return (
    <div id="token-colors" role="group" aria-label="Token color" ref={containerRef}>
      {PALETTE.map(({ hex, name }) => (
        <button
          type="button"
          class="token-swatch"
          style={{ background: hex }}
          data-color={hex}
          title={name}
          aria-label={name}
          aria-pressed={current === hex}
          onClick={() => setColor(hex)}
        />
      ))}
      <label
        class={`token-swatch token-swatch-custom${PALETTE.some((p) => p.hex === current) ? '' : ' selected'}`}
        title="Custom color"
      >
        <input
          type="color"
          id="token-color-custom"
          aria-label="Custom color"
          value={current}
          onInput={(e) => {
            picking.current ??= { token, original: colorOf(token) };
            token.color = e.currentTarget.value;
            drawMain();
          }}
          onChange={(e) => {
            if (picking.current) finishPicking();
            else setColor(e.currentTarget.value); // a browser that sends only 'change'
          }}
          onBlur={finishPicking}
        />
      </label>
    </div>
  );
}
