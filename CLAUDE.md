# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page D&D battle-map editor ("Inkstone"). Vanilla HTML/CSS and strict TypeScript (ES
modules, no framework) bundled with Vite. [index.html](index.html) +
[style.css](style.css) at the root; all behavior lives in [src/](src/) as
small single-purpose modules (see Module layout below).

## Running it

`npm run dev` (Vite dev server), `npm run typecheck` (`tsc --noEmit`, strict),
`npm run build` (typecheck, then production bundle to `dist/`),
`npm run preview`. The entry point is `<script type="module" src="src/main.ts">`
in [index.html](index.html) — it must stay `type="module"`, and `public/`
holds static assets (`icons.svg`, `logo.svg`) that Vite copies through
unmodified rather than processing.

Vite strips types without checking them, so `npm run typecheck` is what
actually enforces them (CI runs it). Shared types live in
[src/types.ts](src/types.ts); `dom.ts` has `byId`/`qs`, which throw on a
missing element so callers get non-null typed elements. Biome handles
linting, formatting and import order: `npm run lint` checks (CI runs it),
`npm run format` fixes. Style is 2-space indent, single quotes, semicolons,
110 columns; [.editorconfig](.editorconfig) and [.gitattributes](.gitattributes)
pin LF line endings.

There are two test suites, and `npm test` runs both (unit first). **Unit
tests** (Vitest, `npm run test:unit`) live in `tests/unit/` (mirroring
`src/`, as `*.test.ts`) and cover pure logic with no DOM: geometry, the rect and
wall element types, `validate.ts`, the changelog parser. They run in
milliseconds, so prefer them for math and parsing. A module that imports
`canvas.ts` (or anything else that touches the DOM at load, like the token and
label types) can't load under Vitest's Node environment, so those are covered
by the e2e suite instead. The **Playwright e2e suite**
(the `*.spec.js` files in [tests/](tests/), `npm run test:e2e`; the config
auto-starts the dev server and ignores `tests/unit/`) drives the real UI (clicking toolbar buttons, dragging on
the canvas) rather than calling module internals, since there's no exposed
JS API and DOM/canvas interaction is what actually exercises the code worth
regression-testing. Collab connection behavior (`tests/connection.spec.js`) uses
`page.routeWebSocket` as a stand-in relay, which must be registered *before*
the page loads, plus a fake clock stepped a second at a time (one big jump
would expire the socket's own connection timeout before the real, async
open arrives). Touch gestures are tested by dispatching touch-type
`PointerEvent`s via the `touch()` helper (Playwright's touchscreen API only
does taps). [tests/helpers.js](tests/helpers.js) has the shared
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
(the client defaults to `localhost:8787` via `VITE_RELAY_HOST` — see
`.env.example`). `npm run party:deploy` (`wrangler deploy`) pushes it to
your own Cloudflare account for real cross-machine use — `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN` in `.env` authenticate this (wrangler loads `.env`
automatically); no custom domain is needed, it deploys to a free
`*.workers.dev` subdomain. `VITE_RELAY_HOST` then needs to point at that
deployed host before running `npm run build`.

## Releasing

The site only redeploys when the version changes. To release: bump the version
(`npm version patch|minor --no-git-tag-version`), add a matching
`## <version> - <date>` section at the top of [CHANGELOG.md](CHANGELOG.md)
(written for people using the editor, not for developers), and push. CI runs
`npm run check:changelog`, which fails if the top entry doesn't match
package.json. The app's "What's new" modal renders that same file.

On Vercel (Git integration), [vercel.json](vercel.json) sets
[scripts/should-deploy.mjs](scripts/should-deploy.mjs) as the Ignored Build
Step. For production it compares package.json's version against the last
successful deployment's commit (`VERCEL_GIT_PREVIOUS_SHA`, else `HEAD~1`) and
skips the build if it's unchanged. Preview builds always run, and if the
comparison can't be made it builds rather than skips. So a push to master that
doesn't bump the version does not deploy.

## Logo and icons

