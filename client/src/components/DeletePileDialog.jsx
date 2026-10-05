import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const BUTTON_BASE =
  'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 shadow-[4px_4px_0_var(--color-ink)]';
// A choice is a big button: a bold label, then a line explaining what it does.
const CHOICE = `${BUTTON_BASE} flex flex-col items-start gap-1 text-left`;

function cardsText(count) {
  return count === 1 ? '1 card' : `${count} cards`;
}

function deleteCardsText(count) {
  return count === 1
    ? 'That card is gone for good. No take-backs.'
    : `All ${count} cards are gone for good. No take-backs.`;
}

// Asks what should happen to a non-empty pile's cards: keep them (they go to Unsorted) or delete them.
// Opening and closing work exactly like ConfirmDialog.
export default function DeletePileDialog({
  open,
  pileName,
  cardCount,
  onKeep,
  onDeleteCards,
  onCancel,
  pending = false,
  error = null,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  // Latest value of `open` for the native close handler, which must not see a stale prop.
  const openRef = useRef(open);
  // A layout effect runs before the [open] effect cleanup below, so the cleanup's own
  // dialog.close() already sees open=false and is not mistaken for a browser-initiated close.
  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  // The parent owns `open`; we sync it to the native dialog, which gives us the backdrop,
  // focus trapping and inert page content for free.
  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    if (!dialog.open) dialog.showModal();

    return () => {
      dialog.close();
      // The trigger may have been removed (e.g. the deleted pile's header), so check before focusing.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  // Esc fires `cancel`. Stop the browser closing the dialog itself so the parent's state stays in charge.
  function handleCancel(event) {
    event.preventDefault();
    onCancel();
  }

  // The browser can still close the dialog itself (Chrome ignores preventDefault on a second Esc
  // without user activation). If the parent still wants it open, re-sync by opening it again.
  function handleClose() {
    const dialog = dialogRef.current;
    if (openRef.current && !dialog.open) dialog.showModal();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={handleClose}
      className="pop-dialog m-auto w-[min(92vw,480px)] -rotate-[1.5deg] border-[5px] border-ink bg-white p-0 text-ink shadow-[14px_14px_0_var(--color-pop)]"
    >
      {/* Layout lives on this inner div: a display class on <dialog> itself would show it while closed. */}
      <div className="flex flex-col gap-4 p-7">
        <h2 id={titleId} className="font-display text-[34px] uppercase leading-none">
          Delete the {pileName} pile?
        </h2>
        <p className="text-lg font-medium">It still has {cardsText(cardCount)}. What should happen to them?</p>
        {error && (
          <p role="alert" className="border-[3px] border-ink bg-sun p-3 font-bold">
            {error}
          </p>
        )}
        {/* The {' '} keeps a space between label and subtext in the button's accessible name. */}
        <button type="button" disabled={pending} onClick={onKeep} className={`${CHOICE} bg-mint`}>
          <strong className="text-lg">Keep the cards</strong>{' '}
          <span className="font-medium">They move to Unsorted, so you can drag them into another pile later.</span>
        </button>
        <button type="button" disabled={pending} onClick={onDeleteCards} className={`${CHOICE} bg-pop`}>
          <strong className="text-lg">Delete the cards too</strong>{' '}
          <span className="font-medium">{deleteCardsText(cardCount)}</span>
        </button>
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={`${BUTTON_BASE} bg-white font-bold`}
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

DeletePileDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  pileName: PropTypes.string.isRequired,
  cardCount: PropTypes.number.isRequired,
  onKeep: PropTypes.func.isRequired,
  onDeleteCards: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  error: PropTypes.string,
};
