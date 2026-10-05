import { useQuery } from '@tanstack/react-query';
import { createCard, deleteCard, listCards, moveCards, updateCard } from '../api/cards.js';
import { CARDS_KEY, useSyncedMutation } from './useSyncedMutation.js';

// One cache entry per pile, all under ['cards'] so a single invalidation refreshes every pile.
// pileKey is null while there is no pile to show, which keeps the query switched off.
export function useCards(pileKey) {
  return useQuery({
    queryKey: [...CARDS_KEY, pileKey],
    queryFn: () => listCards(pileKey),
    enabled: pileKey !== null,
  });
}

// Variables: { question, answer, pileId }
export function useCreateCard() {
  return useSyncedMutation(createCard);
}

// Variables: { id, question, answer }
export function useUpdateCard() {
  return useSyncedMutation(({ id, question, answer }) => updateCard(id, { question, answer }));
}

// Variables: the card id
export function useDeleteCard() {
  return useSyncedMutation(deleteCard);
}

// Variables: { cardIds, pileId }
export function useMoveCards() {
  return useSyncedMutation(moveCards);
}
