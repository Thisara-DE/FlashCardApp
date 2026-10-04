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
