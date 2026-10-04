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

// Turns a ZodError into { question?: string, answer?: string } (first message per field).
export function toFieldErrors(error) {
  const fieldErrors = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages[0]]),
  );
}
