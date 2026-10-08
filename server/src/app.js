import express from 'express';
import { Card, Pile, GENERAL_PILE_NAME, runInTransaction } from './db.js';
import {
  cardSchema,
  createCardSchema,
  cardsQuerySchema,
  moveCardsSchema,
  toFieldErrors,
} from './schemas/card.js';
import { pileSchema, deletePileQuerySchema } from './schemas/pile.js';

const app = express();

app.use(express.json());

// Express 4 doesn't forward rejected promises to the error middleware on its own.
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Sends the 404 and returns null when the id isn't a positive integer or no row has it.
// Callers must stop when this returns null, because the response is already sent.
async function findByIdOr404(Model, id, res, message) {
  const row = /^[1-9]\d*$/.test(id) ? await Model.findByPk(Number(id)) : null;
  if (!row) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message } });
    return null;
  }
  return row;
}

// Returns the validated data (trimmed, unknown keys stripped), or sends the 400 and returns null.
// Callers must stop when this returns null, because the response is already sent.
function parseOr400(schema, input, res, message) {
  const result = schema.safeParse(input);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: toFieldErrors(result.error),
      },
    });
    return null;
  }
  return result.data;
}

// Piles are few, so we compare in JavaScript. SQLite's lower() only folds ASCII,
// which would treat "ÉCOLE" and "école" as different names.
async function findDuplicatePile(name, exceptId) {
  const piles = await Pile.findAll();
  const wanted = name.toLowerCase();
  return piles.find((pile) => pile.id !== exceptId && pile.name.toLowerCase() === wanted);
}

// Returns the General pile, creating it when there is none, or null when `pileId` is General itself.
async function findOrCreateGeneralPile(pileId, transaction) {
  const piles = await Pile.findAll({ transaction });
  const wanted = GENERAL_PILE_NAME.toLowerCase();
  const existing = piles.find((pile) => pile.name.toLowerCase() === wanted);
  if (existing) return existing.id === pileId ? null : existing;
  return Pile.create({ name: GENERAL_PILE_NAME }, { transaction });
}

function sendDuplicatePile(res, existing) {
  res.status(409).json({
    error: {
      code: 'DUPLICATE_NAME',
      message: 'Duplicate pile name',
      details: { name: `You already have a pile called "${existing.name}"` },
    },
  });
}

function pileToJson(pile, cardCount) {
  return { id: pile.id, name: pile.name, cardCount, createdAt: pile.createdAt };
}

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Pile order matches the tabs: oldest first, id as the tie-break.
const PILE_ORDER = [
  ['createdAt', 'ASC'],
  ['id', 'ASC'],
];

app.get(
  '/api/piles',
  asyncHandler(async (req, res) => {
    const piles = await Pile.findAll({ order: PILE_ORDER });
    // One grouped query for all counts: [{ pileId, count }]. The null pileId row is Unsorted.
    const counts = await Card.count({ group: ['pileId'] });
    const countByPileId = new Map(counts.map((row) => [row.pileId, row.count]));
    res.json({
      piles: piles.map((pile) => pileToJson(pile, countByPileId.get(pile.id) ?? 0)),
      unsortedCount: countByPileId.get(null) ?? 0,
    });
  }),
);

app.post(
  '/api/piles',
  asyncHandler(async (req, res) => {
    const data = parseOr400(pileSchema, req.body, res, 'Invalid pile');
    if (!data) return;
    const duplicate = await findDuplicatePile(data.name);
    if (duplicate) return sendDuplicatePile(res, duplicate);
    const pile = await Pile.create(data);
    res.status(201).json(pileToJson(pile, 0));
  }),
);

app.put(
  '/api/piles/:id',
  asyncHandler(async (req, res) => {
    // Look the pile up first so an unknown id is a 404 even when the body is also invalid.
    const pile = await findByIdOr404(Pile, req.params.id, res, 'Pile not found');
    if (!pile) return;
    const data = parseOr400(pileSchema, req.body, res, 'Invalid pile');
    if (!data) return;
    // Excluding this pile lets "math" be renamed to "Math".
    const duplicate = await findDuplicatePile(data.name, pile.id);
    if (duplicate) return sendDuplicatePile(res, duplicate);
    await pile.update(data);
    const cardCount = await Card.count({ where: { pileId: pile.id } });
    res.json(pileToJson(pile, cardCount));
  }),
);

