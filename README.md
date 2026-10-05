# BrainCramBam - Flash Card App

**Study like it's loud.**

Turn facts into flashcards and give your memory a workout. BrainCramBam
pairs a bold, comic-inspired look with a simple study flow: write a
question, flip for the answer, and keep your card pile fresh.

- Sort your cards into piles, one per subject, each with its own tab.
- Create your own question-and-answer cards.
- Flip cards to test your recall, then edit them inline or toss them
  with a confirmation.
- Press and hold cards to select them, then drag them onto another
  pile's tab (or use **Move to…**).
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
an empty database is populated with sample piles and cards. Upgrading
from a version without piles? On first start, the cards already in
your database move into a new "General" pile.

### Development checks

```sh
npm run lint
npm test
npx playwright install chromium
npm run e2e
```

## Using piles

Every card lives in a pile, like Geography, Math or Law. Each pile has
a tab above the cards that shows its name and card count. Click a tab
to open that pile, or **+ New pile** to make another one. With no piles
at all (say, after deleting every one), the app asks you to make a pile
before your first card.

- **Rename** and **Delete pile** sit in the pile's header. Deleting a
  pile that still has cards asks what to do with them: keep them, or
  delete them too.
- **Unsorted** holds kept cards whose pile was deleted. Its tab only
  shows up while it has cards.
- **Press and hold** a card for a moment to select it. Tap more cards to
  add them to the selection, and press **Clear** or Esc to stop.
- **Drag** selected cards onto another pile's tab to move them there.
  The tab says `Drop into ‹Name›` while the cards are over it.
- **Move to…** in the selection bar does the same without dragging:
  pick a pile and press **Move**. Once cards are selected, Move to…
  works with a keyboard and screen reader; selecting cards needs a
  press and hold for now.

## API

The Vite dev server proxies `/api/*` to the Express server on
http://localhost:3001. Errors come back as `{ error: { code, message } }`.

| Method | Path                            | Description                                                                 |
| ------ | ------------------------------- | --------------------------------------------------------------------------- |
| GET    | /api/ping                       | health check                                                                |
| GET    | /api/piles                      | list piles, oldest first: `{ piles: [{ id, name, cardCount, createdAt }], unsortedCount }` |
| POST   | /api/piles                      | create a pile (name; trimmed, 1–40 chars, unique ignoring case)            |
| PUT    | /api/piles/:id                  | rename a pile                                                               |
| DELETE | /api/piles/:id                  | delete an empty pile (409 `PILE_NOT_EMPTY` with `details.cardCount` if it has cards) |
| DELETE | /api/piles/:id?cards=keep       | delete a pile; its cards become Unsorted (`pileId` null)                    |
| DELETE | /api/piles/:id?cards=delete     | delete a pile and its cards                                                 |
| GET    | /api/cards?pileId=:id           | list one pile's cards, newest first (`pileId` is required)                  |
| GET    | /api/cards?pileId=unsorted      | list the cards without a pile, newest first                                 |
| POST   | /api/cards                      | create a card (question, answer, pileId — required)                         |
| PUT    | /api/cards/:id                  | update a card's question and answer (`pileId` is ignored)                   |
| DELETE | /api/cards/:id                  | delete a card                                                               |
| POST   | /api/cards/move                 | move cards to a pile (`{ cardIds, pileId }` → `{ movedCount }`)             |
