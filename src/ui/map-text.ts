// ── The map on the board, as the text of a map file ────────────
// What Save to a file writes, and what the feedback form attaches when a player chooses to: the map's name, its
// elements and (unless left out) the pictures its tokens and background use (core/map-file.ts).

import { serializeMap } from '../core/map-file';
import { state } from '../core/state';
import { getImageData, pictureOf } from '../elements/token-image';

export function currentMapText(withPictures = true): string {
  const images: Record<string, string> = {};
  if (withPictures) {
    for (const el of state.elements) {
      const id = pictureOf(el);
      const data = id ? getImageData(id) : undefined;
      if (id && data) images[id] = data;
    }
  }
  return serializeMap({ name: state.mapName, elements: state.elements, images });
}
