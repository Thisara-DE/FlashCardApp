import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCard, deleteCard, listCards, updateCard } from '../api/cards.js';

const CARDS_KEY = ['cards'];

export function useCards() {
  return useQuery({ queryKey: CARDS_KEY, queryFn: listCards });
}

// Each mutation refetches the list on success so the UI always matches the server.
function useCardMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
  });
}

export function useCreateCard() {
  return useCardMutation(createCard);
}

// Variables: { id, question, answer }
export function useUpdateCard() {
  return useCardMutation(({ id, question, answer }) => updateCard(id, { question, answer }));
}

// Variables: the card id
export function useDeleteCard() {
  return useCardMutation(deleteCard);
}
