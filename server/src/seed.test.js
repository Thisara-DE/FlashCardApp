import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card, Pile } from './db.js';
import { seed, SEED_PILES } from './seed.js';

beforeEach(async () => {
  await sequelize.sync({ force: true });
});

describe('seed()', () => {
  it('creates the five piles in order with two cards each', async () => {
    await seed();
    const piles = await Pile.findAll({ order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    expect(piles.map((p) => p.name)).toEqual(['Geography', 'History', 'Law', 'Math', 'Science']);
    expect(SEED_PILES.map((p) => p.name)).toEqual(piles.map((p) => p.name));
    for (const pile of piles) expect(await pile.countCards()).toBe(2);
    expect(await Card.findOne({ where: { question: 'What is a tort?' } })).toMatchObject({
      answer: 'A civil wrong that causes harm or loss',
      pileId: piles[2].id,
    });
  });

  it('does nothing when any pile exists', async () => {
    await Pile.create({ name: 'Mine' });
    await seed();
    expect(await Pile.count()).toBe(1);
    expect(await Card.count()).toBe(0);
  });

  it('does nothing when any card exists, even an unsorted one', async () => {
    await Card.create({ question: 'Mine?', answer: 'Yes' });
    await seed();
    expect(await Pile.count()).toBe(0);
    expect(await Card.count()).toBe(1);
  });
});
