// ── Touch gestures and long-press ──────────────────────────────
// The touch-only half of pointer handling. A second finger turns whatever
// single-pointer action was in flight into a pinch-zoom/pan gesture, and a
// held finger stands in for the right-click context menu (touch has no
// second button). Each on* function returns true when it consumed the event,
// so pointer.js knows to skip its normal tool handling.

import { iCanvas } from '../core/canvas';
import { clampZoom, dist } from '../core/geometry';
import { cancelInProgressDrag, state } from '../core/state';
import type { Point } from '../core/types';
import { drawMain, setView } from '../draw/render';
import { openContextMenuAt, suppressNativeContextMenu } from '../ui/context-menu';

// pointerId -> last known {x, y} in screen (client) coordinates.
const activePointers = new Map<number, Point>();
// Set once a 2nd touch lands; holds the pinch/pan gesture's starting frame
// so each move can be computed as a delta from gesture start rather than
// drifting frame-to-frame.
interface Gesture {
  startDist: number;
  startMid: Point;
  startZoom: number;
  startPanX: number;
  startPanY: number;
}
let gesture: Gesture | null = null;

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10; // screen px before a hold becomes a drag instead
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressPointerId: number | null = null;
let longPressStartScreen: Point | null = null;
// The pointerId a long-press already fired for, so its eventual pointerup
// doesn't also commit whatever tool action was in flight underneath it.
let longPressFiredFor: number | null = null;

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressPointerId = null;
}

// Call when a touch press starts a tool action; opens the context menu if
// the finger stays put.
export function armLongPress(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  // The text tool opens its placement dialog synchronously on pointerdown —
  // a long-press menu popping up over that modal 500ms later would be more
  // confusing than useful, so it's the one tool that opts out.
  if (state.tool === 'text') return;
  longPressPointerId = e.pointerId;
  const pressStart = { x: e.clientX, y: e.clientY };
  longPressStartScreen = pressStart;
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    if (gesture || activePointers.size >= 2) return; // a 2nd finger arrived; that's a pinch, not a hold
    longPressFiredFor = longPressPointerId;
    longPressPointerId = null;
    cancelInProgressDrag();
    drawMain();
    suppressNativeContextMenu();
    openContextMenuAt(pressStart.x, pressStart.y);
  }, LONG_PRESS_MS);
}

function startGesture() {
  const [p0, p1] = [...activePointers.values()];
  gesture = {
    startDist: dist(p0.x, p0.y, p1.x, p1.y),
    startMid: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 },
    startZoom: state.zoom,
    startPanX: state.panX,
    startPanY: state.panY,
  };
  iCanvas.style.cursor = '';
}

function updateGesture(gesture: Gesture): void {
  const [p0, p1] = [...activePointers.values()];
  const newDist = dist(p0.x, p0.y, p1.x, p1.y);
  const newMid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

  const scale = gesture.startDist > 0 ? newDist / gesture.startDist : 1;
  const newZoom = clampZoom(gesture.startZoom * scale);

  // The world point that sat under the gesture's starting midpoint stays
  // under the current midpoint as it zooms+pans together (so a two-finger
  // drag pans, and pinching zooms around wherever the fingers landed).
  const wx = (gesture.startMid.x - gesture.startPanX) / gesture.startZoom;
  const wy = (gesture.startMid.y - gesture.startPanY) / gesture.startZoom;

  setView(newMid.x - wx * newZoom, newMid.y - wy * newZoom, newZoom);
}

export function onTouchDown(e: PointerEvent): boolean {
  if (e.pointerType === 'touch') {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      cancelLongPress();
      cancelInProgressDrag();
      startGesture();
      drawMain();
      return true;
    }

    if (activePointers.size > 2) return true; // 3rd+ finger: stay in the existing gesture
  }

  return gesture !== null; // stray event mid-gesture
}

export function onTouchMove(e: PointerEvent): boolean {
  if (e.pointerType !== 'touch' || !activePointers.has(e.pointerId)) return false;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (gesture) {
    if (activePointers.size >= 2) updateGesture(gesture);
    return true;
  }

  if (longPressPointerId === e.pointerId && longPressStartScreen) {
    const moved = dist(e.clientX, e.clientY, longPressStartScreen.x, longPressStartScreen.y);
    if (moved > LONG_PRESS_MOVE_TOLERANCE) cancelLongPress();
  }
  return false;
}

export function onTouchUp(e: PointerEvent): boolean {
  if (e.pointerType !== 'touch') return false;
  activePointers.delete(e.pointerId);
  if (longPressPointerId === e.pointerId) cancelLongPress();

  if (gesture) {
    if (activePointers.size < 2) gesture = null;
    return true;
  }

  if (longPressFiredFor === e.pointerId) {
    longPressFiredFor = null;
    return true; // consumed by the long-press menu; don't also commit a draw
  }
  return false;
}

export function onTouchCancel(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  activePointers.delete(e.pointerId);
  if (longPressPointerId === e.pointerId) cancelLongPress();
  if (activePointers.size < 2) gesture = null;
}
