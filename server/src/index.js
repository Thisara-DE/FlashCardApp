import app from './app.js';
import { sequelize } from './db.js';
import { seed } from './seed.js';

const PORT = process.env.PORT || 3001;

// Create the table and sample cards before accepting requests. Without the
// table the API is useless, so exit instead of running half-broken.
try {
  await sequelize.sync();
  await seed();
} catch (err) {
  console.error('Failed to set up the database:', err);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
