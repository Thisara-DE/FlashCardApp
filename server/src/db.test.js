import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card } from './db.js';
import { seed, SEED_CARDS } from './seed.js';

beforeEach(async () => {
  await sequelize.sync({ force: true });
});

describe('Card model', () => {
  it('uses an in-memory database under NODE_ENV=test', () => {
    expect(sequelize.options.storage).toBe(':memory:');
  });

  it('stores a question and answer with timestamps', async () => {
    const card = await Card.create({ question: 'Q?', answer: 'A' });
    expect(card.id).toBeTypeOf('number');
    expect(card.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an empty question and a 201-character answer', async () => {
    await expect(Card.create({ question: '', answer: 'A' })).rejects.toThrow();
    await expect(
      Card.create({ question: 'Q', answer: 'a'.repeat(201) }),
    ).rejects.toThrow();
  });
});

describe('seed()', () => {
  it('inserts the sample cards into an empty table', async () => {
    await seed();
    expect(await Card.count()).toBe(SEED_CARDS.length);
  });

  it('does nothing when cards already exist', async () => {
    await Card.create({ question: 'Mine?', answer: 'Yes' });
    await seed();
    expect(await Card.count()).toBe(1);
  });
});
