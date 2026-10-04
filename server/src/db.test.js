import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card, Pile } from './db.js';

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

describe('Pile model', () => {
  it('stores a name and owns cards through pileId', async () => {
    const pile = await Pile.create({ name: 'Math' });
    const card = await Card.create({ question: 'Q?', answer: 'A', pileId: pile.id });
    expect(card.pileId).toBe(pile.id);
    expect(await pile.countCards()).toBe(1);
  });

  it('allows a card with no pile (Unsorted)', async () => {
    expect((await Card.create({ question: 'Q?', answer: 'A' })).pileId).toBeNull();
  });

  it('rejects an empty or 41-character name', async () => {
    await expect(Pile.create({ name: '' })).rejects.toThrow();
    await expect(Pile.create({ name: 'a'.repeat(41) })).rejects.toThrow();
  });
});
