import { expect } from '@playwright/test';

// The e2e tests run in parallel against one shared database, so every test makes its own
// uniquely named piles instead of relying on the seeded ones (whose counts other tests change).
// Prefixes of up to 20 characters keep the name within the 40-character pile name limit.
export function uniqueName(prefix) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Creates a pile from the tab row and waits until it is the selected pile.
export async function createPile(page, name) {
  await page.getByRole('button', { name: '+ New pile' }).click();
  await page.getByLabel('New pile name').fill(name);
  await page.getByRole('button', { name: 'Add pile' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

// Adds a card to the selected pile from its "New ‹Name› card" button and waits until it is listed.
export async function addCard(page, pileName, question, answer = 'An answer') {
  await page.getByRole('button', { name: `New ${pileName} card` }).click();
  const form = page.getByRole('form', { name: `New ${pileName} card` });
  await form.getByLabel(/^Question/).fill(question);
  await form.getByLabel(/^Answer/).fill(answer);
  await form.getByRole('button', { name: 'Slam it in!' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: question })).toBeVisible();
}

// The centre of an element in viewport coordinates, for driving the mouse by hand.
// page.mouse never scrolls, so scroll the element into view first: with many piles in the shared
// database the tab row wraps, and a card can sit below the bottom of the window.
export async function centreOf(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A press and hold also starts a dnd-kit drag (both wait the same 400 ms). When that drag ends,
// dnd-kit swallows every click on the page for the next 50 ms (a `setTimeout(…, 50)`), so the
// click that ends the hold can't count as a click. A person never clicks again that fast; a test
// does. A 50 ms timer started in the page now is due after dnd-kit's, so once it has fired,
// clicks work again. (A wait in the test process could finish first on a busy machine.)
export async function waitForDragToSettle(page) {
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
}

// Presses and holds a card face (400 ms selects it), then lets go.
export async function pressAndHold(page, face) {
  const { x, y } = await centreOf(face);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  // Still holding: wait until the card shows as selected. On a busy machine the page's 400 ms
  // timer can run late, and letting go before it fires would cancel the hold.
  await expect(face).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await waitForDragToSettle(page);
}

// The selected pile's "Delete pile" button. Scoped to <main>, because the empty-pile
// confirm dialog has a button with the same name.
export function deletePileButton(page) {
  return page.getByRole('main').getByRole('button', { name: 'Delete pile', exact: true });
}
