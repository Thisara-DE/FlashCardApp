import { describe, expect, it } from 'vitest';
import { MAX_PILE_NAME, validatePileName } from './pile.js';

const piles = [
  { id: 1, name: 'Math' },
  { id: 2, name: 'ÉCOLE' },
];

describe('validatePileName', () => {
  it('exposes the 40 character limit', () => {
    expect(MAX_PILE_NAME).toBe(40);
  });

  it.each([
    ['', 'Pile name is required'],
    ['   ', 'Pile name is required'],
    ['a'.repeat(41), 'Pile name must be 40 characters or fewer'],
    ['  math ', 'You already have a pile called "Math"'],
    ['école', 'You already have a pile called "ÉCOLE"'],
  ])('%j → %s', (name, message) => {
    expect(validatePileName(name, piles)).toBe(message);
  });

  it('accepts 40 characters after trimming', () => {
    expect(validatePileName(` ${'a'.repeat(40)} `, piles)).toBeUndefined();
  });

  it('ignores the pile being renamed', () => {
    expect(validatePileName('MATH', piles, { ignoreId: 1 })).toBeUndefined();
  });
});
