# Roadmap

Direction: **get new people through the door and keep hosting free until players keep coming back.**
Inkstone's edge is that it already feels like a drawing tool (walls that erase cell by cell, resizable
tokens, rotation, multi-select, undo, PNG export, live co-editing) and needs no account. Everything
here runs in the browser or on the relay we already have, so none of it needs a database. Heavy
features (fog of war, accounts) come last, because they are expensive and only pay off once the
basics feel good.

Sizes: **S** is a day or less, **M** a few days, **L** a week or more.
Each item is meant to ship on its own. Done items are removed (see CHANGELOG.md).

## Now: a good first visit (S)

- **An example map to try.** A one-click "Open the example map" for someone who lands on an empty
  page, so they see what the editor can do. The home page's map (`scripts/build-home-map.mjs`) is
  already that map.
- **Know whether people come back.** Cloudflare Web Analytics (free, no cookies) or Vercel's own
  analytics. Decide on this before spending anything on hosting.
- **A way to reach us.** Make "Contact" in the menu a real page: a `mailto:` or a link to GitHub
  issues, and a "send feedback" link from the editor.
- **Watch the free tier.** The relay now hibernates when a table is idle, cursors send every 100 ms, and
  `CURSORS_OFF` in wrangler.toml switches them off (see CLAUDE.md). What is left is looking at the Durable
  Objects usage in the Cloudflare dashboard (requests, duration, storage reads) once real tables use it, and
  deciding then whether anything else needs trimming. Each wake reloads the whole room from storage, so a
  very busy room is the thing to watch.

## Next: what a GM expects (M to L)

- **Doors, windows and stairs on walls**, and a line with an arrow. Rooms and walls cover a dungeon;
  doors are what players draw next. A new element type, which `src/elements/` makes cheap. (M)
- **Several maps in the browser**: a map list with rename, duplicate, delete, and a switcher by the
  map's name. Today there is one map per browser, the biggest everyday gap. Local first, no account,
  one plain JSON entry per map (a map is about 8 KB, so hundreds fit). A shared map becomes one entry in
  the list. (L)
  - Move pictures to IndexedDB as binary: no 33% base64 overhead, far more room than localStorage's 5 MB,
    so the limits on a background picture (800,000 characters) and on token pictures (100) can rise.
- **View-only invite links**: a player can look but not touch. A light version of roles (a GM and
  everyone else), and the first step toward fog of war. The relay checks a flag; no new storage. (M)
- **Export options**: PNG with or without the grid, a transparent background, and a print layout at
  one-inch squares. (M)
- **HP and AC on a token**, as plain numbers everyone sees in its card (hiding them from other players
  needs roles). Then a turn-order tracker. (M)
- **Installable and offline**: a service worker, so a table at a convention with no wifi can still
  draw. The manifest is already there. (S)

## Polish (S to M)

- **Token pictures**: offer pictures already used when choosing one.
- **Text**: font family, and text on any element (doors, and so on). `src/elements/text.ts` is ready for it.
- **Layers**: hiding elements, named groups or layers, a lock shortcut.
- **Opening files and pictures**: drop a `.inkstone.json` file onto the page to open it, and drop or
  paste a picture onto the page to use it as the background.
- **Fit to grid**: scans that are skewed by a degree or more (needs a rotation search) and faint dot grids.

## Sessions: make live play smoother (S to M)

- **Sigil and color for players**: let a player shuffle their look (a stored seed, separate from their
  id) and pick their color, in Settings, Profile and from the list. (S)
- **Ping**: click-and-hold to flash a spot for everyone ("look here"). It can ride the cursors socket,
  so it needs no new connection. (S)
- **Follow a player**: click someone's sigil to jump the view to their cursor, or keep following it.
  Useful when the GM wants the table looking at one spot. (S)
- **Who changed what**: the relay already logs who sent each revision, so show it: a "last edited by" on
  the selected element, or a brief highlight on what someone else just changed. (M)

## Later: bigger bets (L)

- **Fog of war / hidden areas**: the main thing GMs ask a battle map for. Needs roles first (the GM sees
  everything, the other players don't), so it follows view-only links.
- **Hex grids and a no-grid mode**: needed for some systems and for scanned maps. Touches the grid, the
  measuring rules and snapping.
- **Only the GM runs the table.** Anyone at a table can move it between its maps, bring one and take one off
  today (`goto`, `addmap` and `dropmap` in `party/server.js`, and the Share popover and `bringToTable` in the
  client). With roles (see view-only links) the relay refuses those from anyone but the GM, and the controls only
  show for them. Also worth building: "Save to My Maps" for a map at the table (a player leaving a session keeps
  only the map on their board today, the table's other maps stay in the room), and rename, reorder and a thumbnail
  per map in the table's list.
- **Sharing in the library** (and the "Public creations" item in the home page menu): players sharing
  maps, models and tokens with each other. The library panel, its filters and its list format
  (`src/core/library.ts`) are built; what is missing is somewhere to keep what players share, and
  moderation. It waits until there are consistent players and a plan for the cost.
- **Library tags**: each item carries a few tags (`dungeon`, `tavern`, `wilderness`, a size...), shown on its card
  and as chips in the panel to filter by, several at once, alongside the search and the type. The panel's
  search and types are built; this adds `tags` to `LibraryItem` and `index.json`, a tag filter in
  `filterLibrary`, and the chips. (S)
- **More in the library**: more sample maps (add them in `scripts/sample-maps.mjs`), then models (a
  reusable group of elements, like a room with its furniture) and tokens, which turn the disabled
  "Models" and "Tokens" types on.
- **Dice roller** with shared roll history. Cheap to build, but players already have dice; do it only if
  it keeps players on the page.
- **Accounts and cloud-saved maps**: only if players ask for it. It brings storage and cost, and it ends
  the "nothing to sign up for" advantage.
