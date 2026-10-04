# Card Piles — Design

Date: 2026-10-04
Status: Approved design sections; spec pending user review
Branch: `feature/card-piles`
Mockups: https://claude.ai/artifact/NXr9t7dSQByenBuyA3cj3Z (top row = chosen direction)

## Goal

A student keeps separate piles of cards, one per school subject (Geography,
Math, Law, …). They pick a pile from a row of binder-divider tabs and only that
pile's cards show underneath. Cards are always made inside a pile, can be moved
between piles by press-and-hold select + drag, and a pile can be created,
renamed and deleted.

## Scope

In scope:

- `Pile` model and CRUD API; cards belong to at most one pile.
- Card list filtered by pile; card create requires a pile; bulk move endpoint.
- Delete a non-empty pile with a choice: keep the cards (they become Unsorted)
  or delete them too.
- "Unsorted" view for cards whose pile was deleted.
- Binder-divider tab UI, "NEW ‹PILE› CARD +" button, inline pile create/rename,
  press-and-hold multi-select, drag onto a tab (@dnd-kit), "Move to…" menu.
- Remembering the selected pile across reloads.
- One-time upgrade of an existing `flashcards.db`; new seed data.

Out of scope (later work): a card in several piles (tags), reordering piles or
cards, moving cards *into* Unsorted, pile colours chosen by the user, study/quiz
mode, accounts.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Card ↔ pile | One pile per card; `pileId` is nullable, `null` = Unsorted | A pile is a subject. Unsorted only exists for "delete pile, keep cards". |
| Pile actions | Create, rename, delete; cards move by drag-and-drop | User's choice |
| Deleting a non-empty pile | Must choose: keep cards (→ Unsorted) or delete them; empty pile = simple confirm | User's choice |
| Workflow | Pile-first: a pile is always selected; cards are created in it; Unsorted has no card form | "Things stay organized" |
| Pile order | Creation order (`createdAt`, then `id`) | User's choice |
| Fresh database | Seeds Geography, History, Law, Math, Science (created in that order) with sample cards | User's choice |
| Existing database | Existing cards go into a new "General" pile | User's choice |
| Layout | Option C, Binder dividers, with the card form behind a "NEW ‹PILE› CARD +" button | User's choice from mockups |
| Drag-and-drop | `@dnd-kit/core` | Mouse + touch sensors, built-in press delay, drag overlay |
| DB upgrade | Small, tested startup check (`server/src/migrate.js`) | No new tooling; `sync()` alone never adds columns |
| Selected pile | Remembered in `localStorage`, falls back to the first pile | User's choice |
| Pile name | Trimmed, 1–40 characters, unique ignoring case | Short enough for a tab; "math" vs "Math" would confuse |

## 1. Data model and API

### Models (`server/src/db.js`)

```js
export const Pile = sequelize.define('Pile', {
  name: { type: DataTypes.STRING(40), allowNull: false, validate: { len: [1, 40] } },
});

// Card gains:
pileId: { type: DataTypes.INTEGER, allowNull: true }

Pile.hasMany(Card, { foreignKey: 'pileId' });
Card.belongsTo(Pile, { foreignKey: 'pileId' });
```

Routes do the delete/keep work explicitly inside a transaction; they never rely
on SQLite foreign-key cascades (SQLite does not enforce them unless the pragma
is on).

### Startup upgrade (`server/src/migrate.js`)

`export async function migrate()`, called from `index.js` **after**
`sequelize.sync()` (which creates the new `Piles` table) and **before**
`seed()`:

1. `queryInterface.describeTable('Cards')`. If it already has `pileId`, return
   (idempotent: safe on every start).
2. `addColumn('Cards', 'pileId', { type: INTEGER, allowNull: true })`.
3. In one transaction: if any cards exist, create a pile named `General` and
   set every card's `pileId` to it.

A database with zero cards gets no General pile, so `seed()` then fills it like
a fresh install. In tests (`:memory:` + `sync({ force: true })`) the column
already exists, so `migrate()` is a no-op; its own test builds the old
`Cards` table by hand (raw SQL) to prove the upgrade.

