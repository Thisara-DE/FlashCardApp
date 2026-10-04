import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const BUTTON_BASE =
  'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 shadow-[4px_4px_0_var(--color-ink)]';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
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
      // The trigger may have been removed (e.g. the deleted card), so check before focusing.
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
      className="pop-dialog m-auto w-[min(92vw,440px)] -rotate-[1.5deg] border-[5px] border-ink bg-white p-0 text-ink shadow-[14px_14px_0_var(--color-pop)]"
    >
      {/* Layout lives on this inner div: a display class on <dialog> itself would show it while closed. */}
      <div className="flex flex-col gap-4 p-7">
        <h2 id={titleId} className="font-display text-[34px] uppercase leading-none">
          {title}
        </h2>
        <p className="text-lg font-medium">{message}</p>
        {error && (
          <p role="alert" className="border-[3px] border-ink bg-sun p-3 font-bold">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className={`${BUTTON_BASE} bg-mint font-bold`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`${BUTTON_BASE} bg-ink font-display text-[20px] uppercase text-sun`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  cancelLabel: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  error: PropTypes.string,
};
