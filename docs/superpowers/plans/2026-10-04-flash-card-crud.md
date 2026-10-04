# Flash Card CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users create, see (grid, flip), edit inline and delete flash cards, stored in SQLite, in the "Comic Pop" visual style.

**Architecture:** Express serves `/api/cards` (Zod at the route, Sequelize model in `db.js`). The React client talks to it through a small `fetch` wrapper and TanStack Query hooks; presentational components (`CardForm`, `FlashCard`, `CardGrid`, `ConfirmDialog`) receive data and callbacks as props, and `App` wires the hooks to them.

**Tech Stack:** Node ESM, Express 4, Zod 3, Sequelize 6 + sqlite3, React 18, Vite 6, Tailwind v4, TanStack Query 5, Vitest 3, Supertest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-flash-card-crud-design.md` (read it alongside this plan; section 2a is the visual design). Visual reference: the "1 · Wild — Comic Pop" artboard at https://claude.ai/artifact/JoK4Q3mGNoCYG2TZNiGt8Q.

## Constraints

Restated from `CLAUDE.md`. Every task must follow these.

**Coding guidelines**

- Test-first (TDD). Tests come first, always. Every task starts with a failing test, run and seen failing.
- Build production-grade code.
- Use best practices for readability in React and Express.
- Validate frontend inputs: required fields, types, length limits, basic format checks.
- Write for a junior-to-mid dev. Clear and conventional over clever.
- Use pragmatic error handling.
- Write e2e tests for the critical paths of the application.
- (Optional) Why-comments: short explanations where they help a beginner.
- Don't tell the user which approaches you recommend until they ask.

**Conventions**

- Validation: Zod at the API route boundary.
- ORM: Sequelize with the SQLite dialect. Models in `server/src/db.js`. Storage: `server/flashcards.db` (production), `:memory:` when `NODE_ENV=test`.
- Tests: Vitest; API routes via Supertest. API test `beforeAll` calls `sequelize.sync({ force: true })` then `seed()`.
- E2E: Playwright, in `/e2e`.
- Errors: return `{ error: { code, message } }`; 404 for unknown routes and resources.
- Pre-commit runs lint + unit + API tests + e2e. **Never bypass it with `--no-verify`.** Each task's commit must pass it, so a task that changes visible UI also updates any e2e test it breaks.

## Global Constraints

From the spec. These apply to every task.

- Card content: plain text, both sides required, trimmed, 1–200 characters per side (length checked **after** trimming).
- Exact validation messages, identical on server and client:
  - `Question is required` / `Answer is required` (missing, empty or whitespace-only)
  - `Question must be 200 characters or fewer` / `Answer must be 200 characters or fewer`
  - `Question must be text` / `Answer must be text` (wrong type, including `null`; server only)
- Error codes: `VALIDATION_ERROR` (400, with `details: { question?, answer? }`), `NOT_FOUND` (404), `INTERNAL_ERROR` (500, never a stack trace).
- List order: newest first, `createdAt DESC`, tie broken by `id DESC`.
- Copy (spec 2a): page title `BrainCramBam`; create form heading `Make a card`, submit `Slam it in!`; card footers `Flip it →` / `← Flip back`; badges `Q!` / `A!`; card actions `Edit` / `Toss`; edit heading `Fix this card`, buttons `Save` / `Cancel`; dialog title `Toss it for real?`, body `“{question}” goes in the bin. No take-backs.`, buttons `Keep it` / `Toss it`; grid heading `The pile`, hint `Tap a card to flip it — newest on top`; empty `No cards yet — make your first one!`; load error `Couldn't load cards` + `Retry`; count badge `{n} cards in the pile` (`1 card in the pile` when n = 1).
- Generic save error (any non-400 failure): `Something went wrong — your card wasn't saved. Try again.`
- Delete error (non-404 failure): `Couldn't toss this card. Try again.`
- Colours, fonts, borders, shadows, tilt and focus ring: exactly as in spec section 2a.
- Everything with motion (tilt transitions, hover movement, 3D flip) is off under `prefers-reduced-motion: reduce`.
- Every component declares `propTypes` (the `prop-types` package is already a dependency).

## Review Focus

Inputs the spec implies but doesn't spell out. Each one has a test in the task named.

- Malformed JSON body (`{"question":`) → 400 `VALIDATION_ERROR` with message `Request body must be valid JSON`, not a 500. (Task 2)
- Non-string fields (`question: 123`, `answer: null`) → 400 with `Question must be text` / `Answer must be text` in `details`, not a crash or a stored `"123"`. (Task 2)
- Cards created in the same millisecond (the seed uses `bulkCreate`) still come back in a stable newest-first order, thanks to the `id DESC` tie-break. (Task 2)
- The hidden face of a card must not leak into its accessible name: a screen-reader user hears the answer only after flipping. (Task 6)
- Deleting a card that is already gone (404) closes the dialog and refreshes the list; any other delete failure keeps the dialog open with an error message. (Task 9)

---

