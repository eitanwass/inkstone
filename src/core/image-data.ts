// ── Token pictures, as data ─────────────────────────────────────
// A token's picture is a small data URL kept once in the image store (elements/token-image.ts), under
// an id made from its content; the token holds only the id. That way moving a token, undoing, saving
// and syncing never carry the picture, and two tokens with the same picture share it.
//
// Pure, so it is unit tested. The relay keeps its own copy of the check.

// A picture must be a small raster data URL. Anyone in a session can send one, so SVG (which can
// carry script) and anything large are refused.
export const MAX_IMAGE_LENGTH = 100_000;

export const isImageData = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= MAX_IMAGE_LENGTH &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v);

// The picture's id: a 53-bit hash of its text (cyrb53), in hex. The same picture always gets the same
// id, so the room and every client agree on it, and a picture that arrives under the wrong id is
// recognised. Not for secrecy: it only has to tell pictures apart.
export function hashImage(data: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
