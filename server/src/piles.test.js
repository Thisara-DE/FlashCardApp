import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Pile, Card } from './db.js';
import { seed } from './seed.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Creates a pile through the API and returns the response body.
async function makePile(name) {
  const res = await request(app).post('/api/piles').send({ name });
  expect(res.status).toBe(201);
  return res.body;
}

// Creates `count` cards straight in the database, inside the given pile.
async function makeCards(pileId, count) {
  const cards = [];
  for (let i = 1; i <= count; i += 1) {
    cards.push(await Card.create({ question: `Q${i}?`, answer: `A${i}`, pileId }));
  }
  return cards;
}

async function getList() {
  const res = await request(app).get('/api/piles');
  return res.body;
}

describe('GET /api/piles', () => {
  it('lists piles oldest first with card counts and the unsorted count', async () => {
    const res = await request(app).get('/api/piles');
    expect(res.status).toBe(200);
    expect(res.body.piles.slice(0, 5).map((p) => p.name)).toEqual([
      'Geography',
      'History',
      'Law',
      'Math',
      'Science',
    ]);
    expect(Object.keys(res.body.piles[0]).sort()).toEqual([
      'cardCount',
      'createdAt',
      'id',
      'name',
    ]);
    expect(res.body.piles[0].cardCount).toBe(2);
    expect(res.body.unsortedCount).toBe(0);
  });
});

describe('POST /api/piles', () => {
  it('creates a trimmed pile with cardCount 0 (201)', async () => {
    const res = await request(app).post('/api/piles').send({ name: '  Biology  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Biology', cardCount: 0 });
    expect(Object.keys(res.body).sort()).toEqual(['cardCount', 'createdAt', 'id', 'name']);
  });

  it.each([
    [{}, 'Pile name is required'],
    [{ name: '   ' }, 'Pile name is required'],
    [{ name: 'a'.repeat(41) }, 'Pile name must be 40 characters or fewer'],
    [{ name: 7 }, 'Pile name must be text'],
  ])('rejects %j with 400', async (body, message) => {
    const res = await request(app).post('/api/piles').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid pile',
      details: { name: message },
    });
  });

  it('accepts exactly 40 characters', async () => {
    const res = await request(app).post('/api/piles').send({ name: 'b'.repeat(40) });
    expect(res.status).toBe(201);
  });

  it.each(['math', '  MATH  '])(
    'rejects duplicate %j ignoring case and spaces (409)',
    async (name) => {
      const res = await request(app).post('/api/piles').send({ name });
      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'DUPLICATE_NAME',
        message: 'Duplicate pile name',
        details: { name: 'You already have a pile called "Math"' },
      });
    },
  );

  it('treats non-ASCII names differing only in case as duplicates', async () => {
    await makePile('ÉCOLE');
    expect((await request(app).post('/api/piles').send({ name: 'école' })).status).toBe(409);
  });
});

describe('PUT /api/piles/:id', () => {
  it('renames a pile (200) and returns its card count', async () => {
    const pile = await makePile('Chemestry');
    await makeCards(pile.id, 2);
    const res = await request(app).put(`/api/piles/${pile.id}`).send({ name: '  Chemistry  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: pile.id, name: 'Chemistry', cardCount: 2 });
  });

  it('allows renaming a pile to its own name in a new case', async () => {
    const pile = await makePile('Kemistry');
    const res = await request(app).put(`/api/piles/${pile.id}`).send({ name: 'kemistry' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('kemistry');
  });

  it("rejects another pile's name with 409", async () => {
    const pile = await makePile('Astronomy');
    const res = await request(app).put(`/api/piles/${pile.id}`).send({ name: 'law' });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'DUPLICATE_NAME',
      message: 'Duplicate pile name',
      details: { name: 'You already have a pile called "Law"' },
    });
  });

  it('rejects an empty name with 400', async () => {
    const pile = await makePile('Geology');
    const res = await request(app).put(`/api/piles/${pile.id}`).send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid pile',
      details: { name: 'Pile name is required' },
    });
  });

  it.each(['999999', 'abc'])('returns 404 for id %s, even with an invalid body', async (id) => {
    const res = await request(app).put(`/api/piles/${id}`).send({ name: '' });
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Pile not found' });
  });
});

describe('DELETE /api/piles/:id', () => {
  it('deletes an empty pile (204)', async () => {
    const pile = await makePile('Empty one');
    const res = await request(app).delete(`/api/piles/${pile.id}`);
    expect(res.status).toBe(204);
    expect(await Pile.findByPk(pile.id)).toBeNull();
  });

  it('refuses a pile with cards and no cards param (409)', async () => {
    const pile = await makePile('Has cards');
    await makeCards(pile.id, 2);
    const res = await request(app).delete(`/api/piles/${pile.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'PILE_NOT_EMPTY',
      message: 'This pile still has cards',
      details: { cardCount: 2 },
    });
    expect(await Pile.findByPk(pile.id)).not.toBeNull();
  });

  it('?cards=keep moves its cards to Unsorted, then deletes it', async () => {
    const pile = await makePile('Keep me');
    const cards = await makeCards(pile.id, 2);
    const before = (await getList()).unsortedCount;

    const res = await request(app).delete(`/api/piles/${pile.id}?cards=keep`);

    expect(res.status).toBe(204);
    expect(await Pile.findByPk(pile.id)).toBeNull();
    for (const card of cards) {
      const reloaded = await Card.findByPk(card.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded.pileId).toBeNull();
    }
    expect((await getList()).unsortedCount).toBe(before + 2);
  });

  it('?cards=delete deletes its cards, then the pile', async () => {
    const pile = await makePile('Delete me');
    const cards = await makeCards(pile.id, 2);

    const res = await request(app).delete(`/api/piles/${pile.id}?cards=delete`);

    expect(res.status).toBe(204);
    expect(await Pile.findByPk(pile.id)).toBeNull();
    expect(await Card.count({ where: { id: cards.map((c) => c.id) } })).toBe(0);
  });

  it('rejects ?cards=maybe with 400 even for an empty pile', async () => {
    const pile = await makePile('Empty two');
    const res = await request(app).delete(`/api/piles/${pile.id}?cards=maybe`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid delete option',
      details: { cards: 'cards must be "keep" or "delete"' },
    });
    expect(await Pile.findByPk(pile.id)).not.toBeNull();
  });

  it('accepts ?cards=keep on an empty pile (204)', async () => {
    const pile = await makePile('Empty three');
    const res = await request(app).delete(`/api/piles/${pile.id}?cards=keep`);
    expect(res.status).toBe(204);
    expect(await Pile.findByPk(pile.id)).toBeNull();
  });

  it.each(['999999', 'abc'])('returns 404 for id %s', async (id) => {
    const res = await request(app).delete(`/api/piles/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Pile not found' });
  });

  it('returns 404 for an unknown id even with an invalid cards param', async () => {
    const res = await request(app).delete('/api/piles/999999?cards=maybe');
    expect(res.status).toBe(404);
  });

  it('rolls back when the delete fails half-way', async () => {
    const pile = await makePile('Rollback');
    const cards = await makeCards(pile.id, 2);
    vi.spyOn(Pile.prototype, 'destroy').mockRejectedValueOnce(new Error('boom'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).delete(`/api/piles/${pile.id}?cards=keep`);

    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalled();
    expect(await Pile.findByPk(pile.id)).not.toBeNull();
    for (const card of cards) {
      expect((await Card.findByPk(card.id)).pileId).toBe(pile.id);
    }
  });
});