## File structure

```
server/
  package.json                 + sequelize, sqlite3
  src/db.js                    NEW  Sequelize instance + Card model
  src/seed.js                  NEW  idempotent seed()
  src/db.test.js               NEW  model + seed tests
  src/schemas/card.js          NEW  Zod cardSchema + messages
  src/app.js                   MOD  /api/cards routes, error middleware
  src/cards.test.js            NEW  API tests
  src/index.js                 MOD  sync() + seed() before listen
client/
  package.json                 + @tanstack/react-query
  index.html                   MOD  title, Google Fonts link
  src/index.css                MOD  @theme tokens + Comic Pop component CSS
  src/main.jsx                 MOD  QueryClientProvider
  src/test-setup.js            MOD  <dialog> polyfill for jsdom
  src/test-utils.jsx           NEW  renderWithClient()
  src/api/cards.js             NEW  fetch wrapper + ApiError
  src/api/cards.test.js        NEW
  src/hooks/useCards.js        NEW  query + mutations
  src/validation/card.js       NEW  validateCard()
  src/validation/card.test.js  NEW
  src/components/CardForm.jsx        NEW (+ .test.jsx)
  src/components/FlashCard.jsx       NEW (+ .test.jsx)
  src/components/ConfirmDialog.jsx   NEW (+ .test.jsx)
  src/components/CardGrid.jsx        NEW (+ .test.jsx)
  src/App.jsx                  MOD  header, wiring, delete flow
  src/App.test.jsx             MOD
e2e/
  home.spec.js                 MOD  new heading
  cards.spec.js                NEW  critical path
playwright.config.js           MOD  server under NODE_ENV=test
CLAUDE.md                      MOD  structure + API routes table
```

---

### Task 1: Card model and seed

**Files:**
- Modify: `server/package.json` (run `npm install sequelize@^6.37 sqlite3@^5.1 -w server`)
- Create: `server/src/db.js`, `server/src/seed.js`
- Modify: `server/src/index.js`
- Test: `server/src/db.test.js`

**Interfaces:**
- Produces: `db.js` exports `sequelize` (Sequelize instance) and `Card` (model with `id`, `question`, `answer`, `createdAt`, `updatedAt`). `seed.js` exports `async function seed(): Promise<void>` and `SEED_CARDS: Array<{ question, answer }>`.

- [ ] **Step 1: Write the failing tests** in `server/src/db.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { sequelize, Card } from './db.js';
import { seed, SEED_CARDS } from './seed.js';

beforeEach(async () => {
  await sequelize.sync({ force: true });
});

describe('Card model', () => {
  it('uses an in-memory database under NODE_ENV=test', () => {
    expect(sequelize.options.storage).toBe(':memory:');
  });

  it('stores a question and answer with timestamps', async () => {
    const card = await Card.create({ question: 'Q?', answer: 'A' });
    expect(card.id).toBeTypeOf('number');
    expect(card.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an empty question and a 201-character answer', async () => {
    await expect(Card.create({ question: '', answer: 'A' })).rejects.toThrow();
    await expect(
      Card.create({ question: 'Q', answer: 'a'.repeat(201) }),
    ).rejects.toThrow();
  });
});

describe('seed()', () => {
  it('inserts the sample cards into an empty table', async () => {
    await seed();
    expect(await Card.count()).toBe(SEED_CARDS.length);
  });

  it('does nothing when cards already exist', async () => {
    await Card.create({ question: 'Mine?', answer: 'Yes' });
    await seed();
    expect(await Card.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test -w server -- db.test.js`
Expected: FAIL, `Cannot find module './db.js'`.

- [ ] **Step 3: Implement `db.js` and `seed.js`**

- `db.js`: `new Sequelize({ dialect: 'sqlite', storage, logging: false })` where `storage` is `':memory:'` when `process.env.NODE_ENV === 'test'`, else `fileURLToPath(new URL('../flashcards.db', import.meta.url))` (so it always lands in `server/` whatever the working directory). `Card` has `question` and `answer`: `DataTypes.STRING(200)`, `allowNull: false`, `validate: { len: [1, 200] }`. Timestamps on (Sequelize default). Why-comment: Zod is the main check; the model rule is a safety net.
- `seed.js`: `SEED_CARDS` = the five cards from the mockup (capital of Australia → Canberra; HTTP 404 → Not Found; author of "Pride and Prejudice" → Jane Austen; chemical symbol for gold → Au; largest planet → Jupiter). `seed()` returns early if `Card.count() > 0`, else `Card.bulkCreate(SEED_CARDS)`.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test -w server -- db.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run sync + seed on startup** in `server/src/index.js`: `await sequelize.sync(); await seed();` before `app.listen`. If either throws, `console.error` it and `process.exit(1)` (a server with no table is no use).

