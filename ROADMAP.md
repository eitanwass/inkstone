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

- ~~**Keyboard shortcuts you'd expect.**~~
  - ~~Arrow keys nudge the selection by a cell~~
  - ~~Ctrl+A selects all~~
  - ~~`+` / `-` zoom~~
  - ~~Escape deselects.~~
- ~~**Shortcut cheat sheet.**~~
  - ~~`?` opens a small list of every shortcut.~~
- ~~**Zoom controls on-screen.**~~
  - ~~`+` / `-` and "fit map to screen".~~
- ~~**Undo for Clear All and other destructive actions.**~~
  - ~~A toast with an "Undo" button after Clear All and after deleting elements or a token.~~
- ~~**Saved-state feedback.**~~
  - ~~A quiet "Saved" mark so people trust that the map survives a reload.~~
- ~~**First-visit hint.**~~
  - ~~A welcome on an empty map, with an arrow to the shortcut list.~~

## Next: drawing speed and polish (S to M)

- ~~**Ruler / distance measuring** in cells and feet.~~
  - ~~Ruler tool (M): drag to measure, 5 ft a square, straight-line distance.~~
  - ~~A ruler on a shape's width and height shows while it is drawn or resized.~~
- ~~**Settings menu with a "Board" panel.**~~
  - ~~A gear button opens it; the Board panel sets the unit (feet, meters, squares) and how much one square is worth.~~
  - ~~A "D&D diagonal rules" toggle: the first diagonal counts as 1 square, the next as 2, and so on.~~
  - ~~More panels can be added later (see `src/settings/`).~~
- **Token polish** (M)
  - ~~Place tokens without a name dialog: a plain disc straight away.~~
  - ~~A card above the selected token, with a name field (`src/ui/token-card.ts`).~~
  - ~~Image on the token. Each picture is stored once, downscaled, and tokens point at it by id, so moving a token or saving the map never carries it; in a live session it goes over once.~~ (Still to do: offer pictures already used when choosing one.)
  - HP and AC in the card, as plain numbers everyone sees (hiding them from players needs roles).
  - ~~Color per token, in the card: the palette as swatches, and any color.~~
  - ~~Conditions (dead, prone, ...): badges on the token, set from its card or a right-click submenu, with your own in Settings.~~
  - ~~"Duplicate and increment" for packs of enemies ("Goblin 1, 2, 3").~~
- **Text and label styling** (S)
  - ~~Edit a label in place, and set its size and colour in a card beside it; the text tool places and opens a label in one click.~~
  - ~~Bold, italic and a background plate for labels, and for token names too (shared text code, ready for any element's text).~~
  - Font family. Text on any element (doors, and so on).
- **Layer controls** (M)
  - ~~Lock an element so a background room isn't dragged by accident: clicks pass through it, right-click it to unlock, a faded lock fades in on hover. From the right-click menus, for any selection.~~
  - ~~Send to back~~ (already in the element menu).
  - Not done: hiding elements (built, then taken out for now), named groups or layers, a lock shortcut.
- **Right-click and long-press menus reachable by keyboard** (known a11y gap). (M)
- **More stock shapes**: doors and windows on walls, circles, stairs, and a line
  with an arrow. Rooms and walls cover dungeons; doors are what people draw next. (M)


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

## Later: bigger bets (L)

- **Fog of war / hidden areas**: the main thing GMs ask a battle map for. Needs roles first (the GM sees everything, players
  don't), so it follows read-only links.
- **Dice roller** with shared roll history. Cheap to build, but players already
  have dice; do it only if it keeps people on the page.
- **Accounts and cloud-saved maps**: only if people ask for it. It brings storage
  and cost, and it ends the "nothing to sign up for" advantage.