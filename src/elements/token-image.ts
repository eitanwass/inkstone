// ── Token images ───────────────────────────────────────────────
// A token's picture is a small data URL stored in the token itself (like its conditions), so it
// is saved, undone and synced with the rest of the map and needs no server. Pictures are cropped to
// a square and shrunk on the way in so a snapshot stays small.

const SIZE = 128;

// Decoded pictures by data URL. A picture that isn't ready yet draws as the plain disc, and the
// listener (set by main.ts, since this file sits below render.ts) repaints once it is.
const cache = new Map<string, HTMLImageElement>();
let onLoaded = () => {};

export function setImageLoadedListener(fn: () => void): void {
  onLoaded = fn;
}

export function imageFor(src: string): HTMLImageElement | null {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.onload = onLoaded;
    img.src = src;
    cache.set(src, img);
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
