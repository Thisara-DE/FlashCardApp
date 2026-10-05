import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';
import PileNameForm from './PileNameForm.jsx';

// Colour by position, so neighbouring tabs differ. The selected tab ignores this and uses the panel colour.
const TAB_COLOURS = ['bg-paper', 'bg-mint', 'bg-pop', 'bg-zap text-white', 'bg-white'];

const TAB_BASE =
  'pop-tab relative cursor-pointer border-4 border-b-0 border-ink px-5 py-2 font-display text-[17px]';
// Taller, above its neighbours, and -mb-1 (the border width) so it covers the panel's top border.
const TAB_SELECTED = 'z-[2] -mb-1 bg-paper py-3 text-ink';

function tabClasses({ selected, colour, dashed = false }) {
  const border = dashed ? 'border-dashed' : '';
  return `${TAB_BASE} ${border} ${selected ? TAB_SELECTED : colour}`;
}

// Inverted colours and a dashed outline while dragged cards hover over the tab.
const TAB_DROP_TARGET = 'bg-ink text-sun outline-4 outline-offset-[6px] outline-dashed outline-ink';

// One pile's tab. It is also a drop target for dragged cards, except for the pile they are already in.
function PileTab({ pile, selected, colour, onSelect }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `pile-${pile.id}`,
    data: { pileId: pile.id, name: pile.name },
    disabled: selected,
  });
  const label = `${pile.name} · ${pile.cardCount}`;

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(pile.id)}
      className={tabClasses({ selected, colour: isOver ? TAB_DROP_TARGET : colour })}
    >
      {isOver ? `Drop into ${label}` : label}
    </button>
  );
}

PileTab.propTypes = {
  pile: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    cardCount: PropTypes.number.isRequired,
  }).isRequired,
  selected: PropTypes.bool.isRequired,
  // Background (and text) colour classes for an unselected tab.
  colour: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default function PileTabs({ piles, unsortedCount, selectedKey, onSelect, onCreatePile }) {
  const [isCreating, setIsCreating] = useState(false);
  const newPileButtonRef = useRef(null);
  // Set when the form closes, so focus goes back to "+ New pile" once that button is on screen again.
  const restoreFocusRef = useRef(false);

  // Closing the form unmounts the focused button; without this, focus would fall to <body>.
  useEffect(() => {
    if (!isCreating && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      newPileButtonRef.current?.focus();
    }
  }, [isCreating]);

  function closeForm() {
    restoreFocusRef.current = true;
    setIsCreating(false);
  }

  async function handleCreate(name) {
    // If this rejects, PileNameForm shows the error and the form stays open.
    const newPile = await onCreatePile(name);
    closeForm();
    onSelect(newPile.id);
  }

  return (
    <nav aria-label="Piles" className="flex flex-wrap items-end gap-2 px-3">
      {piles.map((pile, index) => (
        <PileTab
          key={pile.id}
          pile={pile}
          selected={pile.id === selectedKey}
          colour={TAB_COLOURS[index % TAB_COLOURS.length]}
          onSelect={onSelect}
        />
      ))}
      {unsortedCount > 0 && (
        <button
          type="button"
          aria-pressed={selectedKey === 'unsorted'}
          onClick={() => onSelect('unsorted')}
          className={tabClasses({
            selected: selectedKey === 'unsorted',
            colour: 'bg-ink text-sun',
            dashed: true,
          })}
        >
          Unsorted · {unsortedCount}
        </button>
      )}
      {isCreating ? (
        <div className="mb-2 min-w-64 border-4 border-ink bg-paper p-3">
          <PileNameForm
            label="New pile name"
            submitLabel="Add pile"
            existingPiles={piles}
            onSubmit={handleCreate}
            onCancel={closeForm}
          />
        </div>
      ) : (
        <button
          ref={newPileButtonRef}
          type="button"
          onClick={() => setIsCreating(true)}
          className="pop-tab min-h-11 cursor-pointer border-4 border-dashed border-ink bg-transparent px-4 py-2 font-body font-bold"
        >
          + New pile
        </button>
      )}
    </nav>
  );
}

PileTabs.propTypes = {
  piles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string.isRequired,
      cardCount: PropTypes.number.isRequired,
    }),
  ).isRequired,
  unsortedCount: PropTypes.number.isRequired,
  // A pile id, or 'unsorted'.
  selectedKey: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['unsorted'])]),
  onSelect: PropTypes.func.isRequired,
  onCreatePile: PropTypes.func.isRequired,
};
