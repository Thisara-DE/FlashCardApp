import { Card } from './db.js';

export const SEED_CARDS = [
  { question: 'What is the capital of Australia?', answer: 'Canberra' },
  { question: 'What does HTTP status code 404 mean?', answer: 'Not Found' },
  { question: 'Who wrote "Pride and Prejudice"?', answer: 'Jane Austen' },
  { question: 'What is the chemical symbol for gold?', answer: 'Au' },
  {
    question: 'What is the largest planet in our solar system?',
    answer: 'Jupiter',
  },
];

// Only fills an empty table, so restarting the server never duplicates cards
// or overwrites a user's own deck.
export async function seed() {
  if ((await Card.count()) > 0) return;
  await Card.bulkCreate(SEED_CARDS);
}
