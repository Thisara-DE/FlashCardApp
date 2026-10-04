import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useLongPress } from '../hooks/useLongPress.js';
import CardForm from './CardForm.jsx';

// Shadows are set per button (not here) so no element ends up with two shadow utilities.
const ACTION_BUTTON = 'pop-btn min-h-11 cursor-pointer border-4 border-ink px-5 py-2 text-base font-bold';

const FACE_BASE = 'flip-face flex min-h-[220px] flex-col justify-between gap-4 p-6';

export default function FlashCard({
  card,
  onSave,
  onRequestDelete,
  selected = false,
  selectionMode = false,
  onLongPress,
  onToggleSelect,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { handlers: longPressHandlers, consumeLongPress } = useLongPress(() => onLongPress(card.id));
  const editButtonRef = useRef(null);
  // Set when the edit form closes, so focus goes back to Edit once that button is on screen again.
  const restoreFocusRef = useRef(false);

  // Closing the form unmounts the focused Save/Cancel button; without this, focus would fall to <body>.
  useEffect(() => {
    if (!isEditing && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [isEditing]);

  function closeEditor() {
    restoreFocusRef.current = true;
    setIsEditing(false);
  }

  function handleFaceClick() {
    // The click that ends a long press only finishes selecting the card: no flip, no toggle.
    if (consumeLongPress()) return;
    if (selectionMode) {
      onToggleSelect(card.id);
    } else {
      setIsFlipped((flipped) => !flipped);
    }
  }

  async function handleSave(values) {
    // If this rejects, CardForm shows the error and we stay in edit mode.
    await onSave(values);
    closeEditor();
  }

  if (isEditing) {
    return (
      <CardForm
        title="Fix this card"
        submitLabel="Save"
        initialValues={{ question: card.question, answer: card.answer }}
        onSubmit={handleSave}
        onCancel={closeEditor}
        variant="edit"
        autoFocus
      />
    );
  }

  // In selection mode the footer says what a tap does now, instead of "Flip it →".
  const selectionFooter = selected ? 'Selected' : 'Tap to add';

  return (
    <div className="flex flex-col gap-4">
      {/* The whole face is one native button, so Enter and Space flip it (or select it) for free.
          In selection mode aria-pressed says whether the card is selected, otherwise whether it is flipped. */}
      <button
        type="button"
        aria-pressed={selectionMode ? selected : isFlipped}
        onClick={handleFaceClick}
        {...longPressHandlers}
        className={`pop-card relative block w-full cursor-pointer border-4 border-ink bg-transparent p-0 text-left shadow-[8px_8px_0_var(--color-ink)] [perspective:1200px] ${isFlipped ? 'is-flipped' : ''} ${selected ? 'is-selected' : ''}`}
      >
        {selected && (
          // Decorative: aria-pressed and the "Selected" footer already say it.
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-ink bg-mint"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="square"
            >
              <path d="M4 12l5 5L20 6" />
            </svg>
          </span>
        )}
        {/* Only <span>s inside a button: it may hold phrasing content only. */}
        <span className="flip-inner">
          {/* aria-hidden on the hidden face keeps its text out of the button's accessible name. */}
          <span aria-hidden={isFlipped} className={`${FACE_BASE} bg-white`}>
            <span className="self-start border-[3px] border-ink bg-pop px-2.5 py-0.5 font-display text-lg text-white">
              Q!
            </span>
            <span className="block whitespace-pre-wrap break-words text-xl font-bold">{card.question}</span>
            <span className="block text-right text-sm font-bold">{selectionMode ? selectionFooter : 'Flip it →'}</span>
          </span>
          <span aria-hidden={!isFlipped} className={`${FACE_BASE} flip-back bg-zap text-white`}>
            <span className="self-start border-[3px] border-ink bg-mint px-2.5 py-0.5 font-display text-lg text-ink">
              A!
            </span>
            <span className="block whitespace-pre-wrap break-words font-display text-2xl">{card.answer}</span>
            <span className="block text-sm font-bold">{selectionMode ? selectionFooter : '← Flip back'}</span>
          </span>
        </span>
      </button>
      {/* No Edit or Toss while selecting: a tap there should never edit or delete by mistake. */}
      {!selectionMode && (
        <div className="flex gap-3">
          <button
            ref={editButtonRef}
            type="button"
            onClick={() => setIsEditing(true)}
            className={`${ACTION_BUTTON} bg-white shadow-[4px_4px_0_var(--color-ink)]`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(card)}
            className={`${ACTION_BUTTON} bg-ink text-sun shadow-[4px_4px_0_var(--color-pop)]`}
          >
            Toss
          </button>
        </div>
      )}
    </div>
  );
}

FlashCard.propTypes = {
  card: PropTypes.shape({
    id: PropTypes.number.isRequired,
    question: PropTypes.string.isRequired,
    answer: PropTypes.string.isRequired,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
  onRequestDelete: PropTypes.func.isRequired,
  // True when this card is one of the selected cards.
  selected: PropTypes.bool,
  // True while any card is selected: a tap then toggles the card instead of flipping it.
  selectionMode: PropTypes.bool,
  // Called with the card id after a 400 ms press and hold.
  onLongPress: PropTypes.func.isRequired,
  // Called with the card id when the card is tapped in selection mode.
  onToggleSelect: PropTypes.func.isRequired,
};
