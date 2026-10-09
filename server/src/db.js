import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';

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
// transaction"). A plain write is not safe either: on the shared connection it would run
// inside whatever transaction is open, and vanish if that one rolls back. So every write
// waits its turn in this one queue.
let lastWrite = Promise.resolve();

// Remembers whether the code running now was started by the queue. A plain flag can't do this:
// another request calling in while a write runs is fine (it just waits), but a call from
// *inside* a queued write would wait for itself forever and block every later write.
const insideQueuedWrite = new AsyncLocalStorage();

export function runExclusive(work) {
  if (insideQueuedWrite.getStore()) {
    return Promise.reject(
      new Error('Nested write: runExclusive/runInTransaction was called inside another one. Pass the transaction down instead.'),
    );
  }
  const result = lastWrite.then(() => insideQueuedWrite.run(true, work));
  // A failed write must not block the queue, so the next one starts either way.
  lastWrite = result.catch(() => {});
  return result;
}

export function runInTransaction(work) {
  return runExclusive(() => sequelize.transaction(work));
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
