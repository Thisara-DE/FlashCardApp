import { useState } from 'react';

export const STORAGE_KEY = 'braincrambam.selectedPile';

// Stored values are strings. Anything that is not 'unsorted' or a positive integer becomes null.
function parseStoredKey(raw) {
  if (raw === 'unsorted') return 'unsorted';
  if (raw !== null && /^[1-9]\d*$/.test(raw)) return Number(raw);
  return null;
}

// localStorage can throw (private mode, blocked site data), so every access is guarded.
function readStoredKey() {
  try {
    return parseStoredKey(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredKey(key) {
  try {
    localStorage.setItem(STORAGE_KEY, String(key));
  } catch {
    // Not remembering the pile across reloads is acceptable.
  }
}

// Pure: turns whatever was remembered into a key that is valid right now.
// Returns a pile id, 'unsorted', or null when there is nothing to select.
export function resolvePileKey(storedKey, pilesData) {
  if (!pilesData || pilesData.piles.length === 0) return null;
  if (storedKey === 'unsorted' && pilesData.unsortedCount > 0) return 'unsorted';
  if (pilesData.piles.some((pile) => pile.id === storedKey)) return storedKey;
  return pilesData.piles[0].id;
}

// pilesData is the listPiles() result, or undefined while it loads.
// The raw remembered key stays in state, so the fallback is never written back to storage.
export function useSelectedPile(pilesData) {
  const [storedKey, setStoredKey] = useState(readStoredKey);

  function setSelectedKey(key) {
    setStoredKey(key);
    writeStoredKey(key);
  }

  return [resolvePileKey(storedKey, pilesData), setSelectedKey];
}
