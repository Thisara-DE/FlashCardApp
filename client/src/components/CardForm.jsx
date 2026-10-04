import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { ApiError } from '../api/cards.js';
import { MAX_LENGTH, validateCard } from '../validation/card.js';

const GENERIC_ERROR = "Something went wrong — your card wasn't saved. Try again.";

const VARIANT_CLASSES = {
  create: 'bg-white shadow-[10px_10px_0_var(--color-ink)] -rotate-1',
  edit: 'bg-mint shadow-[8px_8px_0_var(--color-ink)]',
};

const BUTTON_BASE =
  'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 shadow-[4px_4px_0_var(--color-ink)]';

// One labelled textarea with a live counter and an optional error message.
function Field({ label, value, error, onChange, autoFocus = false }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex justify-between text-base font-bold">
        {label}
        <span className="font-medium">
          {value.length}/{MAX_LENGTH}
        </span>
      </label>
      <textarea
        id={id}
        autoFocus={autoFocus}
        className="pop-field resize-y border-[3px] border-ink bg-paper p-3 text-[17px]"
        rows={3}
        maxLength={MAX_LENGTH}
        value={value}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  autoFocus: PropTypes.bool,
};

export default function CardForm({
  title,
  submitLabel,
  initialValues = { question: '', answer: '' },
  onSubmit,
  onCancel,
  variant,
  resetOnSuccess = false,
  autoFocus = false,
}) {
  const titleId = useId();
  const [question, setQuestion] = useState(initialValues.question);
  const [answer, setAnswer] = useState(initialValues.answer);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    // The disabled button already blocks double clicks; this also covers Enter-key submits.
    if (isSubmitting) return;

    const values = { question: question.trim(), answer: answer.trim() };
    const validationErrors = validateCard(values);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      if (resetOnSuccess) {
        setQuestion('');
        setAnswer('');
      }
    } catch (error) {
      // A 400 means the server rejected specific fields: show its messages next to them.
      const serverErrors = error instanceof ApiError && error.status === 400 ? error.details : {};
      if (serverErrors.question || serverErrors.answer) {
        setErrors({ question: serverErrors.question, answer: serverErrors.answer });
      } else {
        setFormError(GENERIC_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      onSubmit={handleSubmit}
      className={`flex flex-col gap-[18px] border-4 border-ink p-7 ${VARIANT_CLASSES[variant]}`}
    >
      <h2 id={titleId} className="font-display text-[28px] uppercase">
        {title}
      </h2>
      <Field
        label="Question"
        value={question}
        error={errors.question}
        onChange={setQuestion}
        autoFocus={autoFocus}
      />
      <Field label="Answer" value={answer} error={errors.answer} onChange={setAnswer} />
      {formError && (
        <p role="alert" className="border-[3px] border-ink bg-white p-3 font-bold">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${BUTTON_BASE} bg-pop font-display text-[22px] uppercase text-ink`}
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

CardForm.propTypes = {
  title: PropTypes.string.isRequired,
  submitLabel: PropTypes.string.isRequired,
  initialValues: PropTypes.shape({
    question: PropTypes.string,
    answer: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  variant: PropTypes.oneOf(['create', 'edit']).isRequired,
  resetOnSuccess: PropTypes.bool,
  // Focus the Question field on mount (used by the inline edit form, not the create form).
  autoFocus: PropTypes.bool,
};
