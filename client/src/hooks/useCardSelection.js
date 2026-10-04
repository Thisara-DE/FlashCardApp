import { useCallback, useState } from 'react';

// Which of the shown cards are selected. Selection mode is simply "at least one card selected".
//
// selectedIds is worked out from `cards` on every render, so a card that disappears (deleted or
// moved elsewhere, then refetched) drops out of the count and the move request by itself.
export function useCardSelection(cards) {
  const [storedIds, setStoredIds] = useState([]);

  const selectedIds = storedIds.filter((id) => cards.some((card) => card.id === id));

  // useCallback keeps these the same functions across renders, so effects can depend on them.

  // Only adds: a long press (and later a drag) on an already selected card keeps it selected.
  const select = useCallback((id) => {
    setStoredIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);

  const toggle = useCallback((id) => {
    setStoredIds((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));
  }, []);

  const clear = useCallback(() => {
    setStoredIds([]);
  }, []);

  return {
    selectedIds,
    isSelecting: selectedIds.length > 0,
    select,
    toggle,
    clear,
  };
}
