import { vi } from 'vitest';

// A minimal fake fetch Response.
export function respond(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

// A fake error Response in the server's { error: { code, message, details? } } shape.
export function respondError(status, code, message, details) {
  const error = details ? { code, message, details } : { code, message };
  return respond(status, { error });
}

const notFound = (message) => respondError(404, 'NOT_FOUND', message);

// Pile names are unique ignoring case, like on the server.
function findDuplicate(piles, name, ignoreId) {
  const lower = name.toLowerCase();
  return piles.find((pile) => pile.id !== ignoreId && pile.name.toLowerCase() === lower);
}

const nameRequired = () =>
  respondError(400, 'VALIDATION_ERROR', 'Invalid pile', { name: 'Pile name is required' });

function duplicateName(existing) {
  return respondError(409, 'DUPLICATE_NAME', 'Duplicate pile name', {
    name: `You already have a pile called "${existing.name}"`,
  });
}

// Stubs the global fetch with an in-memory copy of the API.
//
// - `piles`: [{ id, name }], oldest first. `cards`: [{ id, question, answer, pileId }], newest
//   first. Both are copied, so tests can reuse their fixtures.
// - `overrides` force a response for one route, keyed by 'METHOD /path' with the path matched
//   without its query string, e.g. { 'DELETE /api/piles/1': () => respondError(500, ...) }.
//   Each override is called with (url, options, handleNormally); return handleNormally() to let
//   the fake API answer as usual (handy for "fail the first time only").
//
// Returns the fetch mock, so tests can inspect the requests it received.
export function stubApi({ piles = [], cards = [] } = {}, overrides = {}) {
  const state = {
    piles: piles.map((pile) => ({ ...pile })),
    cards: cards.map((card) => ({ ...card })),
  };
  let nextId = 1000;

  const findPile = (id) => state.piles.find((pile) => pile.id === id);
  const findCard = (id) => state.cards.find((card) => card.id === id);

  // Each route: [method, path pattern, handler({ params, query, body })].
  const routes = [
    [
      'GET',
      /^\/api\/piles$/,
      () =>
        respond(200, {
          piles: state.piles.map((pile) => ({
            ...pile,
            cardCount: state.cards.filter((card) => card.pileId === pile.id).length,
          })),
          unsortedCount: state.cards.filter((card) => card.pileId === null).length,
        }),
    ],
    [
      'POST',
      /^\/api\/piles$/,
      ({ body }) => {
        const name = String(body.name ?? '').trim();
        if (!name) return nameRequired();
        const existing = findDuplicate(state.piles, name);
        if (existing) return duplicateName(existing);
        const pile = { id: nextId++, name, createdAt: new Date().toISOString() };
        state.piles.push(pile);
        return respond(201, { ...pile, cardCount: 0 });
      },
    ],
    [
      'PUT',
      /^\/api\/piles\/(\d+)$/,
      ({ params, body }) => {
        const pile = findPile(params.id);
        if (!pile) return notFound('Pile not found');
        const name = String(body.name ?? '').trim();
        if (!name) return nameRequired();
        const existing = findDuplicate(state.piles, name, pile.id);
        if (existing) return duplicateName(existing);
        pile.name = name;
        const cardCount = state.cards.filter((card) => card.pileId === pile.id).length;
        return respond(200, { ...pile, cardCount });
      },
    ],
    [
      'DELETE',
      /^\/api\/piles\/(\d+)$/,
      ({ params, query }) => {
        const pile = findPile(params.id);
        if (!pile) return notFound('Pile not found');
        const mode = query.get('cards');
        if (mode !== null && mode !== 'keep' && mode !== 'delete') {
          return respondError(400, 'VALIDATION_ERROR', 'Invalid pile delete', {
            cards: 'cards must be "keep" or "delete"',
          });
        }
        const cardCount = state.cards.filter((card) => card.pileId === pile.id).length;
        if (cardCount > 0 && mode === null) {
          return respondError(409, 'PILE_NOT_EMPTY', 'Pile still has cards', { cardCount });
        }
        if (mode === 'delete') {
          state.cards = state.cards.filter((card) => card.pileId !== pile.id);
        } else if (cardCount > 0) {
          // Kept cards go to General (made when missing); General's own cards become Unsorted.
          let general = findDuplicate(state.piles, 'General');
          if (!general) {
            general = { id: nextId++, name: 'General', createdAt: new Date().toISOString() };
            state.piles.push(general);
          }
          const newPileId = general.id === pile.id ? null : general.id;
          state.cards.forEach((card) => {
            if (card.pileId === pile.id) card.pileId = newPileId;
          });
        }
        state.piles = state.piles.filter((other) => other.id !== pile.id);
        return respond(204, null);
      },
    ],
    [
      'GET',
      /^\/api\/cards$/,
      ({ query }) => {
        const pileKey = query.get('pileId');
        if (pileKey === null) {
          return respondError(400, 'VALIDATION_ERROR', 'Invalid card filter', { pileId: 'pileId is required' });
        }
        if (pileKey === 'unsorted') {
          return respond(200, state.cards.filter((card) => card.pileId === null));
        }
        const pileId = Number(pileKey);
        if (!findPile(pileId)) return notFound('Pile not found');
        return respond(200, state.cards.filter((card) => card.pileId === pileId));
      },
    ],
    [
      'POST',
      /^\/api\/cards$/,
      ({ body }) => {
        if (!findPile(body.pileId)) return notFound('Pile not found');
        const card = { id: nextId++, question: body.question, answer: body.answer, pileId: body.pileId };
        state.cards.unshift(card); // newest first
        return respond(201, card);
      },
    ],
    [
      'POST',
      /^\/api\/cards\/move$/,
      ({ body }) => {
        if (!findPile(body.pileId)) return notFound('Pile not found');
        if (!body.cardIds.every((id) => findCard(id))) return notFound('Card not found');
        body.cardIds.forEach((id) => {
          findCard(id).pileId = body.pileId;
        });
        return respond(200, { movedCount: body.cardIds.length });
      },
    ],
    [
      'PUT',
      /^\/api\/cards\/(\d+)$/,
      ({ params, body }) => {
        const card = findCard(params.id);
        if (!card) return notFound('Card not found');
        card.question = body.question;
        card.answer = body.answer;
        return respond(200, { ...card });
      },
    ],
    [
      'DELETE',
      /^\/api\/cards\/(\d+)$/,
      ({ params }) => {
        if (!findCard(params.id)) return notFound('Card not found');
        state.cards = state.cards.filter((card) => card.id !== params.id);
        return respond(204, null);
      },
    ],
  ];

  function handle(method, path, query, options) {
    for (const [routeMethod, pattern, handler] of routes) {
      const match = method === routeMethod && path.match(pattern);
      if (match) {
        const params = match[1] === undefined ? {} : { id: Number(match[1]) };
        const body = options.body ? JSON.parse(options.body) : {};
        return handler({ params, query, body });
      }
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  }

  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const [path, queryString = ''] = url.split('?');
    const query = new URLSearchParams(queryString);
    const handleNormally = () => handle(method, path, query, options);

    const override = overrides[`${method} ${path}`];
    return override ? override(url, options, handleNormally) : handleNormally();
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// The requests the mock received, as 'METHOD url' strings (url includes the query string).
export function requestsMade(fetchMock) {
  return fetchMock.mock.calls.map(([url, options = {}]) => `${options.method ?? 'GET'} ${url}`);
}
