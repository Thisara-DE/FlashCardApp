import { useState } from 'react';
import { ApiError } from '../api/request.js';
import { useDeletePile } from './usePiles.js';

const PILE_DELETE_ERROR = "Couldn't delete this pile. Try again.";

// Deleting the selected pile: which pile the dialog is asking about, its error, and the actions.
//
// - piles: every pile, to pick the one to open after a delete.
// - onSelectPile(id): opens a pile.
// - onStale(): called when the pile was already deleted elsewhere, to refetch.
export function usePileDelete({ piles, onSelectPile, onStale }) {
  const deletePile = useDeletePile();
  // The pile waiting for delete confirmation: { id, name, cardCount }, or null when no dialog is open.
  // An empty pile gets the simple confirm; a pile with cards asks what to do with them.
  const [pileToDelete, setPileToDelete] = useState(null);
  const [pileDeleteError, setPileDeleteError] = useState(null);

  function requestDeletePile({ id, name, cardCount }) {
    setPileDeleteError(null);
    setPileToDelete({ id, name, cardCount });
  }

  // Esc, "Keep it" and "Cancel" all land here; closing mid-request would hide the outcome.
  function cancelDeletePile() {
    if (deletePile.isPending) return;
    setPileToDelete(null);
  }

  // cardsMode: undefined for an empty pile, 'keep' or 'delete' for a pile with cards.
  async function confirmDeletePile(cardsMode) {
    const { id } = pileToDelete;
    // Clear the old error first so a repeated failure re-renders (and re-announces) the alert.
    setPileDeleteError(null);
    try {
      await deletePile.mutateAsync({ id, cardsMode });
      setPileToDelete(null);
      // Open the first pile that is left, so the deleted pile is not the remembered choice.
      const firstPileLeft = piles.find((pile) => pile.id !== id);
      if (firstPileLeft) onSelectPile(firstPileLeft.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PILE_NOT_EMPTY' && error.details.cardCount > 0) {
        // Cards were added elsewhere since the counts loaded. That is not an error: ask what to do
        // with them, using the server's count (a count above 0 switches to the keep/delete dialog).
        setPileToDelete((pile) => ({ ...pile, cardCount: error.details.cardCount }));
      } else if (error instanceof ApiError && error.status === 404) {
        // Already deleted elsewhere: there is nothing to retry, so close and resync.
        setPileToDelete(null);
        onStale();
      } else {
        setPileDeleteError(PILE_DELETE_ERROR);
      }
    }
  }

  return {
    pileToDelete,
    pileDeleteError,
    isDeletePending: deletePile.isPending,
    requestDeletePile,
    cancelDeletePile,
    confirmDeletePile,
  };
}
