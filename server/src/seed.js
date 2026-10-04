import { Card, Pile } from './db.js';

export const SEED_PILES = [
  {
    name: 'Geography',
    cards: [
      { question: 'What is the capital of Australia?', answer: 'Canberra' },
      { question: 'Which river is the longest in the world?', answer: 'The Nile' },
    ],
  },
  {
    name: 'History',
    cards: [
      { question: 'In which year did World War II end?', answer: '1945' },
      { question: 'Who was the first President of the United States?', answer: 'George Washington' },
    ],
  },
  {
    name: 'Law',
    cards: [
      { question: 'What is a tort?', answer: 'A civil wrong that causes harm or loss' },
      { question: 'What does habeas corpus protect against?', answer: 'Unlawful detention' },
    ],
  },
  {
    name: 'Math',
    cards: [
      { question: 'What is the square root of 144?', answer: '12' },
      { question: 'What is pi to two decimal places?', answer: '3.14' },
    ],
  },
  {
    name: 'Science',
    cards: [
      { question: 'What is the chemical symbol for gold?', answer: 'Au' },
      { question: 'What is the largest planet in our solar system?', answer: 'Jupiter' },
    ],
  },
];

// Only fills a completely empty database, so restarting the server never
// duplicates the samples or fills in around a user's own piles and cards.
export async function seed() {
  if ((await Pile.count()) > 0 || (await Card.count()) > 0) return;

  // One pile at a time (not bulkCreate) so ids and createdAt ascend in order.
  for (const { name, cards } of SEED_PILES) {
    const pile = await Pile.create({ name });
    await Card.bulkCreate(cards.map((card) => ({ ...card, pileId: pile.id })));
  }
}
