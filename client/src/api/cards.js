import { request } from './request.js';

// Re-exported so existing imports of ApiError from cards.js keep working.
export { ApiError } from './request.js';

export function listCards() {
  return request('/api/cards');
}

export function createCard({ question, answer, pileId }) {
  return request('/api/cards', {
    method: 'POST',
    body: JSON.stringify({ question, answer, pileId }),
  });
}

export function updateCard(id, { question, answer }) {
  return request(`/api/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ question, answer }),
  });
}

export function deleteCard(id) {
  return request(`/api/cards/${id}`, { method: 'DELETE' });
}

// Moves several cards into one pile at once. Resolves to { movedCount }.
export function moveCards({ cardIds, pileId }) {
  return request('/api/cards/move', {
    method: 'POST',
    body: JSON.stringify({ cardIds, pileId }),
  });
}
