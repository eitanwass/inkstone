# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page D&D battle-map editor ("Inkstone"). Vanilla HTML/CSS/JS (ES
modules, no framework) bundled with Vite. [index.html](index.html) +
[style.css](style.css) at the root; all behavior lives in [src/](src/) as
small single-purpose modules (see Module layout below).

## Running it

`npm run dev` (Vite dev server), `npm run build` (production bundle to `dist/`),
`npm run preview`. The entry point is `<script type="module" src="src/main.js">`
in [index.html](index.html) — it must stay `type="module"`, and `public/`
holds static assets (`icons.svg`, `logo.svg`) that Vite copies through
unmodified rather than processing.

There are no linters or formatters configured. There is a Playwright Test
suite in [tests/](tests/) — `npm test` runs it (the config auto-starts the
dev server). It drives the real UI (clicking toolbar buttons, dragging on
the canvas) rather than calling module internals, since there's no exposed
JS API and DOM/canvas interaction is what actually exercises the code worth
regression-testing. [tests/helpers.js](tests/helpers.js) has the shared
setup (`resetBoard`, world→screen conversion matching `resetView()`'s pan
formula, element-placement helpers). When adding a feature, prefer deriving
test coordinates from the actual persisted element data
(`boardElements(page)`) rather than hand-computing expected positions —
several early drafts of these tests got the placement math wrong by
forgetting that a token's center is the clicked cell's origin *plus*
`GRID/2`, not the click point itself. [.github/workflows/test.yml](.github/workflows/test.yml)
runs this suite on every push/PR to `main`.

Live collaboration (see Collaboration below) needs a second process:
`npm run party:dev` runs the relay locally via `wrangler dev` on port 8787
(the client defaults to `localhost:8787` via `VITE_PARTYKIT_HOST` — see
`.env.example`). `npm run party:deploy` (`wrangler deploy`) pushes it to
your own Cloudflare account for real cross-machine use — `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN` in `.env` authenticate this (wrangler loads `.env`
automatically); no custom domain is needed, it deploys to a free
`*.workers.dev` subdomain. `VITE_PARTYKIT_HOST` then needs to point at that
deployed host before running `npm run build`.

## Module layout

No framework, no virtual DOM, no state-management library — every module
imports the same `state` object from `state.js` and mutates its properties
directly, then calls `drawMain()`/`drawGrid()` (from `render.js`) to
re-render. Dependencies flow one direction (geometry → elements → render →
selection/erase → pointer → UI wiring); nothing here imports back down that
chain, so there are no circular imports to reason about.

| File | Responsibility |
|---|---|
| `state.js` | The shared `state` object and the `GRID` constant. |
| `canvas.js` | Canvas element/context references only. |
| `geometry.js` | Pure math: coordinate conversion, rotation, segment/cell clipping. |
| `elements.js` | Per-type bounds, hit-testing, grid-cell occupancy. |
| `handles.js` | Resize/rotate handle geometry and drag math. |
| `render.js` | Everything that draws to the canvases. |
| `history.js` | Undo/redo stack + localStorage persistence. |
| `selection.js` | Move, delete, duplicate, copy/paste, reorder, rubber-band select. |
| `erase.js` | Erase tool targeting + hover preview. |
| `pointer.js` | Mouse/Alt-pan/Escape orchestration — ties the above together per active tool. |
| `modal.js` | The generic confirm dialog. |
| `context-menu.js` | Right-click menus (element, token, empty-canvas paste). |
| `dialogs.js` | Token-name and text-label placement dialogs. |
| `toolbar.js` | Tool switching + the contextual style panel. |
| `color-swatches.js` | Stroke/fill swatch rows and the custom-color popover. |
| `view-actions.js` | Reset View, Clear All, Export PNG. |
| `shortcuts.js` | Global keyboard shortcuts. |
| `toast.js` | Toast notifications. |
| `collab.js` | Live multi-user sync over a Durable Object room (see Collaboration below). |
| `main.js` | Entry point: canvas sizing, load-time init, pulls in the pure-side-effect modules. |

When extending an element type, the three functions that must change together
(`drawElement` in `render.js`, `getElementBounds` and `hitElement` in
`elements.js`) now live in two different files — check both.

## Architecture

