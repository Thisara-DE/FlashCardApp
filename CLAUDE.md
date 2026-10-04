# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

[One-sentence description of your app — what it does and who it's for.]
React + Vite frontend, Express backend (Node ESM). [Database: e.g. SQLite via Sequelize ORM — or remove if not added yet.]

## Commands

```sh
npm run dev          # start both server (port 3001) and client (port 5173) concurrently
npm run dev -w server  # server only
npm run dev -w client  # client only
```

## Structure

```
client/        Vite + React frontend
server/        Express API
  src/app.js   Route handlers
  src/index.js Entry point
  [src/db.js   Sequelize instance + model definitions — add when DB is wired up]
  [src/seed.js Idempotent seed function — add when DB is wired up]
```

## API routes

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | /api/ping | health check |
| [...]  | [...]     | [...]        |

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
