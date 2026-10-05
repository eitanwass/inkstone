# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page D&D battle-map editor ("Inkstone"). Vanilla HTML/CSS and strict TypeScript (ES
modules, no framework) bundled with Vite. [index.html](index.html) at
the root is the page shell, and a small Vite plugin in `vite.config.ts` pastes each
`<!-- @include html/name.html -->` with that file's contents (so the markup lives in
[html/](html/), one file per part of the page: tool dock, token card, settings...). The CSS is in
[src/styles/](src/styles/), one file per part, pulled together in order by `main.css`
(`@import`s; keep `responsive.css` last so it wins the cascade). All behavior lives in [src/](src/) as
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
[src/types.ts](src/core/types.ts); `dom.ts` has `byId`/`qs`, which throw on a
missing element so callers get non-null typed elements. Biome handles
linting, formatting and import order: `npm run lint` checks (CI runs it),
`npm run format` fixes. Style is 2-space indent, single quotes, semicolons,
110 columns; [.editorconfig](.editorconfig) and [.gitattributes](.gitattributes)
pin LF line endings.

There are two test suites, and `npm test` runs both (unit first). **Unit
tests** (Vitest, `npm run test:unit`) live in `tests/unit/` (mirroring
`src/`'s folders, as `*.test.ts`) and cover pure logic with no DOM: geometry, the rect and
wall element types, `validate.ts`, the changelog parser. They run in
milliseconds, so prefer them for math and parsing. A module that imports
`canvas.ts` (or anything else that touches the DOM at load, like the token and
label types) can't load under Vitest's Node environment, so those are covered
by the e2e suite instead. The **Playwright e2e suite**
(the `*.spec.js` files in [tests/e2e/](tests/e2e/), `npm run test:e2e`; the config
auto-starts the dev server and ignores `tests/unit/`) drives the real UI (clicking toolbar buttons, dragging on
the canvas) rather than calling module internals, since there's no exposed
JS API and DOM/canvas interaction is what actually exercises the code worth
regression-testing. Collab connection behavior (`tests/e2e/connection.spec.js`) uses
`page.routeWebSocket` as a stand-in relay, which must be registered *before*
the page loads, plus a fake clock stepped a second at a time (one big jump
would expire the socket's own connection timeout before the real, async
open arrives). Touch gestures are tested by dispatching touch-type
`PointerEvent`s via the `touch()` helper (Playwright's touchscreen API only
does taps). [tests/e2e/helpers.js](tests/e2e/helpers.js) has the shared
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
needs the script. `tests/e2e/icons.spec.js` fails if `public/` drifts from the
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
- **Synced once, when editing finishes** (the commit), never per keystroke, as a change
  of its own, `{ t: 'name', name }` (see "Collaboration"): a rename never carries the map, so it
  can't overwrite anyone's work. `broadcastDocument()` (history.ts) sends it without
  recording a history step.
- **Wire format.** A name that isn't text is dropped from a message (the local name is
  left alone) while the rest of it is applied (`protocol.ts`).
- **A peer's rename never overwrites what you're typing**: `refreshMapName()`
  leaves the field alone while it has focus, and it shows the shared name when you
  finish (or press Escape). Offline renames follow the same rule as offline edits:
  the shared map wins on reconnect.
- **Layout.** Wide screens (over 1000px): centred in the top row. At 1000px and
  under there's no room beside both the brand mark and the right rail, so it moves
  to a row below them, left-aligned, leaving room for the "Live" pill (`body.is-sharing`
  is set while the pill shows). The toast sits below the name for the same reason.
  Focus uses an ink-coloured outline, not the gold one, which is 1.8:1 on parchment.

## Design system and share preview

