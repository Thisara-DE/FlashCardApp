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
