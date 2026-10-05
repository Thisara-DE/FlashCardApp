import { useEffect, useRef } from 'react';

// Calls onLongPress when the pointer is held down for `delay` ms without moving more than
// `tolerance` px. Spread `handlers` onto the element.
//
// A browser still sends a click when a long press ends. Call consumeLongPress() first thing in
// onClick: it returns true (once) when that click belongs to a long press, so it can be ignored.
export function useLongPress(onLongPress, { delay = 400, tolerance = 8 } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);
  // The latest callback, so a timer started during an older render never calls a stale one.
  const onLongPressRef = useRef(onLongPress);

  useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  function cancelTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  // Don't leave a timer running after the element is gone.
  useEffect(() => cancelTimer, []);

  function onPointerDown(event) {
    // Only the main mouse button: holding the right button (for the context menu) should not select.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // A new press starts fresh, so a long press whose click never arrived can't swallow this one.
    firedRef.current = false;
    cancelTimer();
    startRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      onLongPressRef.current();
    }, delay);
  }

  function onPointerMove(event) {
    if (timerRef.current === null) return;
    const distance = Math.hypot(event.clientX - startRef.current.x, event.clientY - startRef.current.y);
    // Moving too far means the user is scrolling or dragging, not holding.
    if (distance > tolerance) cancelTimer();
  }

  // A key press is never part of a long press. The click that ends a hold can be swallowed
  // (dnd-kit does that after a drag), which leaves the flag set; without this, the next Enter or
  // Space on the still-focused element would be ignored once.
  function onKeyDown() {
    firedRef.current = false;
  }

  function consumeLongPress() {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  }

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancelTimer,
      onPointerLeave: cancelTimer,
      onPointerCancel: cancelTimer,
      onKeyDown,
    },
    consumeLongPress,
  };
}
