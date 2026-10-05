import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Pile, Card } from './db.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

// Why this file exists: the write routes run inside sequelize.transaction(). Two overlapping
// requests used to start two transactions at once, and SQLite allows only one at a time.
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
    const [moving, staying] = await Card.bulkCreate([
      { question: 'Move me?', answer: 'Yes', pileId: target.id },
      { question: 'Keep me?', answer: 'Yes', pileId: doomed.id },
    ]);

    const [moved, deleted] = await Promise.all([
      request(app).post('/api/cards/move').send({ cardIds: [moving.id], pileId: target.id }),
      request(app).delete(`/api/piles/${doomed.id}?cards=keep`),
    ]);

    expect(moved.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect((await Card.findByPk(staying.id)).pileId).toBeNull();
  });
});
