import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PileHeader from './PileHeader.jsx';

const PILES = [
  { id: 1, name: 'Geography', cardCount: 2 },
  { id: 2, name: 'Math', cardCount: 0 },
];

function renderHeader(props = {}) {
  const handlers = {
    onRename: vi.fn().mockResolvedValue(undefined),
    onRequestDelete: vi.fn(),
    onToggleNewCard: vi.fn(),
  };
  render(
    <PileHeader
      variant="pile"
      name="Geography"
      pileId={1}
      existingPiles={PILES}
      newCardOpen={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, user: userEvent.setup() };
}

describe('PileHeader (pile variant)', () => {
  it('shows the heading and the three buttons', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Geography' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete pile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Geography card' })).toBeInTheDocument();
  });

  it('reflects newCardOpen in aria-expanded and calls onToggleNewCard on click', async () => {
    const { onToggleNewCard, user } = renderHeader();
    const button = screen.getByRole('button', { name: 'New Geography card' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    expect(onToggleNewCard).toHaveBeenCalledTimes(1);
  });

  it('sets aria-expanded to true while the new card form is open', () => {
    renderHeader({ newCardOpen: true });
    expect(screen.getByRole('button', { name: 'New Geography card' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('attaches newCardButtonRef to the new card button', () => {
    const ref = { current: null };
    renderHeader({ newCardButtonRef: ref });
    expect(ref.current).toBe(screen.getByRole('button', { name: 'New Geography card' }));
  });

  it('calls onRequestDelete when Delete pile is clicked', async () => {
    const { onRequestDelete, user } = renderHeader();
    await user.click(screen.getByRole('button', { name: 'Delete pile' }));
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('renames: shows a pre-filled form, saves, then restores the heading and focuses Rename', async () => {
    const { onRename, user } = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Pile name');
    expect(input).toHaveValue('Geography');
    expect(screen.queryByRole('button', { name: 'Delete pile' })).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Geo');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onRename).toHaveBeenCalledWith('Geo');
    expect(await screen.findByRole('heading', { name: 'Geography' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Pile name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
  });

  it('cancels a rename and returns focus to Rename', async () => {
    const { onRename, user } = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
  });

  it("shows the duplicate message when renaming to another pile's name, ignoring case", async () => {
    const { onRename, user } = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Pile name');
    await user.clear(input);
    await user.type(input, 'math');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('You already have a pile called "Math"')).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('allows a case-only change of its own name', async () => {
    const { onRename, user } = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Pile name');
    await user.clear(input);
    await user.type(input, 'GEOGRAPHY');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onRename).toHaveBeenCalledWith('GEOGRAPHY');
  });

  it('replaces the buttons with selectionBar but keeps the heading', () => {
    renderHeader({ selectionBar: <p>bar</p> });
    expect(screen.getByRole('heading', { name: 'Geography' })).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete pile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Geography card' })).not.toBeInTheDocument();
  });
});

describe('PileHeader rename state across changes', () => {
  const baseProps = {
    existingPiles: PILES,
    onRename: vi.fn().mockResolvedValue(undefined),
    onRequestDelete: vi.fn(),
    newCardOpen: false,
    onToggleNewCard: vi.fn(),
  };

  it('closes the rename form when a different pile is shown', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByLabelText('Pile name')).toHaveValue('Geography');

    rerender(<PileHeader variant="pile" name="Math" pileId={2} {...baseProps} />);

    expect(screen.queryByLabelText('Pile name')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Math' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });

  it('does not reopen the rename form after a trip through Unsorted', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    rerender(<PileHeader variant="unsorted" name="Unsorted" {...baseProps} />);
    rerender(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} />);

    expect(screen.queryByLabelText('Pile name')).not.toBeInTheDocument();
  });

  it('abandons an open rename when selection mode starts', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    rerender(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} selectionBar={<p>bar</p>} />);
    rerender(<PileHeader variant="pile" name="Geography" pileId={1} {...baseProps} />);

    expect(screen.queryByLabelText('Pile name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });
});

describe('PileHeader (unsorted variant)', () => {
  it('shows the heading and the hint, and no buttons', () => {
    render(
      <PileHeader
        variant="unsorted"
        name="Unsorted"
        existingPiles={PILES}
        onRename={vi.fn()}
        onRequestDelete={vi.fn()}
        newCardOpen={false}
        onToggleNewCard={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Unsorted' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'These cards lost their pile. Press and hold a card to select it, then drag it onto a pile.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