[design/DESIGN.md](design/DESIGN.md) is the design guide (brand, logo, colour,
type, shape, motion, tone), with a visual version in
[design/style-guide.html](design/style-guide.html). Match it when adding UI. It
describes values that live in the code, so `tests/e2e/design-docs.spec.js` fails if
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
- Modals (`showConfirm` in `modal.ts`, and the "What's
  new" modal) trap focus, move focus in, and give it back on close. A modal's
  backdrop should *fade* in (never scale, or it briefly stops covering the
  screen); only the box itself scales.
- UI chrome sits inside `header` / `nav` / `footer` landmarks; they wrap
  `position: fixed` panels, so they don't affect layout.
- Text must stay at least 4.5:1 against its background: `--text-muted` and
  `--text-label` are set for that on the dark panels (don't darken them), and
  `.btn-primary` uses a light label on the gold fill.
- `tests/e2e/accessibility.spec.js` runs axe on the main screen and with popovers
  and dialogs open, and must stay clean. It runs with reduced motion on, so
  axe doesn't sample the popovers mid fade-in.
- Never call `localStorage` directly; use `storage.ts`, because it throws when
  storage is blocked or full. Persisting the board warns the user once per page
  load when it fails (`persistBoard`). Saved custom colors live under
  `inkstone-custom-*`; the old `tavernmap-custom-*` keys are migrated on load.

## Module layout

Under `src/`: `core/` (state, types, DOM/storage helpers, pure math and validation), `draw/`
(everything that paints the canvases), `input/` (pointer, keyboard, selection, history, tools),
`ui/` (popovers, dialogs, cards and other page chrome), `collab/` (live sync), plus `elements/`,
`conditions/`, `settings/` and `main.ts`. The table below lists files by path.

No framework, no virtual DOM, no state-management library — every module
imports the same `state` object from `state.ts` and mutates its properties
directly, then calls `drawMain()` (`render.ts`) or `drawGrid()` (`grid.ts`) to
re-render. Dependencies flow one direction (geometry → elements → render →
selection/erase → pointer → UI wiring); nothing here imports back down that
chain, so there are no circular imports to reason about.

| File | Responsibility |
|---|---|
| `core/state.ts` | The shared `state` object and the `GRID` constant. |
| `core/types.ts` | Shared types: the `BoardElement` union, `ElementBehavior`, drag/hover shapes. |
| `core/dom.ts` | `byId` / `qs`: typed element lookups that throw if the element is missing. |
| `core/validate.ts` | `parseElements`: checks board data from localStorage and the collab relay, dropping malformed elements (and cleaning a token's bad conditions and picture). |
| `core/canvas.ts` | Canvas element/context references, plus client→canvas→world coordinate helpers. |
| `core/geometry.ts` | Pure math: coordinate conversion, rotation, segment/cell clipping. |
| `elements/` | One file per element type (`rect`, `wall`, `token`, `label`) plus `index.ts`, the registry and dispatchers (bounds, hit-testing, erase, handles, move). |
| `draw/handles.ts` | Resize/rotate handle geometry and drag math. |
| `draw/grid.ts` | The dot grid (live background and PNG export). |
| `draw/render.ts` | Everything that draws to the main canvas. |
| `input/history.ts` | Undo/redo stack + localStorage persistence. |
| `input/selection.ts` | Move, delete, duplicate, copy/paste, reorder, rubber-band select. |
| `input/erase.ts` | Erase tool targeting + hover preview. |
| `core/measure.ts` | Pure measuring rules: `scale` (unit, size of a square, and the D&D diagonal rule; 5 ft with the rule on by default; the Board settings panel's one input), `UNITS` (the choices and each one's usual square), `validPerCell` / `parseScale` (checking a typed or stored size; the rule stays on unless stored as exactly `false`), `gridDistance` (with the D&D rule, the default: the DMG 1-2-1-2 count, the longer side plus half the shorter, rounded down; with it off, the true straight line, so a 45° line is √2 times a straight one), `formatDistance`. Used by the ruler and by each element type's optional `dimensions`. |
| `settings/` | The settings modal, opened from the gear button in the action cluster. `index.ts` is the modal (open, close, the tabs) and the Board panel: unit and size of a square, applied as they're changed and kept under `inkstone-board-settings` in this browser, not shared with a session. `conditions.ts` is the Conditions panel (below). The tabs down the left are one tab stop, with the arrow keys moving between them. To add a panel, add a tab and a tabpanel in `html/settings.html` and its controls as a new file in this folder, imported from `main.ts`. While any `aria-modal` dialog is open, `shortcuts.ts` ignores keys, so arrows and letters don't act on the map behind it. |
| `input/pointer.ts` | Mouse/Alt-pan/Escape orchestration — ties the above together per active tool. |
| `input/touch.ts` | Touch-only input: two-finger pinch-zoom/pan and the long-press context menu. `pointer.ts` offers it each event first. |
| `ui/popover.ts` | `positionPopover`: places a popover under its anchor button (share, join). |
| `ui/changelog.ts` | The "What's new" modal (about 75% of the viewport, page blurred behind): renders CHANGELOG.md, dots the button until the current version is opened. |
| `ui/changelog-parse.ts` | Parses CHANGELOG.md's `## version - date` + bullet format. |
| `core/storage.ts` | Never-throwing `localStorage` wrappers. All reads and writes go through here. |
| `ui/map-name.ts` | The editable map name at the top of the page (see "The map's name"). |
| `ui/map-name-text.ts` | Pure rules for map names: `normalizeMapName`, `mapFileSlug`. |
| `ui/focus.ts` | `trapFocus` / `restoreFocus` for modals. |
| `ui/modal.ts` | The generic confirm dialog. |
| `ui/context-menu.ts` | Right-click menus (element, token, empty-canvas paste). |
| `ui/label-editor.ts` | Editing a label's text in place: a field (`#label-editor`) laid over the label on the map, at its own size and colour, growing as it is typed into and following pan and zoom (positioned from `onMainDrawn`, which now holds a list of hooks). Reached by double-click, Enter (`editSelectedText` in controls.ts, which also names a selected token) or "Edit Text" in the label's right-click menu, and **by the text tool** (`textToolClick`): a click on a label opens it, like double-clicking it with the select tool; a **drag** marks out an area for a new label (`textToolArea`, a rubber-band box shown while dragging; a drag under 5px is still a click): the label goes at the area's top left and its font size is the area's height, clamped to 8–72 (a label is one line, so the width is the text's own, and a drag-sized label doesn't change what the next one starts as); a click anywhere else (placed when the pointer is released, so the browser moving focus as the press ends can't take it from the new field) puts a new, empty label there (`placeLabel`), selects it and opens it, with its card; there is no dialog. A new label is on the map for the field and card to work on but is *pending* (`isPendingLabel`): it joins the saved map, the undo history and a live session only when it has text, as one step with whatever size and colour it was given; blank or Escape and it was never there. Going to the card to style it doesn't end the edit (nor lose a label with no text yet); leaving both does. Enter or clicking away keeps the text (one undo step; blank or unchanged is none), Escape puts the old text back. `state.editingLabel` keeps the canvas from drawing the label's own text under the field. |
| `ui/label-card.ts` | The card next to a selected label (markup `#label-card`; the label's counterpart of the token card): a size slider (8 to 72), the bold / italic / plate buttons (`text-style-toggles.ts`) and its colour (the `LABEL_COLORS` swatches from `elements/label.ts`, which are the style panel's stroke colours, plus a ring for any colour). It shows for a single selected label with the select *or text* tool, and what is set there (size, colour and the text style flags) becomes what the next new label starts as (`state.labelStyle`, for this visit only). A change shows on the map as it is made and is one undo step (the slider when it is let go, a swatch when clicked, the ring's picker when it closes). The card is lined up with the label's left edge, not its middle, and is held still while the slider is dragged, because the label grows under it and a card that tried to stay centred slid about under the pointer. Font family and the like are meant to join it. |
| `ui/card-placement.ts` | Pure: `cardPosition`, where a floating card goes next to what is selected (above it, below if the top of the screen is in the way, kept on screen). Used by the token card and the label card. |
| `ui/text-style-toggles.ts` | The bold, italic and plate buttons, built once and mounted in both the label card (`#label-text-style`) and the token card (`#token-text-style`, for its name), and in the card of any element that is given text later. A card passes `mountTextStyleToggles` its element and what a change does (set the flag, redraw, keep an undo step); `refresh` marks the flags that are on. |
| `elements/layer.ts` | Pure: locking. `locked` is an optional flag any element can carry (present only when on, like the text style flags; `validate.ts` keeps only exact `true`; `setLocked` deletes it rather than setting false). `isInteractive` (not locked) is what `hitTest`, `eraseTarget`, Select All, box select and a peer's change to your selection all use, so a **locked** element is a background that left-clicks, drags, the eraser and selection pass through. It can still be right-clicked (to unlock) and is shown a faded lock on hover, both through `hitTestAny` (elements/index.ts: the topmost element at a point, locked or not). There is no hide yet (it was built and taken out for now: an element that can't be clicked needs a list to be found in, and locked ones are right-clicked instead). |
| `input/layers.ts` | `lockElements(indices, locked)`: what the right-click menus do. Locks or unlocks some elements as one undo step (it lets go of what it locks, and shows an Undo toast saying how to undo it: right-click it to unlock). |
| `ui/context-menu.ts` (locking) | Right-clicking a locked element gives the usual menu for it (the element menu, or the token menu), with every item faded out (`.ctx-item.disabled`, `aria-disabled`, no pointer events) but the lock row, which becomes Unlock (`showLockState` and `lockedTarget`). Lock and Unlock use the icon set's `icon-lock` and `icon-unlock`, not emoji. A faded lock **fades in** on the corner of a locked element the pointer is over: it is a small element laid over the map (`#lock-hint`, `ui/lock-hint.ts` follows the mouse itself (idle, with the select tool, `hitTestAny`) and is positioned again after every redraw through `onMainDrawn`, so it stays on its element as the map is panned or zoomed under a still mouse; no shared hover state), not drawn on the canvas, so the fade is a CSS `transition: opacity` (`styles/lock-hint.css`, which `prefers-reduced-motion` already switches off) and the browser does the animation. On a small element such as a token or label it sits just outside the corner so it doesn't cover it. |
| `elements/token-names.ts` | Pure: `nextTokenName(name, taken)`, the numbering for duplicated tokens. A name ending in a number ("Goblin 1") gets the next number after the highest one in use with the same words, ignoring capitals; leading zeros are kept; other names, and any result over 20 characters, stay as they were. `duplicateSelected` (selection.ts) uses it, counting copies made in the same go as taken. Paste does not rename. |
| `conditions/index.ts` | Pure: what a condition is (`{ id, name, color, icon }`), the icon library (`ICONS`, built from the standalone SVG files in `src/conditions/icons/`, one per icon and named for it: a 24-unit box with one `<path>`, line styling on the `<svg>`, `stroke-dasharray` on the path for a dashed one. They are read at build time with `import.meta.glob` and `parseIconSvg` takes the path out, which is drawn on the canvas as a `Path2D` and in the page as an `<svg>` path. To add an icon, add a file there: it appears in the Settings icon picker, and a test checks each file is a clean single-path SVG), the sixteen `DEFAULT_CONDITIONS` (the 5e conditions plus Dead), and the checks (`isCondition`, `parseConditions`) used for anything read from storage or from a session. |
| `conditions/library.ts` | The conditions a person can choose from: the defaults plus their own custom ones, kept in this browser under `inkstone-conditions` (ids start `custom-`, so nothing can pose as a default). `draftProblem` says in words why a draft can't be used (name missing or taken, any capitals, defaults included). |
| `conditions/tokens.ts` | Putting conditions on tokens and taking them off (`toggleCondition`, one undo step each; at most 12 per token), and `refreshCondition`, which brings the copies on tokens up to date when a custom condition is edited. |
| `conditions/icon.ts` | A condition's round badge (and a bare icon) as `<svg>` built from DOM nodes, never an HTML string: names and colors are text a person or someone in their session typed. |
| `settings/conditions.ts` | The Conditions panel in Settings: your own conditions (add, edit, delete) with a live preview, a color and icon picker, and the defaults listed for reference. |
| `elements/text-style.ts` | Pure: what an element's text can be styled with, shared by labels, token names and (next) the text of any element. `TextStyled` (`bold`, `italic`, `plate`, in core/types.ts) are optional flags that are present only when on (`setTextStyle` deletes a flag rather than setting it false, so unstyled elements save and sync as they always did); `fontString` (canvas font; Inter has no italic face, so italics are the browser's slanted upright); `plateColorFor` (a dark plate behind light text, a light plate behind dark text, by luminance; `PLATE_PAD` is how far a plate reaches past the text). |
| `elements/text.ts` | The one place that draws and measures an element's text: `drawText` (a plate behind it, or a dark outline for text with no plate), `textRect` and `plateRect` (the box the text, and its plate, cover: used for bounds and hit-testing). An element's file only says where its text goes and what it looks like by default (a `TextSpec`): `elements/label.ts` anchors at its top left, so a plate reaches out around it and the text doesn't move when it is switched on; `elements/token.ts` centres the name under the disc. **To give another element text** (a door's, say): add a text field and the `TextStyled` mixin to its type, write its `TextSpec`, draw and size it with `drawText` / `plateRect`, and mount `text-style-toggles.ts` in its card. |
| `elements/token-image.ts` | The image store and a token's picture. A picture is a small data URL (`shrinkImage`: center-crop to a 128px square, webp or jpeg) kept **once**, here, in this browser (`inkstone-images`, newest 100) under an id made from its content (`hashImage` in `core/image-data.ts`, so the same picture is the same id everywhere); a token holds only that id in `image`. `addImage` stores one, `receiveImage` takes one from the room (kept only if its hash is its id), `imageFor` decodes and caches it for drawing (a missing one draws as a plain disc; `main.ts` registers the repaint). So moving, copying, undoing, saving and syncing a token never carries the picture. `isImageData` (core/image-data.ts) only accepts small png/jpeg/webp data URLs, and a token's `image` must be an id (validate.ts), so a picture can't be smuggled inside a token. A board saved by 0.6.8, with the picture inside the token, is moved to the store on load (`loadPersistedBoard`). With a picture the token's color is the outline. |
| `ui/token-card.ts` | The card above a selected token (its name, color, image and conditions for now; HP and AC to come): placement, editing, the conditions picker, the hover list of a token's conditions, and the ways in (Enter, double-click, "Add name"/"Rename"/"Change Color" in the token menu). |
| `input/toolbar.ts` | Tool switching + the contextual style panel. |
| `ui/color-swatches.ts` | Stroke/fill swatch rows and the custom-color popover. |
| `input/controls.ts` | The commands a user gives the map outside any one tool: zoom (the bottom-left panel's buttons too), fit map to screen, reset view, nudge the selection, select all, open the shortcut list (`?` button, bottom-right; its rows are static HTML in `index.html`, so update them with any new shortcut). Keyboard, wheel and buttons all call these; add new ones here rather than next to their caller. |
| `ui/view-actions.ts` | Reset View button, Clear All, Export PNG. |
| `input/shortcuts.ts` | Global keyboard shortcuts (bindings only; the commands they run are in `controls.ts` and `selection.ts`). |
| `ui/hint.ts` | The first-visit welcome on an empty map (`#first-visit-hint`: how to start, an arrow to the `?` button). Updated from `drawMain`; hides for good (`inkstone-hint-seen`) once anything is drawn. It is `pointer-events: none`, so it never blocks drawing. |
| `ui/toast.ts` | Toast notifications. A toast may carry one button; `showUndoToast` (history.ts) uses it for "Undo" after Clear All and deletes. Such a toast lasts 6s and vanishes on the user's next click or key press, so Undo can never act on a map that has since changed. |
| `collab/collab.ts` | Live multi-user sync over a Durable Object room (see Collaboration below). |
| `collab/changes.ts` | Pure: `ensureIds`, `diff` (what turns one map into another: `set`, `del`, `order`, `name`) and `applyChanges`. |
| `collab/protocol.ts` | `parseMessage`: checks what the relay sends (`doc`, `catchup`, `changes`, `ack`), dropping a bad change on its own. |
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

**Tokens are placed with no name**: releasing the mouse with the token tool commits a plain
disc straight away (no dialog), in the next colour of `PALETTE` in `elements/token.ts`. An
unnamed token draws no initials and no label. Details are added afterwards in **the token
card** (`token-card.ts`, markup `#token-card`): click a token (select tool, exactly one
selected) and a card appears above it, below it when the top of the screen is in the way,
following it as the map is panned or zoomed and gone while it is dragged. It holds a name
field and the token's color (the eight `PALETTE` swatches from `elements/token.ts`, plus a
ring that opens the browser's own picker for any color; a choice applies at once as one
undo step, and the token's right-click "Change Color" just selects it and moves to these
swatches). HP and AC are meant to join it (as plain numbers everyone sees;
hiding them from players needs roles). The card never takes focus by itself, so Delete and
the arrows still act on the token; click its field, double-click the token, press Enter, or
choose "Add name" (or "Rename") from the token's right-click menu to type. Enter or
clicking away keeps the name (one undo step; unchanged is none; trimmed; empty removes
it); Escape restores the old one and keeps the token selected. The card is positioned from
`render.ts`'s `onMainDrawn` hook, which is registered rather than imported to keep the
module chain one-way.

**Conditions** (Prone, Poisoned, a custom "Hexed"...) are objects, not words: `{ id, name,
color, icon }` (`conditions.ts`). A token holds its own whole copies in `conditions?:
Condition[]` (left off when there are none), so a token is complete in itself and shows
right in a session whether or not the others have the same custom conditions in their
settings, which are per browser. The consequence is copy semantics: **editing** a custom
condition in Settings updates the copy on every token carrying that id (`refreshCondition`,
one undo step), **deleting** one only removes it from the list to choose from, and tokens
that have it keep it. They are set in three places that share `toggleCondition`: the
picker in the token card (type to filter, Enter switches the first match), the token
menu's right-click "Conditions" submenu (a tick per condition, stays open so several can be
switched in one visit), and removing a pill. On the canvas (`elements/badges.ts`) up to
three show as round badges on the top of the rim, a fourth turns the last into a count
(`+2`), and below 55% zoom they fold into one gold dot; a token with the Dead condition is
greyed and crossed out instead. Hovering a token lists its conditions by name. Read from
storage or a session, conditions go through `parseConditions`, which cleans a token's list
rather than dropping the token (and rejects any color that isn't plain `#rrggbb`).

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
switch statement; each tool (`select`, `rect`, `wall`, `token`, `text`, `erase`,
`ruler`) has its own placement/drag logic. Keyboard shortcuts and toolbar buttons both
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

**Measuring.** The ruler tool (`M`) drags a line between half-square points (a grid
line or the middle of a square, where tokens sit) and reads its length from
`measure.ts`. The line lives in `state.ruler`, not in `state.elements`, so it is never
saved, shared or an undo step; it stays after release and goes on a click that goes
nowhere, Escape, or another tool. Diagonals are counted the D&D way by default (the
first diagonal square is 1, the next 2, then 1, 2...), or as the true straight line (a
45° line is √2 times a straight one) when the "D&D diagonal rules" setting is turned
off, in `gridDistance`; it affects the ruler and walls, never a room's sides (which are
always axis-aligned). Shapes show a ruler along their measured sides while
drawn or resized (not while moved or rotated): each element type's optional
`dimensions(el)` lists the stretches (a room's width along its bottom edge and its
height along its right edge, each its own ruler; a wall's length; a token's width) with
a text and which way to push the ruler off the shape. `render.ts` draws each as a line
beside the edge with end ticks and the length in the same pill as the rotation readout,
moving it to the shape's other side when the bottom panels would cover it. The canvas
can't be read by assistive tech or tests, so `render.ts` also writes the current
measurement ("30 ft × 20 ft" for a room) into the hidden `#measure-readout`.

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
panel, and action cluster are opaque. The style panel (stroke, fill and the "Size"
slider, which is the stroke width) is for the rect and wall tools; the text tool has none, because a
label's size and colour are set in its own card (`label-card.ts`).

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

**Collaboration** (`collab/`) is a thin sync layer on top of the existing
whole-document undo model, not a separate state system. A session is a
Durable Object room ([party/server.js](party/server.js), a relay that keeps the map per
element — one `InkstoneRoom` instance per session id, addressed by
a Worker `fetch` handler that routes `/parties/<name>/<room>` requests to
it) keyed by a random id carried in the URL (`?session=...`). Clicking
"Share" (`btn-share`) lazily creates that id with `crypto.randomUUID()`
the first time (a session is never created just by opening the app),
puts it in the URL via `history.replaceState`, connects, and opens a
popover showing the code with a "Copy Link" button. "Join" (`btn-join`)
opens a sibling popover where a user pastes another session's code or
full invite link (`extractSessionId()` accepts either) to connect to it
without creating a new session.

**What goes over the wire is changes, not snapshots** (`changes.ts`, pure and unit
tested). Every element has a stable `id` (`ensureIds`, called by `pushHistory` and before
sending; a duplicate or paste arrives with its original's id and is given a new one).
Every local `pushHistory()`/`undo()`/`redo()` calls `broadcastState`, which `diff`s the
map against `synced` (what the room is believed to hold) and sends
`{ type: 'changes', base, changes }`: `set` (an element, new or edited; new ids go last),
`del` (an id), `order` (all ids, only when the order isn't what adding and removing gives
anyway) and `name`. So undo stays whole-snapshot (see below) while the traffic is just the
difference, and two people editing *different* elements never collide. Token images no longer
travel on every edit.

**Pictures are not changes.** A token's `image` is an id (see `elements/token-image.ts`); the picture itself
goes over the wire once, as its own message, never as part of the map. When a batch contains a token
whose picture the room hasn't had from us, `uploadImages` first sends `{ type: 'image', id, data }`
(`uploadedImages` remembers what was sent, and is emptied when the room's epoch changes). The relay keeps
each picture once (`img:<id>`, first one wins, at most 100 and 1,500,000 characters a room, raster data
URLs only) and does not forward it. A client that has a token whose picture it lacks (from `doc`,
`catchup`, `changes`, or an `ack` fix) asks `{ type: 'getimages', ids }` and the relay answers
with `image` messages; `receiveImage` keeps one only if its hash is the id it came under, and the map
repaints. Requests are made again after a reconnect. Nothing needs to be asked for or sent when a
token merely moves.

**Revisions: the room is the source of truth.** The relay numbers every accepted batch of
changes (`rev`) and keeps a log of the last 100 (`LOG_LIMIT` in party/server.js), one small
entry each: `{ rev, cid, by: { id, name }, at, ids, order, name }`, which says who sent it and
which elements it touched, not what it put in them (so the log is tiny, and is the start of a
"who changed what" view). A batch carries `base`, the revision the client built it on. The relay
refuses a change to something that a revision *after* `base`, by another tab (`cid`; a client's
own earlier batches don't count), touched: the same element, the order, or the name. It then
sends the sender `{ type: 'ack', epoch, rev, fix }`, where `fix` is the room's version of what
was refused (the element as it is, or a deletion), and the client applies it, with a toast ("Someone
else changed that first, so their version was kept"). What was accepted is forwarded to the others
as `{ type: 'changes', rev, changes }`; a client that sees a revision other than the one after the
last it has asks to be caught up. A client built on a revision older than the log reaches is refused
whole. The relay's author is a placeholder: `collab.ts` keeps `{ id, name: 'Guest 1234' }` per
browser (`inkstone-author`), and a `cid` per page load.

**Connecting.** The client says `{ type: 'hello', cid, author, epoch?, since? }` as soon as the
socket opens (the relay ignores a client it hasn't met, and the client sends nothing until the
relay has answered: `caughtUp`). `epoch` names one life of the room (a new one after it expires and
is made again) and `since` is the last revision the client has, sent only if it has been in this
room before. The relay answers with one of:
- `catchup`: the room's *current* version of whatever was touched since `since` (a `set` or
  `del` per element, the order and the name if touched), built from the log. A client that was
  offline first works out what it changed itself (`diff` against `synced`), applies the catchup (the
  room wins), then sends its own changes on top, built on `since`, which the relay accepts or refuses
  as above. So a flaky connection loses only what truly conflicted.
- `doc`: the whole map, when it can't catch the client up (first visit, another epoch, or the log no
  longer reaches back to `since`); the room's map then replaces the local one and offline edits are
  lost, with a toast. A reload while offline forgets `synced`, so it is this case too.
- `doc` with `fresh: true`: nobody has used the room yet (new, or expired). The client gives it its
  own map (a `doc` message, accepted only while the room is fresh, so the first to arrive wins and a
  late one just gets the room's map back), acknowledged with the new epoch at revision 0.

`protocol.ts` checks every message from the relay on arrival, dropping a bad change on its own. A
peer's changes are applied with `applyRemoteChanges` (history.ts), which does *not* make an undo
step, so Ctrl+Z undoes your own last edit, not whatever a peer just did. They are applied to every
step of your undo stack too, so undoing your own edit later keeps their work, and your selection is
kept by id (unless they deleted what you had selected). `applyRemoteDocument` makes the room's
map the new start of the undo history.

Because `history.ts` sits *below* `collab.ts` in the module chain (per the
one-directional dependency rule above), it can't import `collab.ts` to
notify it of changes without creating a cycle. Instead `history.ts` exposes
`setHistoryListener(fn)`, and `collab.ts` registers its own broadcast
function there at load time — inversion of control instead of a direct
import, so the dependency arrow still only points one way.

**The room is kept.** The relay keeps the map in the Durable Object's storage, one row per
element (`el:<id>`), one per log entry (`log:<rev>`) plus `order` and `meta` (name, epoch, revision), so an edit writes only the rows it
changed (once per burst of edits, and at once when the last person leaves). Whoever opens the
link later, even after everyone has left, gets the map as it was. A room (and its log) is deleted a week
after its last visit (a Durable Object alarm; any visit pushes it back), so abandoned rooms
don't fill the free plan. The relay drops any message that isn't well formed (an element
needs an id of letters, digits, `_` and `-` and a known type) or is over its limits (20,000
characters an element (they no longer carry pictures), 2,000 elements, 900,000 in all, kept under Cloudflare's 1 MiB per
message), since what it stores lasts. It can't import `changes.ts`, so its checks are kept in
step by hand. Tested in `tests/unit/party/`.

**Connection loss.** `partysocket` reconnects on its own; `collab.ts` surfaces
it. The status pill (`#collab-status`, in the top-right rail under the action cluster, red dot
for live) goes `Connecting…` → `Live`, and on a
drop to `Reconnecting…` (with a toast, announced once, not on every retry
attempt). If the relay can't be reached for 8 seconds on the first connect, a
toast says so. The policy for edits made while offline is **the room wins where they
conflict**: on reconnect the client is caught up (see "Connecting"), its offline edits are sent on top, and
any the room refuses (someone else changed the same element, the order or the name first) are replaced
by the room's version. `broadcastState` notes `unsentEdits` when it can't send. Messages from the relay go
through `parseMessage` (see `protocol.ts`).

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
