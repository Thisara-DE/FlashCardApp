import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { ApiError } from './api/cards.js';
import CardForm from './components/CardForm.jsx';
import CardGrid from './components/CardGrid.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DeletePileDialog from './components/DeletePileDialog.jsx';
import DragGhost from './components/DragGhost.jsx';
import NoPilesState from './components/NoPilesState.jsx';
import PileHeader from './components/PileHeader.jsx';
import PileTabs from './components/PileTabs.jsx';
import SelectionBar from './components/SelectionBar.jsx';
import { useCardSelection } from './hooks/useCardSelection.js';
import { useDragSensors } from './hooks/useDragSensors.js';
import { useCards, useCreateCard, useDeleteCard, useMoveCards, useUpdateCard } from './hooks/useCards.js';
import { useCreatePile, useDeletePile, usePiles, useRenamePile } from './hooks/usePiles.js';
import { useSelectedPile } from './hooks/useSelectedPile.js';
import { CARDS_KEY, PILES_KEY } from './hooks/useSyncedMutation.js';

const DELETE_ERROR = "Couldn't toss this card. Try again.";
const PILE_DELETE_ERROR = "Couldn't delete this pile. Try again.";
const MOVE_ERROR = "Couldn't move those cards. Try again.";
const PILE_TIP = 'Tip: press and hold a card to select it, then drag it onto another pile.';

// dnd-kit would announce "Picked up draggable item 12" and the like. Our own status region already
// says "Moved N cards to ‹Name›" after a drop, so its announcements are switched off (undefined = silent).
const DRAG_ACCESSIBILITY = {
  announcements: {
    onDragStart: () => undefined,
    onDragOver: () => undefined,
    onDragEnd: () => undefined,
    onDragCancel: () => undefined,
  },
};

// The paper panel under the tabs, and the boxes shown while the piles load.
const PANEL = 'border-4 border-ink bg-paper p-7 shadow-[10px_10px_0_var(--color-ink)]';

function plural(count, one, many) {
  return count === 1 ? one : many;
}

// The badge's number and the words after it: "2 cards in Geography", "1 unsorted card", "0 piles".
// The counts come from the piles list, so the badge never waits for the cards to load.
function countBadge(pilesData, selectedKey, selectedPile) {
  if (pilesData.piles.length === 0) {
    return { count: 0, label: 'piles' };
  }
  if (selectedKey === 'unsorted') {
    const count = pilesData.unsortedCount;
    return { count, label: plural(count, 'unsorted card', 'unsorted cards') };
  }
  const count = selectedPile.cardCount;
  return { count, label: `${plural(count, 'card', 'cards')} in ${selectedPile.name}` };
}

function CountBadge({ count, label }) {
  return (
    <p className="m-0 rotate-2 border-4 border-ink bg-mint px-5 py-3 text-lg font-bold shadow-[6px_6px_0_var(--color-ink)]">
      <span className="font-display text-[34px]">{count}</span> {label}
    </p>
  );
}

CountBadge.propTypes = {
  count: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
};

// Shown until the piles have loaded: a loading status, or an error with Retry (same pattern as CardGrid).
function PilesLoadState({ isError, isFetching, onRetry }) {
  if (!isError) {
    return (
      <p role="status" className={`${PANEL} text-xl font-bold`}>
        Loading piles…
      </p>
    );
  }

  return (
    <div className={`${PANEL} flex flex-col items-start gap-4`}>
      <p className="text-xl font-bold">Couldn't load piles</p>
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
          Loading piles…
        </p>
      )}
    </div>
  );
}

PilesLoadState.propTypes = {
  isError: PropTypes.bool.isRequired,
  isFetching: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
};

