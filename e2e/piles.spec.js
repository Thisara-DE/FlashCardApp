import { test, expect } from '@playwright/test';
import { createPile, uniqueName } from './helpers.js';

test('a card made in a pile shows only in that pile', async ({ page }) => {
  const pileA = uniqueName('Pile A');
  const pileB = uniqueName('Pile B');
  const question = uniqueName('Only in A?');
  await page.goto('/');
  await createPile(page, pileB);
  await createPile(page, pileA);

  // Add a card to A from its "New ‹A› card" button.
  await page.getByRole('button', { name: `New ${pileA} card` }).click();
  const form = page.getByRole('form', { name: `New ${pileA} card` });
  await form.getByLabel(/^Question/).fill(question);
  await form.getByLabel(/^Answer/).fill('Yes');
  await form.getByRole('button', { name: 'Slam it in!' }).click();

  const card = page.getByRole('listitem').filter({ hasText: question });
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: `${pileA} · 1` })).toBeVisible();

  // Pile B does not have it.
  await page.getByRole('button', { name: `${pileB} · 0` }).click();
  await expect(page.getByRole('heading', { name: pileB, exact: true })).toBeVisible();
  await expect(page.getByText(`No cards in ${pileB} yet — make your first one!`)).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button', { name: `${pileA} · 1` })).toBeVisible();
});
