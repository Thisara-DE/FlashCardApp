import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Card } from './db.js';
import { seed, SEED_CARDS } from './seed.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
});

describe('GET /api/cards', () => {
  it('returns all cards, newest first', async () => {
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(SEED_CARDS.length);
    // Seed rows share a createdAt; the id DESC tie-break makes the order stable.
    const ids = res.body.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['answer', 'createdAt', 'id', 'question', 'updatedAt'],
    );
  });

  it('returns 500 INTERNAL_ERROR without a stack trace when the database fails', async () => {
    vi.spyOn(Card, 'findAll').mockRejectedValueOnce(new Error('disk on fire'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/cards');
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
      .send({ question: '  Capital of Peru?  ', answer: ' Lima ', extra: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ question: 'Capital of Peru?', answer: 'Lima' });
    expect(res.body).not.toHaveProperty('extra');
    const list = await request(app).get('/api/cards');
    expect(list.body[0].id).toBe(res.body.id);
  });

  it('accepts exactly 200 characters', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: 'q'.repeat(200), answer: 'a'.repeat(200) });
    expect(res.status).toBe(201);
  });

  it.each([
    [{}, { question: 'Question is required', answer: 'Answer is required' }],
    [{ question: '   ', answer: 'A' }, { question: 'Question is required' }],
    [{ question: 'Q', answer: 'a'.repeat(201) }, { answer: 'Answer must be 200 characters or fewer' }],
    [{ question: 123, answer: null }, { question: 'Question must be text', answer: 'Answer must be text' }],
  ])('rejects %j with 400 VALIDATION_ERROR', async (body, details) => {
    const before = await Card.count();
    const res = await request(app).post('/api/cards').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details,
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
