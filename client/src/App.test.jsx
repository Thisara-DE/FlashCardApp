import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { STORAGE_KEY } from './hooks/useSelectedPile.js';
import { renderWithClient } from './test-utils.jsx';
import { requestsMade, respondError, stubApi } from './test/fakeApi.js';

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

      expect(screen.getByRole('status')).toHaveTextContent('Loading piles…');
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
      expect(await screen.findByRole('status')).toHaveTextContent('Loading cards…');
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
