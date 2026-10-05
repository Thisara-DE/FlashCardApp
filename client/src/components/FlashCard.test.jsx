import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashCard from './FlashCard.jsx';
import { renderWithClient } from '../test-utils.jsx';

const card = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' };

function renderCard(props = {}) {
  const handlers = {
    onSave: vi.fn().mockResolvedValue(undefined),
    onRequestDelete: vi.fn(),
    onLongPress: vi.fn(),
    onToggleSelect: vi.fn(),
  };
  const allProps = { card, ...handlers, ...props };
  const view = renderWithClient(<FlashCard {...allProps} />);
  return { ...allProps, props: allProps, rerender: view.rerender, user: userEvent.setup() };
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

  describe('selecting', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    // A press as a browser sends it: pointer down, a pause, pointer up, then the click.
    function press(element, holdMs) {
      fireEvent.pointerDown(element, { clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(holdMs));
      fireEvent.pointerUp(element, { clientX: 5, clientY: 5 });
      fireEvent.click(element);
    }

    it('a 400 ms hold calls onLongPress, and the click after it does not flip the card', () => {
      vi.useFakeTimers();
      const { onLongPress } = renderCard();

      press(questionFace(), 400);

      expect(onLongPress).toHaveBeenCalledWith(card.id);
      expect(questionFace()).toHaveAttribute('aria-pressed', 'false');
    });

    // While dragging is on, dnd-kit swallows the click after a hold, so the face never sees it.
    // A key press on the (still focused) face afterwards must work the first time.
    it.each(['Enter', ' '])('after a hold whose click never arrived, "%s" still works first time', (key) => {
      vi.useFakeTimers();
      const { onLongPress } = renderCard();
      const face = questionFace();

      fireEvent.pointerDown(face, { clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(400));
      fireEvent.pointerUp(face, { clientX: 5, clientY: 5 });
      expect(onLongPress).toHaveBeenCalledWith(card.id);

      // A key press as a browser sends it: keydown, then the button's click (detail 0).
      fireEvent.keyDown(face, { key });
      fireEvent.click(face, { detail: 0 });

      expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
    });

    it('a short press flips the card as usual', () => {
      vi.useFakeTimers();
      const { onLongPress } = renderCard();

      press(questionFace(), 100);

      expect(onLongPress).not.toHaveBeenCalled();
      expect(answerFace()).toHaveAttribute('aria-pressed', 'true');
    });

    it('in selection mode a click toggles the card instead of flipping it', async () => {
      const { onToggleSelect, user } = renderCard({ selectionMode: true });

      await user.click(questionFace());

      expect(onToggleSelect).toHaveBeenCalledWith(card.id);
      expect(screen.queryByRole('button', { name: /canberra/i })).not.toBeInTheDocument();
    });

    it('in selection mode aria-pressed tells whether the card is selected', () => {
      const { rerender, props } = renderCard({ selectionMode: true });
      expect(questionFace()).toHaveAttribute('aria-pressed', 'false');

      rerender(<FlashCard {...props} selected />);
      expect(questionFace()).toHaveAttribute('aria-pressed', 'true');
    });

    it('selection mode hides Edit and Toss and says "Tap to add" on an unselected card', () => {
      renderCard({ selectionMode: true });

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Toss' })).not.toBeInTheDocument();
      // The accessible name holds only the visible face, so this checks the footer that is shown.
      expect(questionFace()).toHaveAccessibleName('Q! Capital of Australia? Tap to add');
      expect(screen.queryByText('Flip it →')).not.toBeInTheDocument();
    });

    it('a flipped card also says "Tap to add" in selection mode, instead of "← Flip back"', async () => {
      const { props, rerender, user } = renderCard();
      await user.click(questionFace());

      rerender(<FlashCard {...props} selectionMode />);

      expect(answerFace()).toHaveAccessibleName('A! Canberra Tap to add');
    });

    it('a selected card says "Selected" and gets the selected look', () => {
      renderCard({ selectionMode: true, selected: true });

      expect(questionFace()).toHaveAccessibleName('Q! Capital of Australia? Selected');
      expect(screen.queryByText('Tap to add')).not.toBeInTheDocument();
      expect(questionFace()).toHaveClass('is-selected');
    });

    it('an unselected card has no selected look', () => {
      renderCard({ selectionMode: true });

      expect(questionFace()).not.toHaveClass('is-selected');
    });

    it('passes pointer down to the drag listeners as well as to the long press', () => {
      vi.useFakeTimers();
      const dragListeners = { onPointerDown: vi.fn(), onTouchStart: vi.fn() };
      const { onLongPress } = renderCard({ dragListeners });

      fireEvent.pointerDown(questionFace(), { clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(400));
      fireEvent.touchStart(questionFace());

      expect(dragListeners.onPointerDown).toHaveBeenCalledTimes(1);
      expect(onLongPress).toHaveBeenCalledWith(card.id);
      expect(dragListeners.onTouchStart).toHaveBeenCalledTimes(1);
    });

    it('outside selection mode the footer says "Flip it →"', () => {
      renderCard();

      expect(screen.getByText('Flip it →')).toBeInTheDocument();
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