The mark is a pen nib that doubles as a compass needle ("ink, pointing north"),
on the same chamfered tile as the UI panels. The sources live in
[design/logo/](design/logo/): `logo.svg` (the full mark, used in the app's
corner), `favicon.svg` (a simplified version: the compass ring and ticks vanish
at 16px, so it drops them and draws the nib bigger), and `icon-fullbleed.svg`
(an opaque square for iOS/Android home screens, kept inside the central 80%
that platform masks don't cut into). `design/logo/alternates/` keeps rejected
options in case of a change of mind (currently the cairn).

Don't edit `public/logo.svg`, `favicon.svg`, `favicon.ico`,
`apple-touch-icon.png` or `icon-*.png` by hand: edit the SVGs in `design/logo/`
and run `npm run build:icons`, which regenerates all of them
(`scripts/build-icons.mjs`; it rasterizes with Playwright's Chromium and builds
the `.ico` itself). The generated files are committed, so a normal build never
needs the script. `tests/icons.spec.js` fails if `public/` drifts from the
sources, if an icon isn't served, or if a home-screen icon has transparency.
`index.html` links the icons and `public/site.webmanifest` (name, colors,
home-screen icons).

## The map's name

`state.mapName` (`''` = unnamed, shown as the "Untitled map" placeholder) is
edited in place at the top of the page (`map-name.ts`, markup `#map-title`): the
title is a real `<input>` styled as text, with a hidden mirror `<span>` in the
same grid cell giving it the width of its text. **Enter or clicking away
commits; Escape puts the old name back.** Rules for the text live in
`map-name-text.ts` (`normalizeMapName`: trimmed, whitespace collapsed, control
characters removed, at most 60 characters; `mapFileSlug` for the export's file
name). Where it appears: the field, `document.title` ("Name – Inkstone"), and the
exported PNG's name (`the-sunken-crypt.png`, default `inkstone-map.png`).

Deliberate design points:

- **Not part of the undo history.** Snapshots (`history.stack`) hold only
  elements; renaming never creates an undo step and undo/redo never changes the
  name. The name has its own persistence (`persistMapName`, key
  `inkstone-map-name`) and is saved once per commit.
- **Synced once, when editing finishes** (the commit), never per keystroke.
  Because the relay remembers only the *latest* message to catch up whoever joins
  next, a rename sends the whole snapshot via `broadcastDocument()` (history.ts)
  without recording a history step, not a name-only message.
- **Wire format.** `collab.ts` sends `{ name, elements }`. `parseSnapshot`
  (validate.ts) also accepts the older bare array of elements (no name: the local
  name is left alone), and ignores a name that isn't text while still applying the
  elements. The relay itself is unchanged: it passes strings through.
- **A peer's rename never overwrites what you're typing**: `refreshMapName()`
  leaves the field alone while it has focus, and it shows the shared name when you
  finish (or press Escape). Offline renames follow the same rule as offline edits:
  the shared map wins on reconnect.
- **Layout.** Wide screens (over 1000px): centred in the top row. At 1000px and
  under there's no room beside both the brand mark and the right rail, so it moves
  to a row below them, left-aligned, leaving room for the "Live" pill (`body.is-sharing`
  is set while the pill shows). The toast sits below the name for the same reason.
  Focus uses an ink-coloured outline, not the gold one, which is 1.8:1 on parchment.

**Known limitation (deliberate for now).** Because a rename sends the renamer's
whole snapshot (see above), it can overwrite other people's work in two cases:
(1) a joiner who renames *before the room's map has reached them* sends their own
older board (confirmed with a probe: the message carried the joiner's stale
elements); (2) a rename sent while someone else is mid-edit carries a copy that
lacks that edit (the same lost-update every whole-snapshot edit has under
last-write-wins, but a rename makes it happen without touching the map). The fix
is to send the name as its own message that never carries the map, with the relay
remembering the map and the name separately for catch-up. That needs a relay
change, and the relay must be redeployed *before* the client: an old relay would
remember a name-only message as the whole room. The new relay should keep accepting
today's formats. A client-only guard (hold a joiner's rename until they have
caught up) fixes just case 1.

## Design system and share preview

[design/DESIGN.md](design/DESIGN.md) is the design guide (brand, logo, colour,
type, shape, motion, tone), with a visual version in
[design/style-guide.html](design/style-guide.html). Match it when adding UI. It
describes values that live in the code, so `tests/design-docs.spec.js` fails if
a `:root` token, a swatch colour, a token colour or the bundled fonts change
without the guide changing too (and if a link in it breaks).

Typography: **Inter** (variable, bundled via `@fontsource-variable/inter`) for
the UI and for text drawn on the canvas, upright **EB Garamond** 500 for the
wordmark, and the system monospace for the HUD numbers. Fonts are imported in
`main.ts`, so nothing is fetched from Google. Canvas text doesn't wait for fonts
the way page text does, so `main.ts` also loads the font explicitly and repaints.

