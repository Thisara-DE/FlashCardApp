# BrainCramBam - Flash Card App

**Study like it's loud.**

Turn facts into flashcards and give your memory a workout. BrainCramBam
pairs a bold, comic-inspired look with a simple study flow: write a
question, flip for the answer, and keep your card pile fresh.

- Create your own question-and-answer cards.
- Flip cards to test your recall, then edit them inline or toss them
  with a confirmation.
- Keep your cards between sessions with local SQLite storage.

Built with React, Vite, Tailwind CSS, Express, and Sequelize.

## Quick start

Install a current Node.js LTS release with npm, then run these commands
from the project root:

```sh
npm install
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:3001.
The database is created automatically at `server/flashcards.db`, and
an empty database is populated with sample cards.

### Development checks

```sh
npm run lint
npm test
npx playwright install chromium
npm run e2e
```
