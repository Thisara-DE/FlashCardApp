import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Card, Pile } from './db.js';
import { seed, SEED_PILES } from './seed.js';

let geography;
let history;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
  geography = await Pile.findOne({ where: { name: 'Geography' } });
  history = await Pile.findOne({ where: { name: 'History' } });
});

describe('GET /api/cards', () => {
  it('without pileId returns 400 pileId is required', async () => {
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card filter',
      details: { pileId: 'pileId is required' },
    });
  });

  it("returns the pile's cards, newest first", async () => {
    const res = await request(app).get(`/api/cards?pileId=${geography.id}`);
    expect(res.status).toBe(200);
    const seededGeography = SEED_PILES.find((p) => p.name === 'Geography');
    expect(res.body).toHaveLength(seededGeography.cards.length);
    // Seed rows share a createdAt; the id DESC tie-break makes the order stable.
    const ids = res.body.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['answer', 'createdAt', 'id', 'pileId', 'question', 'updatedAt'],
    );
  });

  it("?pileId=N returns only that pile's cards, newest first", async () => {
    const res = await request(app).get(`/api/cards?pileId=${geography.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((card) => card.pileId === geography.id)).toBe(true);
    const ids = res.body.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('?pileId=unsorted returns only cards with no pile', async () => {
    const orphan = await Card.create({ question: 'Lost?', answer: 'Yes', pileId: null });
    const res = await request(app).get('/api/cards?pileId=unsorted');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((card) => card.pileId === null)).toBe(true);
    expect(res.body.map((card) => card.id)).toContain(orphan.id);
    await orphan.destroy();
  });

  it('?pileId=999999 returns 404 Pile not found', async () => {
    const res = await request(app).get('/api/cards?pileId=999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Pile not found' });
  });

  it.each(['0', '1.5', 'UNSORTED', 'abc'])('?pileId=%s returns 400', async (value) => {
    const res = await request(app).get(`/api/cards?pileId=${value}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card filter',
      details: { pileId: 'pileId must be a pile id or "unsorted"' },
    });
  });

  it('a repeated pileId param returns 400, not 500', async () => {
    const res = await request(app).get('/api/cards?pileId=1&pileId=2');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 INTERNAL_ERROR without a stack trace when the database fails', async () => {
    vi.spyOn(Card, 'findAll').mockRejectedValueOnce(new Error('disk on fire'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get(`/api/cards?pileId=${geography.id}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('POST /api/cards', () => {
  it('creates a trimmed card, returns 201, and lists it first', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: '  Capital of Peru?  ', answer: ' Lima ', pileId: geography.id, extra: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ question: 'Capital of Peru?', answer: 'Lima', pileId: geography.id });
    expect(res.body).not.toHaveProperty('extra');
    const list = await request(app).get(`/api/cards?pileId=${geography.id}`);
    expect(list.body[0].id).toBe(res.body.id);
  });

  it('accepts exactly 200 characters', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: 'q'.repeat(200), answer: 'a'.repeat(200), pileId: geography.id });
    expect(res.status).toBe(201);
  });

  it.each([
    [{}, { question: 'Question is required', answer: 'Answer is required' }],
    [{ question: '   ', answer: 'A' }, { question: 'Question is required' }],
    [{ question: 'Q', answer: 'a'.repeat(201) }, { answer: 'Answer must be 200 characters or fewer' }],
    [{ question: 123, answer: null }, { question: 'Question must be text', answer: 'Answer must be text' }],
  ])('rejects %j (sent to a real pile) with 400 VALIDATION_ERROR', async (body, details) => {
    const before = await Card.count();
    const res = await request(app)
      .post('/api/cards')
      .send({ ...body, pileId: geography.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details,
    });
    expect(await Card.count()).toBe(before);
  });

  it('without pileId returns 400 Pick a pile for this card and creates nothing', async () => {
    const before = await Card.count();
    const res = await request(app).post('/api/cards').send({ question: 'Q', answer: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details: { pileId: 'Pick a pile for this card' },
    });
    expect(await Card.count()).toBe(before);
  });

  it('with pileId creates the card in that pile', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: 'Year of the French Revolution?', answer: '1789', pileId: history.id });
    expect(res.status).toBe(201);
    expect(res.body.pileId).toBe(history.id);
    expect((await Card.findByPk(res.body.id)).pileId).toBe(history.id);
  });

  it('with an unknown pileId returns 404 Pile not found and creates nothing', async () => {
    const before = await Card.count();
    const res = await request(app)
      .post('/api/cards')
      .send({ question: 'Q', answer: 'A', pileId: 999999 });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Pile not found' });
    expect(await Card.count()).toBe(before);
  });

  it.each([0, -1, 1.5, '2'])('with pileId %j returns 400 Pick a pile for this card', async (pileId) => {
    const before = await Card.count();
    const res = await request(app).post('/api/cards').send({ question: 'Q', answer: 'A', pileId });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details: { pileId: 'Pick a pile for this card' },
    });
    expect(await Card.count()).toBe(before);
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set('Content-Type', 'application/json')
      .send('{"question":');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request body must be valid JSON',
    });
  });
});

async function makeCard() {
  const res = await request(app)
    .post('/api/cards')
    .send({ question: 'Old?', answer: 'Old', pileId: geography.id });
  return res.body;
}

describe('PUT /api/cards/:id', () => {
  it('replaces both sides, trims them, and returns 200', async () => {
    const card = await makeCard();
    const res = await request(app)
      .put(`/api/cards/${card.id}`)
      .send({ question: ' New? ', answer: ' New ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: card.id, question: 'New?', answer: 'New' });
  });

  it('ignores pileId in the body', async () => {
    const card = await Card.create({ question: 'Stay?', answer: 'Yes', pileId: geography.id });
    const res = await request(app)
      .put(`/api/cards/${card.id}`)
      .send({ question: 'Stay?', answer: 'Yes', pileId: history.id });
    expect(res.status).toBe(200);
    expect(res.body.pileId).toBe(geography.id);
    expect((await Card.findByPk(card.id)).pileId).toBe(geography.id);
  });

  it('requires both fields (400, card unchanged)', async () => {
    const card = await makeCard();
    const res = await request(app).put(`/api/cards/${card.id}`).send({ question: 'Only?' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ answer: 'Answer is required' });
    expect((await Card.findByPk(card.id)).question).toBe('Old?');
  });

  it.each(['999999', 'abc', '0', '-1', '1.5'])('returns 404 NOT_FOUND for id %s', async (id) => {
    const res = await request(app).put(`/api/cards/${id}`).send({ question: 'Q', answer: 'A' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/cards/move', () => {
  const makeCardIn = (pileId) => Card.create({ question: 'Move me?', answer: 'Sure', pileId });

  it('moves every listed card and returns movedCount', async () => {
    const [a, b] = [await makeCardIn(geography.id), await makeCardIn(geography.id)];
    const res = await request(app)
      .post('/api/cards/move')
      .send({ cardIds: [a.id, b.id], pileId: history.id });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedCount: 2 });
    expect((await Card.findByPk(a.id)).pileId).toBe(history.id);
    expect((await Card.findByPk(b.id)).pileId).toBe(history.id);
  });

  it('reports how many cards really moved, not how many were asked for', async () => {
    const real = await makeCardIn(geography.id);
    // Pretend both ids passed the existence check, as if 999999 was deleted just after it.
    const count = vi.spyOn(Card, 'count').mockResolvedValueOnce(2);

    const res = await request(app)
      .post('/api/cards/move')
      .send({ cardIds: [real.id, 999999], pileId: history.id });

    count.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedCount: 1 });
    expect((await Card.findByPk(real.id)).pileId).toBe(history.id);
  });

  it('moves nothing and returns 404 when one card id is unknown', async () => {
    const real = await makeCardIn(geography.id);
    const res = await request(app)
      .post('/api/cards/move')
      .send({ cardIds: [real.id, 999999], pileId: history.id });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Card not found' });
    expect((await Card.findByPk(real.id)).pileId).toBe(geography.id);
  });

  it('returns 404 Pile not found for an unknown pile', async () => {
    const real = await makeCardIn(geography.id);
    const res = await request(app)
      .post('/api/cards/move')
      .send({ cardIds: [real.id], pileId: 999999 });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Pile not found' });
    expect((await Card.findByPk(real.id)).pileId).toBe(geography.id);
  });

  it.each([
    [{ cardIds: [], pileId: 1 }, { cardIds: 'Pick between 1 and 100 cards' }],
    [{ cardIds: [1, 1], pileId: 1 }, { cardIds: 'Each card can only be listed once' }],
    [
      { cardIds: Array.from({ length: 101 }, (_, i) => i + 1), pileId: 1 },
      { cardIds: 'Pick between 1 and 100 cards' },
    ],
    [{ cardIds: [1] }, { pileId: 'Pick a pile to move the cards to' }],
  ])('rejects %j with 400', async (body, details) => {
    const res = await request(app).post('/api/cards/move').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid move',
      details,
    });
  });
});

describe('DELETE /api/cards/:id', () => {
  it('deletes the card and returns 204 with no body', async () => {
    const card = await makeCard();
    const res = await request(app).delete(`/api/cards/${card.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await Card.findByPk(card.id)).toBeNull();
  });

  it.each(['999999', 'abc'])('returns 404 NOT_FOUND for id %s', async (id) => {
    const res = await request(app).delete(`/api/cards/${id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
  });
});
