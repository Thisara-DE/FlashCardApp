import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { STORAGE_KEY } from './hooks/useSelectedPile.js';
import { renderWithClient } from './test-utils.jsx';
import { requestsMade, respond, respondError, stubApi } from './test/fakeApi.js';

const PILES = [
  { id: 1, name: 'Geography' },
  { id: 2, name: 'Math' },
];

const australia = { id: 11, question: 'Capital of Australia?', answer: 'Canberra', pileId: 1 };
const france = { id: 12, question: 'Capital of France?', answer: 'Paris', pileId: 1 };
const squareRoot = { id: 21, question: 'Square root of 144?', answer: '12', pileId: 2 };

// Newest first, like the real server.
const FIXTURE = { piles: PILES, cards: [france, australia, squareRoot] };

const serverError = () => respondError(500, 'INTERNAL_ERROR', 'Boom');

// The header count badge, e.g. "2 cards in Geography" or "0 piles". The number sits in its own
// <span>, so match on the paragraph's whole text rather than on a single text node.
const BADGE_TEXT = /^\d+ (cards? in .+|unsorted cards?|piles)$/;
const isBadge = (content, element) => element?.tagName === 'P' && BADGE_TEXT.test(element.textContent);
const findBadge = () => screen.findByText(isBadge);
const getBadge = () => screen.getByText(isBadge);
const queryBadge = () => screen.queryByText(isBadge);

function countRequests(fetchMock, request) {
  return requestsMade(fetchMock).filter((made) => made === request).length;
}

// Clicks "Toss" on the card with this question (each card has its own Toss button).
async function tossCard(user, question) {
  const item = screen.getByText(question).closest('li');
  await user.click(within(item).getByRole('button', { name: 'Toss' }));
}

function renderApp(fixture = FIXTURE, overrides = {}) {
  const fetchMock = stubApi(fixture, overrides);
  const user = userEvent.setup();
  renderWithClient(<App />);
  return { fetchMock, user };
}

