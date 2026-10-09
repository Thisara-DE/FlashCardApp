import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card, Pile, runExclusive, runInTransaction } from './db.js';

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

describe('write queue', () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  it('still runs the next transaction after one fails', async () => {
    await expect(
      runInTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // The rejection above passes either way; this is the part that proves the queue survived.
    await runInTransaction((transaction) => Pile.create({ name: 'After a failure' }, { transaction }));
    expect(await Pile.findOne({ where: { name: 'After a failure' } })).not.toBeNull();
  });

  it('rejects a nested call instead of hanging, and keeps working afterwards', async () => {
    await expect(runInTransaction(() => runInTransaction(async () => {}))).rejects.toThrow(/nest/i);
    await expect(runExclusive(() => runExclusive(async () => {}))).rejects.toThrow(/nest/i);

    await expect(runInTransaction(async () => 'still works')).resolves.toBe('still works');
  });

  it('lets a call from outside wait its turn while another write is running', async () => {
    const order = [];
    let second;
    const first = runExclusive(async () => {
      order.push('first starts');
      await wait(30);
      order.push('first ends');
    });
    // Called while `first` is running, but not from inside it, so it is not nesting.
    setTimeout(() => {
      second = runExclusive(async () => order.push('second runs'));
    }, 5);

    await first;
    await wait(10);
    await second;
    expect(order).toEqual(['first starts', 'first ends', 'second runs']);
  });
});
