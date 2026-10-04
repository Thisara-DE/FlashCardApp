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
