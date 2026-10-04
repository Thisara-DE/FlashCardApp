import { useQuery } from '@tanstack/react-query';
import { createCard, deleteCard, listCards, moveCards, updateCard } from '../api/cards.js';
import { CARDS_KEY, useSyncedMutation } from './useSyncedMutation.js';

export function useCards() {
  return useQuery({ queryKey: CARDS_KEY, queryFn: listCards });
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
