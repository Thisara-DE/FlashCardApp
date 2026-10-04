import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PileNameForm from './PileNameForm.jsx';
import { ApiError } from '../api/request.js';

const GENERIC_ERROR = "Something went wrong — the pile wasn't saved. Try again.";
const PILES = [{ id: 1, name: 'Geography', cardCount: 2 }];

function renderForm(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <PileNameForm label="Pile name" submitLabel="Save" existingPiles={PILES} {...props} onSubmit={onSubmit} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('PileNameForm', () => {
  it('focuses the input on mount', () => {
    renderForm();
    expect(screen.getByLabelText('Pile name')).toHaveFocus();
  });

  it('does not steal focus when autoFocus is false', () => {
    renderForm({ autoFocus: false });
    expect(screen.getByLabelText('Pile name')).not.toHaveFocus();
  });

  it('pre-fills the input and shows the placeholder', () => {
    renderForm({ initialName: 'Geography', placeholder: 'e.g. Geography' });
    expect(screen.getByLabelText('Pile name')).toHaveValue('Geography');
    expect(screen.getByLabelText('Pile name')).toHaveAttribute('placeholder', 'e.g. Geography');
    expect(screen.getByText('9/40')).toBeInTheDocument();
  });

  it('shows a live character counter and caps the input length', async () => {
    const { user } = renderForm();
    expect(screen.getByText('0/40')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Pile name'), 'Hello');

    expect(screen.getByText('5/40')).toBeInTheDocument();
    expect(screen.getByLabelText('Pile name')).toHaveAttribute('maxLength', '40');
  });

  it('blocks a blank name and shows the error on the input', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Pile name'), '   ');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const input = screen.getByLabelText('Pile name');
    expect(screen.getByText('Pile name is required')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Pile name is required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a duplicate name, ignoring case', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Pile name'), 'geography');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('You already have a pile called "Geography"')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows keeping the name of the pile being renamed (ignoreId)', async () => {
    const { onSubmit, user } = renderForm({ initialName: 'Geography', ignoreId: 1 });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith('Geography');
  });

  it('submits the trimmed name', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Pile name'), ' Bio ');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith('Bio');
  });

  it('submits with the Enter key', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Pile name'), 'Bio{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('Bio');
  });

  it('shows the server message for a 409 duplicate', async () => {
    const message = 'You already have a pile called "Bio"';
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ status: 409, code: 'DUPLICATE_NAME', message: 'x', details: { name: message } }),
      );
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText('Pile name'), 'Bio');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Pile name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server message for a 400', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'x',
          details: { name: 'Pile name is required' },
        }),
      );
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText('Pile name'), 'Bio');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Pile name is required')).toBeInTheDocument();
  });

  it('shows a generic alert for any other failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network'));
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText('Pile name'), 'Bio');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
  });

  it('shows a generic alert for a server error that has no name detail', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }));
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText('Pile name'), 'Bio');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
  });

  it('keeps what was typed after a failure so the user can retry', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network'));
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText('Pile name'), 'Bio');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');

    expect(screen.getByLabelText('Pile name')).toHaveValue('Bio');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('calls onCancel on Esc and on the Cancel button', async () => {
    const onCancel = vi.fn();
    const { user } = renderForm({ onCancel });

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('has no Cancel button without onCancel', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
