import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardForm from './CardForm.jsx';
import { ApiError } from '../api/cards.js';

const GENERIC_ERROR = "Something went wrong — your card wasn't saved. Try again.";

function renderForm(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <CardForm title="Make a card" submitLabel="Slam it in!" variant="create" {...props} onSubmit={onSubmit} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('CardForm', () => {
  it('shows labelled fields with character counters', async () => {
    const { user } = renderForm();
    expect(screen.getByRole('form', { name: 'Make a card' })).toBeInTheDocument();
    expect(screen.getAllByText('0/200')).toHaveLength(2);

    await user.type(screen.getByLabelText(/Answer/), 'Lima');

    expect(screen.getByText('4/200')).toBeInTheDocument();
  });

  it('pre-fills fields from initialValues', () => {
    renderForm({ initialValues: { question: 'Capital of Peru?', answer: 'Lima' } });
    expect(screen.getByLabelText(/Question/)).toHaveValue('Capital of Peru?');
    expect(screen.getByLabelText(/Answer/)).toHaveValue('Lima');
  });

  it('blocks an invalid submit and shows the error on the field', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText(/Answer/), 'Lima');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    const question = screen.getByLabelText(/Question/);
    expect(screen.getByText('Question is required')).toBeInTheDocument();
    expect(question).toHaveAttribute('aria-invalid', 'true');
    expect(question).toHaveAccessibleDescription('Question is required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values once', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText(/Question/), '  Capital of Peru?  ');
    await user.type(screen.getByLabelText(/Answer/), 'Lima ');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ question: 'Capital of Peru?', answer: 'Lima' });
  });

  it('disables the submit button while saving', async () => {
    let resolveSubmit;
    const onSubmit = vi.fn(() => new Promise((resolve) => (resolveSubmit = resolve)));
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/Question/), 'Q?');
    await user.type(screen.getByLabelText(/Answer/), 'A');
    const button = screen.getByRole('button', { name: 'Slam it in!' });

    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    resolveSubmit();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('clears the fields after success when resetOnSuccess is set', async () => {
    const { user } = renderForm({ resetOnSuccess: true });
    await user.type(screen.getByLabelText(/Question/), 'Q?');
    await user.type(screen.getByLabelText(/Answer/), 'A');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    await waitFor(() => expect(screen.getByLabelText(/Question/)).toHaveValue(''));
    expect(screen.getByLabelText(/Answer/)).toHaveValue('');
  });

  it('keeps the typed values after success by default', async () => {
    const { user } = renderForm();
    await user.type(screen.getByLabelText(/Question/), 'Q?');
    await user.type(screen.getByLabelText(/Answer/), 'A');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Slam it in!' })).toBeEnabled());
    expect(screen.getByLabelText(/Question/)).toHaveValue('Q?');
  });

  it('shows server validation details on the matching field and keeps the values', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid card',
        details: { answer: 'Answer must be 200 characters or fewer' },
      }),
    );
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/Question/), 'Q?');
    await user.type(screen.getByLabelText(/Answer/), 'A');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    expect(await screen.findByText('Answer must be 200 characters or fewer')).toBeInTheDocument();
    expect(screen.getByLabelText(/Answer/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Question/)).toHaveValue('Q?');
    expect(screen.getByLabelText(/Answer/)).toHaveValue('A');
  });

  it('shows a generic alert for other failures and keeps the values', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network down'));
    const { user } = renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/Question/), 'Q?');
    await user.type(screen.getByLabelText(/Answer/), 'A');

    await user.click(screen.getByRole('button', { name: 'Slam it in!' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.getByLabelText(/Question/)).toHaveValue('Q?');
    expect(screen.getByLabelText(/Answer/)).toHaveValue('A');
  });

  it('renders a Cancel button only when onCancel is given', async () => {
    const onCancel = vi.fn();
    const { user } = renderForm({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has no Cancel button without onCancel', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