### Seed (`server/src/seed.js`)

Runs only when there are **no piles and no cards** (so it never fills in around
a user's data). Creates the piles one at a time in this order so ids and
`createdAt` ascend: Geography, History, Law, Math, Science. Two cards each:

| Pile | Question | Answer |
| --- | --- | --- |
| Geography | What is the capital of Australia? | Canberra |
| Geography | Which river is the longest in the world? | The Nile |
| History | In which year did World War II end? | 1945 |
| History | Who was the first President of the United States? | George Washington |
| Law | What is a tort? | A civil wrong that causes harm or loss |
| Law | What does habeas corpus protect against? | Unlawful detention |
| Math | What is the square root of 144? | 12 |
| Math | What is pi to two decimal places? | 3.14 |
| Science | What is the chemical symbol for gold? | Au |
| Science | What is the largest planet in our solar system? | Jupiter |

`SEED_PILES` is exported (like `SEED_CARDS` today) so tests can assert against it.

### Validation (`server/src/schemas/pile.js`, `server/src/schemas/card.js`)

- `pileSchema`: `name`, trimmed, required ("Pile name is required"),
  max 40 ("Pile name must be 40 characters or fewer"), must be text.
- `cardSchema` is unchanged for PUT. A new `createCardSchema` extends it with
  `pileId`: positive integer, required ("Pick a pile for this card").
- `moveCardsSchema`: `cardIds` = array of 1–100 unique positive integers;
  `pileId` = positive integer.
- `cardsQuerySchema` for `GET /api/cards`: `pileId` = positive integer string
  or the literal `unsorted`.
- The duplicate-name check is done in the route (it needs the DB): a pile with
  the same name ignoring case, other than the one being renamed, exists →
  409.

### Routes (`server/src/app.js`)

Error shape is the existing `{ error: { code, message, details? } }`.

| Method | Path | Success | Errors |
| --- | --- | --- | --- |
| GET | `/api/piles` | 200 `{ piles: [{ id, name, cardCount, createdAt }], unsortedCount }`, oldest first (`createdAt`, then `id`) | — |
| POST | `/api/piles` | 201 pile (with `cardCount: 0`) | 400 `VALIDATION_ERROR` (`details.name`); 409 `DUPLICATE_NAME` (`details.name`: `You already have a pile called "Math"`) |
| PUT | `/api/piles/:id` | 200 pile | 404 `NOT_FOUND`; 400; 409 `DUPLICATE_NAME`. Renaming to its own name in a new case ("math" → "Math") is allowed. |
| DELETE | `/api/piles/:id` | 204 | 404; 409 `PILE_NOT_EMPTY` (`details.cardCount`) when it has cards and no `cards` param; 400 when `cards` is not `keep` or `delete` |
| DELETE | `/api/piles/:id?cards=keep` | 204: in one transaction, its cards' `pileId` → `null`, then the pile is deleted | 404 |
| DELETE | `/api/piles/:id?cards=delete` | 204: in one transaction, its cards are deleted, then the pile | 404 |
| GET | `/api/cards?pileId=3` | 200 that pile's cards, newest first (unchanged order) | 400 when `pileId` is missing or invalid; 404 unknown pile |
| GET | `/api/cards?pileId=unsorted` | 200 cards with `pileId = null`, newest first | — |
| POST | `/api/cards` | 201 card (now includes `pileId`) | 400 (`details.pileId` when missing/invalid); 404 `Pile not found` |
| PUT | `/api/cards/:id` | unchanged; a `pileId` in the body is stripped and ignored | unchanged |
| DELETE | `/api/cards/:id` | unchanged | unchanged |
| POST | `/api/cards/move` | 200 `{ movedCount }`: in one transaction, every listed card's `pileId` → target | 400; 404 when the pile or **any** card id does not exist (nothing is moved) |

The pile delete for an **empty** pile ignores the `cards` param (a valid value is
accepted, an invalid one is still 400). `GET /api/cards` without `pileId` becomes
a 400; the client always sends it.

## 2. Frontend

### Data layer

| File | Contents |
| --- | --- |
| `src/api/piles.js` | `listPiles()`, `createPile({ name })`, `renamePile(id, { name })`, `deletePile(id, cardsMode?)` (`cardsMode`: `'keep' \| 'delete' \| undefined`). Uses the shared `request()`, moved to `src/api/request.js` along with `ApiError` (`cards.js` re-exports `ApiError` so existing imports keep working). |
| `src/api/cards.js` | `listCards(pileKey)` (number or `'unsorted'`), `createCard({ question, answer, pileId })`, `moveCards({ cardIds, pileId })`; update and delete unchanged |
| `src/hooks/usePiles.js` | `usePiles()` (key `['piles']`), `useCreatePile`, `useRenamePile`, `useDeletePile` |
| `src/hooks/useCards.js` | `useCards(pileKey)` with key `['cards', pileKey]` (disabled when `pileKey` is null). Every card and pile mutation invalidates both `['cards']` (all piles) and `['piles']` (counts). Adds `useMoveCards`. |
| `src/hooks/useSelectedPile.js` | `useSelectedPile(pilesData)` → `[selectedKey, setSelectedKey]`. Stores the key in `localStorage` under `braincrambam.selectedPile`; every read/write in try/catch. Resolves to the stored key if that pile still exists (or `'unsorted'` while `unsortedCount > 0`), otherwise the first pile, otherwise `null`. |
| `src/validation/pile.js` | `MAX_PILE_NAME = 40`; `validatePileName(name, existingPiles, { ignoreId })` returns an error string or `undefined`, with the same messages as the server (required, too long, duplicate ignoring case). |

### Components

| Component | Responsibility |
| --- | --- |
| `App.jsx` | Loads piles; resolves the selected pile; renders the header, `PileTabs`, and the panel or `NoPilesState`; owns the pile-delete dialogs and the `DndContext`. |
| `PileTabs.jsx` | `<nav aria-label="Piles">` of tab buttons (`aria-pressed` on the selected one), label `Name · count`. Unsorted tab last, only while `unsortedCount > 0`, dashed style. "+ New pile" turns into an inline `PileNameForm`. Each real pile tab is a dnd-kit droppable, except the current pile. |
| `PileNameForm.jsx` | Shared by create (in the tab row) and rename (in the header). Labelled input with a live `n/40` counter, inline error (client validation, then server 400/409 `details.name`), Save/Cancel, Esc cancels, autofocus. On success: create selects the new pile; rename closes. |
| `PileHeader.jsx` | Pile name heading, **Rename**, **Delete pile**, and on the right **New ‹Name› card +** (`aria-expanded`). For Unsorted: heading "Unsorted", a hint line, no buttons. While selecting cards it is replaced by `SelectionBar`. |
| New-card form (rendered by `App` between `PileHeader` and the grid) | The existing `CardForm` (variant `create`, title `New ‹Name› card`, `resetOnSuccess`, `onCancel` closes) shown inline above the grid when the button is pressed. It stays open after a save for quick entry. Focus goes to the question on open and back to the button on close. |
| `DeletePileDialog.jsx` | Native `<dialog>` like `ConfirmDialog`: title `Delete the ‹Name› pile?`, text `It still has N cards. What should happen to them?`, buttons **Keep the cards** (→ Unsorted), **Delete the cards too** (`All N cards are gone for good. No take-backs.`), **Cancel**. Shows a pending state and an error inside the dialog. An empty pile uses the existing `ConfirmDialog` instead. |
| `SelectionBar.jsx` | `role="status"` bar: `N selected`, hint `Drag them onto a tab, or`, **Move to…** (a labelled native `<select>` of the other piles plus a **Move** button, so it works with keyboard and screen readers for free), **Clear**. |
| `NoPilesState.jsx` | Step 1 "Start with a pile" (a `PileNameForm` in create mode), with step 2 "Make a card" **underneath**, disabled, saying "Make a pile first, then your cards go in here." If unsorted cards exist it also says `You have N unsorted cards. Make a pile, then drag them in.` |
| `CardGrid.jsx` / `FlashCard.jsx` | Gain selection: `selected`, `selectionMode`, `onLongPress`, `onToggleSelect`. Each card is a dnd-kit draggable. |

Header count badge: `N cards in ‹Name›`, `N unsorted cards`, or `0 piles`.

### Interactions

- **Selecting a pile**: click a tab. This clears any selection and closes the new-card form.
- **Press and hold** a card for 400 ms without moving (more than 8 px) to select
  it and switch on selection mode. A small `useLongPress` hook handles this;
  the click that follows a long press must not flip the card.
- **In selection mode**: tapping a card toggles it (no flip). Edit/Toss and the
  New card button are hidden. Esc or **Clear** ends selection mode, as does
  switching pile or a successful move.
- **Dragging**: dnd-kit `PointerSensor` and `TouchSensor` with
  `activationConstraint: { delay: 400, tolerance: 8 }`. Dragging an unselected
  card adds it to the selection first; the drag carries the whole selection. A
  `DragOverlay` shows a small stacked "N cards" ghost. The tab under the
  pointer shows `Drop into ‹Name›` (dashed outline, inverted colours). Dropping
  calls `moveCards`; dropping anywhere else does nothing.
- **Move to…**: the keyboard and accessible path to the same `moveCards` call.
- **After a move**: a live region announces `Moved N cards to ‹Name›`; the user
  stays on the current pile.
- **Touch**: cards get `touch-action: manipulation` and
  `-webkit-touch-callout: none` so a long press doesn't open the browser menu.
  `prefers-reduced-motion` turns off the lift/tilt transitions, as it does today.
- **Deleting the selected pile**: selection falls back via `useSelectedPile`
  (the first pile, or Unsorted only if no piles remain and it has cards).

### Copy and errors

| Situation | What the user sees |
| --- | --- |
| Pile name empty / too long / duplicate | Inline under the field; the server's 400/409 `details.name` is shown the same way |
| Pile create/rename fails otherwise | `Something went wrong — the pile wasn't saved. Try again.` |
| Move fails | Alert in the selection bar: `Couldn't move those cards. Try again.` The selection is kept. |
| Move or create card returns 404 (pile deleted elsewhere) | Refetch piles and cards; the selection falls back. |
| Pile delete fails | Error inside the dialog, which stays open (same pattern as card delete). A 404 closes it and refetches. |
| Cards fail to load | Existing `CardGrid` error panel with retry |

## 2a. Visual design

This keeps the Comic Pop tokens and shapes from the CRUD spec. It follows the
mockup artboards **Chosen: Binder dividers**, **Binder: New card form open**,
**Binder: hold to select, drag onto a tab**, plus the flow boards for the delete
dialog, Unsorted, new pile and no piles yet.

- **Tabs**: 4px ink border, no bottom border, Bowlby One 17px, sitting on the
  panel. Each tab gets a colour by position, cycling `paper, mint, pop, zap
  (white text), white`. The selected tab uses the panel colour (`paper`), is
  taller, and covers the panel's top border (`z-index`, `margin-bottom: -4px`).
  Unsorted: dashed border, ink background, sun text.
- **Panel**: `paper` background, 4px ink border, `10px 10px 0 ink` shadow, 28px
  padding, holding the header row, the optional new-card form and the grid. The
  grid now uses the full panel width.
- **New card button**: Bowlby One, uppercase, pop background, `6px 6px 0 ink`
  shadow, plus icon (inline stroke SVG) at the end, pushed to the right of the
  header row.
- **Selected card**: no tilt, lifted (`translate(-3px,-3px)`), mint outline 5px
  with 5px offset, pale mint face, plus a round mint check badge top right.
- **Selection bar**: ink background, white text, mint `N selected` in Bowlby One,
  `6px 6px 0 mint` shadow.

## 3. Testing (test-first)

**Server (Vitest + Supertest)**

- `migrate.test.js`: old-shape `Cards` table with rows → adds `pileId`, creates
  General, assigns every card; running it twice changes nothing; old-shape table
  with zero cards → no General pile.
- `seed.test.js`: empty DB → 5 piles in order with 2 cards each; DB with any
  pile or card → untouched.
- `piles.test.js`: list (order, `cardCount`, `unsortedCount`); create (201,
  trims, 400 cases, 409 duplicate ignoring case); rename (200, own-name case
  change allowed, 404, 400, 409); delete empty (204), non-empty without param
  (409 + `cardCount`), `keep` (cards now unsorted), `delete` (cards gone),
  invalid `cards` (400), 404, non-numeric id (404).
- `cards.test.js` (updated): list requires `pileId` (400), filters by pile, unknown
  pile 404, `unsorted`; create requires an existing `pileId`; PUT ignores
  `pileId`; move (200 + count, one bad card id → 404 and nothing moved, unknown
  pile 404, empty/duplicate/over-100 ids → 400).

**Client (Vitest + Testing Library)**

- `validation/pile.test.js`; `api/piles.test.js`; `useSelectedPile` (stored,
  fallback, unsorted rules, storage throwing).
- `PileTabs` (order, counts, `aria-pressed`, Unsorted only when it has cards,
  inline create success and error), `PileNameForm`, `PileHeader` (rename,
  New card toggles the form, Unsorted variant), `DeletePileDialog` (three
  choices, pending, error), `NoPilesState`.
- Selection: long press selects without flipping; tap toggles in selection
  mode; Esc/Clear; **Move to…** calls `moveCards` and announces the result;
  move failure keeps the selection.
- `App.test.jsx` updated for piles (loading, no piles, switching tabs).

**E2E (Playwright)**, on the existing isolated ports with the in-memory seeded DB:

1. Create a pile, add a card from **New ‹Pile› card +**, and see it only in that pile.
2. Hold-select two cards (`mouse.down`, wait about 450 ms, `mouse.up`), drag them
   onto another tab (`mouse.down`, wait, `mouse.move` in steps, `mouse.up`), and
   check both piles' counts and contents.
3. Delete a pile choosing **Keep the cards**, see Unsorted appear, move the cards
   out with **Move to…**, and see Unsorted disappear.
4. Delete a pile choosing **Delete the cards too**.
5. Delete every pile and see the "Start with a pile" screen.
6. The existing `cards.spec.js` create/flip/edit/delete path is updated to run
   inside a pile.

## Build order

1. Server: `Pile` model + association, `migrate.js`, new seed (tests first).
2. Server: pile routes, then card route changes and `/api/cards/move`.
3. Client: shared `request.js`, `api/piles.js`, `api/cards.js` changes, hooks,
   `validation/pile.js`, `useSelectedPile`.
4. Client: `PileTabs` + `PileNameForm` + `PileHeader` + new-card panel +
   `NoPilesState`, wired into `App`.
5. Client: pile delete dialogs and the Unsorted view.
6. Client: selection mode, `SelectionBar` and Move to…, then dnd-kit dragging.
7. E2E specs; update the CLAUDE.md API table and the README.

## Constraints (restated from CLAUDE.md for plan/executor agents)

- Test-first (TDD), always. Production-grade, readable React/Express code for a
  junior-to-mid developer; conventional over clever; short why-comments where
  they help.
- Validate frontend inputs (required, types, length limits, basic format).
- Zod at the API boundary; Sequelize + SQLite (`server/flashcards.db`,
  `:memory:` when `NODE_ENV=test`); tests' `beforeAll` runs
  `sequelize.sync({ force: true })` + `seed()`.
- Errors: `{ error: { code, message } }`; 404 for unknown routes and resources.
- Vitest + Supertest; Playwright e2e for critical paths, in `/e2e`.
- Pre-commit runs lint + unit + API tests + e2e; never bypass with `--no-verify`.
- Don't offer recommended approaches unless the user asks.
