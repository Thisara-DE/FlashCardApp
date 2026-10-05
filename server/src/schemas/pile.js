import { z } from 'zod';

export const MAX_PILE_NAME = 40;

// trim() runs before min(1), so whitespace-only input counts as empty.
// Unknown keys are stripped by default, so extra body fields never reach the DB.
export const pileSchema = z.object({
  name: z
    .string({
      required_error: 'Pile name is required',
      invalid_type_error: 'Pile name must be text',
    })
    .trim()
    .min(1, 'Pile name is required')
    .max(MAX_PILE_NAME, `Pile name must be ${MAX_PILE_NAME} characters or fewer`),
});

// The optional ?cards= choice for deleting a pile that still has cards.
export const deletePileQuerySchema = z.object({
  cards: z
    .enum(['keep', 'delete'], {
      errorMap: () => ({ message: 'cards must be "keep" or "delete"' }),
    })
    .optional(),
});