Three-layer canvas stack (`#grid-canvas`, `#main-canvas`, `#interaction-canvas`,
absolutely positioned over each other in [index.html](index.html)):
- **grid-canvas** — dot grid background, redrawn on pan/zoom/resize (`drawGrid`).
- **main-canvas** — all committed elements plus the in-progress preview shape
  (`drawMain` → `drawElement`).
- **interaction-canvas** — transparent, captures all mouse events
  (`mousemove`/`mousedown`/`mouseup`/`wheel`/`contextmenu`); nothing is drawn to it.

All app state lives in one `state` object (current tool, style settings,
pan/zoom transform, drag/erase/selection state, and the `elements` array) —
see Module layout above for where it's defined and how the rest of the
codebase is organized around it.

**Elements** (`state.elements`) are plain objects with a `type` discriminator:
`rect`, `wall`, `token`, `label`. Three functions switch on `el.type` and must
be extended together when adding a new element type:
- `drawElement` — rendering
- `getElementBounds` — selection-box bounds, also used for rubber-band hit testing
- `hitElement` — click hit-testing

`elementOccupiesCell` (used by the erase tool) only needs cases for types that
are erased as a whole discrete prop — `wall` is handled separately via
`clipSegmentToCell` since walls erase per-segment, not per-element.

**`cellOf` vs `snapToGrid`** (both in `geometry.js`) are not interchangeable
despite looking similar: `snapToGrid` *rounds* to the nearest grid line
(correct for placing/dragging a shape's own coordinates onto a grid
intersection), while `cellOf` *floors* to the cell's origin (correct for
"which cell does this point belong to"). Erase targeting needs `cellOf` —
using `snapToGrid` there was a real bug that only showed up near a cell
boundary (e.g. clicking near a large token's edge could round to the
*next* cell over and miss it). `elementOccupiesCell`'s own per-type cell
math must stay on the same convention as whatever its caller passes in.

**Tokens have a variable `radius`**, set either by dragging while placing
one or, after the fact, via resize handles on an already-selected token
(still always a circle either way — see "Resize/rotate handles" below). The
radius snaps to `GRID / 2` steps — diameters of 1, 2, 3... whole grid cells,
matching D&D's Medium/Large/Huge creature-size convention. Placement-drag
has a dead zone below the default radius (`GRID * 0.42`) so incidental mouse
drift during a plain click doesn't bump a "click to place" token up to the
first snap step; see the `'token'` branch in `pointer.js`'s drag handler.
Resizing an *existing* token needs no dead zone — the handle itself starts
already at the current radius, so an un-moved grab re-resolves to ~the same
size. Every place that reads a token's size falls back to that same
default via `el.radius || GRID * 0.42`, so boards persisted before this
feature existed keep rendering at their original size with no migration
needed. Bounds/hit/erase-occupancy all scale with the radius —
`elementOccupiesCell`'s token case in particular is an AABB-overlap check
(like rect), not "is this the center cell", so erasing a large token works
from any cell it visually covers.

**Coordinate systems**: world space (logical, grid-unit based, `GRID = 40px`)
vs. screen space (pixels, after pan/zoom). Convert screen→world with
`screenToWorld`; snap world coords to the grid with `snapToGrid`. Canvas
pan/zoom is applied via `ctx.translate`/`ctx.scale` in `drawMain`, so element
coordinates are always stored in world space.

**Tools** are selected via `state.tool` and dispatched in the `onMouseDown`
switch statement; each tool (`select`, `rect`, `wall`, `token`, `text`, `erase`)
has its own placement/drag logic. Keyboard shortcuts and toolbar buttons both
funnel through `setTool()`.

**Selection** (`state.selected`) is always an array of indices, supporting
multi-select via shift-click or rubber-band drag (`state.isBoxSelecting` /
`state.selectBox`, resolved in `finishBoxSelect`). Dragging any selected
element moves the whole selection (`state.elementDrag`, applied via
`applyElementDrag`) — built on a position snapshot taken at drag start plus a
grid-snapped delta, rather than per-frame absolute snapping, so mixed element
types move together consistently. Any splice into `state.elements` (delete,
erase, wall-segment split) must route index shifts through
`adjustSelectionForSplice` to keep `state.selected` valid.

