# API reference

BrainCramBam's frontend talks to a small JSON API served by Express. You don't need any of this to use the app. It's here for anyone who wants to poke at the server directly, write a script against it, or work on the code.

[← Back to the README](../README.md)

## The basics

- **Base URL:** `http://localhost:3001` when you run `npm run dev`. The Vite dev server also forwards `/api/*` to it, so `http://localhost:5173/api/...` works too.
- **Format:** requests and responses are JSON.
- **Errors:** every error comes back as `{ "error": { "code": "...", "message": "..." } }`. Unknown routes and unknown ids return `404`.

## Piles and cards

A **pile** is a named group of cards (Geography, Math, and so on). A **card** has a `question`, an `answer` and a `pileId`. A card with no pile is "unsorted", which happens when the General pile is deleted and its cards are kept.

## Routes

| Method | Path                        | Description                                                                                                       |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | /api/ping                   | health check                                                                                                      |
| GET    | /api/piles                  | list piles, oldest first: `{ piles: [{ id, name, cardCount, createdAt }], unsortedCount }`                        |
| POST   | /api/piles                  | create a pile (name; trimmed, 1–40 chars, unique ignoring case)                                                   |
| PUT    | /api/piles/:id              | rename a pile                                                                                                     |
| DELETE | /api/piles/:id              | delete an empty pile (409 `PILE_NOT_EMPTY` with `details.cardCount` if it has cards)                              |
| DELETE | /api/piles/:id?cards=keep   | delete a pile; its cards move to the General pile (made if missing; deleting General itself leaves them Unsorted) |
| DELETE | /api/piles/:id?cards=delete | delete a pile and its cards                                                                                       |
| GET    | /api/cards?pileId=:id       | list one pile's cards, newest first (`pileId` is required)                                                        |
| GET    | /api/cards?pileId=unsorted  | list the cards without a pile, newest first                                                                       |
| POST   | /api/cards                  | create a card (question, answer, pileId — required)                                                               |
| PUT    | /api/cards/:id              | update a card's question and answer (`pileId` is ignored)                                                         |
| DELETE | /api/cards/:id              | delete a card                                                                                                     |
| POST   | /api/cards/move             | move cards to a pile (`{ cardIds, pileId }` → `{ movedCount }`)                                                   |
