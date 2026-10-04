import { useQuery } from '@tanstack/react-query';
import { createPile, deletePile, listPiles, renamePile } from '../api/piles.js';
import { PILES_KEY, useSyncedMutation } from './useSyncedMutation.js';

export function usePiles() {
  return useQuery({ queryKey: PILES_KEY, queryFn: listPiles });
}

// Variables: { name }
export function useCreatePile() {
  return useSyncedMutation(createPile);
}

// Variables: { id, name }
export function useRenamePile() {
  return useSyncedMutation(({ id, name }) => renamePile(id, { name }));
}

// Variables: { id, cardsMode } (cardsMode is 'keep' | 'delete', or omitted for an empty pile)
export function useDeletePile() {
  return useSyncedMutation(({ id, cardsMode }) => deletePile(id, cardsMode));
}