Run: `npm start -w server`, then `curl http://localhost:3001/api/ping`.
Expected: `{"message":"pong"}`, and `server/flashcards.db` now exists (it is git-ignored by `*.db`). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add server/package.json package-lock.json server/src/db.js server/src/seed.js server/src/db.test.js server/src/index.js
git commit -m "feat(server): add Card model and idempotent seed"
```

---

### Task 2: List and create cards, plus error handling

**Files:**
- Create: `server/src/schemas/card.js`
- Modify: `server/src/app.js`
- Test: `server/src/cards.test.js`

**Interfaces:**
- Consumes: `sequelize`, `Card` (Task 1); `seed()` (Task 1).
- Produces: `GET /api/cards` → 200 `Card[]`; `POST /api/cards` → 201 `Card`; `schemas/card.js` exports `cardSchema` (Zod object) and `toFieldErrors(zodError) → { question?: string, answer?: string }`. `app.js` keeps `export default app` and gains `asyncHandler(fn)` (local helper) and a final error middleware that Task 3 reuses.

- [ ] **Step 1: Write the failing tests** in `server/src/cards.test.js`

```js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { sequelize, Card } from './db.js';
import { seed, SEED_CARDS } from './seed.js';

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
});

describe('GET /api/cards', () => {
  it('returns all cards, newest first', async () => {
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(SEED_CARDS.length);
    // Seed rows share a createdAt; the id DESC tie-break makes the order stable.
    const ids = res.body.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ['answer', 'createdAt', 'id', 'question', 'updatedAt'],
    );
  });

  it('returns 500 INTERNAL_ERROR without a stack trace when the database fails', async () => {
    vi.spyOn(Card, 'findAll').mockRejectedValueOnce(new Error('disk on fire'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/cards');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('POST /api/cards', () => {
  it('creates a trimmed card, returns 201, and lists it first', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: '  Capital of Peru?  ', answer: ' Lima ', extra: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ question: 'Capital of Peru?', answer: 'Lima' });
    expect(res.body).not.toHaveProperty('extra');
    const list = await request(app).get('/api/cards');
    expect(list.body[0].id).toBe(res.body.id);
  });

  it('accepts exactly 200 characters', async () => {
    const res = await request(app)
      .post('/api/cards')
      .send({ question: 'q'.repeat(200), answer: 'a'.repeat(200) });
    expect(res.status).toBe(201);
  });

  it.each([
    [{}, { question: 'Question is required', answer: 'Answer is required' }],
    [{ question: '   ', answer: 'A' }, { question: 'Question is required' }],
    [{ question: 'Q', answer: 'a'.repeat(201) }, { answer: 'Answer must be 200 characters or fewer' }],
    [{ question: 123, answer: null }, { question: 'Question must be text', answer: 'Answer must be text' }],
  ])('rejects %j with 400 VALIDATION_ERROR', async (body, details) => {
    const before = await Card.count();
    const res = await request(app).post('/api/cards').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid card',
      details,
    });
    expect(await Card.count()).toBe(before);
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/cards')
      .set('Content-Type', 'application/json')
      .send('{"question":');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request body must be valid JSON',
    });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w server -- cards.test.js`
Expected: FAIL, GET returns 404.

- [ ] **Step 3: Implement the schema** in `server/src/schemas/card.js`

Each field: `z.string({ required_error: '<Field> is required', invalid_type_error: '<Field> must be text' }).trim().min(1, '<Field> is required').max(200, '<Field> must be 200 characters or fewer')`. `cardSchema = z.object({ question, answer })` (Zod strips unknown keys by default; `null` is a wrong type, so it gets "must be text"). `toFieldErrors(error)` takes the first message per field from `error.flatten().fieldErrors`.

- [ ] **Step 4: Implement the routes and error handling** in `server/src/app.js`

- `asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next)`. Why-comment: Express 4 doesn't forward rejected promises to the error middleware on its own.
- `GET /api/cards`: `Card.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] })`.
- `POST /api/cards`: `cardSchema.safeParse(req.body)`; on failure send 400 `{ error: { code: 'VALIDATION_ERROR', message: 'Invalid card', details } }`; on success `Card.create(data)` → 201.
- Keep the existing `/api` 404 handler after the routes.
- Final error middleware `(err, req, res, next)`: if `err.type === 'entity.parse.failed'` → 400 `VALIDATION_ERROR` / `Request body must be valid JSON` (no `details`). Otherwise `console.error(err)` and send 500 `{ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }`.

- [ ] **Step 5: Run the server tests and see them pass**

Run: `npm test -w server`
Expected: PASS, all tests (ping, db, cards).

- [ ] **Step 6: Commit**

```bash
git add server/src/schemas/card.js server/src/app.js server/src/cards.test.js
git commit -m "feat(server): list and create cards with Zod validation"
```

---

### Task 3: Update and delete cards

**Files:**
- Modify: `server/src/app.js`
- Test: `server/src/cards.test.js`

**Interfaces:**
- Consumes: `cardSchema`, `toFieldErrors`, `asyncHandler`, the error middleware (Task 2).
- Produces: `PUT /api/cards/:id` → 200 `Card`; `DELETE /api/cards/:id` → 204 with an empty body.

- [ ] **Step 1: Write the failing tests** (append to `server/src/cards.test.js`)

```js
async function makeCard() {
  const res = await request(app).post('/api/cards').send({ question: 'Old?', answer: 'Old' });
  return res.body;
}

