import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './request.js';
import { createPile, deletePile, listPiles, renamePile } from './piles.js';

// Build a minimal fake fetch Response.
function respond(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

describe('piles API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listPiles() fetches /api/piles and returns piles plus unsortedCount', async () => {
    const data = { piles: [{ id: 1, name: 'Math', cardCount: 2 }], unsortedCount: 0 };
    fetch.mockResolvedValue(respond(200, data));

    await expect(listPiles()).resolves.toEqual(data);
    expect(fetch).toHaveBeenCalledWith('/api/piles', expect.anything());
  });

  it('createPile() POSTs the name as JSON', async () => {
    const created = { id: 2, name: 'Law', cardCount: 0 };
    fetch.mockResolvedValue(respond(201, created));

    await expect(createPile({ name: 'Law' })).resolves.toEqual(created);
    expect(fetch).toHaveBeenCalledWith(
      '/api/piles',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: 'Law' }),
      }),
    );
  });

  it('renamePile() PUTs the new name to /api/piles/:id', async () => {
    fetch.mockResolvedValue(respond(200, { id: 5, name: 'History' }));

    await renamePile(5, { name: 'History' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/piles/5',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'History' }) }),
    );
  });

  it('deletePile(id) sends DELETE to /api/piles/:id with no query string', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() });

    await expect(deletePile(3)).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/piles/3', expect.objectContaining({ method: 'DELETE' }));
  });

  it('deletePile(id, cardsMode) appends ?cards=', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() });

    await deletePile(3, 'keep');

    expect(fetch).toHaveBeenCalledWith('/api/piles/3?cards=keep', expect.objectContaining({ method: 'DELETE' }));
  });

  it('rejects with an ApiError carrying status, code and details on a 409', async () => {
    const body = {
      error: {
        code: 'DUPLICATE_NAME',
        message: 'Duplicate pile name',
        details: { name: 'You already have a pile called "Math"' },
      },
    };
    fetch.mockResolvedValue(respond(409, body));

    const error = await createPile({ name: 'math' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'DUPLICATE_NAME',
      details: { name: 'You already have a pile called "Math"' },
    });
  });
});
