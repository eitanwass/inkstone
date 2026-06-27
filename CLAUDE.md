# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page D&D battle-map editor ("Tavern Map"). Pure vanilla HTML/CSS/JS — no
build step, no package manager, no framework, no test runner. The entire app is
three files: [index.html](index.html), [app.js](app.js), [style.css](style.css).

## Running it

There is no build/dev server tooling in the repo. Open [index.html](index.html)
directly in a browser, or serve the directory with any static file server
(e.g. `npx serve .`) if `file://` causes issues with canvas/blob APIs.

There are no linters, formatters, or tests configured — verify changes by loading
the page and exercising the tool manually.

## Architecture

Three-layer canvas stack (`#grid-canvas`, `#main-canvas`, `#interaction-canvas`,
absolutely positioned over each other in [index.html](index.html)):
- **grid-canvas** — dot grid background, redrawn on pan/zoom/resize (`drawGrid`).
- **main-canvas** — all committed elements plus the in-progress preview shape
  (`drawMain` → `drawElement`).
- **interaction-canvas** — transparent, captures all mouse events
  (`mousemove`/`mousedown`/`mouseup`/`wheel`/`contextmenu`); nothing is drawn to it.

All app state lives in one global `state` object in [app.js](app.js) (current
tool, style settings, pan/zoom transform, drag/erase/selection state, and the
`elements` array). There is no framework, no virtual DOM, no state management
library — every interaction handler mutates `state` directly and calls
`drawMain()`/`drawGrid()` to re-render.

**Elements** (`state.elements`) are plain objects with a `type` discriminator:
`rect`, `wall`, `token`, `door`, `label`. Three functions switch on `el.type` and
must be extended together when adding a new element type:
- `drawElement` ([app.js:146](app.js#L146)) — rendering
- `getElementBounds` ([app.js:300](app.js#L300)) — selection-box bounds
- `hitElement` ([app.js:332](app.js#L332)) — click hit-testing
- `elementOccupiesCell` ([app.js:384](app.js#L384)) — grid-cell-based erase

**Coordinate systems**: world space (logical, grid-unit based, `GRID = 40px`)
vs. screen space (pixels, after pan/zoom). Convert with `screenToWorld` /
`worldToScreen`; snap world coords to the grid with `snapToGrid`. Canvas pan/zoom
is applied via `ctx.translate`/`ctx.scale` in `drawMain`, so element coordinates
are always stored in world space.

**Tools** are selected via `state.tool` and dispatched in the `onMouseDown`
switch statement; each tool (`select`, `rect`, `wall`, `token`, `door`, `text`,
`erase`) has its own placement/drag logic. Keyboard shortcuts and toolbar
buttons both funnel through `setTool()`.

Undo/redo ([app.js:1035](app.js#L1035)) is a simple single-array pop/push stack
on `state._undoStack` — it only ever undoes the most recent addition, not edits
or deletions.

PNG export ([app.js:977](app.js#L977)) re-renders the grid and all elements onto
an offscreen 2x-resolution canvas rather than capturing the visible canvases
directly (so exports are independent of current viewport resolution).
