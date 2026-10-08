import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'node:url';

// Tests use a throwaway in-memory database. Otherwise the file always lands in
// server/, whatever directory the server is started from.
const storage =
  process.env.NODE_ENV === 'test'
    ? ':memory:'
    : fileURLToPath(new URL('../flashcards.db', import.meta.url));

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false,
});

// SQLite allows one transaction at a time, and the in-memory database shares a single
// connection, so two overlapping transactions fail ("cannot start a transaction within a
// transaction"). This queue makes each transaction wait for the one before it.
let lastTransaction = Promise.resolve();

export function runInTransaction(work) {
  // A failed transaction must not block the queue, so the next one starts either way.
  const result = lastTransaction.then(() => sequelize.transaction(work));
  lastTransaction = result.catch(() => {});
  return result;
}

// The catch-all pile: cards from a deleted pile (kept) and cards from an upgraded database land here.
export const GENERAL_PILE_NAME = 'General';

// Zod checks input at the API boundary; the length rules here are a safety net.
export const Pile = sequelize.define('Pile', {
  name: {
    type: DataTypes.STRING(40),
    allowNull: false,
    validate: { len: [1, 40] },
  },
});

export const Card = sequelize.define('Card', {
  question: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { len: [1, 200] },
  },
  answer: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { len: [1, 200] },
  },
  // Null means the card is "Unsorted" (it has no pile). The explicit default
  // makes a freshly created card report null instead of undefined.
  pileId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
});

Pile.hasMany(Card, { foreignKey: 'pileId' });
Card.belongsTo(Pile, { foreignKey: 'pileId' });
