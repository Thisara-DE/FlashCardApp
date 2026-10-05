import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLongPress } from './useLongPress.js';

function setup() {
  const onLongPress = vi.fn();
  const { result } = renderHook(() => useLongPress(onLongPress));
  // Read through result.current each time, so the test always uses the latest render's handlers.
  const handlers = () => result.current.handlers;
  return { onLongPress, handlers, result };
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after 400 ms of holding', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire at 399 ms', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(399));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores a held right (or middle) mouse button', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ pointerType: 'mouse', button: 2, clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('fires for a held primary mouse button', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire if the pointer moves more than 8 px', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => handlers().onPointerMove({ clientX: 19, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('still fires after moving exactly 8 px', () => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => handlers().onPointerMove({ clientX: 10, clientY: 18 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it.each(['onPointerUp', 'onPointerLeave', 'onPointerCancel'])('does not fire after %s at 200 ms', (name) => {
    const { onLongPress, handlers } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(200));
    act(() => handlers()[name]({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('consumeLongPress() is true once after a long press, then false', () => {
    const { handlers, result } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));
    act(() => handlers().onPointerUp({ clientX: 10, clientY: 10 }));

    expect(result.current.consumeLongPress()).toBe(true);
    expect(result.current.consumeLongPress()).toBe(false);
  });

  it('consumeLongPress() is false after a short press', () => {
    const { handlers, result } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(100));
    act(() => handlers().onPointerUp({ clientX: 10, clientY: 10 }));

    expect(result.current.consumeLongPress()).toBe(false);
  });

  it('clears the flag on the next pointer down, so a lost click cannot swallow a later one', () => {
    const { handlers, result } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));
    act(() => handlers().onPointerUp({ clientX: 10, clientY: 10 }));
    // No click arrived for that long press. The next press is a short one.
    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => handlers().onPointerUp({ clientX: 10, clientY: 10 }));

    expect(result.current.consumeLongPress()).toBe(false);
  });

  it('clears the flag on a key press, so a lost click cannot swallow a keyboard click', () => {
    const { handlers, result } = setup();

    act(() => handlers().onPointerDown({ clientX: 10, clientY: 10 }));
    act(() => vi.advanceTimersByTime(400));
    act(() => handlers().onPointerUp({ clientX: 10, clientY: 10 }));
    // No click arrived for that long press. Then Enter is pressed on the focused element.
    act(() => handlers().onKeyDown({ key: 'Enter' }));

    expect(result.current.consumeLongPress()).toBe(false);
  });
});