The link preview (`og:` and `twitter:` tags in `index.html`, image
`public/og-image.png`) is rendered by `npm run build:og` from
`design/share-preview/template.html`; don't edit the PNG by hand. Chat apps need
an **absolute** image URL, so `index.html` uses a `%SITE_URL%` placeholder that
`vite.config.ts` fills in at build time using `resolveSiteUrl` (`scripts/site-url.ts`):
`SITE_URL`, else Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (a bare domain, no
protocol), else nothing (relative, fine for local dev). Either may be written
with or without `https://` or a trailing slash; the result always has a protocol
and no trailing slash.

**The link preview is the same for every map, deliberately.** We built a per-map
card (the map's name drawn into the preview image, via `?map=` in the invite link, a
Vercel function that rewrote the preview tags and another that drew the image with
Satori) and removed it again: it was a lot of moving parts (server functions, bundled
fonts and wasm, a special invite path) for a small gain, and it kept failing in
Vercel's runtime in ways local tests couldn't see. If it's ever wanted again, it's
in git history (0.6.1 to 0.6.3). Lessons if so: a static file is served before any
rewrite (so a rewrite on `/` never fires); Satori's WOFF reader returns empty glyphs
(unpack to TTF first); Vercel passes a second argument to handlers; every file a
function reads, including those of its dependencies, must be in `includeFiles`.

## Accessibility and storage conventions

- Icon-only buttons need an `aria-label` (the `title` stays as the tooltip with
  the shortcut). Toggle-like buttons carry state in the DOM: tool buttons and
  swatches use `aria-pressed`, popover buttons use `aria-expanded` (kept in
  sync by `positionPopover` / `closePopover` in `popover.ts`) — update them in
  the same place the visual `active` class changes.