function App() {
  const queryClient = useQueryClient();
  const pilesQuery = usePiles();
  const pilesData = pilesQuery.data;
  const [selectedKey, setSelectedKey] = useSelectedPile(pilesData);
  const cardsQuery = useCards(selectedKey);

  const createPile = useCreatePile();
  const renamePile = useRenamePile();
  const deletePile = useDeletePile();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const moveCards = useMoveCards();

  const panelHeadingId = useId();
  const [newCardOpen, setNewCardOpen] = useState(false);
  const newCardButtonRef = useRef(null);

  // The card waiting for delete confirmation (null = dialog closed).
  const [cardToDelete, setCardToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // The pile waiting for delete confirmation: { id, name, cardCount }, or null when no dialog is open.
  // An empty pile gets the simple confirm; a pile with cards asks what to do with them.
  const [pileToDelete, setPileToDelete] = useState(null);
  const [pileDeleteError, setPileDeleteError] = useState(null);

  const piles = pilesData?.piles ?? [];
  const isUnsorted = selectedKey === 'unsorted';
  const selectedPile = piles.find((pile) => pile.id === selectedKey);

  const cards = cardsQuery.data;
  // Only show the error panel when there is nothing to show: a failed background
  // refetch should not replace a list the user can already see.
  const showLoadError = cardsQuery.isError && cards === undefined;

  // Selected cards, for Move to…. Only ids of cards that are still on screen count.
  const { selectedIds, isSelecting, select, toggle, clear } = useCardSelection(cards ?? []);
  const [moveError, setMoveError] = useState(null);
  // Read out by screen readers after a move, e.g. "Moved 2 cards to Math".
  const [moveAnnouncement, setMoveAnnouncement] = useState('');
  // True while cards are being dragged, to show the "N cards" ghost under the pointer.
  const [isDragging, setIsDragging] = useState(false);
  const dragSensors = useDragSensors();

  const isDialogOpen = cardToDelete !== null || pileToDelete !== null;

  // Esc ends selection mode. Not while a dialog is open: there, Esc closes the dialog instead.
  useEffect(() => {
    if (!isSelecting || isDialogOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        clear();
        setMoveError(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelecting, isDialogOpen, clear]);

  // Used when the server says something is gone: another tab or device changed the data.
  function refetchCardsAndPiles() {
    queryClient.invalidateQueries({ queryKey: CARDS_KEY });
    queryClient.invalidateQueries({ queryKey: PILES_KEY });
  }

  function handleSelectPile(key) {
    setSelectedKey(key);
    setNewCardOpen(false);
    clearSelection();
  }

  function clearSelection() {
    clear();
    setMoveError(null);
  }

  // An old move error was about a different set of cards, so any change to the selection hides it.
  function handleLongPress(cardId) {
    setMoveError(null);
    select(cardId);
  }

  function handleToggleSelect(cardId) {
    setMoveError(null);
    toggle(cardId);
  }

  // Moves every selected card into the pile with this id. Move to… calls it; so will dropping on a tab.
  async function handleMove(pileId) {
    // Read the name now: the piles list may have changed by the time the move finishes.
    const targetName = piles.find((pile) => pile.id === pileId)?.name ?? 'the pile';
    setMoveError(null);
    // Empty it first, so moving the same number of cards to the same pile twice is announced twice.
    setMoveAnnouncement('');
    try {
      await moveCards.mutateAsync({ cardIds: selectedIds, pileId });
      const count = selectedIds.length;
      setMoveAnnouncement(`Moved ${count} ${plural(count, 'card', 'cards')} to ${targetName}`);
      clear();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // A card or the pile was deleted elsewhere. Refetch: vanished cards drop out of the
        // selection, and a vanished pile drops out of Move to….
        refetchCardsAndPiles();
      } else {
        // Keep the selection, so the user can simply try again.
        setMoveError(MOVE_ERROR);
      }
    }
  }

  // Dragging an unselected card adds it to the selection first, the same as a long press.
  // The drag then carries the whole selection.
  function handleDragStart({ active }) {
    setIsDragging(true);
    handleLongPress(active.id);
  }

  function handleDragEnd({ over }) {
    setIsDragging(false);
    // Only the other piles' tabs are drop targets. Dropping anywhere else does nothing.
    const pileId = over?.data.current?.pileId;
    if (pileId === undefined || pileId === selectedKey || moveCards.isPending) return;
    handleMove(pileId);
  }

  // PileTabs selects the new pile itself once this resolves.
  function handleCreatePile(name) {
    return createPile.mutateAsync({ name });
  }

  async function handleCreateFirstPile(name) {
    const pile = await createPile.mutateAsync({ name });
    setSelectedKey(pile.id);
  }

  function handleRenamePile(name) {
    return renamePile.mutateAsync({ id: selectedPile.id, name });
  }

  function handleCloseNewCard() {
    setNewCardOpen(false);
    // The Cancel button that had focus is gone, so hand focus back to the button that opened the form.
    newCardButtonRef.current?.focus();
  }

  async function handleCreateCard(values) {
    try {
      await createCard.mutateAsync({ ...values, pileId: selectedPile.id });
    } catch (error) {
      // 404: the pile was deleted elsewhere. Refetch so the tabs fall back to a pile that exists.
      if (error instanceof ApiError && error.status === 404) {
        refetchCardsAndPiles();
      }
      // Rethrow so CardForm shows its error message.
      throw error;
    }
  }

  function handleRequestDelete(card) {
    setDeleteError(null);
    setCardToDelete(card);
  }

  // Esc and "Keep it" both land here; closing mid-request would hide the outcome.
  function handleCancelDelete() {
    if (deleteCard.isPending) return;
    setCardToDelete(null);
  }

  async function handleConfirmDelete() {
    // Clear the old error first so a repeated failure re-renders (and re-announces) the alert.
    setDeleteError(null);
    try {
      await deleteCard.mutateAsync(cardToDelete.id);
      setCardToDelete(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already deleted elsewhere: there is nothing to retry, so close and resync the list.
        setCardToDelete(null);
        refetchCardsAndPiles();
      } else {
        setDeleteError(DELETE_ERROR);
      }
    }
  }

  function handleRequestDeletePile() {
    const { id, name, cardCount } = selectedPile;
    setPileDeleteError(null);
    setPileToDelete({ id, name, cardCount });
  }

  // Esc, "Keep it" and "Cancel" all land here; closing mid-request would hide the outcome.
  function handleCancelDeletePile() {
    if (deletePile.isPending) return;
    setPileToDelete(null);
  }

  // cardsMode: undefined for an empty pile, 'keep' or 'delete' for a pile with cards.
  async function handleConfirmDeletePile(cardsMode) {
    const { id } = pileToDelete;
    // Clear the old error first so a repeated failure re-renders (and re-announces) the alert.
    setPileDeleteError(null);
    try {
      await deletePile.mutateAsync({ id, cardsMode });
      setPileToDelete(null);
      // Open the first pile that is left, so the deleted pile is not the remembered choice.
      const firstPileLeft = piles.find((pile) => pile.id !== id);
      if (firstPileLeft) setSelectedKey(firstPileLeft.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PILE_NOT_EMPTY' && error.details.cardCount > 0) {
        // Cards were added elsewhere since the counts loaded. That is not an error: ask what to do
        // with them, using the server's count (a count above 0 switches to the keep/delete dialog).
        setPileToDelete((pile) => ({ ...pile, cardCount: error.details.cardCount }));
      } else if (error instanceof ApiError && error.status === 404) {
        // Already deleted elsewhere: there is nothing to retry, so close and resync.
        setPileToDelete(null);
        refetchCardsAndPiles();
      } else {
        setPileDeleteError(PILE_DELETE_ERROR);
      }
    }
  }

  // The selected pile (or Unsorted): its header, the new-card form and its cards.
  function renderPilePanel() {
    const name = isUnsorted ? 'Unsorted' : selectedPile.name;
    // Unsorted is only reachable while it has cards, so its empty message is just a fallback.
    const emptyMessage = isUnsorted ? 'No unsorted cards.' : `No cards in ${name} yet — make your first one!`;

    // While cards are selected, the selection bar takes the place of the header buttons.
    const selectionBar = isSelecting ? (
      <SelectionBar
        count={selectedIds.length}
        // Cards can go to any pile except the one they are in (Unsorted is not a pile).
        targets={piles.filter((pile) => pile.id !== selectedKey)}
        onMove={handleMove}
        onClear={clearSelection}
        pending={moveCards.isPending}
        error={moveError}
      />
    ) : null;

    return (
      <section aria-labelledby={panelHeadingId} className={`${PANEL} flex flex-col gap-6`}>
        {isUnsorted ? (
          <PileHeader
            variant="unsorted"
            name={name}
            headingId={panelHeadingId}
            existingPiles={piles}
            selectionBar={selectionBar}
          />
        ) : (
          <PileHeader
            variant="pile"
            name={name}
            pileId={selectedPile.id}
            headingId={panelHeadingId}
            existingPiles={piles}
            onRename={handleRenamePile}
            onRequestDelete={handleRequestDeletePile}
            newCardOpen={newCardOpen}
            onToggleNewCard={() => setNewCardOpen((open) => !open)}
            newCardButtonRef={newCardButtonRef}
            selectionBar={selectionBar}
          />
        )}
        {!isUnsorted && !isSelecting && <p className="-mt-2 font-medium">{PILE_TIP}</p>}
        {!isUnsorted && !isSelecting && newCardOpen && (
          <div className="max-w-[480px]">
            <CardForm
              // A fresh form per pile, so half-typed text never lands in a different pile.
              key={selectedPile.id}
              title={`New ${name} card`}
              submitLabel="Slam it in!"
              variant="create"
              resetOnSuccess
              autoFocus
              onSubmit={handleCreateCard}
              onCancel={handleCloseNewCard}
            />
          </div>
        )}
        <CardGrid
          cards={cards}
          isLoading={cardsQuery.isLoading}
          isError={showLoadError}
          isFetching={cardsQuery.isFetching}
          emptyMessage={emptyMessage}
          onRetry={() => cardsQuery.refetch()}
          onSaveCard={(id, values) => updateCard.mutateAsync({ id, ...values })}
          onRequestDelete={handleRequestDelete}
          selectedIds={selectedIds}
          selectionMode={isSelecting}
          onLongPress={handleLongPress}
          onToggleSelect={handleToggleSelect}
        />
      </section>
    );
  }

  function renderMain() {
    if (pilesData === undefined) {
      return (
        <PilesLoadState
          isError={pilesQuery.isError}
          isFetching={pilesQuery.isFetching}
          onRetry={() => pilesQuery.refetch()}
        />
      );
    }

    if (piles.length === 0) {
      return <NoPilesState unsortedCount={pilesData.unsortedCount} onCreatePile={handleCreateFirstPile} />;
    }

    // No gap between the tabs and the panel: the selected tab sits on the panel's top border.
    // Cards in the panel can be dragged onto the tabs. pointerWithin: the drop target is the tab
    // under the pointer, not whichever tab the (much bigger) dragged card overlaps most.
    return (
      <DndContext
        sensors={dragSensors}
        collisionDetection={pointerWithin}
        accessibility={DRAG_ACCESSIBILITY}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setIsDragging(false)}
      >
        <div className="flex flex-col">
          <PileTabs
            piles={piles}
            unsortedCount={pilesData.unsortedCount}
            selectedKey={selectedKey}
            onSelect={handleSelectPile}
            onCreatePile={handleCreatePile}
          />
          {renderPilePanel()}
        </div>
        {/* No drop animation: after a move the dragged cards are gone from this pile. */}
        <DragOverlay dropAnimation={null}>{isDragging && <DragGhost count={selectedIds.length} />}</DragOverlay>
      </DndContext>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-sun font-body text-ink">
      {/* Decorative halftone circle behind the top-right of the header. */}
      <div
        aria-hidden="true"
        className="pop-dots pointer-events-none absolute -right-10 -top-10 h-[420px] w-[420px] rounded-full opacity-[0.18]"
      />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-6 pb-20 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-5">
            <h1 className="m-0 font-display text-[64px] uppercase leading-[0.95] tracking-[-1px] [text-shadow:5px_5px_0_var(--color-pop)]">
              <span className="block">Brain</span>
              <span className="block">Cram</span>
              <span className="block text-zap [text-shadow:5px_5px_0_var(--color-ink)]">Bam!</span>
            </h1>
            <p className="m-0 -rotate-[8deg] rounded bg-ink px-4 py-2.5 font-display text-lg text-sun">
              Study like it's loud
            </p>
          </div>

          {pilesData !== undefined && <CountBadge {...countBadge(pilesData, selectedKey, selectedPile)} />}
        </header>

        <main>{renderMain()}</main>
      </div>

      {/* Always on the page, so screen readers notice when its text changes. */}
      <p role="status" className="sr-only">
        {moveAnnouncement}
      </p>

      <ConfirmDialog
        open={cardToDelete !== null}
        title="Toss it for real?"
        message={cardToDelete ? `“${cardToDelete.question}” goes in the bin. No take-backs.` : ''}
        confirmLabel="Toss it"
        cancelLabel="Keep it"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        pending={deleteCard.isPending}
        error={deleteError}
      />

      <ConfirmDialog
        open={pileToDelete !== null && pileToDelete.cardCount === 0}
        title={pileToDelete ? `Delete the ${pileToDelete.name} pile?` : ''}
        message="It has no cards, so nothing else is lost."
        confirmLabel="Delete pile"
        cancelLabel="Keep it"
        onConfirm={() => handleConfirmDeletePile(undefined)}
        onCancel={handleCancelDeletePile}
        pending={deletePile.isPending}
        error={pileDeleteError}
      />

      <DeletePileDialog
        open={pileToDelete !== null && pileToDelete.cardCount > 0}
        pileName={pileToDelete?.name ?? ''}
        cardCount={pileToDelete?.cardCount ?? 0}
        onKeep={() => handleConfirmDeletePile('keep')}
        onDeleteCards={() => handleConfirmDeletePile('delete')}
        onCancel={handleCancelDeletePile}
        pending={deletePile.isPending}
        error={pileDeleteError}
      />
    </div>
  );
}

export default App;
