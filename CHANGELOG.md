# Changelog

## 0.9.1 - 2026-10-06

- Dragging a token now leaves a faded ghost where it started, with a line to where it would
  land and the distance between the two.

## 0.9.0 - 2026-10-05

- Fit to grid: a new button in the Adjust image panel finds the squares printed on a
  scanned or downloaded map and sizes and moves the picture so they line up with the
  grid. If the picture's squares are wider than tall (common with generated maps), it is
  stretched until they are square. If no grid is found, nothing changes and you are told.
- The Adjust image panel is easier to read: the controls are in the order you use them
  (rotate, size, opacity), with Replace, Remove and Done below, and the keys that work on
  the map are listed beside them.
- Fixed resizing a background image after it has been rotated, which made it jump or
  stretch when a corner was dragged.

## 0.8.1 - 2026-10-05

- Rotate a background image by 90 degrees when it is the wrong way round: the Adjust image
  panel has new buttons for turning it left or right, about its middle.

## 0.8.0 - 2026-10-05

- Give your map a background: right-click the empty map and choose "Add image…" to put a
  scanned or downloaded map behind the grid, or pick a background color. A new image opens
  an Adjust image panel to drag it into place, resize it from its corners, set its opacity
  and type how many squares wide it is. Hold Shift while dragging to snap to the grid, and
  use the arrow keys to nudge it a pixel at a time.
- The background stays out of your way while you draw: you can't select, move or erase it by
  accident. Right-click the map to replace, adjust or remove the image.
- Everyone in a shared map sees the background, and it is saved with the map and in map files.

## 0.7.1 - 2026-10-05

- Choose your name before joining a shared map: a window asks "Who's at the table?" with a
  fantasy name already filled in (like "Crimson Owl") and a shuffle button for another. It only
  asks once; after that your name is remembered in this browser.
- Hover over a player's icon to see their name, and see it beside their cursor too.
- Change your name any time in Settings, under the new Profile tab.
- Settings now say "Saved" for a moment whenever a change is kept.

## 0.7.0 - 2026-10-05

- See everyone's pointers live in a shared map: each player's cursor appears as an
  arrow in their own colour with their name, and moves smoothly as they move it. It
  disappears when they leave the map or disconnect.

## 0.6.15 - 2026-10-05

- In a shared map you can now see who is here: the "Live" pill shows how many players
  are connected, and each player gets a round sigil under it (yours has a gold ring).
  Hover one to see the name. If there are more than eight, the rest are counted as "+N".
- The top panel is now wider, so on screens up to 1100px wide the map's name sits in
  its own row below it instead of beside it.

## 0.6.14 - 2026-10-05

- Save your map to a file and open it again: two new buttons in the top-right panel.
  The file keeps the map's name, everything on it and token pictures, so you can back
  a map up, move it to another device or send it to someone. Opening a file replaces
  the map on screen, and Undo brings the old one back.

## 0.6.13 - 2026-10-05

- Lock an element so it stays put: right-click it and choose Lock, and a background
  room can no longer be dragged by accident. Clicks, selecting, erasing and Select All
  all pass through a locked element to what is under it. Hover over a locked element
  and a faded lock fades in on its corner; right-click it to unlock.
- A new, clearer eraser icon, and redrawn label and wall icons to match the rest.

## 0.6.12 - 2026-10-05

- Bold, italic and a background plate for labels. Select a label and use the three
  buttons in its card; the plate is dark behind light text and light behind dark
  text, so a label reads over a busy map. The next label you place starts with the
  style you last used.
- Token names can be bold, italic or on a plate too, from the buttons in the token's
  card.

## 0.6.11 - 2026-10-05

- Labels are easier to work with. Double-click a label (or select it and press Enter, or
  right-click it and choose Edit Text) to change its text right where it is, with no
  dialog. Select a label and a small card appears next to it with a size slider and
  its color.
- The text tool is quicker. Click to place a label and type straight away, with its
  card beside it; click an existing label to edit it; or drag an area and its height
  becomes the font size. A label with no text is never added. The toolbar no longer
  shows stroke and font for the text tool: they are in the label's card, and the next
  label starts with the size and color you last used.

## 0.6.10 - 2026-10-05

- Token pictures are lighter. A picture is now stored once, however many tokens use
  it, so moving, copying and undoing a token no longer carries it around, and the
  map saves and shares faster.
- In a live session each picture is sent once, and anyone who joins asks for the
  ones they are missing. Maps saved with pictures in an earlier version are
  converted when they load.

## 0.6.9 - 2026-10-05

- Shared maps are kept for a week after the last player leaves, so you can open the
  link again later and find the map as it was. Opening the link counts as a visit
  and keeps it another week.
- Live sessions are steadier. Two players editing different things at once no
  longer overwrite each other, renaming the map never overwrites anyone's drawing,
  and an undo only undoes your own edits, keeping what others did.
- If your connection drops and comes back, you catch up with what changed while
  you were away and your own changes made in the meantime are kept. If someone
  else changed the same thing first, their version wins and you are told.

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
