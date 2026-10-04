import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog.jsx';

const TITLE = 'Toss it for real?';

function dialogProps(props = {}) {
  return {
    open: true,
    title: TITLE,
    message: '“Q?” goes in the bin. No take-backs.',
    confirmLabel: 'Toss it',
    cancelLabel: 'Keep it',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
}

function renderDialog(props = {}) {
  const merged = dialogProps(props);
  render(<ConfirmDialog {...merged} />);
  return { onConfirm: merged.onConfirm, onCancel: merged.onCancel, user: userEvent.setup() };
}

describe('ConfirmDialog', () => {
  it('is not exposed as a dialog while closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a dialog named by its title, with the message', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument();
    expect(screen.getByText('“Q?” goes in the bin. No take-backs.')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const { onConfirm, onCancel, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Toss it' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const { onConfirm, onCancel, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel on the native cancel event (Esc) and prevents the default close', () => {
    const { onCancel } = renderDialog();
    const cancelEvent = new Event('cancel', { cancelable: true });

    // fireEvent returns false when a listener called preventDefault().
    const notPrevented = fireEvent(screen.getByRole('dialog'), cancelEvent);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('returns focus to the element that was focused before it opened', () => {
    const props = dialogProps({ open: false });
    const { rerender } = render(
      <>
        <button type="button">Trigger</button>
        <ConfirmDialog {...props} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();

    rerender(
      <>
        <button type="button">Trigger</button>
        <ConfirmDialog {...props} open />
      </>,
    );
    // Simulate the browser moving focus into the modal.
    screen.getByRole('button', { name: 'Keep it' }).focus();
    expect(trigger).not.toHaveFocus();

    rerender(
      <>
        <button type="button">Trigger</button>
        <ConfirmDialog {...props} open={false} />
      </>,
    );
    expect(trigger).toHaveFocus();
  });

  it('disables both buttons while pending', () => {
    renderDialog({ pending: true });
    expect(screen.getByRole('button', { name: 'Toss it' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeDisabled();
  });

  it('shows an error message in an alert', () => {
    renderDialog({ error: "Couldn't toss this card. Try again." });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't toss this card. Try again.");
  });

  it('shows no alert when there is no error', () => {
    renderDialog();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
