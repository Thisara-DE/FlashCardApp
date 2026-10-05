import { useId } from 'react';
import PropTypes from 'prop-types';
import PileNameForm from './PileNameForm.jsx';

const STEP_BADGE = 'self-start border-[3px] border-ink bg-pop px-2.5 py-0.5 font-display text-lg text-white';

// Disabled stand-in for the card form, so the user sees what comes after making a pile.
function DisabledField({ label }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-bold">
        {label}
      </label>
      <textarea
        id={id}
        disabled
        rows={3}
        className="border-[3px] border-ink bg-paper p-3 text-[17px] opacity-60"
      />
    </div>
  );
}

DisabledField.propTypes = {
  label: PropTypes.string.isRequired,
};

export default function NoPilesState({ unsortedCount, onCreatePile }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 border-4 border-ink bg-paper p-7 shadow-[10px_10px_0_var(--color-ink)]">
        <span className={STEP_BADGE}>Step 1</span>
        <h2 className="font-display text-[28px] uppercase">Start with a pile</h2>
        <p className="font-medium">
          A pile is one subject, like Geography, Math or Law. Every card you make goes into a pile, so
          your study stays sorted.
        </p>
        {unsortedCount > 0 && (
          <p className="font-bold">
            You have {unsortedCount} unsorted {unsortedCount === 1 ? 'card' : 'cards'}. Make a pile, then
            drag them in.
          </p>
        )}
        <PileNameForm
          label="Pile name"
          submitLabel="Make the pile"
          existingPiles={[]}
          onSubmit={onCreatePile}
          placeholder="e.g. Geography"
        />
      </section>

      <section className="flex flex-col gap-4 border-4 border-ink bg-white p-7 shadow-[10px_10px_0_var(--color-ink)]">
        <span className={`${STEP_BADGE} bg-zap`}>Step 2</span>
        <h2 className="font-display text-[28px] uppercase">Make a card</h2>
        <p className="font-medium">Make a pile first, then your cards go in here.</p>
        <DisabledField label="Question" />
        <DisabledField label="Answer" />
        <div>
          <button
            type="button"
            disabled
            className="pop-btn min-h-11 cursor-not-allowed border-4 border-ink bg-pop px-4 py-2 font-display text-[22px] uppercase text-ink shadow-[4px_4px_0_var(--color-ink)]"
          >
            Slam it in!
          </button>
        </div>
      </section>
    </div>
  );
}

NoPilesState.propTypes = {
  unsortedCount: PropTypes.number.isRequired,
  onCreatePile: PropTypes.func.isRequired,
};
