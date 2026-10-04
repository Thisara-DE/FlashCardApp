import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCardSelection } from './useCardSelection.js';

const CARDS = [{ id: 1 }, { id: 2 }, { id: 3 }];

function setup(cards = CARDS) {
  return renderHook(({ cards: current }) => useCardSelection(current), {
    initialProps: { cards },
  });
}

describe('useCardSelection', () => {
  it('starts with nothing selected', () => {
    const { result } = setup();

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelecting).toBe(false);
  });

  it('select adds an id once, even when called twice', () => {
    const { result } = setup();

    act(() => result.current.select(2));
    act(() => result.current.select(2));

    expect(result.current.selectedIds).toEqual([2]);
    expect(result.current.isSelecting).toBe(true);
  });

  it('toggle adds an id, and removes it the second time', () => {
    const { result } = setup();

    act(() => result.current.toggle(1));
    act(() => result.current.toggle(3));
    expect(result.current.selectedIds).toEqual([1, 3]);

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([3]);
  });

  it('removing the last id ends selection mode', () => {
    const { result } = setup();

    act(() => result.current.select(1));
    act(() => result.current.toggle(1));

    expect(result.current.isSelecting).toBe(false);
  });

  it('clear empties the selection', () => {
    const { result } = setup();

    act(() => result.current.select(1));
    act(() => result.current.select(2));
    act(() => result.current.clear());

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelecting).toBe(false);
  });

  it('drops selected ids that are no longer in the cards', () => {
    const { result, rerender } = setup();
    act(() => result.current.select(1));
    act(() => result.current.select(2));

    rerender({ cards: [{ id: 2 }, { id: 3 }] });
    expect(result.current.selectedIds).toEqual([2]);

    rerender({ cards: [{ id: 3 }] });
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelecting).toBe(false);
  });
});
