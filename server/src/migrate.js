import { DataTypes } from 'sequelize';
import { sequelize, Card, Pile, runInTransaction } from './db.js';

// Upgrades a database created before piles existed. sync() creates the new
// Piles table but never adds a column to an existing table, so Cards.pileId
// has to be added by hand. Safe to run on every start.
export async function migrate() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('Cards');
  if (columns.pileId) return;

  await queryInterface.addColumn('Cards', 'pileId', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });

  // Existing cards keep a home: one transaction so we never end up with a
  // General pile that no card belongs to.
  await runInTransaction(async (transaction) => {
    if ((await Card.count({ transaction })) === 0) return;
    const general = await Pile.create({ name: 'General' }, { transaction });
    await Card.update({ pileId: general.id }, { where: {}, transaction });
  });
}
