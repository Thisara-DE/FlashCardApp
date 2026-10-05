import PropTypes from 'prop-types';

// Shared by both boxes: white, 4px ink border, 6px ink shadow. The tilt is dropped under reduced motion.
const BOX = 'absolute inset-0 border-4 border-ink bg-white shadow-[6px_6px_0_var(--color-ink)] motion-reduce:rotate-0';

// What follows the pointer while cards are dragged: two stacked, tilted cards saying "N cards".
// dnd-kit's DragOverlay gives this the dragged card's size, so it centres itself in that box.
// aria-hidden: it is only a visual; screen readers hear "Moved N cards to ‹Name›" after the drop.
export default function DragGhost({ count }) {
  return (
    <div aria-hidden="true" className="flex h-full w-full cursor-grabbing items-center justify-center">
      <div className="relative h-24 w-44">
        <div className={`${BOX} -rotate-3`} />
        <div className={`${BOX} flex rotate-[4deg] items-center justify-center font-display text-2xl`}>
          {count} {count === 1 ? 'card' : 'cards'}
        </div>
      </div>
    </div>
  );
}

DragGhost.propTypes = {
  // How many cards are being dragged (the whole selection).
  count: PropTypes.number.isRequired,
};
