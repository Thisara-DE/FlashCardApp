# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project memory:** read `AGENTS.md` in this repo first (git-ignored, local only). It points to the operating rules and project memory, and those rules take precedence.

## Stack

A flashcard app for studying via question/answer decks.
React + Vite frontend, Express backend (Node ESM). Database: SQLite via Sequelize ORM.

## Commands

```sh
npm run dev          # start both server (port 3001) and client (port 5173) concurrently
npm run dev -w server  # server only
npm run dev -w client  # client only
```

## Structure

```
client/              Vite + React frontend
  src/api/           request.js (fetch wrapper, ApiError), cards.js, piles.js
  src/hooks/         TanStack Query hooks (useCards, usePiles, ...); useSelectedPile,
                     useCardSelection, useMoveSelection, usePileDelete, usePileDrag,
                     useLongPress, useDragSensors
  src/validation/    card and pile validation rules shared by the forms
  src/components/    CardForm, CardGrid, FlashCard, ConfirmDialog, PileTabs, PileHeader,
                     PileNameForm, DeletePileDialog, SelectionBar, NoPilesState, DragGhost
  src/queryClient.js TanStack QueryClient setup (retry rules)
  src/test/fakeApi.js  fetch stubs for component tests
server/              Express API
  src/app.js         Route handlers
  src/index.js       Entry point
  src/db.js          Sequelize instance + Card and Pile models
  src/migrate.js     Upgrades a pre-piles database (adds pileId; old cards go to "General")
  src/seed.js        Idempotent seed function (fills an empty table only)
  src/schemas/       Zod request schemas
e2e/                 Playwright end-to-end tests
```

## API routes

| Method | Path                            | Description                                                                 |
| ------ | ------------------------------- | --------------------------------------------------------------------------- |
| GET    | /api/ping                       | health check                                                                |
| GET    | /api/piles                      | list piles, oldest first: `{ piles: [{ id, name, cardCount, createdAt }], unsortedCount }` |
| POST   | /api/piles                      | create a pile (name; trimmed, 1–40 chars, unique ignoring case)            |
| PUT    | /api/piles/:id                  | rename a pile                                                               |
| DELETE | /api/piles/:id                  | delete an empty pile (409 `PILE_NOT_EMPTY` with `details.cardCount` if it has cards) |
| DELETE | /api/piles/:id?cards=keep       | delete a pile; its cards move to the General pile (made if missing; deleting General itself leaves them Unsorted) |
| DELETE | /api/piles/:id?cards=delete     | delete a pile and its cards                                                 |
| GET    | /api/cards?pileId=:id           | list one pile's cards, newest first (`pileId` is required)                  |
| GET    | /api/cards?pileId=unsorted      | list the cards without a pile, newest first                                 |
| POST   | /api/cards                      | create a card (question, answer, pileId — required)                         |
| PUT    | /api/cards/:id                  | update a card's question and answer (`pileId` is ignored)                   |
| DELETE | /api/cards/:id                  | delete a card                                                               |
| POST   | /api/cards/move                 | move cards to a pile (`{ cardIds, pileId }` → `{ movedCount }`)             |

The Vite dev server proxies `/api/*` to `http://localhost:3001`.

## DO NOT MODIFY THIS SECTION WITHOUT ASKING ME

- Every write-plan output must restate coding guidelines and conventions in a "Constraints" section — execute-plan subagents read the plan, not this file.

### Coding guidelines

- Test-first (TDD). Tests come first, always.
- Build production grade code
- Use best practices for readability in React, Express
- Validate frontend inputs. Required fields, types, length limits, basic format checks.
- Write for a junior-to-mid dev. Clear and conventional over clever.
- Use pragmatic error handling
- Write e2e tests for critical paths in the application
- (Optional) Why-comments. Short explanations where they help a beginner.
- Don't tell me what approaches you recommend until I ask for them

### Conventions

- Validation: Zod at the API route boundary (when added).
- ORM: Sequelize with SQLite dialect. Models in `server/src/db.js`. Storage: `server/flashcards.db` (production), `:memory:` (test via `NODE_ENV=test`).
- Tests: Vitest; API routes via Supertest. Test `beforeAll` calls `sequelize.sync({ force: true })` + `seed()`.
- E2E: Playwright, in /e2e (pre-commit for now).
- Errors: Return `{ error: { code, message } }`; 404 for unknown routes/resources.
- Pre-commit: Runs lint + unit + API tests + e2e. Never bypass with --no-verify.
