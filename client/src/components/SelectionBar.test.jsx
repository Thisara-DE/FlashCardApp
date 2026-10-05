import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectionBar from './SelectionBar.jsx';

const TARGETS = [
  { id: 2, name: 'Math' },
  { id: 3, name: 'Law' },
];

function renderBar(props = {}) {
  const onMove = vi.fn();
  const onClear = vi.fn();
  render(<SelectionBar count={2} targets={TARGETS} onMove={onMove} onClear={onClear} {...props} />);
  return { onMove, onClear, user: userEvent.setup() };
}

describe('SelectionBar', () => {
  it('shows the count and the hint inside a status region', () => {
    renderBar();

    const bar = screen.getByRole('status');
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    expect(within(bar).getByText('Drag them onto a tab, or')).toBeInTheDocument();
  });

  it('offers exactly the target piles in Move to…, the first one chosen', () => {
    renderBar();

    const select = screen.getByLabelText('Move to…');
    const options = within(select).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Math', 'Law']);
    expect(select).toHaveValue('2');
  });

  it('Move calls onMove with the first target by default', async () => {
    const { onMove, user } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(onMove).toHaveBeenCalledWith(2);
  });

  it('Move calls onMove with the chosen pile id, as a number', async () => {
    const { onMove, user } = renderBar();

    await user.selectOptions(screen.getByLabelText('Move to…'), 'Law');
    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(onMove).toHaveBeenCalledWith(3);
  });

  it('Clear calls onClear', async () => {
    const { onClear, user } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows an error as an alert', () => {
    renderBar({ error: "Couldn't move those cards. Try again." });

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't move those cards. Try again.");
  });

  it('shows no alert without an error', () => {
    renderBar();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables Move while a move is pending', () => {
    renderBar({ pending: true });

    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  });

  it('disables Move when there is no other pile to move to', () => {
    renderBar({ targets: [] });

    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  });
});
