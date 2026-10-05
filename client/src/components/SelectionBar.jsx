import { useId, useState } from 'react';
import PropTypes from 'prop-types';

const BAR_BUTTON = 'pop-btn min-h-11 cursor-pointer border-4 border-ink px-4 py-2 text-base font-bold';

// Shown in the pile header while cards are selected. Move to… is the keyboard and screen reader
// friendly way to move cards (dragging onto a tab does the same thing with a pointer).
export default function SelectionBar({ count, targets, onMove, onClear, pending = false, error = null }) {
  const selectId = useId();
  const [chosenId, setChosenId] = useState(targets[0]?.id);

  // If the chosen pile has gone (deleted elsewhere), fall back to the first one that is left.
  const targetId = targets.some((target) => target.id === chosenId) ? chosenId : targets[0]?.id;

  return (
    <div
      role="status"
      className="ml-auto flex flex-col gap-2 border-4 border-ink bg-ink px-4 py-3 text-white shadow-[6px_6px_0_var(--color-mint)]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-xl text-mint">{count} selected</span>
        <span className="font-medium">Drag them onto a tab, or</span>
        <label htmlFor={selectId} className="font-bold">
          Move to…
        </label>
        <select
          id={selectId}
          value={targetId ?? ''}
          // Option values are strings; pile ids are numbers.
          onChange={(event) => setChosenId(Number(event.target.value))}
          className="pop-field min-h-11 border-4 border-ink bg-white px-2 font-bold text-ink"
        >
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || targetId === undefined}
          onClick={() => onMove(targetId)}
          className={`${BAR_BUTTON} bg-mint text-ink shadow-[4px_4px_0_#fff]`}
        >
          Move
        </button>
        <button
          type="button"
          onClick={onClear}
          className={`${BAR_BUTTON} bg-white text-ink shadow-[4px_4px_0_var(--color-mint)]`}
        >
          Clear
        </button>
      </div>
      {error && (
        <p role="alert" className="font-bold text-sun">
          {error}
        </p>
      )}
    </div>
  );
}

SelectionBar.propTypes = {
  count: PropTypes.number.isRequired,
  // The piles the cards can go to (every pile except the one shown).
  targets: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  // Called with the chosen pile id.
  onMove: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  // True while the move request is running; disables Move so it can't be sent twice.
  pending: PropTypes.bool,
  error: PropTypes.string,
};
