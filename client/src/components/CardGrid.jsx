import { useId } from 'react';
import PropTypes from 'prop-types';
import FlashCard from './FlashCard.jsx';

// Same white bordered panel look as the create form.
const PANEL = 'border-4 border-ink bg-white p-7 shadow-[10px_10px_0_var(--color-ink)]';

export default function CardGrid({ cards, isLoading, isError, onRetry, onSaveCard, onRequestDelete }) {
  const headingId = useId();

  function renderBody() {
    if (isLoading) {
      return (
        <p role="status" className={`${PANEL} text-xl font-bold`}>
          Loading cards…
        </p>
      );
    }

    if (isError) {
      return (
        <div className={`${PANEL} flex flex-col items-start gap-4`}>
          <p className="text-xl font-bold">Couldn't load cards</p>
          <button
            type="button"
            onClick={onRetry}
            className="pop-btn min-h-11 cursor-pointer border-4 border-ink bg-pop px-4 py-2 font-display text-[22px] uppercase text-ink shadow-[4px_4px_0_var(--color-ink)]"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!cards || cards.length === 0) {
      return <p className={`${PANEL} text-xl font-bold`}>No cards yet — make your first one!</p>;
    }

    return (
      // The .pop-grid tilt rules in index.css target direct <li> children, so keep this a <ul>.
      <ul className="pop-grid m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-7 gap-y-9 p-0">
        {/* Keying by id (not index) keeps each card's flip state when the list is refetched. */}
        {cards.map((card) => (
          <li key={card.id}>
            <FlashCard
              card={card}
              onSave={(values) => onSaveCard(card.id, values)}
              onRequestDelete={onRequestDelete}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id={headingId} className="font-display text-[32px] uppercase">
          The pile
        </h2>
        <p className="text-base font-bold">Tap a card to flip it — newest on top</p>
      </div>
      {renderBody()}
    </section>
  );
}

CardGrid.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      question: PropTypes.string.isRequired,
      answer: PropTypes.string.isRequired,
    }),
  ),
  isLoading: PropTypes.bool.isRequired,
  isError: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  onSaveCard: PropTypes.func.isRequired,
  onRequestDelete: PropTypes.func.isRequired,
};