**Copy/paste** (`clipboard`, a plain module-level array — not the OS
clipboard) is wired through both `Ctrl+C`/`Ctrl+V` and the right-click
context menus: "Copy" on the element menu, "Paste" on a new menu shown only
when right-clicking empty canvas *and* the clipboard is non-empty.
`pasteClipboard(anchorWorld)` re-clones the stored elements and offsets them
as a group so the clipboard's combined bounding-box center lands on
`anchorWorld` (the right-click point, or the mouse's last known position for
the keyboard shortcut) — this keeps a multi-element copy's relative layout
intact rather than pasting each element back at its original spot.

The erase tool clips wall segments at the grid cell instead of deleting the
whole wall (`clipSegmentToCell`, Liang-Barsky line-vs-box clip) — erasing a
middle cell of a long wall splits it into two remaining pieces. Other element
types (rect, token, label) are discrete props without a natural sub-division,
so erasing any cell they occupy removes the whole element.

**Undo/redo** (`history.stack` / `history.index`) is whole-document snapshotting:
every mutation calls `pushHistory()`, which deep-clones `state.elements` onto the
stack. This is deliberately not a command/diff pattern — `state.elements` is
small enough that cloning is cheap, and a snapshot is automatically correct for
every action (move, resize, rotate, erase, reorder, ...) without writing
per-action undo logic. Drag-style mutations (`elementDrag`, `handleDrag`) only
call `pushHistory()` once on mouseup (guarded by a `moved` flag), not per
mousemove frame. `undo()`/`redo()` clear `state.selected` since selection
indices aren't meaningful across a swapped-in snapshot.

**Persistence** piggybacks on the same chokepoint: `pushHistory()`, `undo()`,
and `redo()` all call `persistBoard()`, which writes `state.elements` to
`localStorage` (`STORAGE_KEY = 'inkstone-board'`). Only the board content
persists across a reload — the undo/redo stack itself does not, so a fresh
load always starts with a single history baseline (nothing to undo to) even
though the map reappears.

**Resize/rotate handles** (rect, wall, and token, single-selection only) are
computed by `getHandles()` and hit-tested by `hitHandle()`; dragging one sets
`state.handleDrag` and routes through `applyHandleDrag()`. Rects store an
explicit `rotation` (radians) and rotate around their own center; resizing a
rotated rect keeps the *opposite* corner fixed in world space by solving for
the new center from that anchor (see `applyHandleDrag`'s `resize` branch) rather
than naively recomputing x/y, which would make the shape drift as it's resized.
Walls have no `rotation` field — "rotating" a wall just rotates both endpoints
around their shared midpoint; "resizing" is dragging a single endpoint.
Rotation snaps to 15° increments by default (`ROTATE_SNAP_STEP`); holding
Shift while dragging the rotate handle switches to free/precise rotation.
Tokens get a `'resize-radius'` handle kind instead — a single handle at the
circle's SE edge (45°, matching the rect SE-corner convention), since radius
is the token's only degree of freedom (one handle, not one per cardinal
direction, makes that visually obvious). It drives `el.radius` off
`dist(el.x, el.y, world.x, world.y)`, so it works the same regardless of
where exactly on the edge it sits. No rotate handle at all (rotating a
circle is a no-op, so `getHandles()` just doesn't produce one —
`drawHandles()`'s rotate-handle connector line already no-ops when there
isn't one, so nothing extra was needed there).

**Highlight padding must be zoom-corrected.** The erase-hover outline and
the select-tool dashed highlight both draw a padded box around an element's
bounds. The pad is `constant / state.zoom + strokeWidth / 2`: the
`strokeWidth` term clears the element's own border, and dividing the
constant by zoom keeps that gap a fixed size *on screen* — the same
correction already applied to the dashed line's `lineWidth`/`setLineDash`.
A flat world-unit pad shrinks to ~0 screen px once zoomed out, so the
highlight visually merges back into a thick-stroked element's border
instead of outlining it.

**UI chrome** is all `position: fixed` floating panels over a full-bleed
canvas (no sidebar) — the brand mark (top-left) and HUD readout (bottom-right:
cursor coords + zoom on one line, app version on the line below) are
non-interactive (`pointer-events: none`) and faded; the tool dock, style
panel, and action cluster are opaque. The style panel's "Size" slider is
shared and repurposed per tool (`SIZE_SLIDER_RANGES`): stroke width for
rect/wall, font size for labels — same control, different unit, only one
of which is ever active at a time via `state.tool`.

**Toolbar/menu icons** are `<symbol>`s in `public/icons.svg`, referenced via
`<svg><use href="/icons.svg#icon-name"></use></svg>` rather than inline SVG
or `<img>`. That specific combination matters: these icons use
`stroke/fill="currentColor"` to inherit each button's text color (so a tool
goes gold when active), and only a `<use>` reference keeps that live —
an `<img>` renders SVG content in an isolated context with no access to the
host page's CSS, which would silently break the color theming. The file
lives in `public/` (not `src/`) so Vite copies it through unmodified; a
relative path would risk breaking in the production build since `<use href>`
isn't one of the attributes Vite's HTML asset pipeline rewrites.

