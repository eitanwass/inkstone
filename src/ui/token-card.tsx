// ── The token card ─────────────────────────────────────────────
// Click a token and a small card appears above it with the token's details: its name, color, image
// and conditions (HP and AC are meant to join them). The card follows the token as the map is
// panned, zoomed or the token moved, and goes while it is being dragged or resized.
//
// It is a Preact component (see library.tsx), drawn into #token-card-root and drawn again after every
// redraw of the map (use-editor.ts), reading the selected token straight from `state`. Its parts are
// token-card-color.tsx, token-card-image.tsx and token-card-conditions.tsx; the list shown when hovering
// a token is token-tip.ts; which token the card is for is token-target.ts.
//
// It never takes focus by itself, so the keys that work on a selected token (Delete, the arrows)
// keep working. Click its field, double-click the token, press Enter, or choose "Add name" from the
// token's menu to type. Enter or clicking away keeps what was typed (one undo step, sent to a live
// session once); Escape puts the old name back.

import { render } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { iCanvas, worldToClient } from '../core/canvas';
import { byId } from '../core/dom';
import { DEFAULT_TOKEN_RADIUS, state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { setTextStyle } from '../elements/text-style';
import { pushHistory } from '../input/history';
import { setTool } from '../input/toolbar';
import { cardPosition } from './card-placement';
import { mountTextStyleToggles } from './text-style-toggles';
import { TokenColors } from './token-card-color';
import { TokenConditions } from './token-card-conditions';
import { TokenImage } from './token-card-image';
import { cardToken } from './token-target';
import { useEditorRedraw } from './use-editor';

const NAME_LABEL_PX = 28; // a name is written just under its token

// Where the card goes: above the token, below it if the top of the screen is in the way.
function place(card: HTMLElement, token: TokenElement): void {
  const screen = iCanvas.getBoundingClientRect();
  const radius = (token.radius || DEFAULT_TOKEN_RADIUS) * state.zoom;
  const { x, y } = worldToClient(token.x, token.y);
  const { left, top } = cardPosition({
    centerX: x,
    top: y - radius,
    bottom: y + radius + NAME_LABEL_PX,
    width: card.offsetWidth,
    height: card.offsetHeight,
    screenTop: screen.top,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

// ── Ways in ────────────────────────────────────────────────────
// Asked for from outside (the keyboard, the token's menu), and carried out once the card has been drawn,
// since it may only just have been given a token to show.
let focusRequest: 'name' | 'color' | null = null;
let askForRedraw = () => {};

// Puts the cursor in the name field of the selected token (Enter, or a double-click on it).
export function focusTokenName(): void {
  if (!cardToken()) return;
  focusRequest = 'name';
  askForRedraw();
}

// Selects a token with the select tool, so its card shows.
function selectForCard(idx: number): void {
  setTool('select');
  state.selected = [idx];
  drawMain();
}

// Chosen from a token's menu: select it and type.
export function nameToken(idx: number): void {
  selectForCard(idx);
  focusTokenName();
}

// Chosen from a token's menu: select it and move the keyboard to its colors.
export function chooseTokenColor(idx: number): void {
  selectForCard(idx);
  if (!cardToken()) return;
  focusRequest = 'color';
  askForRedraw();
}

// ── The card ───────────────────────────────────────────────────
// Which token is being typed into, what its name was before, and what is in the field.
type Editing = { token: TokenElement; original: string; text: string };

function TokenCard() {
  const redraw = useEditorRedraw();
  askForRedraw = redraw;

  const token = cardToken();
  const visible = token !== null && !state.elementDrag && !state.handleDrag; // it steps aside while the token moves

  const card = useRef<HTMLDivElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const styleBox = useRef<HTMLDivElement>(null);
  const colors = useRef<HTMLDivElement>(null);
  const editing = useRef<Editing | null>(null);
  const styleToggles = useRef<ReturnType<typeof mountTextStyleToggles> | null>(null);

  // Keeps what was typed: one undo step if the name really changed (typing and putting it back is not an edit).
  const commit = () => {
    const session = editing.current;
    if (!session) return;
    editing.current = null;
    const name = session.text.trim();
    session.token.name = name || undefined;
    if (state.elements.includes(session.token) && name !== session.original) pushHistory();
    drawMain();
  };

  // The name's style: bold, italic and a plate behind the name, the same buttons and drawing as a label's
  // text (text-style-toggles.ts builds them, so they are put in place by hand).
  useEffect(() => {
    if (!styleBox.current) return;
    styleToggles.current = mountTextStyleToggles(styleBox.current, {
      get: cardToken,
      set(key, on) {
        const current = cardToken();
        if (!current) return;
        setTextStyle(current, key, on);
        drawMain();
        pushHistory();
      },
    });
  }, []);

  // Beside the drawing, after every draw of the card:
  useLayoutEffect(() => {
    if (visible && card.current && token) place(card.current, token);
  });
  // (a layout effect, so a request for focus is carried out before another key can arrive)
  useLayoutEffect(() => {
    styleToggles.current?.refresh();
    // Gone, or another token was chosen: whatever was being typed is kept first.
    if (editing.current && editing.current.token !== token) commit();
    if (!visible || !focusRequest) return;
    const request = focusRequest;
    focusRequest = null;
    if (request === 'name') {
      nameField.current?.focus();
      nameField.current?.select();
    } else {
      const swatches = colors.current?.querySelectorAll<HTMLElement>('button.token-swatch');
      const current = colors.current?.querySelector<HTMLElement>('button.token-swatch[aria-pressed="true"]');
      (current ?? swatches?.[0])?.focus();
    }
  });

  return (
    <div
      id="token-card"
      class={visible ? undefined : 'hidden'}
      role="group"
      aria-label="Token details"
      ref={card}
    >
      <input
        id="token-name-field"
        type="text"
        maxLength={20}
        placeholder="Name"
        aria-label="Token name"
        autoComplete="off"
        spellcheck={false}
        enterkeyhint="done"
        ref={nameField}
        value={editing.current ? editing.current.text : (token?.name ?? '')}
        onFocus={() => {
          if (token) editing.current = { token, original: token.name ?? '', text: token.name ?? '' };
        }}
        // The map shows what is typed as it is typed, but it only counts once it is kept.
        onInput={(e) => {
          const session = editing.current;
          if (!session) return;
          session.text = e.currentTarget.value;
          session.token.name = session.text || undefined;
          drawMain();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            const session = editing.current;
            if (session) {
              session.token.name = session.original || undefined;
              editing.current = null;
              drawMain();
            }
            e.currentTarget.blur();
            e.stopPropagation(); // Escape here undoes the typing; it does not also deselect the token
          }
        }}
      />
      {/* The name's style: bold, italic and a plate behind it (built in text-style-toggles.ts, shared with the label card) */}
      <div id="token-text-style" class="ts-toggles" role="group" aria-label="Name style" ref={styleBox} />
      {token && (
        <>
          <TokenColors token={token} containerRef={colors} />
          <TokenImage token={token} />
          <TokenConditions token={token} />
        </>
      )}
    </div>
  );
}

render(<TokenCard />, byId('token-card-root'));
