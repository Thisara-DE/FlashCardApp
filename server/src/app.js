import express from 'express';
import { Card } from './db.js';
import { cardSchema, toFieldErrors } from './schemas/card.js';

const app = express();

app.use(express.json());

// Express 4 doesn't forward rejected promises to the error middleware on its own.
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Sends the 404 and returns null when the id isn't a positive integer or no card has it.
// Callers must stop when this returns null, because the response is already sent.
async function findCardOr404(req, res) {
  const { id } = req.params;
  const card = /^[1-9]\d*$/.test(id) ? await Card.findByPk(Number(id)) : null;
  if (!card) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Card not found' } });
    return null;
  }
  return card;
}

// Returns the validated, trimmed card fields, or sends the 400 and returns null.
// Callers must stop when this returns null, because the response is already sent.
function parseCardOr400(req, res) {
  const result = cardSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid card',
        details: toFieldErrors(result.error),
      },
    });
    return null;
  }
  return result.data;
}

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

app.get(
  '/api/cards',
  asyncHandler(async (req, res) => {
    // id is the tie-break so cards created in the same millisecond keep a stable order.
    const cards = await Card.findAll({
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
    const data = parseCardOr400(req, res);
    if (!data) return;
    const card = await Card.create(data);
    res.status(201).json(card);
  }),
);

app.put(
  '/api/cards/:id',
  asyncHandler(async (req, res) => {
    // Look the card up first so an unknown id is a 404 even when the body is also invalid.
    const card = await findCardOr404(req, res);
    if (!card) return;
    const data = parseCardOr400(req, res);
    if (!data) return;
    await card.update(data);
    res.json(card);
  }),
);

app.delete(
  '/api/cards/:id',
  asyncHandler(async (req, res) => {
    const card = await findCardOr404(req, res);
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
