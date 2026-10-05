# Changelog

## 0.6.8 - 2026-10-05

- Tokens can have a picture. Click a token, then "+ Add" under Image in its card
  and choose a file; it is cropped to a square and shown inside the token, with
  the token's color as its outline. Click the picture to change it, or the red
  X beside it to remove it. Pictures are shared with everyone in a live session.

## 0.6.7 - 2026-10-04

- Conditions on tokens: Prone, Poisoned, Stunned and the rest of the fifteen
  from the rules, plus Dead. They show as small badges on the token (three, then
  a count), and a dead token is greyed and crossed out. Hover a token to read
  its conditions by name.
- Give a token conditions from the card above it, or right-click it and choose
  Conditions. Make your own in Settings, under Conditions: a name, a color and
  an icon.
- Tokens are placed without asking for a name. Click a token to open its card
  and give it a name and a color. Enter or double-click also starts the name.
- Duplicating a token with a number at the end of its name numbers the copy on:
  "Goblin 1" becomes "Goblin 2". Duplicate is also in the token's menu.

## 0.6.6 - 2026-10-03

- A ruler to measure distances (press M, or use the ruler in the tool bar).
  Drag between two points to see how far it is, in feet.
- Rooms, walls and tokens now show their size as you draw or resize them: a
  ruler along a room's width and another along its height, and the length of a
  wall.
- A settings menu, behind the gear button at the top right. Its Board panel
  sets the unit (feet, meters or squares) and how much one square is worth.
- Diagonals are counted the D&D way: the first diagonal square is 1, the next
  is 2, then 1, 2 and so on. Turn that off in the settings to measure the
  straight line instead.

## 0.6.5 - 2026-10-03

- Keyboard shortcuts: arrow keys move the selection one cell, Ctrl+A selects
  everything, + and - zoom, and F fits the whole map on screen. Press ? (or use
  the ? button, bottom-right) to see them all.
- Zoom buttons, bottom-left: zoom in, zoom out, and fit the map to the screen.
- After clearing the map or deleting something, an Undo button appears.
- A small indicator next to the Live badge shows when your map is saving,
  saved, or could not be saved.
- A new map now greets you with a short hint on how to start. The welcome
  messages at the top are gone.

## 0.6.4 - 2026-10-03

- Name your map: click the title at the top of the page. The name shows in the
  browser tab, names exported images, and is shared with everyone on a live map.

## 0.5.0 - 2026-10-03

- New logo and favicon, and new type: Inter throughout, with the name set in
  Garamond.
- Links to Inkstone now show a preview card in chats.
- Fixed the stroke and fill panel being cut off on smaller windows.

## 0.4.2 - 2026-10-03

- "What's new" now opens as a large dialog in the middle of the screen, with the
  page blurred behind it. Close it with the × button, Escape, or a click outside.

## 0.4.1 - 2026-10-03

- Fixed: on the live site, Share no longer makes Chrome ask to access apps and
  services on your device. Sharing now says clearly when it isn't set up.

## 0.4.0 - 2026-10-03

- A red "Live" indicator appears in the top-right while your map is shared. It
  switches to "Reconnecting…" if the connection drops.
- When a shared session reconnects you're told, including when changes you made
  while offline were replaced by the shared map.
- Rename tokens in an in-app dialog instead of the browser's pop-up.
- You're warned if your browser can't save the map.
- Accessibility: every control is labelled, dialogs handle keyboard focus,
  text is easier to read, and you can zoom the page.
- Custom colors you saved before carry over.
- Under the hood: security updates to the development tools, plus a README.

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
