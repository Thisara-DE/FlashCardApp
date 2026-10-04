import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashCard from './FlashCard.jsx';

const card = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' };

function renderCard(props = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onRequestDelete = props.onRequestDelete ?? vi.fn();
  render(<FlashCard card={card} onSave={onSave} onRequestDelete={onRequestDelete} />);
  return { onSave, onRequestDelete, user: userEvent.setup() };
}

// The face is the only button whose name mentions the question or the answer.
const questionFace = () => screen.getByRole('button', { name: /capital of australia/i });
const answerFace = () => screen.getByRole('button', { name: /canberra/i });

describe('FlashCard', () => {
  it('shows the question on an unflipped face and hides the answer', () => {
    renderCard();
    expect(questionFace()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /canberra/i })).not.toBeInTheDocument();
  });

  it('flips on click to show the answer instead of the question', async () => {
    const { user } = renderCard();

    await user.click(questionFace());

    expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /capital of australia/i })).not.toBeInTheDocument();
  });

  it('flips back when clicked again', async () => {
    const { user } = renderCard();
    await user.click(questionFace());

    await user.click(answerFace());

    expect(questionFace()).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles with the Enter key', async () => {
    const { user } = renderCard();
    questionFace().focus();

    await user.keyboard('{Enter}');

    expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles with the Space key', async () => {
    const { user } = renderCard();
    questionFace().focus();

    await user.keyboard(' ');

    expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks to delete the card on Toss without flipping it', async () => {
    const { onRequestDelete, user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Toss' }));
    expect(onRequestDelete).toHaveBeenCalledWith(card);
    expect(questionFace()).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the flip state when Edit is clicked on a flipped card, then returns to it', async () => {
    const { user } = renderCard();
    await user.click(questionFace());

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
  });

  it('swaps the card for a pre-filled edit form', async () => {
    const { user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('form', { name: 'Fix this card' })).toBeInTheDocument();
    expect(screen.getByLabelText(/question/i)).toHaveValue('Capital of Australia?');
    expect(screen.getByLabelText(/answer/i)).toHaveValue('Canberra');
    expect(screen.queryByRole('button', { name: /capital of australia/i })).not.toBeInTheDocument();
  });

  it('saves edited values and brings the card face back when the save resolves', async () => {
    const { onSave, user } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText(/answer/i));
    await user.type(screen.getByLabelText(/answer/i), 'Sydney');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ question: 'Capital of Australia?', answer: 'Sydney' });
    await waitFor(() => expect(questionFace()).toBeInTheDocument());
    expect(screen.queryByRole('form', { name: 'Fix this card' })).not.toBeInTheDocument();
  });

  it('stays in edit mode when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'));
    const { user } = renderCard({ onSave });
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Fix this card' })).toBeInTheDocument();
  });

  it('returns to the face on Cancel without saving', async () => {
    const { onSave, user } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(questionFace()).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  describe('keyboard focus', () => {
    it('moves focus to the Question field when the edit form opens', async () => {
      const { user } = renderCard();

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      expect(screen.getByLabelText(/question/i)).toHaveFocus();
    });

    it('returns focus to the Edit button after Cancel', async () => {
      const { user } = renderCard();
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    });

    it('returns focus to the Edit button after a successful Save', async () => {
      const { user } = renderCard();
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus());
    });

    it('keeps focus in the form when the save fails', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('boom'));
      const { user } = renderCard({ onSave });
      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByRole('alert');

      expect(screen.getByRole('form', { name: 'Fix this card' })).toContainElement(document.activeElement);
    });
  });

  describe('text and styling', () => {
    it('keeps line breaks in the question and the answer', () => {
      renderCard();

      expect(screen.getByText(card.question)).toHaveClass('whitespace-pre-wrap', 'break-words');
      expect(screen.getByText(card.answer)).toHaveClass('whitespace-pre-wrap', 'break-words');
    });

    it('gives each action button exactly one shadow utility', () => {
      renderCard();

      for (const name of ['Edit', 'Toss']) {
        const shadows = screen.getByRole('button', { name }).className.match(/shadow-\[/g);
        expect(shadows).toHaveLength(1);
      }
    });
  });
});