describe('App', () => {
  beforeEach(() => {
    // jsdom keeps localStorage between tests, and the selected pile is remembered there.
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('header', () => {
    it('shows the BrainCramBam wordmark as the page heading', () => {
      renderApp();

      expect(screen.getByRole('heading', { level: 1, name: /brain\s*cram\s*bam/i })).toBeInTheDocument();
    });

    it('shows no count badge until the piles have loaded', async () => {
      renderApp();

      expect(queryBadge()).not.toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('2 cards in Geography');
    });

    it('uses the singular for exactly one card', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      renderApp();

      expect(await findBadge()).toHaveTextContent('1 card in Math');
    });
  });

  describe('piles', () => {
    it("shows the first pile's cards and a count badge", async () => {
      renderApp();

      expect(await screen.findByText(australia.question)).toBeInTheDocument();
      expect(screen.getByText(france.question)).toBeInTheDocument();
      expect(screen.queryByText(squareRoot.question)).not.toBeInTheDocument();

      const tabs = screen.getByRole('navigation', { name: 'Piles' });
      expect(within(tabs).getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(tabs).getByRole('button', { name: 'Math · 1' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('region', { name: 'Geography' })).toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('2 cards in Geography');
      expect(
        screen.getByText('Tip: press and hold a card to select it, then drag it onto another pile.'),
      ).toBeInTheDocument();
    });

    it('switching tabs shows only that pile and remembers it', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);

      await user.click(screen.getByRole('button', { name: 'Math · 1' }));

      expect(await screen.findByText(squareRoot.question)).toBeInTheDocument();
      expect(screen.queryByText(australia.question)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Math · 1' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { level: 2, name: 'Math' })).toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('1 card in Math');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('2');
    });

    it('opens the stored pile on load', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { fetchMock } = renderApp();

      expect(await screen.findByText(squareRoot.question)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Math · 1' })).toHaveAttribute('aria-pressed', 'true');
      // Only the stored pile's cards are requested, never the first pile's.
      expect(requestsMade(fetchMock)).not.toContain('GET /api/cards?pileId=1');
    });

    it('shows Loading piles… until the piles arrive', async () => {
      let finishLoading;
      renderApp(FIXTURE, {
        'GET /api/piles': (url, options, handleNormally) =>
          new Promise((resolve) => {
            finishLoading = () => resolve(handleNormally());
          }),
      });

      // getByText, not getByRole('status'): the page also has an always-present (empty) live region.
      expect(screen.getByText('Loading piles…')).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('navigation', { name: 'Piles' })).not.toBeInTheDocument();

      finishLoading();
      expect(await screen.findByRole('navigation', { name: 'Piles' })).toBeInTheDocument();
      expect(screen.queryByText('Loading piles…')).not.toBeInTheDocument();
    });

    it("shows Couldn't load piles with a Retry that reloads them", async () => {
      let pileLoads = 0;
      const { user } = renderApp(FIXTURE, {
        'GET /api/piles': (url, options, handleNormally) => {
          pileLoads += 1;
          return pileLoads === 1 ? serverError() : handleNormally();
        },
      });

      expect(await screen.findByText("Couldn't load piles")).toBeInTheDocument();
      expect(queryBadge()).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText(australia.question)).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load piles")).not.toBeInTheDocument();
    });

    it('creating a pile from the tab row selects it', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);

      await user.click(screen.getByRole('button', { name: '+ New pile' }));
      await user.type(screen.getByLabelText('New pile name'), 'Bio');
      await user.click(screen.getByRole('button', { name: 'Add pile' }));

      expect(await screen.findByRole('heading', { level: 2, name: 'Bio' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bio · 0' })).toHaveAttribute('aria-pressed', 'true');
      expect(await screen.findByText('No cards in Bio yet — make your first one!')).toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('0 cards in Bio');
    });

    it('renames the selected pile', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(australia.question);

      await user.click(screen.getByRole('button', { name: 'Rename' }));
      const input = screen.getByLabelText('Pile name');
      await user.clear(input);
      await user.type(input, 'Geo');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('button', { name: 'Geo · 2' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { level: 2, name: 'Geo' })).toBeInTheDocument();
      expect(requestsMade(fetchMock)).toContain('PUT /api/piles/1');
    });

    it('shows Start with a pile when there are no piles', async () => {
      renderApp({ piles: [], cards: [] });

      expect(await screen.findByRole('heading', { name: 'Start with a pile' })).toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('0 piles');
      expect(screen.queryByRole('navigation', { name: 'Piles' })).not.toBeInTheDocument();
    });

    it('making the first pile from Start with a pile opens it', async () => {
      const { user } = renderApp({ piles: [], cards: [] });

      await user.type(await screen.findByLabelText('Pile name'), 'Law');
      await user.click(screen.getByRole('button', { name: 'Make the pile' }));

      expect(await screen.findByRole('button', { name: 'Law · 0' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('heading', { name: 'Start with a pile' })).not.toBeInTheDocument();
      expect(await findBadge()).toHaveTextContent('0 cards in Law');
    });
  });

  describe('creating a card', () => {
    it('creates a card in the selected pile from New ‹Name› card', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(australia.question);

      await user.click(screen.getByRole('button', { name: 'New Geography card' }));
      const form = screen.getByRole('form', { name: 'New Geography card' });
      expect(within(form).getByLabelText(/question/i)).toHaveFocus();

      await user.type(within(form).getByLabelText(/question/i), 'Capital of Japan?');
      await user.type(within(form).getByLabelText(/answer/i), 'Tokyo');
      await user.click(within(form).getByRole('button', { name: 'Slam it in!' }));

      await waitFor(() => expect(requestsMade(fetchMock)).toContain('POST /api/cards'));
      const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(JSON.parse(post[1].body)).toEqual({ question: 'Capital of Japan?', answer: 'Tokyo', pileId: 1 });

      await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3));
      expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent('Capital of Japan?');

      // The form stays open, emptied, for quick entry.
      expect(screen.getByRole('form', { name: 'New Geography card' })).toBeInTheDocument();
      expect(within(form).getByLabelText(/question/i)).toHaveValue('');
      expect(within(form).getByLabelText(/answer/i)).toHaveValue('');
      await waitFor(() => expect(getBadge()).toHaveTextContent('3 cards in Geography'));
    });

    it('Cancel closes the new-card form and focus returns to the button', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);
      const newCardButton = screen.getByRole('button', { name: 'New Geography card' });

      await user.click(newCardButton);
      expect(newCardButton).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('form', { name: 'New Geography card' })).not.toBeInTheDocument();
      expect(newCardButton).toHaveAttribute('aria-expanded', 'false');
      expect(newCardButton).toHaveFocus();
    });

    it('the New ‹Name› card button also closes the form', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);
      const newCardButton = screen.getByRole('button', { name: 'New Geography card' });

      await user.click(newCardButton);
      await user.click(newCardButton);

      expect(screen.queryByRole('form', { name: 'New Geography card' })).not.toBeInTheDocument();
    });

    it('switching tabs closes the new-card form', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);

      await user.click(screen.getByRole('button', { name: 'New Geography card' }));
      await user.click(screen.getByRole('button', { name: 'Math · 1' }));

      await screen.findByText(squareRoot.question);
      expect(screen.queryByRole('form', { name: /^New .* card$/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New Math card' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('a card create that 404s refetches the piles', async () => {
      const { fetchMock, user } = renderApp(FIXTURE, {
        'POST /api/cards': () => respondError(404, 'NOT_FOUND', 'Pile not found'),
      });
      await screen.findByText(australia.question);
      const pileLoadsBefore = countRequests(fetchMock, 'GET /api/piles');

      await user.click(screen.getByRole('button', { name: 'New Geography card' }));
      const form = screen.getByRole('form', { name: 'New Geography card' });
      await user.type(within(form).getByLabelText(/question/i), 'Q');
      await user.type(within(form).getByLabelText(/answer/i), 'A');
      await user.click(within(form).getByRole('button', { name: 'Slam it in!' }));

      expect(await within(form).findByRole('alert')).toHaveTextContent(
        "Something went wrong — your card wasn't saved. Try again.",
      );
      await waitFor(() => expect(countRequests(fetchMock, 'GET /api/piles')).toBeGreaterThan(pileLoadsBefore));
    });
  });

  describe('editing a card', () => {
    it('PUTs only question and answer, then shows the new text after the refetch', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(france.question);

      const item = screen.getByText(france.question).closest('li');
      await user.click(within(item).getByRole('button', { name: 'Edit' }));
      const answerField = within(item).getByLabelText(/answer/i);
      await user.clear(answerField);
      await user.type(answerField, 'Lyon');
      await user.click(within(item).getByRole('button', { name: 'Save' }));

      // The answer sits on the (hidden) back face, so look it up by text, not by button name.
      expect(await screen.findByText('Lyon')).toBeInTheDocument();
      const put = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT');
      expect(put[0]).toBe('/api/cards/12');
      expect(JSON.parse(put[1].body)).toEqual({ question: 'Capital of France?', answer: 'Lyon' });
      expect(screen.queryByRole('form', { name: 'Fix this card' })).not.toBeInTheDocument();
    });
  });

  describe('deleting a card', () => {
    it('asks for confirmation, quoting the card question', async () => {
      const { user } = renderApp();
      await screen.findByText(france.question);

      await tossCard(user, france.question);

      const dialog = screen.getByRole('dialog', { name: 'Toss it for real?' });
      expect(within(dialog).getByText('“Capital of France?” goes in the bin. No take-backs.')).toBeInTheDocument();
    });

    it('keeps the card when the user picks "Keep it"', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Keep it' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(france.question)).toBeInTheDocument();
      expect(requestsMade(fetchMock).some((made) => made.startsWith('DELETE'))).toBe(false);
    });

    it('sends DELETE, closes the dialog and removes the card on "Toss it"', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      await waitFor(() => expect(screen.queryByText(france.question)).not.toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith('/api/cards/12', expect.objectContaining({ method: 'DELETE' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(getBadge()).toHaveTextContent('1 card in Geography'));
      expect(screen.getByRole('button', { name: 'Geography · 1' })).toBeInTheDocument();
    });

    it('closes the dialog and refetches cards and piles when the card is already gone (404)', async () => {
      const { fetchMock, user } = renderApp(FIXTURE, {
        'DELETE /api/cards/12': () => respondError(404, 'NOT_FOUND', 'Card not found'),
      });
      await screen.findByText(france.question);
      const cardLoadsBefore = countRequests(fetchMock, 'GET /api/cards?pileId=1');
      const pileLoadsBefore = countRequests(fetchMock, 'GET /api/piles');

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => {
        expect(countRequests(fetchMock, 'GET /api/cards?pileId=1')).toBeGreaterThan(cardLoadsBefore);
        expect(countRequests(fetchMock, 'GET /api/piles')).toBeGreaterThan(pileLoadsBefore);
      });
    });

    it('keeps the dialog open with an error when the delete fails (500)', async () => {
      const { user } = renderApp(FIXTURE, { 'DELETE /api/cards/12': serverError });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      const dialog = screen.getByRole('dialog', { name: 'Toss it for real?' });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't toss this card. Try again.");
      expect(screen.getByText(france.question)).toBeInTheDocument();
    });

    it('clears a previous delete error when the dialog is reopened', async () => {
      const { user } = renderApp(FIXTURE, { 'DELETE /api/cards/12': serverError });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Keep it' }));
      await tossCard(user, france.question);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears the old error while retrying and shows it again if the retry fails', async () => {
      let deleteCount = 0;
      let failRetry;
      const { user } = renderApp(FIXTURE, {
        'DELETE /api/cards/12': () => {
          deleteCount += 1;
          if (deleteCount === 1) return serverError();
          // The second attempt stays pending until the test settles it.
          return new Promise((resolve) => {
            failRetry = () => resolve(serverError());
          });
        },
      });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await screen.findByRole('alert');

      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

      failRetry();
      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't toss this card. Try again.");
    });

    it('closes the dialog and removes the card when a retry succeeds', async () => {
      let deleteCount = 0;
      const { user } = renderApp(FIXTURE, {
        // The first DELETE fails; the retry reaches the fake API as normal.
        'DELETE /api/cards/12': (url, options, handleNormally) => {
          deleteCount += 1;
          return deleteCount === 1 ? serverError() : handleNormally();
        },
      });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      await waitFor(() => expect(screen.queryByText(france.question)).not.toBeInTheDocument());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores Esc while the delete is still in flight', async () => {
      // A DELETE that never settles keeps the mutation pending for the whole test.
      const { user } = renderApp(FIXTURE, { 'DELETE /api/cards/12': () => new Promise(() => {}) });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Toss it' })).toBeDisabled());

      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

      expect(screen.getByRole('dialog', { name: 'Toss it for real?' })).toBeInTheDocument();
    });
  });

  describe('deleting a pile', () => {
    const PILE_DELETE_ERROR = "Couldn't delete this pile. Try again.";
    // The usual fixture plus an empty third pile, Bio (id 3).
    const WITH_EMPTY_BIO = { piles: [...PILES, { id: 3, name: 'Bio' }], cards: FIXTURE.cards };

    // The pile panel's "Delete pile" button (the empty-pile confirm dialog has one with the same name).
    async function openDeletePile(user) {
      await user.click(within(screen.getByRole('region')).getByRole('button', { name: 'Delete pile' }));
    }

    it('deleting an empty pile uses the simple confirm and falls back to the first pile', async () => {
      localStorage.setItem(STORAGE_KEY, '3');
      const { fetchMock, user } = renderApp(WITH_EMPTY_BIO);
      await screen.findByText('No cards in Bio yet — make your first one!');

      await openDeletePile(user);
      const dialog = screen.getByRole('dialog', { name: 'Delete the Bio pile?' });
      expect(within(dialog).getByText('It has no cards, so nothing else is lost.')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Delete pile' }));

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Bio · 0' })).not.toBeInTheDocument());
      expect(requestsMade(fetchMock)).toContain('DELETE /api/piles/3');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'true');
      expect(await screen.findByText(australia.question)).toBeInTheDocument();
    });

    it('Keep it closes the simple confirm without deleting', async () => {
      localStorage.setItem(STORAGE_KEY, '3');
      const { fetchMock, user } = renderApp(WITH_EMPTY_BIO);
      await screen.findByText('No cards in Bio yet — make your first one!');

      await openDeletePile(user);
      await user.click(screen.getByRole('button', { name: 'Keep it' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bio · 0' })).toBeInTheDocument();
      expect(requestsMade(fetchMock).some((made) => made.startsWith('DELETE'))).toBe(false);
    });

    it('Keep the cards sends ?cards=keep, moves the cards to a General tab, and selects the first pile', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { fetchMock, user } = renderApp();
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      const dialog = screen.getByRole('dialog', { name: 'Delete the Math pile?' });
      expect(within(dialog).getByText('It still has 1 card. What should happen to them?')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: /^Keep the cards/ }));

      expect(await screen.findByRole('button', { name: 'General · 1' })).toHaveAttribute('aria-pressed', 'false');
      expect(requestsMade(fetchMock)).toContain('DELETE /api/piles/2?cards=keep');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Math · / })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Unsorted/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'true');
      expect(await screen.findByText(australia.question)).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    });

    it('Keep the cards on General itself leaves its cards in Unsorted', async () => {
      const general = { id: 3, name: 'General' };
      const generalCard = { id: 31, question: 'Who wrote Hamlet?', answer: 'Shakespeare', pileId: 3 };
      localStorage.setItem(STORAGE_KEY, '3');
      const { user } = renderApp({ piles: [...PILES, general], cards: [...FIXTURE.cards, generalCard] });
      await screen.findByText(generalCard.question);

      await openDeletePile(user);
      const dialog = screen.getByRole('dialog', { name: 'Delete the General pile?' });
      await user.click(within(dialog).getByRole('button', { name: /^Keep the cards/ }));

      expect(await screen.findByRole('button', { name: 'Unsorted · 1' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^General/ })).not.toBeInTheDocument();
    });

    it('Delete the cards too sends ?cards=delete and no Unsorted tab appears', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { fetchMock, user } = renderApp();
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      const dialog = screen.getByRole('dialog', { name: 'Delete the Math pile?' });
      expect(within(dialog).getByText('That card is gone for good. No take-backs.')).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: /^Delete the cards too/ }));

      await waitFor(() => expect(screen.queryByRole('button', { name: /^Math · / })).not.toBeInTheDocument());
      expect(requestsMade(fetchMock)).toContain('DELETE /api/piles/2?cards=delete');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Unsorted/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Geography · 2' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('Cancel closes the keep/delete dialog without deleting', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { fetchMock, user } = renderApp();
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Math · 1' })).toBeInTheDocument();
      expect(requestsMade(fetchMock).some((made) => made.startsWith('DELETE'))).toBe(false);
    });

    it('a pile the client thinks is empty but the server says has cards opens the keep/delete dialog', async () => {
      let deleteCount = 0;
      localStorage.setItem(STORAGE_KEY, '2');
      // Math has no cards here, so the client asks for a plain delete; the server says it has 4.
      const { fetchMock, user } = renderApp(
        { piles: PILES, cards: [france, australia] },
        {
          'DELETE /api/piles/2': (url, options, handleNormally) => {
            deleteCount += 1;
            return deleteCount === 1
              ? respondError(409, 'PILE_NOT_EMPTY', 'Pile still has cards', { cardCount: 4 })
              : handleNormally();
          },
        },
      );
      await screen.findByText('No cards in Math yet — make your first one!');

      await openDeletePile(user);
      await user.click(
        within(screen.getByRole('dialog', { name: 'Delete the Math pile?' })).getByRole('button', {
          name: 'Delete pile',
        }),
      );

      const dialog = await screen.findByRole('dialog', { name: 'Delete the Math pile?' });
      expect(await within(dialog).findByText('It still has 4 cards. What should happen to them?')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(requestsMade(fetchMock)).toContain('DELETE /api/piles/2');

      await user.click(within(dialog).getByRole('button', { name: /^Keep the cards/ }));
      await waitFor(() => expect(requestsMade(fetchMock)).toContain('DELETE /api/piles/2?cards=keep'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('a failed delete keeps the dialog open with "Couldn\'t delete this pile. Try again."', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { user } = renderApp(FIXTURE, { 'DELETE /api/piles/2': serverError });
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      await user.click(screen.getByRole('button', { name: /^Keep the cards/ }));

      const dialog = screen.getByRole('dialog', { name: 'Delete the Math pile?' });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(PILE_DELETE_ERROR);
      expect(screen.getByRole('button', { name: 'Math · 1' })).toBeInTheDocument();
    });

    it('a failed empty-pile delete keeps the confirm open with the error', async () => {
      localStorage.setItem(STORAGE_KEY, '3');
      const { user } = renderApp(WITH_EMPTY_BIO, { 'DELETE /api/piles/3': serverError });
      await screen.findByText('No cards in Bio yet — make your first one!');

      await openDeletePile(user);
      const dialog = screen.getByRole('dialog', { name: 'Delete the Bio pile?' });
      await user.click(within(dialog).getByRole('button', { name: 'Delete pile' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(PILE_DELETE_ERROR);
    });

    it('clears a previous pile delete error when the dialog is reopened', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { user } = renderApp(FIXTURE, { 'DELETE /api/piles/2': serverError });
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      await user.click(screen.getByRole('button', { name: /^Keep the cards/ }));
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await openDeletePile(user);

      expect(screen.getByRole('dialog', { name: 'Delete the Math pile?' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a 404 on delete closes the dialog and refetches piles', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      const { fetchMock, user } = renderApp(FIXTURE, {
        'DELETE /api/piles/2': () => respondError(404, 'NOT_FOUND', 'Pile not found'),
      });
      await screen.findByText(squareRoot.question);
      const pileLoadsBefore = countRequests(fetchMock, 'GET /api/piles');

      await openDeletePile(user);
      await user.click(screen.getByRole('button', { name: /^Delete the cards too/ }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(countRequests(fetchMock, 'GET /api/piles')).toBeGreaterThan(pileLoadsBefore));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('ignores Esc while the pile delete is still in flight', async () => {
      localStorage.setItem(STORAGE_KEY, '2');
      // A DELETE that never settles keeps the mutation pending for the whole test.
      const { user } = renderApp(FIXTURE, { 'DELETE /api/piles/2': () => new Promise(() => {}) });
      await screen.findByText(squareRoot.question);

      await openDeletePile(user);
      await user.click(screen.getByRole('button', { name: /^Keep the cards/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled());

      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

      expect(screen.getByRole('dialog', { name: 'Delete the Math pile?' })).toBeInTheDocument();
    });
  });

  describe('the Unsorted view', () => {
    const orphan = { id: 31, question: 'Who wrote Hamlet?', answer: 'Shakespeare', pileId: null };

    it('the Unsorted tab shows unsorted cards with the Unsorted header and no New card button', async () => {
      const { user } = renderApp({ piles: PILES, cards: [...FIXTURE.cards, orphan] });
      await screen.findByText(australia.question);

      // The Unsorted tab comes after every pile tab.
      const tabs = screen.getByRole('navigation', { name: 'Piles' });
      // Tabs are the nav buttons with aria-pressed ("+ New pile" has none).
      const tabNames = within(tabs)
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('aria-pressed'))
        .map((tab) => tab.textContent);
      expect(tabNames).toEqual(['Geography · 2', 'Math · 1', 'Unsorted · 1']);

      await user.click(within(tabs).getByRole('button', { name: 'Unsorted · 1' }));

      expect(await screen.findByText(orphan.question)).toBeInTheDocument();
      expect(screen.queryByText(australia.question)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Unsorted' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'These cards lost their pile. Press and hold a card to select it, then drag it onto a pile.',
        ),
      ).toBeInTheDocument();
      expect(getBadge()).toHaveTextContent(/^1 unsorted card$/);
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete pile' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^New .* card$/ })).not.toBeInTheDocument();

      const card = screen.getByText(orphan.question).closest('li');
      expect(within(card).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Toss' })).toBeInTheDocument();
    });
  });

  describe('selecting cards and Move to…', () => {
    const MOVE_ERROR = "Couldn't move those cards. Try again.";

    // The card face button holding this question.
    const cardFace = (question) => screen.getByText(question).closest('button');

    // Holds the pointer down on a card until the long press fires (400 ms, real time), then releases.
    // The click that follows a release must not toggle or flip the card.
    async function longPress(question) {
      const face = cardFace(question);
      fireEvent.pointerDown(face, { clientX: 5, clientY: 5 });
      await screen.findByText(/^\d+ selected$/, {}, { timeout: 2000 });
      fireEvent.pointerUp(face, { clientX: 5, clientY: 5 });
      fireEvent.click(face);
    }

    // Long-presses the first card and taps the second, so both Geography cards are selected.
    async function selectBothGeographyCards(user) {
      await longPress(australia.question);
      await user.click(cardFace(france.question));
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    }

    const moveTo = () => screen.getByLabelText('Move to…');

    it('long-press selects a card and shows the selection bar instead of the header buttons', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);
      await user.click(screen.getByRole('button', { name: 'New Geography card' }));

      await longPress(australia.question);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByText('Drag them onto a tab, or')).toBeInTheDocument();
      // The card is selected, not flipped.
      expect(cardFace(australia.question)).toHaveAttribute('aria-pressed', 'true');
      expect(cardFace(australia.question)).toHaveAccessibleName(/Selected$/);
      expect(cardFace(france.question)).toHaveAccessibleName(/Tap to add$/);
      // Only the other piles are offered.
      expect(
        within(moveTo())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Math']);
      // The header buttons, the tip, the new-card form and the card buttons are hidden.
      expect(screen.getByRole('heading', { level: 2, name: 'Geography' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete pile' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New Geography card' })).not.toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'New Geography card' })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Tip: press and hold/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Toss' })).not.toBeInTheDocument();
    });

    it('tapping a card in selection mode toggles it; unselecting the last card ends selection mode', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);

      await selectBothGeographyCards(user);
      await user.click(cardFace(france.question));
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      await user.click(cardFace(australia.question));

      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
      // Tapping did not flip either card.
      expect(cardFace(australia.question)).toHaveAttribute('aria-pressed', 'false');
      expect(cardFace(france.question)).toHaveAttribute('aria-pressed', 'false');
    });

    it('Move to… moves the selected cards, announces it, clears selection and stays on the pile', async () => {
      const { fetchMock, user } = renderApp();
      await screen.findByText(australia.question);
      await selectBothGeographyCards(user);

      await user.selectOptions(moveTo(), 'Math');
      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByText('Moved 2 cards to Math')).toHaveAttribute('role', 'status');
      const post = fetchMock.mock.calls.find(([url]) => url === '/api/cards/move');
      expect(post[1].method).toBe('POST');
      expect(JSON.parse(post[1].body)).toEqual({
        cardIds: [australia.id, france.id],
        pileId: 2,
      });

      expect(await screen.findByRole('button', { name: 'Geography · 0' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Math · 3' })).toBeInTheDocument();
      expect(await screen.findByText('No cards in Geography yet — make your first one!')).toBeInTheDocument();
      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    });

    it('a failed move keeps the selection and shows "Couldn\'t move those cards. Try again."', async () => {
      const { user } = renderApp(FIXTURE, {
        'POST /api/cards/move': serverError,
      });
      await screen.findByText(australia.question);
      await selectBothGeographyCards(user);

      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(MOVE_ERROR);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(screen.getByText(australia.question)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Geography · 2' })).toBeInTheDocument();
    });

    it('a retried move that succeeds removes the error', async () => {
      let moveCount = 0;
      const { user } = renderApp(FIXTURE, {
        'POST /api/cards/move': (url, options, handleNormally) => {
          moveCount += 1;
          return moveCount === 1 ? serverError() : handleNormally();
        },
      });
      await screen.findByText(australia.question);
      await selectBothGeographyCards(user);

      await user.click(screen.getByRole('button', { name: 'Move' }));
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByText('Moved 2 cards to Math')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('Esc and Clear end selection mode; switching tabs clears the selection too', async () => {
      const { user } = renderApp();
      await screen.findByText(australia.question);

      await longPress(australia.question);
      await user.keyboard('{Escape}');
      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();

      await longPress(australia.question);
      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();

      await longPress(australia.question);
      await user.click(screen.getByRole('button', { name: 'Math · 1' }));
      await screen.findByText(squareRoot.question);
      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
      // Coming back does not bring the old selection back.
      await user.click(screen.getByRole('button', { name: 'Geography · 2' }));
      await screen.findByText(australia.question);
      expect(screen.queryByText(/^\d+ selected$/)).not.toBeInTheDocument();
      expect(cardFace(australia.question)).toHaveAttribute('aria-pressed', 'false');
    });

    it('selected ids that vanish after a refetch are dropped from the count', async () => {
      // France is deleted elsewhere: the first move 404s, and from then on the server no longer lists it.
      let franceGone = false;
      const { fetchMock, user } = renderApp(FIXTURE, {
        'POST /api/cards/move': (url, options, handleNormally) => {
          if (franceGone) return handleNormally();
          franceGone = true;
          return respondError(404, 'NOT_FOUND', 'Card not found');
        },
        'GET /api/cards': async (url, options, handleNormally) => {
          const response = await handleNormally();
          if (!franceGone) return response;
          const cards = await response.json();
          return respond(
            200,
            cards.filter((card) => card.id !== france.id),
          );
        },
      });
      await screen.findByText(australia.question);
      await selectBothGeographyCards(user);

      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByText('1 selected')).toBeInTheDocument();
      expect(screen.queryByText(france.question)).not.toBeInTheDocument();
      // A 404 is not shown as an error: the list is simply resynced.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByText('Moved 1 card to Math')).toBeInTheDocument();
      const moves = fetchMock.mock.calls.filter(([url]) => url === '/api/cards/move');
      expect(JSON.parse(moves[1][1].body)).toEqual({
        cardIds: [australia.id],
        pileId: 2,
      });
    });

    it('cards in Unsorted can be moved into a pile', async () => {
      const orphan = {
        id: 31,
        question: 'Who wrote Hamlet?',
        answer: 'Shakespeare',
        pileId: null,
      };
      localStorage.setItem(STORAGE_KEY, 'unsorted');
      const { user } = renderApp({
        piles: PILES,
        cards: [...FIXTURE.cards, orphan],
      });
      await screen.findByText(orphan.question);

      await longPress(orphan.question);
      // Every pile is a target from Unsorted.
      expect(
        within(moveTo())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Geography', 'Math']);
      await user.selectOptions(moveTo(), 'Math');
      await user.click(screen.getByRole('button', { name: 'Move' }));

      expect(await screen.findByText('Moved 1 card to Math')).toBeInTheDocument();
      // Unsorted is now empty, so its tab goes and the view falls back to the first pile.
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Unsorted/ })).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Math · 2' })).toBeInTheDocument();
    });
  });

  describe('loading the cards', () => {
    it('shows the error panel with Retry when the first load fails', async () => {
      renderApp(FIXTURE, { 'GET /api/cards': serverError });

      expect(await screen.findByText("Couldn't load cards")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('Retry reloads the list and shows the loading status meanwhile', async () => {
      let cardLoads = 0;
      let finishRetry;
      const { user } = renderApp(FIXTURE, {
        'GET /api/cards': (url, options, handleNormally) => {
          cardLoads += 1;
          if (cardLoads === 1) return serverError();
          return new Promise((resolve) => {
            finishRetry = () => resolve(handleNormally());
          });
        },
      });
      await screen.findByText("Couldn't load cards");

      await user.click(screen.getByRole('button', { name: 'Retry' }));

      // With no cached cards React Query goes back to its loading state, so the error panel is replaced.
      expect(await screen.findByText('Loading cards…')).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

      finishRetry();
      expect(await screen.findByText(australia.question)).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load cards")).not.toBeInTheDocument();
    });

    it('keeps showing the cards when a background refetch fails', async () => {
      // The 404 delete triggers a refetch; that GET fails, but the cached list must stay visible.
      let cardLoads = 0;
      const { user } = renderApp(FIXTURE, {
        'GET /api/cards': (url, options, handleNormally) => {
          cardLoads += 1;
          return cardLoads === 1 ? handleNormally() : serverError();
        },
        'DELETE /api/cards/12': () => respondError(404, 'NOT_FOUND', 'Card not found'),
      });
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await waitFor(() => expect(cardLoads).toBe(2));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      expect(screen.getByText(france.question)).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load cards")).not.toBeInTheDocument();
    });
  });

  it('requests the selected pile only, by id', async () => {
    const { fetchMock } = renderApp();
    await screen.findByText(australia.question);

    expect(requestsMade(fetchMock)).toContain('GET /api/cards?pileId=1');
    expect(requestsMade(fetchMock)).not.toContain('GET /api/cards');
  });
});
