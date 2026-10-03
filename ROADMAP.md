# Roadmap

Direction: **make the map faster and nicer to work on** before adding big new
systems. Inkstone's edge is that it already feels like a drawing
tool (walls that erase cell by cell, resizable tokens, rotation, multi-select,
undo, PNG export) and needs no account. This list builds on that. Heavy features
(fog of war, accounts) come last, because they are expensive and only pay off
once the basics feel good.

Sizes: **S** is a day or less, **M** a few days, **L** a week or more.
Each item is meant to ship on its own.

## Now: quick wins (all S)

- **Keyboard shortcuts you'd expect.** Arrow keys nudge the selection by a cell,
  Ctrl+A selects all, `+` / `-` zoom, Escape deselects. Today the keyboard covers
  only tools, undo/redo, copy/paste/duplicate, delete and Home.
- **Shortcut cheat sheet.** `?` opens a small list of every shortcut. The tooltips
  already carry them, but nobody finds them by hovering.
- **Zoom controls.** On-screen `+` / `-` and "fit map to screen". Right now zooming
  is wheel or pinch only, and Reset View goes to a fixed spot rather than to the map.
- **Undo for Clear All** (check it already records a step; if not, make it) and a
  toast with an "Undo" button after destructive actions instead of only a confirm.
- **Saved-state feedback.** A quiet "Saved" mark so people trust that the map
  survives a reload.
- **First-visit hint.** A one-line, dismissible tip on an empty map ("Press R and
  drag to draw a room"). New visitors currently land on a blank canvas.

## Next: drawing speed and polish (S to M)

- **Snap and precision options.** A grid-snap toggle (hold a key to bypass) and
  half-cell snapping for walls. (M)
- **Ruler / distance measuring** in cells and feet. The most-used table tool that
  we don't have. (M)
- **More stock shapes**: doors and windows on walls, circles, stairs, and a line
  with an arrow. Rooms and walls cover dungeons; doors are what people draw next. (M)
- **Token polish**: colour per token, initials or an emoji/icon, a condition
  marker (dead, prone, ...) and a "duplicate and increment" for packs of enemies
  ("Goblin 1, 2, 3"). (M)
- **Text and label styling**: bold/size presets and a background plate so labels
  read over busy maps. (S)
- **Layer controls**: lock an element, send to back, hide/show a group, so a
  background room isn't dragged by accident. (M)
- **Right-click and long-press menus reachable by keyboard** (known a11y gap). (M)

## Then: working with more than one map (M to L)

- **Several maps in the browser**: a map list with rename, duplicate, delete. This is
  the biggest everyday gap: today there is one map per browser. Local first,
  no account. (L)
- **Save to / open from a file** (JSON). Backup, moving between devices, sharing a
  map by email. Also the escape hatch for the no-account approach. (M)
- **Import an image as a background** (a scanned or downloaded map to draw over). (L)
- **Export options**: PNG with or without grid, transparent background, print
  layout at one-inch squares. (M)

## Sessions: make live play smoother (M to L)

- **See who's here**: a small list of people and their cursors. The Live pill only
  says the connection is up. (M)
- **Fix the rename overwrite** documented in CLAUDE.md (relay change; deploy the
  relay first). Also removes a class of lost updates for map names. (M)
- **Presenter / read-only link**: a view-only invite so players can't move
  things by accident. A light version of GM-versus-player roles. (M)
- **Ping**: click-and-hold to flash a spot for everyone ("look here"). (S)

## Later: bigger bets (L, decide with real use first)

- **Fog of war / hidden areas**: the main thing GMs ask a battle map for. Needs roles first (the GM sees everything, players
  don't), so it follows read-only links.
- **Dice roller** with shared roll history. Cheap to build, but players already
  have dice; do it only if it keeps people on the page.
- **Accounts and cloud-saved maps**: only if people ask for it. It brings storage
  and cost, and it ends the "nothing to sign up for" advantage.

## Not now

- Dynamic lighting, scripting and automation: that is a different product
  (Foundry and Roll20 territory), and the thing a minimal tool is chosen to avoid.
- Per-map link previews: tried in 0.6.1 to 0.6.3 and removed (see CLAUDE.md).

## How to choose

Start from the top and stop when it stops feeling quick. "Now" is about a
week of work for the whole section and changes how the app feels in the first
minute, which is where a new visitor decides. Pick one item from "Next" and one
from "Sessions" per release after that, and revisit the order whenever someone
actually uses it at a table.
