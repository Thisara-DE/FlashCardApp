import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { renderWithClient } from './test-utils.jsx';

const australia = { id: 1, question: 'Capital of Australia?', answer: 'Canberra' };
const france = { id: 2, question: 'Capital of France?', answer: 'Paris' };

// A minimal fake fetch Response.
function respond(status, body) {
  return { ok: status < 400, status, json: async () => body };
}

// Stubs fetch with a tiny in-memory API over `cards` (newest first, like the real server).
// `overrides` lets a test force a response for one method, e.g. { DELETE: () => respond(404, ...) }.
function stubApi(initialCards, overrides = {}) {
  const cards = [...initialCards];
  let nextId = 100;

  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET';
    if (overrides[method]) return overrides[method]();

    if (method === 'GET') return respond(200, [...cards]);
    if (method === 'POST') {
      const created = { id: nextId++, ...JSON.parse(options.body) };
      cards.unshift(created);
      return respond(201, created);
    }
    if (method === 'PUT') {
      const id = Number(url.split('/').pop());
      const index = cards.findIndex((card) => card.id === id);
      if (index === -1) return respond(404, { error: { code: 'NOT_FOUND', message: 'Card not found' } });
      cards[index] = { id, ...JSON.parse(options.body) };
      return respond(200, cards[index]);
    }
    if (method === 'DELETE') {
      const id = Number(url.split('/').pop());
      const index = cards.findIndex((card) => card.id === id);
      // splice(-1, 1) would delete the LAST card, so an unknown id must never reach it.
      if (index === -1) return respond(404, { error: { code: 'NOT_FOUND', message: 'Card not found' } });
      cards.splice(index, 1);
      return respond(204, null);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function methodsCalled(fetchMock) {
  return fetchMock.mock.calls.map(([, options = {}]) => options.method ?? 'GET');
}

// Clicks "Toss" on the card with this question (each card has its own Toss button).
async function tossCard(user, question) {
  const item = screen.getByText(question).closest('li');
  await user.click(within(item).getByRole('button', { name: 'Toss' }));
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('header', () => {
    it('shows the BrainCramBam wordmark as the page heading', () => {
      stubApi([]);
      renderWithClient(<App />);

      expect(screen.getByRole('heading', { level: 1, name: /brain\s*cram\s*bam/i })).toBeInTheDocument();
    });

    it('shows no count badge until the cards have loaded', async () => {
      stubApi([australia, france]);
      renderWithClient(<App />);

      expect(screen.queryByText(/in the pile/i)).not.toBeInTheDocument();
      expect(await screen.findByText(/in the pile/i)).toHaveTextContent('2 cards in the pile');
    });

    it('uses the singular for exactly one card', async () => {
      stubApi([australia]);
      renderWithClient(<App />);

      expect(await screen.findByText(/in the pile/i)).toHaveTextContent('1 card in the pile');
    });
  });

  describe('creating a card', () => {
    it('POSTs the new card, lists it first and clears the form', async () => {
      const fetchMock = stubApi([australia]);
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(australia.question);

      const form = screen.getByRole('form', { name: 'Make a card' });
      await user.type(within(form).getByLabelText(/question/i), 'Capital of Japan?');
      await user.type(within(form).getByLabelText(/answer/i), 'Tokyo');
      await user.click(within(form).getByRole('button', { name: 'Slam it in!' }));

      await waitFor(() => expect(methodsCalled(fetchMock)).toContain('POST'));
      const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
      expect(JSON.parse(post[1].body)).toEqual({ question: 'Capital of Japan?', answer: 'Tokyo' });

      const items = await within(screen.getByRole('list')).findAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Capital of Japan?');
      expect(within(form).getByLabelText(/question/i)).toHaveValue('');
      expect(within(form).getByLabelText(/answer/i)).toHaveValue('');
    });
  });

  describe('editing a card', () => {
    it('PUTs only question and answer, then shows the new text after the refetch', async () => {
      const fetchMock = stubApi([australia, france]);
      const user = userEvent.setup();
      renderWithClient(<App />);
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
      expect(put[0]).toBe('/api/cards/2');
      expect(JSON.parse(put[1].body)).toEqual({ question: 'Capital of France?', answer: 'Lyon' });
      expect(screen.queryByRole('form', { name: 'Fix this card' })).not.toBeInTheDocument();
    });
  });

  describe('deleting a card', () => {
    it('asks for confirmation, quoting the card question', async () => {
      stubApi([australia, france]);
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);

      const dialog = screen.getByRole('dialog', { name: 'Toss it for real?' });
      expect(within(dialog).getByText('“Capital of France?” goes in the bin. No take-backs.')).toBeInTheDocument();
    });

    it('keeps the card when the user picks "Keep it"', async () => {
      const fetchMock = stubApi([australia, france]);
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Keep it' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(france.question)).toBeInTheDocument();
      expect(methodsCalled(fetchMock)).not.toContain('DELETE');
    });

    it('sends DELETE, closes the dialog and removes the card on "Toss it"', async () => {
      const fetchMock = stubApi([australia, france]);
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      await waitFor(() => expect(screen.queryByText(france.question)).not.toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith('/api/cards/2', expect.objectContaining({ method: 'DELETE' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(/in the pile/i)).toHaveTextContent('1 card in the pile');
    });

    it('closes the dialog and refetches when the card is already gone (404)', async () => {
      const fetchMock = stubApi([australia, france], {
        DELETE: () => respond(404, { error: { code: 'NOT_FOUND', message: 'Card not found' } }),
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // The list must be reloaded after the DELETE, so a GET comes last.
      await waitFor(() => {
        const methods = methodsCalled(fetchMock);
        expect(methods.at(-1)).toBe('GET');
        expect(methods.indexOf('DELETE')).toBeGreaterThan(0);
      });
    });

    it('keeps the dialog open with an error when the delete fails (500)', async () => {
      stubApi([australia, france], {
        DELETE: () => respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } }),
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));

      const dialog = screen.getByRole('dialog', { name: 'Toss it for real?' });
      expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't toss this card. Try again.");
      expect(screen.getByText(france.question)).toBeInTheDocument();
    });

    it('clears a previous delete error when the dialog is reopened', async () => {
      stubApi([australia, france], {
        DELETE: () => respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } }),
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
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
      stubApi([australia, france], {
        DELETE: () => {
          deleteCount += 1;
          if (deleteCount === 1) return respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } });
          // The second attempt stays pending until the test settles it.
          return new Promise((resolve) => {
            failRetry = () => resolve(respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } }));
          });
        },
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
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
      const fetchMock = stubApi([australia, france]);
      const workingApi = fetchMock.getMockImplementation();
      // First DELETE fails, every other request behaves like the normal stub.
      fetchMock.mockImplementation(async (url, options = {}) => {
        if (options.method === 'DELETE') {
          deleteCount += 1;
          if (deleteCount === 1) return respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } });
        }
        return workingApi(url, options);
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
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
      stubApi([australia, france], { DELETE: () => new Promise(() => {}) });
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Toss it' })).toBeDisabled());

      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

      expect(screen.getByRole('dialog', { name: 'Toss it for real?' })).toBeInTheDocument();
    });
  });

  describe('loading the list', () => {
    it('shows the error panel with Retry when the first load fails', async () => {
      stubApi([], { GET: () => respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } }) });
      renderWithClient(<App />);

      expect(await screen.findByText("Couldn't load cards")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(screen.queryByText(/in the pile/i)).not.toBeInTheDocument();
    });

    it('Retry reloads the list and shows the loading status meanwhile', async () => {
      let getCount = 0;
      let finishRetry;
      stubApi([], {
        GET: () => {
          getCount += 1;
          if (getCount === 1) return respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } });
          return new Promise((resolve) => {
            finishRetry = () => resolve(respond(200, [australia]));
          });
        },
      });
      const user = userEvent.setup();
      renderWithClient(<App />);
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
      let getCount = 0;
      const overrides = {
        GET: () => {
          getCount += 1;
          return getCount === 1
            ? respond(200, [australia, france])
            : respond(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } });
        },
        DELETE: () => respond(404, { error: { code: 'NOT_FOUND', message: 'Card not found' } }),
      };
      stubApi([], overrides);
      const user = userEvent.setup();
      renderWithClient(<App />);
      await screen.findByText(france.question);

      await tossCard(user, france.question);
      await user.click(screen.getByRole('button', { name: 'Toss it' }));
      await waitFor(() => expect(getCount).toBe(2));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      expect(screen.getByText(france.question)).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load cards")).not.toBeInTheDocument();
    });
  });
});