- Modals (`showConfirm`, `setupInputDialog` in `dialogs.ts`, and the "What's
  new" modal) trap focus, move focus in, and give it back on close. A modal's
  backdrop should *fade* in (never scale, or it briefly stops covering the
  screen); only the box itself scales.
- UI chrome sits inside `header` / `nav` / `footer` landmarks; they wrap
  `position: fixed` panels, so they don't affect layout.
- Text must stay at least 4.5:1 against its background: `--text-muted` and
  `--text-label` are set for that on the dark panels (don't darken them), and
  `.btn-primary` uses a light label on the gold fill.
- `tests/accessibility.spec.js` runs axe on the main screen and with popovers
  and dialogs open, and must stay clean. It runs with reduced motion on, so
  axe doesn't sample the popovers mid fade-in.
- Never call `localStorage` directly; use `storage.ts`, because it throws when
  storage is blocked or full. Persisting the board warns the user once per page
  load when it fails (`persistBoard`). Saved custom colors live under
  `inkstone-custom-*`; the old `tavernmap-custom-*` keys are migrated on load.

## Module layout

No framework, no virtual DOM, no state-management library — every module
imports the same `state` object from `state.ts` and mutates its properties
directly, then calls `drawMain()` (`render.ts`) or `drawGrid()` (`grid.ts`) to
re-render. Dependencies flow one direction (geometry → elements → render →
selection/erase → pointer → UI wiring); nothing here imports back down that
chain, so there are no circular imports to reason about.

| File | Responsibility |
|---|---|
| `state.ts` | The shared `state` object and the `GRID` constant. |
| `types.ts` | Shared types: the `BoardElement` union, `ElementBehavior`, drag/hover shapes. |
| `dom.ts` | `byId` / `qs`: typed element lookups that throw if the element is missing. |
| `validate.ts` | `parseElements`: checks board data from localStorage and the collab relay, dropping malformed elements. |
| `canvas.ts` | Canvas element/context references, plus client→canvas→world coordinate helpers. |
| `geometry.ts` | Pure math: coordinate conversion, rotation, segment/cell clipping. |
| `elements/` | One file per element type (`rect`, `wall`, `token`, `label`) plus `index.ts`, the registry and dispatchers (bounds, hit-testing, erase, handles, move). |
| `handles.ts` | Resize/rotate handle geometry and drag math. |
| `grid.ts` | The dot grid (live background and PNG export). |
| `render.ts` | Everything that draws to the main canvas. |
| `history.ts` | Undo/redo stack + localStorage persistence. |
| `selection.ts` | Move, delete, duplicate, copy/paste, reorder, rubber-band select. |
| `erase.ts` | Erase tool targeting + hover preview. |
| `pointer.ts` | Mouse/Alt-pan/Escape orchestration — ties the above together per active tool. |
| `touch.ts` | Touch-only input: two-finger pinch-zoom/pan and the long-press context menu. `pointer.ts` offers it each event first. |
| `popover.ts` | `positionPopover`: places a popover under its anchor button (share, join). |
| `changelog.ts` | The "What's new" modal (about 75% of the viewport, page blurred behind): renders CHANGELOG.md, dots the button until the current version is opened. |
| `changelog-parse.ts` | Parses CHANGELOG.md's `## version - date` + bullet format. |
| `storage.ts` | Never-throwing `localStorage` wrappers. All reads and writes go through here. |
| `map-name.ts` | The editable map name at the top of the page (see "The map's name"). |
| `map-name-text.ts` | Pure rules for map names: `normalizeMapName`, `mapFileSlug`. |
| `focus.ts` | `trapFocus` / `restoreFocus` for modals. |
| `modal.ts` | The generic confirm dialog. |
| `context-menu.ts` | Right-click menus (element, token, empty-canvas paste). |
| `dialogs.ts` | Token-name and text-label placement dialogs. |
| `toolbar.ts` | Tool switching + the contextual style panel. |
| `color-swatches.ts` | Stroke/fill swatch rows and the custom-color popover. |
| `controls.ts` | The commands a user gives the map outside any one tool: zoom (the bottom-left panel's buttons too), fit map to screen, reset view, nudge the selection, select all, open the shortcut list (`?` button, bottom-right; its rows are static HTML in `index.html`, so update them with any new shortcut). Keyboard, wheel and buttons all call these; add new ones here rather than next to their caller. |
| `view-actions.ts` | Reset View button, Clear All, Export PNG. |
| `shortcuts.ts` | Global keyboard shortcuts (bindings only; the commands they run are in `controls.ts` and `selection.ts`). |
| `hint.ts` | The first-visit welcome on an empty map (`#first-visit-hint`: how to start, an arrow to the `?` button). Updated from `drawMain`; hides for good (`inkstone-hint-seen`) once anything is drawn. It is `pointer-events: none`, so it never blocks drawing. |
| `toast.ts` | Toast notifications. A toast may carry one button; `showUndoToast` (history.ts) uses it for "Undo" after Clear All and deletes. Such a toast lasts 6s and vanishes on the user's next click or key press, so Undo can never act on a map that has since changed. |
| `collab.ts` | Live multi-user sync over a Durable Object room (see Collaboration below). |
| `main.ts` | Entry point: canvas sizing, load-time init, pulls in the pure-side-effect modules. |

To add an element type, add a file in `elements/` and register it in
`elements/index.ts` (see the method list at the top of that file).

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
`rect`, `wall`, `token`, `label`. Elements are pure data (they're persisted,
cloned for undo, and synced to peers, so they can't carry methods). Each type's
behavior lives in its own `elements/<type>.ts` object, and `elements/index.ts`
maps `el.type` to it. Code elsewhere calls dispatchers like
`getElementBounds(el)` or `hitElement(el, x, y)` instead of switching on
`el.type`. A type provides `draw`, `bounds`, and `hit`, plus optional
`occupiesCell`, `erase`, `handles`, `rotate`, `translate`, etc.

Erase uses `occupiesCell` for types removed as a whole discrete prop. A type
that erases piecemeal (`wall`, via `clipSegmentToCell`) provides `erase`
instead, returning the pieces left behind and the part to highlight.

**`cellOf` vs `snapToGrid`** (both in `geometry.ts`) are not interchangeable
despite looking similar: `snapToGrid` *rounds* to the nearest grid line
(correct for placing/dragging a shape's own coordinates onto a grid
intersection), while `cellOf` *floors* to the cell's origin (correct for
"which cell does this point belong to"). Erase targeting needs `cellOf` —
using `snapToGrid` there was a real bug that only showed up near a cell
boundary (e.g. clicking near a large token's edge could round to the
*next* cell over and miss it). Each type's `occupiesCell`
math must stay on the same convention as whatever its caller passes in.

**Tokens have a variable `radius`**, set either by dragging while placing
one or, after the fact, via resize handles on an already-selected token
(still always a circle either way — see "Resize/rotate handles" below). The
radius snaps to `GRID / 2` steps — diameters of 1, 2, 3... whole grid cells,
matching D&D's Medium/Large/Huge creature-size convention. Placement-drag
has a dead zone below the default radius (`GRID * 0.42`) so incidental mouse
drift during a plain click doesn't bump a "click to place" token up to the
first snap step; see the `'token'` branch in `pointer.ts`'s drag handler.
Resizing an *existing* token needs no dead zone — the handle itself starts
already at the current radius, so an un-moved grab re-resolves to ~the same
size. Every place that reads a token's size falls back to that same
default via `el.radius || GRID * 0.42`, so boards persisted before this
feature existed keep rendering at their original size with no migration
needed. Bounds/hit/erase-occupancy all scale with the radius —
The token's `occupiesCell` in particular is an AABB-overlap check
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
though the map reappears. Every save updates the save indicator in the top-right rail, right of the Live pill
(`showSaveStatus` in `history.ts`, element `#save-status`, a small dark chip because
gold wouldn't read on parchment): a yellow spinner while saving (held for 600ms, since
a localStorage write is instant and would otherwise give no sign), a green check once
saved, a red X at once if the browser refused. Its hover text says which. That is the
persistent counterpart to the once-per-load "can't be saved" toast.

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

PNG export (`view-actions.ts`) re-renders the grid and all elements onto an
offscreen 2x-resolution canvas rather than capturing the visible canvases
directly (so exports are independent of current viewport resolution).

**Collaboration** (`collab.ts`) is a thin sync layer on top of the existing
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
applied via `applyRemoteSnapshot()` (in `history.ts`) the same way undo/redo
already swaps in a full snapshot — except it deliberately does *not* go
onto the local undo stack, so pressing Ctrl+Z undoes your own last edit,
not whatever a peer just did. This is last-write-wins: edits to different
elements never collide, but two people editing the same element at the same
instant just have one of them win — there's no operation-level merge, since
a CRDT would mean restructuring `state.elements` around a different data
structure entirely for a hand-drawn map where that's rarely worth it.

Because `history.ts` sits *below* `collab.ts` in the module chain (per the
one-directional dependency rule above), it can't import `collab.ts` to
notify it of changes without creating a cycle. Instead `history.ts` exposes
`setHistoryListener(fn)`, and `collab.ts` registers its own broadcast
function there at load time — inversion of control instead of a direct
import, so the dependency arrow still only points one way.

Only the session **creator** seeds the room with their current board (on
the **first** `open` event only, gated by a `seed` flag passed to
`connect()`); a client *joining* an existing session never does. Without that
asymmetry, a joiner's own (likely stale or empty) local board could race the
server's reply and stomp the room's actual state before the real snapshot
arrives. The same reasoning is why a *re*connect never re-seeds.

**Connection loss.** `partysocket` reconnects on its own; `collab.ts` surfaces
it. The status pill (`#collab-status`, in the top-right rail under the action cluster, red dot
for live) goes `Connecting…` → `Live`, and on a
drop to `Reconnecting…` (with a toast, announced once, not on every retry
attempt). If the relay can't be reached for 8 seconds on the first connect, a
toast says so. The policy for edits made while offline is **the shared map
wins**: the relay sends its copy on reconnect and `applyRemoteSnapshot` makes
it the local map, so offline edits are replaced. `broadcastState` notes
`unsentEdits` when it can't send, and the reconnect toast says so when that
happened. (Making the local map win instead would overwrite peers' work, and
needs care around the relay's catch-up message.) Messages from the relay go
through `parseElements` first (see `validate.ts`).

The relay address comes from `resolveRelayHost` (`relay-host.ts`): the
`VITE_RELAY_HOST` build variable, else `localhost:8787` **only on the dev
server**. A production build with no `VITE_RELAY_HOST` has sharing off: Share,
Join and `?session=` links show "Sharing isn't set up on this site" and never
open a socket. (An earlier fallback to localhost in production made Chrome ask
visitors to allow access to "apps and services on this device", and could
never have worked.) Set `VITE_RELAY_HOST` in the Vercel project's environment
variables, then redeploy; changing a variable alone doesn't trigger a build.

Running this locally needs the `wrangler dev` relay alongside Vite —
`npm run party:dev` (defaults to `localhost:8787`, matching `collab.ts`'s
fallback `VITE_RELAY_HOST`). For real multi-machine use the relay needs
deploying (`npm run party:deploy`, i.e. `wrangler deploy`, authenticated via
`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` in `.env`) and
`VITE_RELAY_HOST` pointed at the resulting `*.workers.dev` host before
building the frontend; see `.env.example`. (The client (`partysocket`)
only ever speaks plain WebSocket, so this backend swap from a PartyKit-
hosted room to a self-deployed Worker + Durable Object needed no change
on the client side — see `party/server.js` for why the managed PartyKit
platform was dropped.)
