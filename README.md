# Inkstone

A battle-map editor for tabletop RPGs. Sketch rooms and walls on a grid, drop
named tokens, label things, and share the map live with the rest of your table.
It runs entirely in the browser, with no account, and your map is saved in the
browser as you work.

## Features

- Draw rooms and walls on a snapping grid, with resize and rotate handles.
- Tokens in whole-cell sizes (Medium, Large, Huge…) with names, plus text labels.
- An eraser that clips walls cell by cell instead of deleting the whole wall.
- Name your map (click the title at the top); the name shows in the tab, names the exported PNG, and is shared with everyone in a live session.
- A ruler (M) that measures in feet, and sizes shown as you draw shapes.
- Select, move, copy, paste, duplicate and reorder; undo and redo.
- Export the map as a PNG.
- Live co-editing: share a link and everyone edits the same map.
- Works with touch: pinch to zoom, two fingers to pan, long-press for the menu.
- Keyboard-friendly chrome with labelled controls and focus-managed dialogs.

## Getting started

You need Node 22 or newer.

```sh
npm install
npm run dev      # http://localhost:5173
```

## Using the editor

| Key | Action |
|---|---|
| `V` `R` `W` `T` `L` `E` | Select, Room, Wall, Token, Label, Erase |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + C` / `V` / `D` | Copy, paste at the cursor, duplicate |
| `Delete` / `Backspace` | Delete the selection |
| `Home` | Reset the view |
| `Esc` | Cancel what you're doing and clear the selection |
| Mouse wheel | Zoom toward the cursor |
| Middle-drag or `Alt` + drag | Pan |
| `Shift` while rotating | Rotate freely instead of in 15° steps |

Right-click (or long-press on a touch screen) an element for copy, duplicate,
delete and ordering, or a token for rename and recolor. Right-click empty space
to paste.

### Sharing a map

**Share** creates a session and puts its code in the URL; send the link to
others. **Join** takes a code or a full link. Everyone's edits go to the same
map. It is last-write-wins: two people changing the *same* element at the same
instant is resolved by whoever's change arrives last. If your connection drops,
the status shows "Reconnecting…", and anything you changed while offline is
replaced by the shared map when you're back (you'll be told).

## Live sessions need the relay

Sharing goes through a small relay (a Cloudflare Worker with a Durable Object,
in [party/](party/)). Locally:

```sh
npm run party:dev   # relay on localhost:8787, which the app uses by default
```

To use sessions on a deployed site, deploy the relay to your own Cloudflare
account and point the build at it. A production build without
`VITE_RELAY_HOST` has sharing switched off (Share and Join say so) instead of
trying to reach a relay on the visitor's own machine:

```sh
npm run party:deploy               # needs CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN in .env
# then build the app with the relay's host:
VITE_RELAY_HOST=your-worker.your-subdomain.workers.dev npm run build
```

See [.env.example](.env.example).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck, then production bundle in `dist/` |
| `npm run preview` | Serve the production bundle |
| `npm test` | Unit tests, then end-to-end tests |
| `npm run test:unit` | Vitest unit tests ([tests/unit/](tests/unit/)) |
| `npm run test:e2e` | Playwright tests that drive the real UI ([tests/](tests/)) |
| `npm run typecheck` | `tsc` in strict mode |
| `npm run lint` / `npm run format` | Biome: check / fix |
| `npm run check:changelog` | Fails if CHANGELOG.md doesn't cover the current version |
| `npm run build:og` | Regenerates the link-preview image `public/og-image.png` from [design/share-preview/](design/share-preview/) |
| `npm run build:icons` | Regenerates the favicon and app icons in `public/` from the SVGs in [design/logo/](design/logo/) |

## Releasing

The site redeploys only when the version in `package.json` changes. To release:

1. Bump the version: `npm version patch|minor --no-git-tag-version`.
2. Add a matching `## <version> - <date>` section to the top of
   [CHANGELOG.md](CHANGELOG.md), written for people using the editor. The app
   shows this file in its "What's new" panel, and CI fails if it's missing.
3. Push to `master`.

How the version gate works on Vercel is described in
[CLAUDE.md](CLAUDE.md#releasing).

## Contributing

The look of the app (logo, colours, type, tone) is described in [design/DESIGN.md](design/DESIGN.md),
with a visual version in [design/style-guide.html](design/style-guide.html).

It's vanilla TypeScript with Vite: no framework, one shared `state` object, and
small single-purpose modules. [CLAUDE.md](CLAUDE.md) has the architecture, the
module map, and the conventions (how to add an element type, how undo, saving
and live sync fit together). Before opening a PR, `npm run lint`,
`npm run typecheck` and `npm test` should pass; CI runs the same.
