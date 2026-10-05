import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { ApiError } from '../api/request.js';
import { MAX_PILE_NAME, validatePileName } from '../validation/pile.js';

const GENERIC_ERROR = "Something went wrong — the pile wasn't saved. Try again.";

const BUTTON_BASE =
  'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 shadow-[4px_4px_0_var(--color-ink)]';

// Shared by "create a pile" (tab row, empty state) and "rename a pile" (header).
// The parent unmounts this form on success, so it never resets itself.
export default function PileNameForm({
  label,
  submitLabel,
  initialName = '',
  existingPiles,
  ignoreId,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus = true,
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    // The disabled button already blocks double clicks; this also covers Enter-key submits.
    if (isSubmitting) return;

    const validationError = validatePileName(name, existingPiles, { ignoreId });
    setFieldError(validationError ?? '');
    setFormError('');
    if (validationError) return;

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
    } catch (error) {
      // A 400/409 carries a message about the name itself: show it next to the field.
      const isNameError = error instanceof ApiError && (error.status === 400 || error.status === 409);
      if (isNameError && error.details?.name) {
        setFieldError(error.details.name);
      } else {
        setFormError(GENERIC_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && onCancel) onCancel();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-base">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        <span className="font-medium">
          {name.length}/{MAX_PILE_NAME}
        </span>
      </div>
      <input
        id={id}
        type="text"
        autoFocus={autoFocus}
        className="pop-field min-h-11 border-[3px] border-ink bg-white px-3 py-2 text-[17px]"
        maxLength={MAX_PILE_NAME}
        placeholder={placeholder}
        value={name}
        aria-invalid={fieldError ? 'true' : 'false'}
        aria-describedby={fieldError ? errorId : undefined}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {fieldError && (
        <p id={errorId} className="text-sm font-bold text-ink">
          {fieldError}
        </p>
      )}
      {formError && (
        <p role="alert" className="border-[3px] border-ink bg-white p-3 font-bold">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${BUTTON_BASE} bg-pop font-display text-lg uppercase text-ink`}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${BUTTON_BASE} bg-white font-bold`}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

PileNameForm.propTypes = {
  label: PropTypes.string.isRequired,
  submitLabel: PropTypes.string.isRequired,
  initialName: PropTypes.string,
  existingPiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  // The pile being renamed, so its own name is not reported as a duplicate.
  ignoreId: PropTypes.number,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  placeholder: PropTypes.string,
  autoFocus: PropTypes.bool,
};
