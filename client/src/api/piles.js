import { request } from './request.js';

// Resolves to { piles, unsortedCount }.
export function listPiles() {
  return request('/api/piles');
}

export function createPile({ name }) {
  return request('/api/piles', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renamePile(id, { name }) {
  return request(`/api/piles/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

// cardsMode ('keep' | 'delete') says what happens to the pile's cards; omit it for an empty pile.
export function deletePile(id, cardsMode) {
  const query = cardsMode ? `?cards=${cardsMode}` : '';
  return request(`/api/piles/${id}${query}`, { method: 'DELETE' });
}
