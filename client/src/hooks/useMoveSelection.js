import { useEffect, useState } from 'react';
import { ApiError } from '../api/request.js';
import { useCardSelection } from './useCardSelection.js';
import { useMoveCards } from './useCards.js';

const MOVE_ERROR = "Couldn't move those cards. Try again.";

function plural(count, one, many) {
  return count === 1 ? one : many;
}

// Selecting the shown cards and moving them into another pile (Move to…, or a drop on a tab).
//
// - cards: the cards on screen. Only their ids can be selected.
// - piles: every pile, to name the target in the announcement.
// - isDialogOpen: while a dialog is open, Esc closes the dialog instead of ending selection mode.
// - onStale(): called when the server says a card or the pile is gone, to refetch.
export function useMoveSelection({ cards, piles, isDialogOpen, onStale }) {
  const { selectedIds, isSelecting, select, toggle, clear } = useCardSelection(cards);
  const moveCards = useMoveCards();
  const [moveError, setMoveError] = useState(null);
  // Read out by screen readers after a move, e.g. "Moved 2 cards to Math".
  const [moveAnnouncement, setMoveAnnouncement] = useState('');

  // Esc ends selection mode. Not while a dialog is open: there, Esc closes the dialog instead.
  useEffect(() => {
    if (!isSelecting || isDialogOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        clear();
        setMoveError(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelecting, isDialogOpen, clear]);

  function clearSelection() {
    clear();
    setMoveError(null);
  }

  // An old move error was about a different set of cards, so any change to the selection hides it.
  function handleLongPress(cardId) {
    setMoveError(null);
    select(cardId);
  }

  function handleToggleSelect(cardId) {
    setMoveError(null);
    toggle(cardId);
  }

  // Moves every selected card into the pile with this id. Move to… and a drop on a tab both call it.
  async function handleMove(pileId) {
    // Read the name now: the piles list may have changed by the time the move finishes.
    const targetName = piles.find((pile) => pile.id === pileId)?.name ?? 'the pile';
    setMoveError(null);
    // Empty it first, so moving the same number of cards to the same pile twice is announced twice.
    setMoveAnnouncement('');
    try {
      await moveCards.mutateAsync({ cardIds: selectedIds, pileId });
      const count = selectedIds.length;
      setMoveAnnouncement(`Moved ${count} ${plural(count, 'card', 'cards')} to ${targetName}`);
      clear();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // A card or the pile was deleted elsewhere. Refetch: vanished cards drop out of the
        // selection, and a vanished pile drops out of Move to….
        onStale();
      } else {
        // Keep the selection, so the user can simply try again.
        setMoveError(MOVE_ERROR);
      }
    }
  }

  return {
    selectedIds,
    isSelecting,
    moveError,
    moveAnnouncement,
    isMovePending: moveCards.isPending,
    clearSelection,
    handleLongPress,
    handleToggleSelect,
    handleMove,
  };
}
