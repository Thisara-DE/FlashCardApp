import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardGrid from './CardGrid.jsx';

const card1 = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' };
const card2 = { id: 2, question: 'Capital of France?', answer: 'Paris' };

function renderGrid(props = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onSaveCard: vi.fn().mockResolvedValue(undefined),
    onRequestDelete: vi.fn(),
  };
  const allProps = { cards: [], isLoading: false, isError: false, ...handlers, ...props };
  const view = render(<CardGrid {...allProps} />);
  return { ...handlers, ...view, props: allProps, user: userEvent.setup() };
}

describe('CardGrid', () => {
  it('always shows the heading and the hint', () => {
    renderGrid();

    expect(screen.getByRole('heading', { name: 'The pile' })).toBeInTheDocument();
    expect(screen.getByText('Tap a card to flip it — newest on top')).toBeInTheDocument();
  });

  it('shows a loading status while loading', () => {
    renderGrid({ cards: undefined, isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Loading cards…');
  });

  it('shows an error with a Retry button that calls onRetry', async () => {
    const { onRetry, user } = renderGrid({ cards: undefined, isError: true });

    expect(screen.getByText("Couldn't load cards")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty message when there are no cards', () => {
    renderGrid({ cards: [] });

    expect(screen.getByText('No cards yet — make your first one!')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders one list item per card, in the order given', () => {
    renderGrid({ cards: [card2, card1] });

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Capital of France?');
    expect(items[1]).toHaveTextContent('Capital of Australia?');
  });

  it('keeps flip state across a refetch that returns new objects with the same ids', async () => {
    const { user, rerender, props } = renderGrid({ cards: [card1, card2] });
    await user.click(screen.getByRole('button', { name: /capital of france/i }));
    expect(screen.getByRole('button', { name: /paris/i })).toHaveAttribute('aria-pressed', 'true');

    const newCard = { id: 3, question: 'Capital of Japan?', answer: 'Tokyo' };
    rerender(<CardGrid {...props} cards={[newCard, { ...card1 }, { ...card2 }]} />);

    expect(screen.getByRole('button', { name: /paris/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /capital of australia/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onSaveCard with the card id and the edited values', async () => {
    const { onSaveCard, user } = renderGrid({ cards: [card1, card2] });
    const secondItem = screen.getAllByRole('listitem')[1];

    await user.click(within(secondItem).getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText(/answer/i));
    await user.type(screen.getByLabelText(/answer/i), 'Lyon');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSaveCard).toHaveBeenCalledWith(2, { question: 'Capital of France?', answer: 'Lyon' });
  });

  it('passes the card to onRequestDelete when Toss is clicked', async () => {
    const { onRequestDelete, user } = renderGrid({ cards: [card1, card2] });
    const firstItem = screen.getAllByRole('listitem')[0];

    await user.click(within(firstItem).getByRole('button', { name: 'Toss' }));

    expect(onRequestDelete).toHaveBeenCalledWith(card1);
  });
});
