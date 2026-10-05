import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createCard, deleteCard, listCards, moveCards, updateCard } from './cards.js';

// Build a minimal fake fetch Response.
function respond(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

describe('cards API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listCards(pileId) fetches that pile's cards and returns the parsed array", async () => {
    const cards = [{ id: 1, question: 'Q', answer: 'A', pileId: 3 }];
    fetch.mockResolvedValue(respond(200, cards));

    await expect(listCards(3)).resolves.toEqual(cards);
    expect(fetch).toHaveBeenCalledWith('/api/cards?pileId=3', expect.anything());
  });

  it("listCards('unsorted') fetches the cards without a pile", async () => {
    fetch.mockResolvedValue(respond(200, []));

    await listCards('unsorted');

    expect(fetch).toHaveBeenCalledWith('/api/cards?pileId=unsorted', expect.anything());
  });

  it('createCard() POSTs the card, including its pile, as JSON', async () => {
    const created = { id: 2, question: 'Q', answer: 'A', pileId: 3 };
    fetch.mockResolvedValue(respond(201, created));

    await expect(createCard({ question: 'Q', answer: 'A', pileId: 3 })).resolves.toEqual(created);
    expect(fetch).toHaveBeenCalledWith(
      '/api/cards',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: 'Q', answer: 'A', pileId: 3 }),
      }),
    );
  });

  it('moveCards() POSTs the card ids and target pile to /api/cards/move', async () => {
    fetch.mockResolvedValue(respond(200, { movedCount: 2 }));

    await expect(moveCards({ cardIds: [1, 2], pileId: 3 })).resolves.toEqual({ movedCount: 2 });
    expect(fetch).toHaveBeenCalledWith(
      '/api/cards/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cardIds: [1, 2], pileId: 3 }),
      }),
    );
  });

  it('updateCard() PUTs to /api/cards/:id', async () => {
    fetch.mockResolvedValue(respond(200, { id: 7, question: 'Q2', answer: 'A2' }));

    await updateCard(7, { question: 'Q2', answer: 'A2' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/cards/7',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ question: 'Q2', answer: 'A2' }),
      }),
    );
  });

  it('deleteCard() sends DELETE and resolves to null on 204 without reading the body', async () => {
    const response = { ok: true, status: 204, json: vi.fn() };
    fetch.mockResolvedValue(response);

    await expect(deleteCard(7)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/cards/7', expect.objectContaining({ method: 'DELETE' }));
    expect(response.json).not.toHaveBeenCalled();
  });

  it('rejects with an ApiError built from the server error body', async () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid card',
        details: { question: 'Question is required' },
      },
    };
    fetch.mockResolvedValue(respond(400, body));

    const error = await createCard({ question: '', answer: 'A' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details: { question: 'Question is required' },
    });
  });

  it('falls back to UNKNOWN_ERROR when the error body is not JSON', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    const error = await listCards(1).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
      message: 'Request failed',
      details: {},
    });
  });
});