describe('PUT /api/cards/:id', () => {
  it('replaces both sides, trims them, and returns 200', async () => {
    const card = await makeCard();
    const res = await request(app)
      .put(`/api/cards/${card.id}`)
      .send({ question: ' New? ', answer: ' New ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: card.id, question: 'New?', answer: 'New' });
  });

  it('requires both fields (400, card unchanged)', async () => {
    const card = await makeCard();
    const res = await request(app).put(`/api/cards/${card.id}`).send({ question: 'Only?' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ answer: 'Answer is required' });
    expect((await Card.findByPk(card.id)).question).toBe('Old?');
  });

  it.each(['999999', 'abc', '0', '-1', '1.5'])('returns 404 NOT_FOUND for id %s', async (id) => {
    const res = await request(app).put(`/api/cards/${id}`).send({ question: 'Q', answer: 'A' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/cards/:id', () => {
  it('deletes the card and returns 204 with no body', async () => {
    const card = await makeCard();
    const res = await request(app).delete(`/api/cards/${card.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await Card.findByPk(card.id)).toBeNull();
  });

  it.each(['999999', 'abc'])('returns 404 NOT_FOUND for id %s', async (id) => {
    const res = await request(app).delete(`/api/cards/${id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w server -- cards.test.js`
Expected: FAIL, PUT/DELETE return the route-level 404 (`Route not found`), and the DELETE body assertion fails.

- [ ] **Step 3: Implement the routes**

- A helper `findCardOr404(req, res)`: if `req.params.id` doesn't match `/^[1-9]\d*$/`, or `Card.findByPk(Number(id))` is null, send 404 `{ error: { code: 'NOT_FOUND', message: 'Card not found' } }` and return `null`.
- `PUT`: look up the card first (404 wins over 400 for an unknown id), then validate as in POST, then `card.update(data)` → 200.
- `DELETE`: `card.destroy()` → `res.status(204).end()`.

- [ ] **Step 4: Run the server tests and see them pass**

Run: `npm test -w server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/app.js server/src/cards.test.js
git commit -m "feat(server): update and delete cards"
```

---

### Task 4: Client API module, query hooks and provider

**Files:**
- Modify: `client/package.json` (run `npm install @tanstack/react-query@^5 -w client`)
- Create: `client/src/api/cards.js`, `client/src/hooks/useCards.js`, `client/src/test-utils.jsx`
- Modify: `client/src/main.jsx`
- Test: `client/src/api/cards.test.js`

**Interfaces:**
- Produces:
  - `api/cards.js`: `class ApiError extends Error` with `status: number`, `code: string`, `details: object` (default `{}`); `listCards(): Promise<Card[]>`, `createCard({ question, answer }): Promise<Card>`, `updateCard(id, { question, answer }): Promise<Card>`, `deleteCard(id): Promise<null>`.
  - `hooks/useCards.js`: `useCards()` (`useQuery`, key `['cards']`), `useCreateCard()`, `useUpdateCard()` (mutation variables `{ id, question, answer }`), `useDeleteCard()` (variables: `id`). Each mutation invalidates `['cards']` on success.
  - `test-utils.jsx`: `renderWithClient(ui)` → RTL render result, wrapped in a fresh `QueryClient` with `{ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }`.

- [ ] **Step 1: Write the failing tests** in `client/src/api/cards.test.js`

Stub `fetch` with `vi.stubGlobal('fetch', vi.fn())` and a helper `respond(status, body)` that returns `{ ok: status < 400, status, json: async () => body }`. Tests:

- `listCards()` calls `fetch('/api/cards', …)` and returns the parsed array.
- `createCard({ question: 'Q', answer: 'A' })` sends `POST`, header `Content-Type: application/json`, body `JSON.stringify({ question: 'Q', answer: 'A' })`.
- `updateCard(7, {...})` sends `PUT /api/cards/7`; `deleteCard(7)` sends `DELETE /api/cards/7` and resolves to `null` on 204 without calling `json()`.
- A 400 `{ error: { code: 'VALIDATION_ERROR', message: 'Invalid card', details: { question: 'Question is required' } } }` rejects with an `ApiError` whose `status`, `code`, `message` and `details` match.
- A 502 whose `json()` throws (an HTML error page) rejects with `ApiError { status: 502, code: 'UNKNOWN_ERROR', message: 'Request failed', details: {} }`.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w client -- api/cards.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `api/cards.js`** around one private `request(path, options)` helper that sets the JSON header, returns `null` for 204, and throws `ApiError` for non-OK responses (falling back to the `UNKNOWN_ERROR` values when the body isn't our JSON shape). Network failures (`fetch` rejecting) propagate unchanged.

- [ ] **Step 4: Run them and see them pass**

Run: `npm test -w client -- api/cards.test.js`
Expected: PASS.

- [ ] **Step 5: Add the hooks, provider and test helper**

Write `hooks/useCards.js` and `test-utils.jsx` to the Interfaces above. In `main.jsx`, create one `QueryClient` at module level and wrap `<App />` in `<QueryClientProvider client={queryClient}>`. The hooks get their test coverage through `App.test.jsx` in Task 9.

Run: `npm test -w client && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add client/package.json package-lock.json client/src/api client/src/hooks client/src/test-utils.jsx client/src/main.jsx
git commit -m "feat(client): add cards API module and TanStack Query hooks"
```

---

### Task 5: Comic Pop theme, client validation and CardForm

**Files:**
- Modify: `client/index.html`, `client/src/index.css`
- Create: `client/src/validation/card.js`, `client/src/components/CardForm.jsx`
- Test: `client/src/validation/card.test.js`, `client/src/components/CardForm.test.jsx`

**Interfaces:**
- Consumes: `ApiError` (Task 4).
- Produces:
  - `validateCard({ question, answer }) → { question?: string, answer?: string }` (empty object = valid). Exports `MAX_LENGTH = 200`.
  - `<CardForm title submitLabel initialValues onSubmit onCancel? variant resetOnSuccess? />`: `title: string`; `submitLabel: string`; `initialValues: { question, answer }` (default both `''`); `onSubmit: (values) => Promise` (values already trimmed); `onCancel?: () => void` (renders a `Cancel` button when given); `variant: 'create' | 'edit'` (white panel vs mint panel); `resetOnSuccess?: boolean` (default `false`). The `<form>` has `aria-labelledby` pointing at its `<h2>` title, so tests and e2e can find it by role `form` and name.
  - CSS classes in `index.css` that later tasks use: `pop-btn`, `pop-field`, `pop-card`, `pop-grid`, `pop-dots`, `flip-inner`, `flip-face`, `flip-back`, `is-flipped`.

- [ ] **Step 1: Write the failing validation tests** in `validation/card.test.js`

```js
import { describe, it, expect } from 'vitest';
import { validateCard } from './card.js';

describe('validateCard', () => {
  it('passes valid input', () => {
    expect(validateCard({ question: 'Q?', answer: 'A' })).toEqual({});
  });
  it('requires both sides, treating whitespace as empty', () => {
    expect(validateCard({ question: '', answer: '   ' })).toEqual({
      question: 'Question is required',
      answer: 'Answer is required',
    });
  });
  it('allows 200 characters after trimming and rejects 201', () => {
    expect(validateCard({ question: ` ${'q'.repeat(200)} `, answer: 'A' })).toEqual({});
    expect(validateCard({ question: 'Q', answer: 'a'.repeat(201) })).toEqual({
      answer: 'Answer must be 200 characters or fewer',
    });
  });
});
```

- [ ] **Step 2: Run them, see them fail, implement `validateCard`, run them and see them pass**

Run: `npm test -w client -- validation`
Expected: FAIL (module not found), then PASS after implementing it. Messages exactly as in Global Constraints.

- [ ] **Step 3: Write the failing CardForm tests** in `components/CardForm.test.jsx`

Using `@testing-library/react` and `fireEvent` (or `@testing-library/user-event` if you add it as a dev dependency). Render with `title="Make a card"`, `submitLabel="Slam it in!"`, `variant="create"`.

- Shows labels `Question` and `Answer` with counters `0/200`; typing `Lima` into Answer shows `4/200`.
- Submitting with an empty question shows `Question is required` next to the field, sets `aria-invalid="true"` on it, and does **not** call `onSubmit`.
- Valid submit calls `onSubmit` once with trimmed values `{ question: 'Capital of Peru?', answer: 'Lima' }`.
- While `onSubmit`'s promise is pending, the submit button is disabled (a second click doesn't call `onSubmit` again).
- `resetOnSuccess`: after `onSubmit` resolves, both fields are empty.
- `onSubmit` rejecting with `new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid card', details: { answer: 'Answer must be 200 characters or fewer' } })` shows that message on the Answer field and keeps the typed values.
- `onSubmit` rejecting with any other error shows `Something went wrong — your card wasn't saved. Try again.` in an element with `role="alert"` and keeps the typed values.
- With `onCancel`, a `Cancel` button calls it; without `onCancel`, there is no Cancel button.
- `initialValues` pre-fill the fields.

- [ ] **Step 4: Run them and see them fail**

Run: `npm test -w client -- CardForm`
Expected: FAIL, module not found.

- [ ] **Step 5: Add the theme**

- `client/index.html`: `<title>BrainCramBam</title>`; Google Fonts `preconnect` links plus `<link href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">`.
- `client/src/index.css`: after `@import 'tailwindcss';`, an `@theme` block with the six colours and two fonts from spec 2a (`--color-sun`, `--color-ink`, `--color-pop`, `--color-zap`, `--color-mint`, `--color-paper`, `--font-display`, `--font-body`). Then `@layer components` with the classes listed in Interfaces, copying the mockup's rules: `.pop-grid > li:nth-child(4n+1..4) .pop-card` rotations (−2.5°, 1.8°, −1°, 2.6°), `.pop-card` / `.pop-btn` hover and active, the 4 px `zap` focus ring on `.pop-card`, `.pop-btn`, `.pop-field`, and the `.pop-dots` halftone. Add the flip: `.flip-inner { display: grid; transform-style: preserve-3d; transition: transform .5s }`, `.flip-face { grid-area: 1 / 1; backface-visibility: hidden }` (grid stacking makes the card as tall as its taller face), `.flip-back { transform: rotateY(180deg) }`, `.is-flipped .flip-inner { transform: rotateY(180deg) }`. Finally a `@media (prefers-reduced-motion: reduce)` block that turns off every transition and hover transform.

- [ ] **Step 6: Implement `CardForm`**

Fields are `<textarea class="pop-field" maxLength={200} rows={3}>` with labels from `useId()` ids. Validate with `validateCard` on submit; show each field error below its field, linked with `aria-describedby`. Keep `isSubmitting` in local state while awaiting `onSubmit`. Styling as in spec 2a: create = white panel, 4 px ink border, 10 px shadow, `-rotate-1`; edit = mint panel, 8 px shadow, no tilt; submit button is `pop-btn` with a `pop` background and display font. Declare `propTypes`.

- [ ] **Step 7: Run the client tests and see them pass**

Run: `npm test -w client && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/index.html client/src/index.css client/src/validation client/src/components/CardForm.jsx client/src/components/CardForm.test.jsx
git commit -m "feat(client): add Comic Pop theme, card validation and CardForm"
```

---

### Task 6: FlashCard

**Files:**
- Create: `client/src/components/FlashCard.jsx`
- Test: `client/src/components/FlashCard.test.jsx`

**Interfaces:**
- Consumes: `CardForm` (Task 5); CSS classes `pop-card`, `pop-btn`, `flip-*`, `is-flipped` (Task 5).
- Produces: `<FlashCard card onSave onRequestDelete />`: `card: { id, question, answer }`; `onSave: (values) => Promise` (Task 9 passes `values => updateCard.mutateAsync({ id: card.id, ...values })`); `onRequestDelete: (card) => void`. Flip and edit state are local to the component.

- [ ] **Step 1: Write the failing tests**

Render with `card = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' }`.

- The face is a `button` with `aria-pressed="false"`; its accessible name includes `Capital of Australia?` and does **not** include `Canberra` (`getByRole('button', { name: /capital of australia/i })` and `queryByRole('button', { name: /canberra/i })` is null).
- Clicking it sets `aria-pressed="true"`, and now its name includes `Canberra` and not the question.
- Pressing Enter and pressing Space on the focused face also toggle it. (A native `<button>` does this; with `fireEvent`, simulate with `click`. With `user-event`, use `keyboard('{Enter}')` / `keyboard(' ')`.)
- Clicking `Edit` or `Toss` leaves `aria-pressed` unchanged. `Toss` calls `onRequestDelete(card)`.
- `Edit` swaps the card for a form named `Fix this card`, pre-filled. `Save` calls `onSave({ question, answer })`; when it resolves, the card face comes back. `Cancel` returns to the face without calling `onSave`.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w client -- FlashCard`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `FlashCard`**

Markup: wrapper `<div>` → face `<button type="button" class="pop-card …" aria-pressed>` containing `.flip-inner` with two `.flip-face` divs (front: white, `Q!` badge in a `pop` chip, question, `Flip it →`; back: `.flip-back`, `zap` background with white text, `A!` badge in a `mint` chip, answer in the display font, `← Flip back`). Put `aria-hidden="true"` on whichever face is hidden. Below it, a row with `Edit` (white `pop-btn`) and `Toss` (ink background, `sun` text, `pop` shadow). In edit mode render `CardForm` with `variant="edit"`, `title="Fix this card"`, `submitLabel="Save"`. Every button is at least 44 px tall. Declare `propTypes`.

- [ ] **Step 4: Run them and see them pass**

Run: `npm test -w client -- FlashCard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/FlashCard.jsx client/src/components/FlashCard.test.jsx
git commit -m "feat(client): add flippable FlashCard with inline edit"
```

---

### Task 7: ConfirmDialog

**Files:**
- Create: `client/src/components/ConfirmDialog.jsx`
- Modify: `client/src/test-setup.js`
- Test: `client/src/components/ConfirmDialog.test.jsx`

**Interfaces:**
- Produces: `<ConfirmDialog open title message confirmLabel cancelLabel onConfirm onCancel pending? error? />`: `open: boolean`; `title`, `message`, `confirmLabel`, `cancelLabel`: strings; `onConfirm`, `onCancel`: `() => void`; `pending?: boolean` disables both buttons; `error?: string | null` shown with `role="alert"`. The parent owns `open`.

- [ ] **Step 1: Add a jsdom `<dialog>` polyfill** to `test-setup.js`. jsdom doesn't implement `showModal`/`close`. Only when `HTMLDialogElement.prototype.showModal` is missing: `showModal()` sets the `open` attribute; `close()` removes it and dispatches a `close` event. Why-comment it.

- [ ] **Step 2: Write the failing tests**

Render with `title="Toss it for real?"`, `message="“Q?” goes in the bin. No take-backs."`, `confirmLabel="Toss it"`, `cancelLabel="Keep it"`.

- `open={false}`: `queryByRole('dialog')` is null (closed dialogs aren't exposed).
- `open={true}`: a dialog named `Toss it for real?` with the message; `Toss it` calls `onConfirm`; `Keep it` calls `onCancel`.
- Dispatching a `cancel` event on the dialog (what Esc does in a browser) calls `onCancel`, and the event's default is prevented so React state stays in charge.
- Focus return: focus a "trigger" button, rerender with `open={true}`, then `open={false}` → `document.activeElement` is the trigger again.
- `pending` disables both buttons; `error="Couldn't toss this card. Try again."` renders in `role="alert"`.

- [ ] **Step 3: Run them and see them fail**

Run: `npm test -w client -- ConfirmDialog`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `ConfirmDialog`**

A native `<dialog aria-labelledby>` with a ref. A `useEffect` on `open`: when it opens, remember `document.activeElement` and call `showModal()`; when it closes, call `close()` and focus the remembered element if it's still in the document (`isConnected`). Listen for `cancel` → `preventDefault()` + `onCancel()`. Styling per spec 2a: `::backdrop` ink at 55 % opacity, white panel, 5 px border, 14 px `pop` shadow, `-1.5°` tilt; `Keep it` mint, `Toss it` ink with `sun` text. Declare `propTypes`.

- [ ] **Step 5: Run them and see them pass**

Run: `npm test -w client -- ConfirmDialog`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/test-setup.js client/src/components/ConfirmDialog.jsx client/src/components/ConfirmDialog.test.jsx
git commit -m "feat(client): add accessible ConfirmDialog"
```

---

### Task 8: CardGrid

**Files:**
- Create: `client/src/components/CardGrid.jsx`
- Test: `client/src/components/CardGrid.test.jsx`

**Interfaces:**
- Consumes: `FlashCard` (Task 6).
- Produces: `<CardGrid cards isLoading isError onRetry onSaveCard onRequestDelete />`: `cards: Card[] | undefined`; `isLoading`, `isError`: booleans; `onRetry: () => void`; `onSaveCard: (id, values) => Promise`; `onRequestDelete: (card) => void`.

- [ ] **Step 1: Write the failing tests**

- Always renders the heading `The pile` and the hint `Tap a card to flip it — newest on top`.
- `isLoading` → `Loading cards…` in `role="status"`.
- `isError` → `Couldn't load cards` and a `Retry` button that calls `onRetry`.
- `cards=[]` → `No cards yet — make your first one!`.
- Two cards → a `list` with two `listitem`s, in the order given.
- Flip state survives a refetch: flip card id 2, rerender with `[newCard, card1, card2]` (new objects, same ids) → card 2's face still has `aria-pressed="true"`.
- `Edit` → `Save` in a card calls `onSaveCard(card.id, values)`.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w client -- CardGrid`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `CardGrid`**

A `<section aria-labelledby>`; the grid is a `<ul class="pop-grid">` with `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` and gap `36px 28px`; each `<li key={card.id}>` holds a `FlashCard`. The empty and error states use the same white bordered panel as the create form. Declare `propTypes`.

- [ ] **Step 4: Run them and see them pass**

Run: `npm test -w client -- CardGrid`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/CardGrid.jsx client/src/components/CardGrid.test.jsx
git commit -m "feat(client): add CardGrid with loading, empty and error states"
```

---

### Task 9: App assembly and the delete flow

**Files:**
- Modify: `client/src/App.jsx`, `client/src/App.test.jsx`, `e2e/home.spec.js`

**Interfaces:**
- Consumes: hooks + `renderWithClient` (Task 4), `CardForm` (Task 5), `CardGrid` (Task 8), `ConfirmDialog` (Task 7), `ApiError` (Task 4).

- [ ] **Step 1: Write the failing tests** in `App.test.jsx` (replace the old title test)

Use `renderWithClient(<App />)` and a stubbed `fetch` that routes on method + URL over an in-test array of cards.

- Header: an `h1` whose name matches `/brain\s*cram\s*bam/i`; after loading, the badge reads `2 cards in the pile` with two cards and `1 card in the pile` with one.
- Create: fill the `Make a card` form, click `Slam it in!` → POST is sent, the new card appears first in the list (the hooks invalidated `['cards']`), and the form is cleared.
- Delete confirm: `Toss` on a card → dialog `Toss it for real?` quoting that card's question; `Keep it` closes it and the card stays; `Toss` then `Toss it` → DELETE sent, dialog closes, card gone.
- Delete of an already-gone card: DELETE returns 404 → the dialog closes and the list is refetched (a GET after the DELETE).
- Delete failure: DELETE returns 500 → the dialog stays open showing `Couldn't toss this card. Try again.`

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -w client -- App`
Expected: FAIL, heading and form not found.

- [ ] **Step 3: Implement `App`**

Layout per spec 2a: a full-height `bg-sun` page with `font-body` text, the `pop-dots` circle (`aria-hidden`, `pointer-events-none`) at the top right, and content capped at `max-w-[1200px]`. The header holds the stacked wordmark (`Brain` / `Cram` / `Bam!` as block spans in the display font with a `pop` text shadow; `Bam!` in `zap` with an ink shadow), the tilted ink tag `Study like it's loud`, and the mint count badge (shown only once the cards have loaded). The body is a flex-wrap row: the create `CardForm` (`variant="create"`, `resetOnSuccess`, `onSubmit={createCard.mutateAsync}`, max 380 px) and the `CardGrid` (wired to `useCards`, with `onRetry={refetch}`).

Delete flow state: `cardToDelete` (card or `null`) and `deleteError`. `onConfirm` calls `deleteCard.mutateAsync(id)`; on success, or on `ApiError` with status 404, it invalidates `['cards']` (the 404 case needs it; for success the hook already does) and clears `cardToDelete`; on any other error it sets `deleteError` to the copy in Global Constraints. Pass `pending={deleteCard.isPending}`.

- [ ] **Step 4: Update `e2e/home.spec.js`** so the heading check matches `/brain\s*cram\s*bam/i` (the pre-commit e2e run would fail otherwise).

- [ ] **Step 5: Run everything and see it pass**

Run: `npm run lint && npm test && npm run e2e`
Expected: PASS everywhere.

- [ ] **Step 6: Check it by eye**

Run `npm run dev` and open http://localhost:5173. Compare against the Comic Pop artboard: tilted cards, hard shadows, flip animation, the dialog, and a one-column layout at a 390 px wide window. Turn on reduced motion in the OS: cards swap faces instantly and nothing moves on hover.

- [ ] **Step 7: Commit**

```bash
git add client/src/App.jsx client/src/App.test.jsx e2e/home.spec.js
git commit -m "feat(client): assemble BrainCramBam app with delete confirmation"
```

---

### Task 10: End-to-end critical path and docs

**Files:**
- Modify: `playwright.config.js`, `CLAUDE.md` (structure and API routes table only, **not** the "DO NOT MODIFY" section)
- Create: `e2e/cards.spec.js`

- [ ] **Step 1: Run the e2e server on the in-memory database**

In `playwright.config.js`, replace `webServer` with an array of two entries: the server (`npm run start -w server`, `url: 'http://localhost:3001/api/ping'`, `env: { NODE_ENV: 'test' }`) and the client (`npm run dev -w client`, `url: 'http://localhost:5173'`). Keep `reuseExistingServer: !process.env.CI` on both. Why-comment: when a dev server is already running, Playwright reuses it, so e2e tests always create their own uniquely named cards and clean up after themselves.

- [ ] **Step 2: Write the e2e tests** in `e2e/cards.spec.js`

`const q = \`E2E question ${Date.now()}\`` (unique per run). Find the create form with `page.getByRole('form', { name: 'Make a card' })` and the card's list item with `page.getByRole('listitem').filter({ hasText: q })`.

1. **Critical path:** create a card (`q` / `E2E answer`) → its face is visible → click it → `aria-pressed="true"` and `E2E answer` visible → `Edit` → in the `Fix this card` form change the question to `${q} edited` → `Save` → reload → the edited question is still there → `Toss` → dialog `Toss it for real?` visible → press `Escape` → dialog hidden, card still there → `Toss` → `Toss it` → the card is gone → reload → still gone.
2. **Invalid input saves nothing:** record every `POST /api/cards` request with `page.on('request')`; fill the question with spaces and the answer with `x`; click `Slam it in!` → `Question is required` visible; zero POST requests recorded.

- [ ] **Step 3: Run them**

Run: `npm run e2e`
Expected: PASS (2 home tests + 2 card tests). If they fail, debug; don't loosen the assertions.

- [ ] **Step 4: Update `CLAUDE.md`**

In Structure, replace the bracketed `db.js` / `seed.js` placeholders with real entries and add the client folders (`api/`, `hooks/`, `validation/`, `components/`). In the API routes table, replace the `[...]` row with the four `/api/cards` routes from the spec. Leave every other section untouched.

- [ ] **Step 5: Run the full pre-commit suite once more, then commit**

```bash
git add playwright.config.js e2e/cards.spec.js CLAUDE.md
git commit -m "test(e2e): cover the card create/flip/edit/delete critical path"
```

Expected: the pre-commit hook (lint-staged, unit + API tests, e2e) passes. Never use `--no-verify`.
