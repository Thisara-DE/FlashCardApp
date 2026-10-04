import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from './api/cards.js';
import CardForm from './components/CardForm.jsx';
import CardGrid from './components/CardGrid.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { useCards, useCreateCard, useDeleteCard, useUpdateCard } from './hooks/useCards.js';

const DELETE_ERROR = "Couldn't toss this card. Try again.";

function App() {
  const queryClient = useQueryClient();
  const cardsQuery = useCards();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  // The card waiting for delete confirmation (null = dialog closed).
  const [cardToDelete, setCardToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const cards = cardsQuery.data;
  // Only show the error panel when there is nothing to show: a failed background
  // refetch should not replace a list the user can already see.
  const showLoadError = cardsQuery.isError && cards === undefined;

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
    try {
      await deleteCard.mutateAsync(cardToDelete.id);
      setCardToDelete(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Already deleted elsewhere: there is nothing to retry, so close and resync the list.
        setCardToDelete(null);
        queryClient.invalidateQueries({ queryKey: ['cards'] });
      } else {
        setDeleteError(DELETE_ERROR);
      }
    }
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

          {cards !== undefined && (
            <p className="m-0 rotate-2 border-4 border-ink bg-mint px-5 py-3 text-lg font-bold shadow-[6px_6px_0_var(--color-ink)]">
              <span className="font-display text-[34px]">{cards.length}</span>{' '}
              {cards.length === 1 ? 'card' : 'cards'} in the pile
            </p>
          )}
        </header>

        <div className="flex flex-wrap items-start gap-10">
          <div className="max-w-[380px] flex-[1_1_320px]">
            <CardForm
              title="Make a card"
              submitLabel="Slam it in!"
              variant="create"
              resetOnSuccess
              onSubmit={createCard.mutateAsync}
            />
          </div>
          <div className="min-w-0 flex-[999_1_560px]">
            <CardGrid
              cards={cards}
              isLoading={cardsQuery.isLoading}
              isError={showLoadError}
              onRetry={cardsQuery.refetch}
              onSaveCard={(id, values) => updateCard.mutateAsync({ id, ...values })}
              onRequestDelete={handleRequestDelete}
            />
          </div>
        </div>
      </div>

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
    </div>
  );
}

export default App;
