import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card, Pile } from './db.js';
import { migrate } from './migrate.js';

// Build the old Cards table (no pileId) by hand, as an upgraded install has it.
beforeEach(async () => {
  await sequelize.sync({ force: true });
  await sequelize.query('DROP TABLE Cards');
  await sequelize.query(`CREATE TABLE Cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question VARCHAR(200) NOT NULL, answer VARCHAR(200) NOT NULL,
    createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
});

const insertOldCard = (q) =>
  sequelize.query(
    "INSERT INTO Cards (question, answer, createdAt, updatedAt) VALUES (?, 'A', datetime('now'), datetime('now'))",
    { replacements: [q] },
  );

describe('migrate()', () => {
  it('adds pileId and puts every existing card in a new General pile', async () => {
    await insertOldCard('One?');
    await insertOldCard('Two?');
    await migrate();
    const columns = await sequelize.getQueryInterface().describeTable('Cards');
    expect(columns).toHaveProperty('pileId');
    const piles = await Pile.findAll();
    expect(piles.map((p) => p.name)).toEqual(['General']);
    expect(await Card.count({ where: { pileId: piles[0].id } })).toBe(2);
  });

  it('is safe to run twice', async () => {
    await insertOldCard('One?');
    await migrate();
    await migrate();
    expect(await Pile.count()).toBe(1);
  });

  it('creates no General pile when the old table is empty', async () => {
    await migrate();
    expect(await Pile.count()).toBe(0);
  });

  it('does nothing on a current-shape table', async () => {
    await sequelize.sync({ force: true });
    await Card.create({ question: 'Q?', answer: 'A' });
    await migrate();
    expect(await Pile.count()).toBe(0);
  });
});
