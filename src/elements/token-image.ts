// ── Token images ───────────────────────────────────────────────
// A token's picture is a small data URL kept once in the image store, here, under an id made from its
// content (see core/image-data.ts); the token holds only the id. The store lives in this browser
// (`inkstone-images`) and fills from files the person chooses and, in a live session, from the room,
// which keeps each picture once and sends it to whoever asks (see collab/collab.ts). Pictures are
// cropped to a square and shrunk on the way in so they stay small.

import { hashImage, isImageData } from '../core/image-data';
import { storageGet, storageSet } from '../core/storage';

const SIZE = 128;
const STORE_KEY = 'inkstone-images';
const MAX_IMAGES = 100; // the oldest go first; a token whose picture went just shows as a disc

const store = new Map<string, string>(); // id -> data URL, oldest first

const saved: unknown = (() => {
  try {
    return JSON.parse(storageGet(STORE_KEY) ?? '{}');
  } catch {
    return {};
  }
})();
if (typeof saved === 'object' && saved !== null) {
  for (const [id, data] of Object.entries(saved)) {
    if (isImageData(data) && hashImage(data) === id) store.set(id, data);
  }
}

const save = () => storageSet(STORE_KEY, JSON.stringify(Object.fromEntries(store)));

// Puts a picture in the store and returns its id (the same one if it was already there).
export function addImage(data: string): string {
  const id = hashImage(data);
  if (!store.has(id)) {
    store.set(id, data);
    while (store.size > MAX_IMAGES) store.delete(store.keys().next().value as string);
    save();
  }
  return id;
}

export const getImageData = (id: string): string | undefined => store.get(id);

// A picture that came from the room: kept only if it is what its id says, so a wrong one can't
// stand in for another. Returns whether it was kept.
export function receiveImage(id: string, data: unknown): boolean {
  if (!isImageData(data) || hashImage(data) !== id) return false;
  if (!store.has(id)) {
    store.set(id, data);
    save();
  }
  onLoaded();
  return true;
}

// Decoded pictures by id. A picture that isn't ready yet (or isn't here yet) draws as the plain disc,
// and the listener (set by main.ts, since this file sits below render.ts) repaints once it is.
const decoded = new Map<string, HTMLImageElement>();
let onLoaded = () => {};

export function setImageLoadedListener(fn: () => void): void {
  onLoaded = fn;
}

export function imageFor(id: string): HTMLImageElement | null {
  let img = decoded.get(id);
  if (!img) {
    const data = store.get(id);
    if (!data) return null;
    img = new Image();
    img.onload = onLoaded;
    img.src = data;
    decoded.set(id, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// The file's centre square at SIZE px, as a data URL. Rejects if the browser can't read the file
// as a picture (so an SVG, or something that isn't an image at all, is refused).
export async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas
    .getContext('2d')
    ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85); // Safari has no webp
}
