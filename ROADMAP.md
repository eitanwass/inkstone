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
  - ~~A quiet "Saved" mark so players trust that the map survives a reload.~~
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
  - HP and AC in the card, as plain numbers everyone sees (hiding them from other players needs roles).
  - ~~Color per token, in the card: the palette as swatches, and any color.~~
  - ~~Conditions (dead, prone, ...): badges on the token, set from its card or a right-click submenu, with your own in Settings.~~
  - ~~"Duplicate and increment" for packs of enemies ("Goblin 1, 2, 3").~~
- **Text and label styling** (S)
  - ~~Edit a label in place, and set its size and colour in a card beside it; the text tool places and opens a label in one click.~~
  - ~~Bold, italic and a background plate for labels, and for token names too (shared text code, ready for any element's text).~~
  - Font family. Text on any element (doors, and so on).
- **Layer controls** (M)
  - ~~Lock an element so a background room isn't dragged by accident: clicks pass through it, right-click it to unlock, a faded lock fades in on hover. From the right-click menus, for any selection.~~
  - ~~Send to back~~
  - Hiding elements, named groups or layers, a lock shortcut.
- **More stock shapes**: doors and windows on walls, circles, stairs, and a line
  with an arrow. Rooms and walls cover dungeons; doors are what players draw next. (M)

## Then: working with more than one map (M to L)

- **Several maps in the browser**: a map list with rename, duplicate, delete. This is
  the biggest everyday gap: today there is one map per browser. Local first,
  no account. (L)
- ~~**Save to / open from a file** (JSON). Backup, moving between devices, sharing a
  map by email. Also the escape hatch for the no-account approach.~~
  - Still to do: drop a file onto the page to open it. (S)
- ~~**Import an image as a background** (a scanned or downloaded map to draw over).~~
  - ~~Right-click the map: "Add image…" (drawn behind the grid dots) and a background colour. An Adjust image panel with opacity, width in squares and moving and resizing on the map (Shift snaps to the grid), shared with the session.~~
  - ~~**Fit it to the grid automatically**: a "Fit to grid" button in the Adjust image panel finds the scan's own squares (measured across and down separately, since generated maps often have squares that are not square) and sizes and moves the picture so they are ours.~~
    - Still to do: a scan that is skewed by a degree or more (needs a rotation search), and faint dot grids. (S)
  - Drop or paste a picture onto the page, and keep big pictures in IndexedDB instead of the small localStorage. (M)
- **Export options**: PNG with or without grid, transparent background, print
  layout at one-inch squares. (M)

## Sessions: make live play smoother (M to L)

- ~~**See who's here**~~
  - ~~The Live pill shows how many are connected, with a round sigil for each player under it (made from their id, in the logo's compass style).~~
  - ~~Everyone's cursors live, on their own socket and relay so they never slow down map changes.~~
- ~~**Fix the rename overwrite.** A rename is its own change and never carries the map.~~
- ~~**Names for players.**~~
  - ~~"Who's at the table?" before first joining or sharing, with a fantasy name suggested and a shuffle; no skip. Change it later in Settings, Profile. Names show on hover in the list and by each cursor.~~
- **Sigil and colour for players** (S): let a player shuffle their look (a stored seed, separate from
  their id) and pick their colour, in Settings, Profile and from the list.
- **Ping**: click-and-hold to flash a spot for everyone ("look here"). It can ride the
  cursors socket, so it needs no new connection. (S)
- **Follow a player**: click someone's sigil to jump the view to their cursor, or keep following
  it. Useful when the GM wants the table looking at one spot. (S)
- **Who changed what**: the relay already logs who sent each revision, so show it: a "last edited
  by" on the selected element, or a brief highlight on what someone else just changed. (M)
- **Presenter / read-only link**: a view-only invite so a player can't move
  things by accident. A light version of roles: a GM and everyone else. (M)

## Later: bigger bets (L)

- **Fog of war / hidden areas**: the main thing GMs ask a battle map for. Needs roles first (the GM sees everything, the other
  players don't), so it follows read-only links.
- **Dice roller** with shared roll history. Cheap to build, but players already
  have dice; do it only if it keeps players on the page.
- **Accounts and cloud-saved maps**: only if players ask for it. It brings storage
  and cost, and it ends the "nothing to sign up for" advantage.