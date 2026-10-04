import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PileTabs from './PileTabs.jsx';
import { ApiError } from '../api/request.js';

const PILES = [
  { id: 1, name: 'Geography', cardCount: 2 },
  { id: 2, name: 'Math', cardCount: 0 },
];

function renderTabs(props = {}) {
  const onSelect = vi.fn();
  const onCreatePile = props.onCreatePile ?? vi.fn().mockResolvedValue({ id: 9, name: 'Bio', cardCount: 0 });
  render(
    <PileTabs
      piles={PILES}
      unsortedCount={0}
      selectedKey={1}
      onSelect={onSelect}
      {...props}
      onCreatePile={onCreatePile}
    />,
  );
  return { onSelect, onCreatePile, user: userEvent.setup() };
}

describe('PileTabs', () => {
  it('lists piles in the given order as "Name · count" buttons inside the Piles nav', () => {
    renderTabs();
    const nav = screen.getByRole('navigation', { name: 'Piles' });
    const labels = within(nav)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(['Geography · 2', 'Math · 0', '+ New pile']);
  });

  it('marks only the selected tab as pressed', () => {
    renderTabs({ selectedKey: 2 });
    expect(screen.getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Math · 0' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the Unsorted tab after the piles, and only when there are unsorted cards', () => {
    const { unmount } = render(
      <PileTabs piles={PILES} unsortedCount={3} selectedKey={1} onSelect={vi.fn()} onCreatePile={vi.fn()} />,
    );
    const labels = within(screen.getByRole('navigation', { name: 'Piles' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(['Geography · 2', 'Math · 0', 'Unsorted · 3', '+ New pile']);
    unmount();

    renderTabs({ unsortedCount: 0 });
    expect(screen.queryByRole('button', { name: /Unsorted/ })).not.toBeInTheDocument();
  });

  it('marks the Unsorted tab as pressed when it is selected', () => {
    renderTabs({ unsortedCount: 3, selectedKey: 'unsorted' });
    expect(screen.getByRole('button', { name: 'Unsorted · 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the pile id when a tab is clicked', async () => {
    const { onSelect, user } = renderTabs();
    await user.click(screen.getByRole('button', { name: 'Math · 0' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("calls onSelect with 'unsorted' when the Unsorted tab is clicked", async () => {
    const { onSelect, user } = renderTabs({ unsortedCount: 3 });
    await user.click(screen.getByRole('button', { name: 'Unsorted · 3' }));
    expect(onSelect).toHaveBeenCalledWith('unsorted');
  });

  it('creates a pile inline, selects it and closes the form', async () => {
    const { onSelect, onCreatePile, user } = renderTabs();

    await user.click(screen.getByRole('button', { name: '+ New pile' }));
    await user.type(screen.getByLabelText('New pile name'), 'Bio');
    await user.click(screen.getByRole('button', { name: 'Add pile' }));

    expect(onCreatePile).toHaveBeenCalledWith('Bio');
    expect(onSelect).toHaveBeenCalledWith(9);
    expect(screen.queryByLabelText('New pile name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New pile' })).toBeInTheDocument();
  });

  it('keeps the form open and shows the message on a 409', async () => {
    const message = 'You already have a pile called "Bio"';
    const onCreatePile = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 409, code: 'DUPLICATE_NAME', message: 'x', details: { name: message } }),
      );
    const { onSelect, user } = renderTabs({ onCreatePile });

    await user.click(screen.getByRole('button', { name: '+ New pile' }));
    await user.type(screen.getByLabelText('New pile name'), 'Bio');
    await user.click(screen.getByRole('button', { name: 'Add pile' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('New pile name')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('restores the + New pile button, with focus, when the form is cancelled', async () => {
    const { user } = renderTabs();

    await user.click(screen.getByRole('button', { name: '+ New pile' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('New pile name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New pile' })).toHaveFocus();
  });
});
