import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePileDrag } from './usePileDrag.js';

// What dnd-kit passes to onDragEnd: `over` is the droppable under the pointer, or null.
function overTab(pileId) {
  return { over: { id: `pile-${pileId}`, data: { current: { pileId, name: 'Some pile' } } } };
}

function setup(props = {}) {
  const onPickUp = vi.fn();
  const onDrop = vi.fn();
  const allProps = { selectedKey: 1, isMovePending: false, onPickUp, onDrop, ...props };
  const { result, rerender } = renderHook((hookProps) => usePileDrag(hookProps), { initialProps: allProps });
  return { result, rerender, onPickUp, onDrop, props: allProps };
}

describe('usePileDrag', () => {
  it('is dragging from drag start until drag end, and picks up the dragged card', () => {
    const { result, onPickUp } = setup();
    expect(result.current.isDragging).toBe(false);

    act(() => result.current.handleDragStart({ active: { id: 12 } }));
    expect(result.current.isDragging).toBe(true);
    expect(onPickUp).toHaveBeenCalledWith(12);

    act(() => result.current.handleDragEnd({ over: null }));
    expect(result.current.isDragging).toBe(false);
  });

  it('stops dragging on cancel without dropping', () => {
    const { result, onDrop } = setup();

    act(() => result.current.handleDragStart({ active: { id: 12 } }));
    act(() => result.current.handleDragCancel());

    expect(result.current.isDragging).toBe(false);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('drops onto another pile tab', () => {
    const { result, onDrop } = setup();

    act(() => result.current.handleDragEnd(overTab(2)));

    expect(onDrop).toHaveBeenCalledWith(2);
  });

  it('does nothing when dropped outside a tab', () => {
    const { result, onDrop } = setup();

    act(() => result.current.handleDragEnd({ over: null }));
    act(() => result.current.handleDragEnd({ over: { id: 'elsewhere', data: { current: {} } } }));

    expect(onDrop).not.toHaveBeenCalled();
  });

  it('does nothing when dropped on the pile the cards are already in', () => {
    const { result, onDrop } = setup({ selectedKey: 2 });

    act(() => result.current.handleDragEnd(overTab(2)));

    expect(onDrop).not.toHaveBeenCalled();
  });

  it('does nothing while a move is already running', () => {
    const { result, onDrop } = setup({ isMovePending: true });

    act(() => result.current.handleDragEnd(overTab(2)));

    expect(onDrop).not.toHaveBeenCalled();
  });
});
