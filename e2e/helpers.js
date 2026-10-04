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

// The selected pile's "Delete pile" button. Scoped to <main>, because the empty-pile
// confirm dialog has a button with the same name.
export function deletePileButton(page) {
  return page.getByRole('main').getByRole('button', { name: 'Delete pile', exact: true });
}
