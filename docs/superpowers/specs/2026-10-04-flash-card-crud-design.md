# Flash Card CRUD — Design

Date: 2026-10-04
Status: Approved in brainstorming, pending spec review

## Goal

First real feature of BrainCramBam: users create flash cards (question on the
front, answer on the back), see all cards in a grid, flip any card to reveal
its answer, edit cards inline, and delete cards after confirming.

## Scope

In scope:

- Create, list, edit, delete cards (persisted in SQLite).
- Grid of all cards, newest first; each card flips independently.
- Inline edit on the card; delete behind a confirmation dialog.

Out of scope (later work): decks, study/quiz mode, accounts, rich text/images,
search, pagination.

## Decisions

| Topic        | Decision                                                        |
| ------------ | --------------------------------------------------------------- |
| Content      | Plain text, both sides required, trimmed, 1–200 chars per side   |
| Display      | All cards in a grid, newest first (`createdAt DESC`)            |
| Flip         | Click or Enter/Space; CSS 3D flip, disabled under reduced motion |
| Edit         | Inline — card becomes a form with Save / Cancel                 |
| Delete       | Custom accessible confirm dialog before deleting                |
| Users        | None — single shared set of cards                               |
| Server state | TanStack Query on the client                                    |
| Empty state  | "No cards yet — create one above."                              |

## 1. Data model and API

### Model (`server/src/db.js`)

Sequelize, SQLite dialect. Storage `server/flashcards.db`; `:memory:` when
`NODE_ENV=test`.

| Field                     | Type        | Rules                          |
| ------------------------- | ----------- | ------------------------------ |
| `id`                      | INTEGER PK  | auto-increment                 |
| `question`                | STRING(200) | not null, trimmed, 1–200 chars |
| `answer`                  | STRING(200) | not null, trimmed, 1–200 chars |
| `createdAt` / `updatedAt` | DATE        | Sequelize timestamps           |

`server/src/seed.js` exports an idempotent `seed()` that inserts a few sample
cards only when the table is empty.

### Validation

A Zod `cardSchema` at the route boundary: `question` and `answer` are strings,
trimmed, min 1, max 200. Unknown keys are stripped. Length is checked after
trimming, so whitespace-only input fails as "required".

### Routes (`server/src/app.js`)

| Method | Path           | Success                            | Errors   |
| ------ | -------------- | ---------------------------------- | -------- |
| GET    | /api/cards     | 200 `Card[]`, newest first         | —        |
| POST   | /api/cards     | 201 `Card`                         | 400      |
| PUT    | /api/cards/:id | 200 `Card` (both fields required)  | 400, 404 |
| DELETE | /api/cards/:id | 204, empty body                    | 404      |

`Card` = `{ id, question, answer, createdAt, updatedAt }`.

Errors use `{ error: { code, message } }`:

- `VALIDATION_ERROR` (400) — also includes `details: { question?: string, answer?: string }`.
- `NOT_FOUND` (404) — unknown card id, a non-positive-integer id, or an unknown `/api` route.
- `INTERNAL_ERROR` (500) — final error middleware; logs the error, never sends stack traces.

## 2. Frontend

New dependency: `@tanstack/react-query`. `main.jsx` wraps `<App />` in a
`QueryClientProvider`.

| File                            | Job                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/api/cards.js`       | `listCards`, `createCard`, `updateCard`, `deleteCard`. Non-2xx responses throw `ApiError { status, code, message, details }`.                                                                              |
| `client/src/hooks/useCards.js`  | `useCards()` query (key `['cards']`); `useCreateCard`, `useUpdateCard`, `useDeleteCard` mutations that invalidate `['cards']` on success.                                                                   |
| `client/src/validation/card.js` | `validateCard({ question, answer })` → `{ question?, answer? }` error messages. Same rules as the server: required after trim, max 200.                                                                     |
| `components/CardForm.jsx`       | Shared by create and inline edit. Props: `initialValues`, `onSubmit`, `onCancel?`, `submitLabel`. Shows `n/200` counters and field errors, disables submit while pending, maps server `details` onto fields, shows a general message for other failures, keeps input on failure. Create form clears after success. |
| `components/FlashCard.jsx`      | One card. Click / Enter / Space toggles the face (`role="button"`, `aria-pressed`). Edit and Delete buttons stop propagation so they don't flip. Edit mode renders `CardForm` with the current values. |
| `components/CardGrid.jsx`       | Responsive grid, keyed by `card.id` so flip state survives refetches. Shows loading, empty ("No cards yet — create one above."), and error ("Couldn't load cards" + Retry) states.                         |
| `components/ConfirmDialog.jsx`  | Native `<dialog>` with `showModal()`: focus stays inside, Esc cancels, focus returns to the button that opened it.                                                                                        |
| `client/src/App.jsx`            | Header, create `CardForm`, `CardGrid`.                                                                                                                                                                     |

How data moves: submit → `validateCard` (blocks if invalid) → mutation → API →
on success the `['cards']` query is invalidated and refetched; on a 400 the
`details` show on the fields; any other failure shows a general form error.

Styling: Tailwind. The flip uses `transform-style: preserve-3d` and
`backface-visibility: hidden`; under `prefers-reduced-motion: reduce` it swaps
faces with no animation.

## 3. Testing

Test-first: each unit starts with a failing test.

| Layer             | Tool                                  | Cases                                                                                                                                                         |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API               | Vitest + Supertest                    | Every route; 400 (missing, whitespace-only, 201 chars), 200-char boundary passes; 404 (unknown id, bad id); newest-first order; unknown keys stripped; 500 shape |
| Client validation | Vitest                                | Empty, whitespace-only, 200 vs 201 chars, trimming                                                                                                            |
| Components        | Vitest + React Testing Library, mocked fetch | FlashCard flips on click/Enter/Space but not from Edit/Delete; CardForm counters, errors, blocks invalid input, server `details`, disabled while pending; CardGrid loading/empty/error/Retry; ConfirmDialog confirm/cancel/Esc/focus return |
| E2E               | Playwright (`/e2e`)                   | Create → flip → inline edit → delete (cancel, then confirm) → reload confirms changes were saved; invalid input shows an error and saves nothing                |

API tests: `beforeAll` runs `sequelize.sync({ force: true })` and then `seed()`.
E2E: Playwright's `webServer` starts the server with `NODE_ENV=test`, so it
uses the in-memory database. `index.js` runs `sync()` + `seed()` on startup,
so every run starts fresh and `flashcards.db` is never touched. E2E tests
create their own uniquely named cards and do not rely on the seed data.

## Build order

1. DB model + seed
2. API routes
3. API client + hooks
4. Client validation
5. Components
6. App assembly
7. E2E
8. Update CLAUDE.md (stack line, structure, API routes table)

The pre-commit hook (lint + unit + API + e2e) must pass on every commit; never
use `--no-verify`.
