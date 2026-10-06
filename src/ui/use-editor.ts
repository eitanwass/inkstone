// ── The bridge between the editor and the components ───────────
// The editor's state (`state`) is changed in place and `drawMain()` is told afterwards, so there is
// nothing for a component to subscribe to except that signal. This hook makes a component draw itself
// again after every redraw of the map, and gives it a function to ask for a draw by hand (for a change
// that doesn't redraw the map). The component then reads whatever it needs straight from `state`.

import { useEffect, useReducer } from 'preact/hooks';
import { onMainDrawn } from '../draw/render';

export function useEditorRedraw(): () => void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onMainDrawn(() => bump(0)), []);
  return () => bump(0);
}
