import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Pile, Card } from './db.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Why this file exists: SQLite allows one transaction at a time, and two overlapping requests
// used to start two at once. Every write route now waits its turn in one queue (runExclusive
// in db.js), whether or not it uses a transaction.
describe('overlapping write requests', () => {
  it('lets several card moves run at the same time', async () => {
    const [from, to] = await Pile.bulkCreate([{ name: 'From' }, { name: 'To' }]);
    const cards = await Card.bulkCreate(
      Array.from({ length: 6 }, (_, i) => ({ question: `Q${i}?`, answer: `A${i}`, pileId: from.id })),
    );

    const responses = await Promise.all(
      cards.map((card) => request(app).post('/api/cards/move').send({ cardIds: [card.id], pileId: to.id })),
    );

    expect(responses.map((res) => res.status)).toEqual(cards.map(() => 200));
    expect(await Card.count({ where: { pileId: to.id } })).toBe(6);
  });

  it('lets a pile delete and a card move run at the same time', async () => {
    const [doomed, target] = await Pile.bulkCreate([{ name: 'Doomed' }, { name: 'Target' }]);
    // `moving` starts Unsorted, so the assertion below proves the move really happened.
    const [moving, staying] = await Card.bulkCreate([
      { question: 'Move me?', answer: 'Yes', pileId: null },
      { question: 'Keep me?', answer: 'Yes', pileId: doomed.id },
    ]);

    const [moved, deleted] = await Promise.all([
      request(app).post('/api/cards/move').send({ cardIds: [moving.id], pileId: target.id }),
      request(app).delete(`/api/piles/${doomed.id}?cards=keep`),
    ]);

    expect(moved.status).toBe(200);
    expect(deleted.status).toBe(204);
    const general = await Pile.findOne({ where: { name: 'General' } });
    expect((await Card.findByPk(staying.id)).pileId).toBe(general.id);
    expect((await Card.findByPk(moving.id)).pileId).toBe(target.id);
  });

  // With one shared in-memory connection, a write that skips the queue runs inside whatever
  // transaction is open, so that transaction's rollback would take the write with it.
  it('keeps a card created while a pile delete is rolling back', async () => {
    const [doomed, other] = await Pile.bulkCreate([{ name: 'Doomed twice' }, { name: 'Other' }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let signalTransactionOpen;
    const transactionOpen = new Promise((resolve) => {
      signalTransactionOpen = resolve;
    });
    vi.spyOn(Pile.prototype, 'destroy').mockImplementationOnce(async () => {
      // Hold the delete's transaction open for a moment, then make it fail and roll back.
      signalTransactionOpen();
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error('boom');
    });

    // .then() makes supertest send the request now instead of when it is awaited.
    const deleting = request(app).delete(`/api/piles/${doomed.id}?cards=delete`).then((res) => res);
    await transactionOpen;
    // Sent from here, not from inside the mock, so it arrives like any other outside request.
    const createdRes = await request(app)
      .post('/api/cards')
      .send({ question: 'Saved?', answer: 'Yes', pileId: other.id });
    const deleted = await deleting;

    expect(deleted.status).toBe(500);
    expect(createdRes.status).toBe(201);
    expect(await Card.findByPk(createdRes.body.id)).not.toBeNull();
  });
});
