import PropTypes from 'prop-types';
import FlashCard from './FlashCard.jsx';

// Same white bordered panel look as the create form.
const PANEL = 'border-4 border-ink bg-white p-7 shadow-[10px_10px_0_var(--color-ink)]';

// The cards of one pile. It has no heading of its own: the pile panel's header names it.
export default function CardGrid({
  cards,
  isLoading,
  isError,
  isFetching = false,
  emptyMessage,
  onRetry,
  onSaveCard,
  onRequestDelete,
  selectedIds = [],
  selectionMode = false,
  onLongPress,
  onToggleSelect,
}) {
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
            disabled={isFetching}
            onClick={onRetry}
            className="pop-btn min-h-11 cursor-pointer border-4 border-ink bg-white px-4 py-2 font-bold shadow-[4px_4px_0_var(--color-ink)]"
          >
            Retry
          </button>
          {/* Without this the click seems to do nothing while the request is in flight. */}
          {isFetching && (
            <p role="status" className="font-bold">
              Loading cards…
            </p>
          )}
        </div>
      );
    }

    if (!cards || cards.length === 0) {
      return <p className={`${PANEL} text-xl font-bold`}>{emptyMessage}</p>;
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
              selected={selectedIds.includes(card.id)}
              selectionMode={selectionMode}
              onLongPress={onLongPress}
              onToggleSelect={onToggleSelect}
            />
          </li>
        ))}
      </ul>
    );
  }

  return <div>{renderBody()}</div>;
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
  // True while a (re)fetch is running; disables Retry so it cannot be spammed.
  isFetching: PropTypes.bool,
  // Shown when the pile has no cards, e.g. "No cards in Math yet — make your first one!"
  emptyMessage: PropTypes.string.isRequired,
  onRetry: PropTypes.func.isRequired,
  onSaveCard: PropTypes.func.isRequired,
  onRequestDelete: PropTypes.func.isRequired,
  // Ids of the selected cards.
  selectedIds: PropTypes.arrayOf(PropTypes.number),
  // True while any card is selected.
  selectionMode: PropTypes.bool,
  // Both are called with a card id: after a press and hold, and on a tap in selection mode.
  onLongPress: PropTypes.func.isRequired,
  onToggleSelect: PropTypes.func.isRequired,
};
