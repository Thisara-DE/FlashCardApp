import { useMutation, useQueryClient } from '@tanstack/react-query';

export const CARDS_KEY = ['cards'];
export const PILES_KEY = ['piles'];

// Card changes alter pile counts and pile changes can move cards, so every
// mutation refetches both lists to keep the UI matching the server.
export function useSyncedMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
        queryClient.invalidateQueries({ queryKey: PILES_KEY }),
      ]),
  });
}
