// ── Token images ───────────────────────────────────────────────
// A token's picture is a small data URL kept once in the image store, here, under an id made from its
// content (see core/image-data.ts); the token holds only the id. The store lives in this browser
// (`inkstone-images`) and fills from files the player chooses and, in a live session, from the room,
// which keeps each picture once and sends it to whoever asks (see collab/collab.ts). Pictures are
// cropped to a square and shrunk on the way in so they stay small.

import { hashImage, isImageData, MAX_IMAGE_LENGTH } from '../core/image-data';
import { storageGet, storageSet } from '../core/storage';
import type { BoardElement } from '../core/types';

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

let lastSaveWorked = true;
const save = () => {
  lastSaveWorked = storageSet(STORE_KEY, JSON.stringify(Object.fromEntries(store)));
};

// Whether the last picture added could be kept in this browser (its storage may be full: a big picture
// on the map takes much more room than a token's).
export const imagesSaved = (): boolean => lastSaveWorked;

// The id of the picture an element shows, if it has one (a token's disc, or a picture on the map).
export function pictureOf(el: BoardElement): string | undefined {
  return el.type === 'token' || el.type === 'background' ? el.image : undefined;
}

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

// A picture for the map, as a data URL that fits the limit: the file at up to MAP_PICTURE_SIDE px on its long
// side, as webp (jpeg where the browser has no webp), made smaller in quality and then in size until it
// fits. Also its size in pixels, so it can be placed in proportion. Rejects if the browser can't read the
// file as a picture, or it can't be made small enough.
const MAP_PICTURE_SIDE = 2048;
const MAP_PICTURE_TARGET = MAX_IMAGE_LENGTH - 100_000; // some room under the limit

export async function shrinkPicture(file: File): Promise<{ data: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, MAP_PICTURE_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 8; round++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.85, 0.7, 0.55]) {
        const webp = canvas.toDataURL('image/webp', quality);
        const data = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
        if (data.length <= MAP_PICTURE_TARGET) return { data, width, height };
      }
      scale *= 0.75;
    }
    throw new Error('picture too large');
  } finally {
    bitmap.close();
  }
}
