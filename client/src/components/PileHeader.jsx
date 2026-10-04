import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import PileNameForm from './PileNameForm.jsx';

const SMALL_BUTTON = 'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 text-base font-bold';

const UNSORTED_HINT =
  'These cards lost their pile. Press and hold a card to select it, then drag it onto a pile.';

// The key remounts the body when the pile, the variant or selection mode changes, so a half-finished
// rename (open form, typed text, target pile) can never carry over to a different pile or view.
export default function PileHeader(props) {
  const { variant, pileId, selectionBar } = props;
  const key = `${variant}-${pileId ?? 'none'}-${selectionBar ? 'selecting' : 'idle'}`;
  return <PileHeaderBody key={key} {...props} />;
}

function PileHeaderBody({
  variant,
  name,
  pileId,
  headingId,
  existingPiles,
  onRename,
  onRequestDelete,
  newCardOpen = false,
  onToggleNewCard,
  newCardButtonRef,
  selectionBar,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const renameButtonRef = useRef(null);
  // Set when the rename form closes, so focus goes back to Rename once that button is on screen again.
  const restoreFocusRef = useRef(false);

  // Closing the form unmounts the focused Save/Cancel button; without this, focus would fall to <body>.
  useEffect(() => {
    if (!isRenaming && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      renameButtonRef.current?.focus();
    }
  }, [isRenaming]);

  function closeRenamer() {
    restoreFocusRef.current = true;
    setIsRenaming(false);
  }

  async function handleRename(newName) {
    // If this rejects, PileNameForm shows the error and we stay in rename mode.
    await onRename(newName);
    closeRenamer();
  }

  if (variant === 'unsorted') {
    return (
      <header className="flex flex-col gap-2">
        <h2 id={headingId} className="font-display text-[32px] uppercase">
          {name}
        </h2>
        <p className="font-medium">{UNSORTED_HINT}</p>
      </header>
    );
  }

  const showForm = isRenaming && !selectionBar;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      {showForm ? (
        <div className="min-w-64 flex-1">
          <PileNameForm
            label="Pile name"
            submitLabel="Save"
            initialName={name}
            existingPiles={existingPiles}
            ignoreId={pileId}
            onSubmit={handleRename}
            onCancel={closeRenamer}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={headingId} className="font-display text-[32px] uppercase">
            {name}
          </h2>
          {!selectionBar && (
            <>
              <button
                ref={renameButtonRef}
                type="button"
                onClick={() => setIsRenaming(true)}
                className={`${SMALL_BUTTON} bg-white shadow-[4px_4px_0_var(--color-ink)]`}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={onRequestDelete}
                className={`${SMALL_BUTTON} bg-ink text-sun shadow-[4px_4px_0_var(--color-pop)]`}
              >
                Delete pile
              </button>
            </>
          )}
        </div>
      )}
      {selectionBar}
      {!selectionBar && (
        <button
          ref={newCardButtonRef}
          type="button"
          aria-expanded={newCardOpen}
          onClick={onToggleNewCard}
          className="pop-btn ml-auto flex min-h-11 cursor-pointer items-center gap-2 border-4 border-ink bg-pop px-5 py-2 font-display text-lg uppercase text-ink shadow-[6px_6px_0_var(--color-ink)]"
        >
          New {name} card
          {/* Decorative: the button's text already says what it does. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="square"
          >
            <path d="M12 4v16M4 12h16" />
          </svg>
        </button>
      )}
    </header>
  );
}

const propTypes = {
  variant: PropTypes.oneOf(['pile', 'unsorted']).isRequired,
  name: PropTypes.string.isRequired,
  // Only the pile variant has an id (Unsorted is not a real pile).
  pileId: PropTypes.number,
  // Put on the <h2>, so the surrounding panel can use it for aria-labelledby.
  headingId: PropTypes.string,
  existingPiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  // The next four are used by the pile variant only (Unsorted has no buttons).
  onRename: PropTypes.func,
  onRequestDelete: PropTypes.func,
  newCardOpen: PropTypes.bool,
  onToggleNewCard: PropTypes.func,
  newCardButtonRef: PropTypes.shape({ current: PropTypes.any }),
  // While cards are selected, this replaces the buttons.
  selectionBar: PropTypes.node,
};

PileHeaderBody.propTypes = propTypes;
PileHeader.propTypes = propTypes;
