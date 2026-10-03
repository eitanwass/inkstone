# Changelog

Newest first. Each release is a `## version - date` heading followed by bullets
written for people using the editor; a bullet can wrap onto indented lines. The
top entry must match the version in package.json (`npm run check:changelog`
enforces it), and the app shows this file in its "What's new" panel.

## 0.3.0 - 2026-10-03

- New "What's new" button in the top-right panel lists what changed in each
  version. A small dot shows when there's a version you haven't looked at yet.
- Under the hood: the site now redeploys only when the version number changes.

## 0.2.1 - 2026-10-03

- Fixed Ctrl+Shift+Z not redoing; it now works alongside Ctrl+Y.
- Under the hood: the token and text dialogs share one implementation.

## 0.2.0 - 2026-10-03

- A damaged saved map, or a bad message from a shared session, can no longer
  break the editor. Anything that isn't a valid map element is skipped.
- Under the hood: the code is now TypeScript, with linting and type checks on
  every change.

## 0.1.0 - 2026-06-28

- Draw rooms and walls on a grid, with resize and rotate handles.
- Place named tokens in different sizes, and add text labels.
- Erase tool that clips walls cell by cell.
- Select, move, copy, paste, duplicate, and reorder elements.
- Undo and redo, with your map saved automatically.
- Export the map as a PNG.
- Share a live session so others can edit the same map.
- Touch controls: pinch to zoom, two fingers to pan, long-press for the menu.
