import { z } from 'zod';

const MAX_LENGTH = 200;

// Builds one text rule per field so the messages stay consistent.
// trim() runs before min(1), so whitespace-only input counts as empty.
const cardText = (label) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(MAX_LENGTH, `${label} must be ${MAX_LENGTH} characters or fewer`);

// Unknown keys are stripped by default, so extra body fields never reach the DB.
export const cardSchema = z.object({
  question: cardText('Question'),
  answer: cardText('Answer'),
});

// A pile id sent in a JSON body: a positive whole number, with one message for every failure.
const pileIdField = (message) =>
  z.number({ required_error: message, invalid_type_error: message }).int(message).positive(message);

// pileId is optional for now so the current client keeps working.
export const createCardSchema = cardSchema.extend({
  pileId: pileIdField('Pick a pile for this card').optional(),
});

// Query strings are always text, so we check the format first and then convert.
// A repeated param (?pileId=1&pileId=2) arrives as an array and fails the string check.
const PILE_FILTER_MESSAGE = 'pileId must be a pile id or "unsorted"';
export const cardsQuerySchema = z.object({
  pileId: z
    .string({ required_error: 'pileId is required', invalid_type_error: PILE_FILTER_MESSAGE })
    .regex(/^([1-9]\d*|unsorted)$/, PILE_FILTER_MESSAGE)
    .transform((value) => (value === 'unsorted' ? value : Number(value)))
    .optional(),
});

const MAX_MOVE_CARDS = 100;
const MOVE_COUNT_MESSAGE = `Pick between 1 and ${MAX_MOVE_CARDS} cards`;

export const moveCardsSchema = z.object({
  cardIds: z
    .array(
      z
        .number({ invalid_type_error: 'Each card id must be a whole number' })
        .int('Each card id must be a whole number')
        .positive('Each card id must be a whole number'),
      { required_error: MOVE_COUNT_MESSAGE, invalid_type_error: MOVE_COUNT_MESSAGE },
    )
    .min(1, MOVE_COUNT_MESSAGE)
    .max(MAX_MOVE_CARDS, MOVE_COUNT_MESSAGE)
    // A Set drops duplicates, so a smaller Set means an id was listed twice.
    .refine((ids) => new Set(ids).size === ids.length, 'Each card can only be listed once'),
  pileId: pileIdField('Pick a pile to move the cards to'),
});

// Turns a ZodError into { question?: string, answer?: string } (first message per field).
export function toFieldErrors(error) {
  const fieldErrors = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages[0]]),
  );
}
