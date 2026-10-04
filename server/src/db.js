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

// Zod checks input at the API boundary; the length rule here is a safety net.
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
});
