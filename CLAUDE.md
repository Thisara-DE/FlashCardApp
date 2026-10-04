# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
  src/api/           fetch wrapper for /api/cards (ApiError)
  src/hooks/         TanStack Query hooks (useCards, useCreateCard, ...)
  src/validation/    card validation rules shared by the forms
  src/components/    CardForm, CardGrid, FlashCard, ConfirmDialog
server/              Express API
  src/app.js         Route handlers
  src/index.js       Entry point
  src/db.js          Sequelize instance + Card model
  src/seed.js        Idempotent seed function (fills an empty table only)
  src/schemas/       Zod request schemas
e2e/                 Playwright end-to-end tests
```

## API routes

| Method | Path           | Description                      |
| ------ | -------------- | -------------------------------- |
| GET    | /api/ping      | health check                     |
| GET    | /api/cards     | list all cards, newest first     |
| POST   | /api/cards     | create a card (question, answer) |
| PUT    | /api/cards/:id | update a card                    |
| DELETE | /api/cards/:id | delete a card                    |

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
