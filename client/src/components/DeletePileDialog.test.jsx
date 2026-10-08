import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeletePileDialog from './DeletePileDialog.jsx';

const TITLE = 'Delete the Law pile?';

function dialogProps(props = {}) {
  return {
    open: true,
    pileName: 'Law',
    cardCount: 12,
    onKeep: vi.fn(),
    onDeleteCards: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
}

function renderDialog(props = {}) {
  const merged = dialogProps(props);
  render(<DeletePileDialog {...merged} />);
  return { ...merged, user: userEvent.setup() };
}

// Each choice button's accessible name starts with its bold label, followed by its subtext.
const keepButton = () => screen.getByRole('button', { name: /^Keep the cards/ });
const deleteCardsButton = () => screen.getByRole('button', { name: /^Delete the cards too/ });
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' });

describe('DeletePileDialog', () => {
  it('is not exposed as a dialog while closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a dialog named by its title, with the card count and both choices', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument();
    expect(screen.getByText('It still has 12 cards. What should happen to them?')).toBeInTheDocument();
    expect(keepButton()).toHaveAccessibleName(
      'Keep the cards They move to the General pile, so you can drag them into another pile later.',
    );
    expect(deleteCardsButton()).toHaveAccessibleName(
      'Delete the cards too All 12 cards are gone for good. No take-backs.',
    );
    expect(screen.getByText('All 12 cards are gone for good. No take-backs.')).toBeInTheDocument();
  });

  it('uses the singular for exactly one card', () => {
    renderDialog({ cardCount: 1 });

    expect(screen.getByText('It still has 1 card. What should happen to them?')).toBeInTheDocument();
    expect(screen.getByText('That card is gone for good. No take-backs.')).toBeInTheDocument();
  });

  it('says the cards go to Unsorted when the pile being deleted is General itself', () => {
    renderDialog({ pileName: 'general' });

    expect(keepButton()).toHaveAccessibleName(
      'Keep the cards They move to Unsorted, so you can drag them into another pile later.',
    );
  });

  it('calls onKeep when Keep the cards is clicked', async () => {
    const { onKeep, onDeleteCards, onCancel, user } = renderDialog();
    await user.click(keepButton());
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onDeleteCards).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onDeleteCards when Delete the cards too is clicked', async () => {
    const { onKeep, onDeleteCards, onCancel, user } = renderDialog();
    await user.click(deleteCardsButton());
    expect(onDeleteCards).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const { onKeep, onDeleteCards, onCancel, user } = renderDialog();
    await user.click(cancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onKeep).not.toHaveBeenCalled();
    expect(onDeleteCards).not.toHaveBeenCalled();
  });

  it('calls onCancel on the native cancel event (Esc) and prevents the default close', () => {
    const { onCancel } = renderDialog();

    // fireEvent returns false when a listener called preventDefault().
    const notPrevented = fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('disables all three buttons while pending', () => {
    renderDialog({ pending: true });
    expect(keepButton()).toBeDisabled();
    expect(deleteCardsButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
  });

  it('shows an error message in an alert inside the dialog', () => {
    renderDialog({ error: "Couldn't delete this pile. Try again." });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete this pile. Try again.");
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('alert'));
  });

  it('shows no alert when there is no error', () => {
    renderDialog();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('returns focus to the element that was focused before it opened', () => {
    const props = dialogProps({ open: false });
    const { rerender } = render(
      <>
        <button type="button">Trigger</button>
        <DeletePileDialog {...props} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();

    rerender(
      <>
        <button type="button">Trigger</button>
        <DeletePileDialog {...props} open />
      </>,
    );
    cancelButton().focus();
    expect(trigger).not.toHaveFocus();

    rerender(
      <>
        <button type="button">Trigger</button>
        <DeletePileDialog {...props} open={false} />
      </>,
    );
    expect(trigger).toHaveFocus();
  });

  describe('when the browser closes the native dialog', () => {
    it('reopens it while the parent still says open', () => {
      renderDialog();
      const dialog = screen.getByRole('dialog', { name: TITLE });

      dialog.close();

      expect(dialog).toHaveAttribute('open');
    });

    it('stays closed when the parent closed it by setting open to false', () => {
      const props = dialogProps();
      const { rerender } = render(<DeletePileDialog {...props} />);
      const dialog = screen.getByRole('dialog', { name: TITLE });

      rerender(<DeletePileDialog {...props} open={false} />);

      expect(dialog).not.toHaveAttribute('open');
    });
  });
});
