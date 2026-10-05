import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardGrid from './CardGrid.jsx';
import { renderWithClient } from '../test-utils.jsx';

const card1 = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' };
const card2 = { id: 2, question: 'Capital of France?', answer: 'Paris' };

function renderGrid(props = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onSaveCard: vi.fn().mockResolvedValue(undefined),
    onRequestDelete: vi.fn(),
    onLongPress: vi.fn(),
    onToggleSelect: vi.fn(),
  };
  const allProps = {
    cards: [],
    isLoading: false,
    isError: false,
    isFetching: false,
    emptyMessage: 'No cards in Geography yet — make your first one!',
    ...handlers,
    ...props,
  };
  const view = renderWithClient(<CardGrid {...allProps} />);
  return { ...handlers, ...view, props: allProps, user: userEvent.setup() };
}

describe('CardGrid', () => {
  it('has no heading of its own (the pile panel header names it)', () => {
    renderGrid({ cards: [card1] });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('shows a loading status while loading', () => {
    renderGrid({ cards: undefined, isLoading: true });

    // getByText, not getByRole('status'): the DndContext adds its own (empty) live region.
    expect(screen.getByText('Loading cards…')).toHaveAttribute('role', 'status');
  });

  it('shows an error with a Retry button that calls onRetry', async () => {
    const { onRetry, user } = renderGrid({ cards: undefined, isError: true });

    expect(screen.getByText("Couldn't load cards")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('styles Retry as a white button, not the pink primary one', () => {
    renderGrid({ cards: undefined, isError: true });

    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toHaveClass('bg-white', 'font-bold');
    expect(retry).not.toHaveClass('bg-pop');
  });

  it('disables Retry and shows a loading status while a retry is in flight', () => {
    renderGrid({ cards: undefined, isError: true, isFetching: true });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(screen.getByText('Loading cards…')).toHaveAttribute('role', 'status');
  });

  it('keeps Retry enabled and shows no status when nothing is fetching', () => {
    renderGrid({ cards: undefined, isError: true });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(screen.queryByText('Loading cards…')).not.toBeInTheDocument();
  });

  it('shows the emptyMessage when there are no cards', () => {
    renderGrid({ cards: [], emptyMessage: 'No cards in Math yet — make your first one!' });

    expect(screen.getByText('No cards in Math yet — make your first one!')).toBeInTheDocument();
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

  describe('selection', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('marks only the selected cards as selected', () => {
      renderGrid({
        cards: [card1, card2],
        selectionMode: true,
        selectedIds: [2],
      });

      expect(screen.getByRole('button', { name: /capital of france/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /capital of australia/i })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: /capital of france/i })).toHaveClass('is-selected');
    });

    it('passes selection mode to every card (Edit and Toss hidden)', () => {
      renderGrid({
        cards: [card1, card2],
        selectionMode: true,
        selectedIds: [2],
      });

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Toss' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /capital of australia/i })).toHaveAccessibleName(/Tap to add$/);
      expect(screen.getByRole('button', { name: /capital of france/i })).toHaveAccessibleName(/Selected$/);
    });

    it('calls onToggleSelect with the tapped card id in selection mode', async () => {
      const { onToggleSelect, user } = renderGrid({
        cards: [card1, card2],
        selectionMode: true,
        selectedIds: [2],
      });

      await user.click(screen.getByRole('button', { name: /capital of australia/i }));

      expect(onToggleSelect).toHaveBeenCalledWith(1);
    });

    it('calls onLongPress with the held card id', () => {
      vi.useFakeTimers();
      const { onLongPress } = renderGrid({ cards: [card1, card2] });
      const face = screen.getByRole('button', { name: /capital of france/i });

      fireEvent.pointerDown(face, { clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(400));

      expect(onLongPress).toHaveBeenCalledWith(2);
    });
  });
});