The erase tool previews what a click would actually remove
(`updateEraseHover`/`state.eraseHover`) by running the *same* per-cell
targeting logic as `eraseAtCell` itself, rather than a plain hit-test —
otherwise the preview would highlight a whole wall when only one grid
segment of it is about to be clipped.

PNG export (`view-actions.js`) re-renders the grid and all elements onto an
offscreen 2x-resolution canvas rather than capturing the visible canvases
directly (so exports are independent of current viewport resolution).

**Collaboration** (`collab.js`) is a thin sync layer on top of the existing
whole-document snapshot model, not a separate state system. A session is a
Durable Object room ([party/server.js](party/server.js), a pure relay with
no merge logic — one `InkstoneRoom` instance per session id, addressed by
a Worker `fetch` handler that routes `/parties/<name>/<room>` requests to
it) keyed by a random id carried in the URL (`?session=...`). Clicking
"Share" (`btn-share`) lazily creates that id with `crypto.randomUUID()`
the first time (a session is never created just by opening the app),
puts it in the URL via `history.replaceState`, connects, and opens a
popover showing the code with a "Copy Link" button. "Join" (`btn-join`)
opens a sibling popover where a user pastes another session's code or
full invite link (`extractSessionId()` accepts either) to connect to it
without creating a new session. Every local `pushHistory()`/`undo()`/`redo()`
broadcasts the full
`state.elements` array to the room; an incoming snapshot from a peer is
applied via `applyRemoteSnapshot()` (in `history.js`) the same way undo/redo
already swaps in a full snapshot — except it deliberately does *not* go
onto the local undo stack, so pressing Ctrl+Z undoes your own last edit,
not whatever a peer just did. This is last-write-wins: edits to different
elements never collide, but two people editing the same element at the same
instant just have one of them win — there's no operation-level merge, since
a CRDT would mean restructuring `state.elements` around a different data
structure entirely for a hand-drawn map where that's rarely worth it.

Because `history.js` sits *below* `collab.js` in the module chain (per the
one-directional dependency rule above), it can't import `collab.js` to
notify it of changes without creating a cycle. Instead `history.js` exposes
`setHistoryListener(fn)`, and `collab.js` registers its own broadcast
function there at load time — inversion of control instead of a direct
import, so the dependency arrow still only points one way.

Only the session **creator** seeds the room with their current board (on
the `open` event, gated by a `seed` flag passed to `connect()`); a client
*joining* an existing session never does. Without that asymmetry, a joiner's
own (likely stale or empty) local board could race the server's reply and
stomp the room's actual state before the real snapshot arrives.

Running this locally needs the `wrangler dev` relay alongside Vite —
`npm run party:dev` (defaults to `localhost:8787`, matching `collab.js`'s
fallback `VITE_PARTYKIT_HOST`). For real multi-machine use the relay needs
deploying (`npm run party:deploy`, i.e. `wrangler deploy`, authenticated via
`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` in `.env`) and
`VITE_PARTYKIT_HOST` pointed at the resulting `*.workers.dev` host before
building the frontend; see `.env.example`. (The client (`partysocket`)
only ever speaks plain WebSocket, so this backend swap from a PartyKit-
hosted room to a self-deployed Worker + Durable Object needed no change
on the client side — see `party/server.js` for why the managed PartyKit
platform was dropped.)
