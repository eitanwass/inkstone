// ── The token card's image ─────────────────────────────────────
// A picture in the disc: chosen from a file, cropped and shrunk, kept as one undo step.

import { byId } from '../core/dom';
import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { addImage, getImageData, shrinkImage } from '../elements/token-image';
import { pushHistory } from '../input/history';
import { showToast } from './toast';
import { cardToken } from './token-target';

const imageFile = byId<HTMLInputElement>('token-image-file');
const imagePick = byId<HTMLButtonElement>('token-image-pick');
const imageRemove = byId<HTMLButtonElement>('token-image-remove');
const imagePreview = byId<HTMLImageElement>('token-image-preview');

export function showImage(token: TokenElement): void {
  // A picture that hasn't reached us yet (it is being fetched from the room) isn't shown.
  const data = token.image ? getImageData(token.image) : undefined;
  imagePreview.hidden = imageRemove.hidden = !data;
  imagePick.classList.toggle('has-image', !!data);
  imagePick.setAttribute('aria-label', data ? 'Change image' : 'Add image');
  if (data && imagePreview.getAttribute('src') !== data) imagePreview.src = data;
}

function setImage(token: TokenElement, data: string | undefined): void {
  if (!state.elements.includes(token)) return; // gone while the file was being read
  token.image = data && addImage(data);
  drawMain();
  pushHistory();
}

imagePick.addEventListener('click', () => imageFile.click());
imageRemove.addEventListener('click', () => {
  const token = cardToken();
  if (token) setImage(token, undefined);
});
imageFile.addEventListener('change', async () => {
  const token = cardToken();
  const file = imageFile.files?.[0];
  imageFile.value = ''; // so choosing the same file again still counts
  if (!token || !file) return;
  try {
    setImage(token, await shrinkImage(file));
  } catch {
    showToast("Couldn't read that image");
  }
});
