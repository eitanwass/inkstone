// ── The token card's image ─────────────────────────────────────
// A picture in the disc: chosen from a file, cropped and shrunk, kept as one undo step.

import { useRef } from 'preact/hooks';
import { state } from '../core/state';
import type { TokenElement } from '../core/types';
import { drawMain } from '../draw/render';
import { addImage, getImageData, shrinkImage } from '../elements/token-image';
import { pushHistory } from '../input/history';
import { showToast } from './toast';

function setImage(token: TokenElement, data: string | undefined): void {
  if (!state.elements.includes(token)) return; // gone while the file was being read
  token.image = data && addImage(data);
  drawMain();
  pushHistory();
}

export function TokenImage({ token }: { token: TokenElement }) {
  const file = useRef<HTMLInputElement>(null);
  // A picture that hasn't reached us yet (it is being fetched from the room) isn't shown.
  const data = token.image ? getImageData(token.image) : undefined;

  return (
    <div id="token-image" role="group" aria-label="Token image">
      <span class="tc-label">Image</span>
      <button
        type="button"
        id="token-image-pick"
        class={`tc-add${data ? ' has-image' : ''}`}
        aria-label={data ? 'Change image' : 'Add image'}
        onClick={() => file.current?.click()}
      >
        <span id="token-image-text">+ Add</span>
        <img id="token-image-preview" alt="" hidden={!data} src={data} />
        <svg class="tc-pencil" width="14" height="14" aria-hidden="true">
          <use href="/icons.svg#icon-edit" />
        </svg>
      </button>
      <button
        type="button"
        id="token-image-remove"
        class="tc-remove"
        aria-label="Remove image"
        title="Remove image"
        hidden={!data}
        onClick={() => setImage(token, undefined)}
      >
        <svg width="10" height="10" aria-hidden="true">
          <use href="/icons.svg#icon-close" />
        </svg>
      </button>
      <input
        type="file"
        id="token-image-file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        ref={file}
        onChange={async (e) => {
          const picked = e.currentTarget.files?.[0];
          e.currentTarget.value = ''; // so choosing the same file again still counts
          if (!picked) return;
          try {
            setImage(token, await shrinkImage(picked));
          } catch {
            showToast("Couldn't read that image");
          }
        }}
      />
    </div>
  );
}
