# Inkstone design guide

How Inkstone looks and why: the logo, colour, type, shape, motion and tone. It
describes what the app actually does today, so new UI can match it. A visual
version, with live swatches and specimens, is in
[style-guide.html](style-guide.html).

Where something here is a *value* (a colour, a size), the code is the source of
truth: [src/styles/](../src/styles/) for the interface, [src/core/state.ts](../src/core/state.ts)
for the type constants used on the canvas. If they disagree, fix this document.

## 1. Brand

**Inkstone is a calm, hand-drawn tabletop map tool.** Parchment, brass and ink:
a dark brass-and-leather toolbar floating over a warm paper canvas.

- **Personality:** quiet, crafted, a little old-world. The tool should get out of
  the way and let the map be the star.
- **Not:** neon, glossy, or "fantasy game". No dragons, swords, shields, d20s or
  runes (the category is full of them). The brand is about ink, stone and maps.
- **Name:** *Inkstone*, one word, capital I. An inkstone is the slab calligraphers
  grind ink on.

## 2. Logo

**The mark is a pen nib that is also a compass needle**: ink, pointing north. It
sits on a dark tile with cut (chamfered) corners, the same cut corner the UI's
panels use.

| File | Use |
|---|---|
| [logo/logo.svg](logo/logo.svg) | The full mark: the nib in a thin compass ring with cardinal ticks. App corner, anything 24px or larger. |
| [logo/favicon.svg](logo/favicon.svg) | The small-size mark: ring and ticks removed, nib drawn bigger. Browser tabs and anywhere under 24px. |
| [logo/icon-fullbleed.svg](logo/icon-fullbleed.svg) | Opaque square for iOS/Android home screens; the mark sits inside the central 80% that platform masks never cut. |
| [logo/alternates/cairn.svg](logo/alternates/cairn.svg) | A rejected direction (three stacked stones), kept in case of a change of mind. |

The files in `public/` are generated from these by `npm run build:icons`. Edit
the SVGs here, never the generated copies.

