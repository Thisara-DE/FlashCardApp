import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoPilesState from './NoPilesState.jsx';

function renderState(props = {}) {
  const onCreatePile = props.onCreatePile ?? vi.fn().mockResolvedValue(undefined);
  render(<NoPilesState unsortedCount={0} {...props} onCreatePile={onCreatePile} />);
  return { onCreatePile, user: userEvent.setup() };
}

describe('NoPilesState', () => {
  it('shows both steps', () => {
    renderState();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start with a pile' })).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Make a card' })).toBeInTheDocument();
    expect(screen.getByText(/A pile is one subject, like Geography, Math or Law\./)).toBeInTheDocument();
    expect(screen.getByText('Make a pile first, then your cards go in here.')).toBeInTheDocument();
  });

  it('offers a pile name field with a placeholder and creates the pile', async () => {
    const { onCreatePile, user } = renderState();
    const input = screen.getByLabelText('Pile name');
    expect(input).toHaveAttribute('placeholder', 'e.g. Geography');

    await user.type(input, 'Biology');
    await user.click(screen.getByRole('button', { name: 'Make the pile' }));

    expect(onCreatePile).toHaveBeenCalledWith('Biology');
  });

  it('has no Cancel button on the pile form', () => {
    renderState();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('disables the card fields and button until a pile exists', () => {
    renderState();
    expect(screen.getByLabelText('Question')).toBeDisabled();
    expect(screen.getByLabelText('Answer')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Slam it in!' })).toBeDisabled();
  });

  it('mentions unsorted cards only when there are some', () => {
    const { unmount } = render(<NoPilesState unsortedCount={0} onCreatePile={vi.fn()} />);
    expect(screen.queryByText(/unsorted/)).not.toBeInTheDocument();
    unmount();

    const { unmount: unmountMany } = render(<NoPilesState unsortedCount={3} onCreatePile={vi.fn()} />);
    expect(screen.getByText('You have 3 unsorted cards. Make a pile, then drag them in.')).toBeInTheDocument();
    unmountMany();

    render(<NoPilesState unsortedCount={1} onCreatePile={vi.fn()} />);
    expect(screen.getByText('You have 1 unsorted card. Make a pile, then drag them in.')).toBeInTheDocument();
  });
});
