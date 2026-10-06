// ── Putting a map on the board ─────────────────────────────────
// What opening a map file and opening a map from the library have in common: the map replaces the
// one on the board as one undo step (with an Undo toast), its token pictures go into the image store,
// which checks them, and its name becomes the map's.

import type { MapFile } from '../core/map-file';
import { state } from '../core/state';
import { drawMain } from '../draw/render';
import { receiveImage } from '../elements/token-image';
import { persistMapName, pushHistory, showUndoToast } from '../input/history';
import { refreshMapName } from './map-name';
import { normalizeMapName } from './map-name-text';

export function openMap(map: MapFile, message: string): void {
  for (const [id, data] of Object.entries(map.images)) receiveImage(id, data);
  state.elements = map.elements;
  state.selected = [];
  state.mapName = normalizeMapName(map.name);
  persistMapName();
  refreshMapName();
  drawMain();
  pushHistory();
  showUndoToast(message);
}
