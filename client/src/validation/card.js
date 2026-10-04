// Same limit and messages as the server's Zod schema, so users see one wording.
export const MAX_LENGTH = 200;

function validateField(label, value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return `${label} is required`;
  if (trimmed.length > MAX_LENGTH) return `${label} must be ${MAX_LENGTH} characters or fewer`;
  return undefined;
}

// Returns an object of error messages keyed by field; an empty object means valid.
export function validateCard({ question, answer }) {
  const errors = {};
  const questionError = validateField('Question', question);
  const answerError = validateField('Answer', answer);
  if (questionError) errors.question = questionError;
  if (answerError) errors.answer = answerError;
  return errors;
}