app.delete(
  '/api/piles/:id',
  asyncHandler(async (req, res) => {
    const pile = await findByIdOr404(Pile, req.params.id, res, 'Pile not found');
    if (!pile) return;
    const query = parseOr400(deletePileQuerySchema, req.query, res, 'Invalid delete option');
    if (!query) return;

    const cardCount = await Card.count({ where: { pileId: pile.id } });
    if (cardCount > 0 && !query.cards) {
      return res.status(409).json({
        error: {
          code: 'PILE_NOT_EMPTY',
          message: 'This pile still has cards',
          details: { cardCount },
        },
      });
    }

    // Cards first, then the pile, in one transaction: a failure half-way leaves everything as it was.
    // Handling the cards first also keeps the pileId foreign key satisfied.
    await runInTransaction(async (transaction) => {
      const where = { pileId: pile.id };
      if (query.cards === 'delete') {
        await Card.destroy({ where, transaction });
      } else if ((await Card.count({ where, transaction })) > 0) {
        // Kept cards go to General, the catch-all. Deleting General itself is the one case with
        // nowhere to move them, so those cards become Unsorted.
        // Counted again here, not reused from above: cards can change while this waits in the
        // transaction queue, and a stale count would make an empty General or skip a card.
        const general = await findOrCreateGeneralPile(pile.id, transaction);
        await Card.update({ pileId: general?.id ?? null }, { where, transaction });
      }
      await pile.destroy({ transaction });
    });
    res.status(204).end();
  }),
);

app.get(
  '/api/cards',
  asyncHandler(async (req, res) => {
    const query = parseOr400(cardsQuerySchema, req.query, res, 'Invalid card filter');
    if (!query) return;

    // 'unsorted' is cards without a pile; a number must be a real pile.
    let pileId = null;
    if (query.pileId !== 'unsorted') {
      // findByIdOr404 takes the id as text, like it arrives in a URL.
      if (!(await findByIdOr404(Pile, String(query.pileId), res, 'Pile not found'))) return;
      pileId = query.pileId;
    }

    // id is the tie-break so cards created in the same millisecond keep a stable order.
    const cards = await Card.findAll({
      where: { pileId },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    res.json(cards);
  }),
);

app.post(
  '/api/cards',
  asyncHandler(async (req, res) => {
    const data = parseOr400(createCardSchema, req.body, res, 'Invalid card');
    if (!data) return;
    if (!(await findByIdOr404(Pile, String(data.pileId), res, 'Pile not found'))) return;
    const card = await Card.create(data);
    res.status(201).json(card);
  }),
);

// Registered before the /api/cards/:id routes so "move" is never read as a card id.
app.post(
  '/api/cards/move',
  asyncHandler(async (req, res) => {
    const data = parseOr400(moveCardsSchema, req.body, res, 'Invalid move');
    if (!data) return;
    const { cardIds, pileId } = data;
    if (!(await findByIdOr404(Pile, String(pileId), res, 'Pile not found'))) return;

    // Check every card first so one unknown id moves nothing at all.
    const existingCount = await Card.count({ where: { id: cardIds } });
    if (existingCount !== cardIds.length) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    }

    await runInTransaction(async (transaction) => {
      await Card.update({ pileId }, { where: { id: cardIds }, transaction });
    });
    res.json({ movedCount: cardIds.length });
  }),
);

app.put(
  '/api/cards/:id',
  asyncHandler(async (req, res) => {
    // Look the card up first so an unknown id is a 404 even when the body is also invalid.
    const card = await findByIdOr404(Card, req.params.id, res, 'Card not found');
    if (!card) return;
    const data = parseOr400(cardSchema, req.body, res, 'Invalid card');
    if (!data) return;
    await card.update(data);
    res.json(card);
  }),
);

app.delete(
  '/api/cards/:id',
  asyncHandler(async (req, res) => {
    const card = await findByIdOr404(Card, req.params.id, res, 'Card not found');
    if (!card) return;
    await card.destroy();
    res.status(204).end();
  }),
);

// Unknown /api routes return our standard error shape.
app.use('/api', (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Must be registered last, and keep all four arguments: that is how Express knows it's an error handler.
// eslint-disable-next-line no-unused-vars -- Express needs the 4th arg to treat this as an error handler
app.use((err, req, res, next) => {
  // express.json() throws this type when the request body isn't valid JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' },
    });
  }
  // Log the real error for us, but never send its details or stack to the client.
  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});

export default app;