**Lockup** (the mark beside the name, as in the app's top-left corner):

- Mark 30px, gap 10px, name in EB Garamond 500, 25px, letter-spacing +0.02em.
- Name colour `#4a3f2e` (ink) on parchment, `#e8dcc8` on dark.
- Hidden on narrow phones (under 640px) to save room.

**Rules**

- Keep clear space around the mark of at least a quarter of its width.
- Use the small-size mark below 24px; the ring turns to mush there.
- On dark backgrounds the tile blends in, which is fine: the gold nib carries it.
- Don't recolour it, stretch it, add effects, or put the name inside the tile.
- Don't use the italic or the old IM Fell wordmark; the wordmark is upright Garamond.

## 3. Colour

The interface is **dark brass chrome over a light parchment canvas**. Gold is the
one accent. Red means "danger", "live", or a map token, never decoration.

### Surfaces (the dark chrome)

| Token / value | Hex | Used for |
|---|---|---|
| `--bg-toolbar` | `#1a1714` | Floating panels, the logo tile |
| popover / modal surface | `#1e1b17` | Popovers, dialogs, menus |
| `--bg-toolbar-hover` | `#25211d` | Hover on chrome, text inputs |
| button surface | `#2a2520` | Secondary buttons, toasts |
| `--bg-toolbar-active` | `#2e2820` | Active tool background |
| `--border` | `#3a3228` | 1px borders and dividers |

### Text

| Token | Hex | Used for |
|---|---|---|
| `--text-primary` | `#e8dcc8` | Main text on dark; also the default stroke colour on the map |
| `--text-muted` | `#a89885` | Secondary text and icons on dark |
| `--text-label` | `#8f8370` | The small uppercase panel labels |
| ink | `#4a3f2e` | Text on the parchment (wordmark, HUD) |
| cream | `#f5ecd0` | Label on primary (gold) buttons |

### Accent and meaning

| Token / value | Hex | Meaning |
|---|---|---|
| `--accent` | `#c9a84c` | Gold: active state, focus ring, the primary action, the nib |
| `--accent-dim` | `#7a6230` | Primary button fill; the nib's shaded half uses `#8a6a28` |
| `--danger` | `#a04040` | Destructive actions (button border, "Blood" swatch) |
| danger text / fill | `#e06060` on `#3a1515` | Danger button (hover fill `#501c1c`) |
| live | `#e5484d` | The "Live" dot while a map is shared |
| warning | `#d9a441` | The dot while reconnecting |

### The canvas

| Token | Value | |
|---|---|---|
| `--canvas-bg` | `#e9e4da` | Parchment |
| `--dot-color` | `rgba(180,170,155,0.55)` | The dot grid |
| `--grid-size` | `40px` | One map cell |

### Drawing palettes (what users pick from)

- **Stroke:** Parchment `#e8dcc8`, Brown `#8b5e3c`, Forest `#4a7c59`, Water `#5b7fa6`, Gold `#c9a84c`, Blood `#a04040`. Default: Parchment.
- **Fill:** None, Dark `#433b31`, Dungeon `#564837`, Forest `#364c3f`, Water `#333e4e`, Earth `#463b29`. Default: Earth.
- **Tokens** cycle through: `#e05c5c` `#5c8ae0` `#5cba6a` `#e0a85c` `#9a5ce0` `#5ce0d4` `#e05caa` `#c8e05c`.

### Contrast (measured)

| Pair | Ratio |
|---|---|
| `--text-primary` on toolbar | 13.2:1 |
| `--text-muted` on toolbar / popover / button | 6.4 / 6.1 / 5.4:1 |
| `--text-label` on toolbar / popover | 4.8 / 4.6:1 |
| `--accent` on toolbar | 7.8:1 |
| Primary button label (cream on `#7a6230`) | 4.9:1 |
| Ink `#4a3f2e` on parchment | 8.1:1 |
| Danger text on danger fill | 4.6:1 |
| **Gold on parchment** | **1.8:1, never use gold for text or icons on the canvas** |

**Rules:** all text meets 4.5:1. Don't darken `--text-muted` or `--text-label`
(they were raised to pass). The HUD readout and brand mark are deliberately
faded (decorative, not required to read), so they are exempt.

## 4. Typography

| Role | Family | Notes |
|---|---|---|
| **Wordmark** and display titles | **EB Garamond**, weight 500, upright | Never italic. 25px in the lockup; 22px for the map name. |
| **UI and map text** | **Inter** (variable) | Everything else, including text drawn on the canvas. |
| **HUD numbers** | System monospace | The cursor position and zoom; fixed-width digits don't jitter. |

Both fonts are **bundled** with the app (`@fontsource` packages), so there is no
request to Google, the app works offline, and it looks the same on every device.
Fallbacks: `Georgia, serif` for the wordmark, `system-ui, sans-serif` for Inter.

**Canvas text** (token names, labels) uses the same Inter stack
(`FONT_FAMILY` in `state.ts`). Canvas text does not wait for fonts the way page
text does, so `main.ts` loads the font explicitly and repaints when it arrives.

### Type in use today

| Size | Weight | Where |
|---|---|---|
| 9.5px, uppercase, +0.1em | 700 | Panel and popover labels ("Stroke", "Size", "Fill") |
| 10.5px, uppercase, +0.14em | 700 | The "Live" pill |
| 11 to 12px | 400 | HUD readout, release dates, small captions |
| 12.5px | 400 to 500 | Buttons, popover text |
| 13 to 14px | 400 | Dialog and release-note body |
| 15 to 16px | 600 | The What's new title (15px) and release headings (16px) |
| 22px | 500 (Garamond) | The map name |
| 25px | 500 (Garamond) | Wordmark |

Conventions: sentence case everywhere except the small uppercase labels; line
height about 1.5 for body text; tight single-line (1) only for single-line
controls.

*Known gap:* that is about twelve sizes in half-pixel steps. A tidy scale
(for example 10 / 12 / 14 / 16 / 25) is a worthwhile cleanup, and the 9.5px
labels are the smallest text in the app.

## 5. Shape and surface

- **Chamfered panels.** Floating panels have cut corners (`--panel-chamfer`,
  9px, via `clip-path`), a 1px gold hairline fading along the top edge, and a
  deep soft shadow. This is the signature shape; the logo tile repeats it.
- **Radii:** 4px (buttons, inputs), 6px (popovers, menus, toasts, icon buttons), 8px
  (dialogs and modals), 999px (the Live pill), 50% (swatches, dots, tokens).
- **Borders:** 1px `--border`. **Shadows:** large and soft, from
  `0 6px 18px rgba(0,0,0,.35)` (small pill) to `0 24px 64px rgba(0,0,0,.6)`
  (modal).
- **Layers (`z-index`):** 50 ambient readouts, 100 floating panels, 1000
  popovers and menus, 2000 modals and their backdrop, 3000 toasts.
- **Modal backdrop:** `rgba(0,0,0,.45)` with a 6px blur. The backdrop *fades* in;
  only the box scales (a scaling backdrop briefly stops covering the screen).

## 6. Iconography

Icons are `<symbol>`s in `public/icons.svg`, drawn on a **20×20** grid with a
**1.4** stroke, round caps and joins, `currentColor`, no fills unless the shape
needs one. Use them with `<svg><use href="/icons.svg#icon-name"></use></svg>` so
they inherit colour (muted on dark, primary on hover, gold when active).

Sizes: 18px in the action cluster, 20px on the tool dock, 10px inside swatches.
Every icon-only button also needs an `aria-label`.

## 7. Motion

Short and quiet. Hover and state changes take 0.1 to 0.12s; popovers and menus
scale in over 0.1 to 0.12s; a modal backdrop fades over 0.15s; toasts fade over
0.2s; the brand mark spins once on hover (0.6s); the "Live" dot pulses every
1.8s. Everything respects `prefers-reduced-motion` (animations collapse to
nothing and play once).

## 8. Layout

The canvas is full-bleed; **all chrome floats over it** as fixed panels: the
brand mark top-left, **the map's name top-centre** (click to rename), the action
cluster and "Live" pill in a right-hand rail top-right, the tool dock bottom-centre with the contextual style panel above it,
and a faded readout bottom-right. Bottom panels are `width: max-content`, capped
at the viewport.

- **The map name** is plain text that becomes a field on hover and focus (a
  faint border and a small pencil appear; focus is a 2px ink outline, because gold
  fails on parchment). Unnamed, it reads "Untitled map" in a softer ink (4.9:1).
  Above 1000px it is centred in the top row; at 1000px and under it moves to its
  own row beneath the brand mark and rail, left-aligned, and the toast moves below it.
- **Breakpoints:** under 640px wide the brand mark and HUD are hidden, panels
  tighten, and the style panel scrolls sideways; under 420px tall the panels move
  in from the edges.
- **Touch:** with a coarse pointer, icon buttons grow to 42px.
- **Respect safe areas** (`env(safe-area-inset-*)`) for fixed elements.

## 9. Accessibility

Contrast as above; every control has an accessible name; toggle state is exposed
(`aria-pressed`, `aria-expanded`); dialogs trap and restore focus; the page can be
zoomed. The details and the axe test that guards them are in
[CLAUDE.md](../CLAUDE.md#accessibility-and-storage-conventions).

## 10. Voice

Plain, short, friendly. Say what happened or what to do next, in sentence case,
without exclamation marks or jargon.

- Toasts: "Copied element", "Token removed", "Connection lost, reconnecting…".
- Explain, don't blame: "Sharing isn't set up on this site yet."
- Release notes are written for people using the editor, not for developers
  (one "Under the hood" line at most).

## 11. Share preview

The card chat apps show when someone pastes a link (Discord, Slack, iMessage,
WhatsApp, X): **1200×630**, parchment with the dot grid, the lockup, and a small
map (a room, two tokens, a label) bleeding off the corner. It is rendered from
[share-preview/template.html](share-preview/template.html) by `npm run build:og`
into `public/og-image.png`.

The template has two layouts:

- **Site card** (no name): large lockup, the tagline "A battle-map editor for
  tabletop RPGs", and one line of description.
- **Named-map card** (`?name=Some+Map`): a small lockup at the top, a dark
  "Live map" pill, and **the map's name as the hero** in EB Garamond, with "Join
  this map on Inkstone" beneath. A sample is
  [share-preview/example-named.png](share-preview/example-named.png).

Names are user text: the template sets them as text (never HTML), keeps them to
60 characters, shrinks them from 112px to a 44px floor, and then trims with an
ellipsis until they fit their box.

A map's own name is deliberately not shown in the preview of its invite link:
every link gets this same card. (We built it and removed it; see CLAUDE.md.)

## 12. Known gaps

- Many colours are hard-coded in `src/styles/` (the popover surface `#1e1b17`,
  the button surface `#2a2520`, hover fills, danger colours). Only the values in
  `:root` are real tokens; promoting the repeated ones would make this document
  and the CSS agree by construction.
- The type scale above is unconsolidated (about twelve sizes).
- The HUD uses system monospace, so its digits differ slightly per operating
  system. Inter's tabular figures are the fallback option if that bothers us.
