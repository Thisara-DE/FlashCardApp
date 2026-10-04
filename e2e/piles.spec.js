import { test, expect } from '@playwright/test';
import { addCard, createPile, deletePileButton, uniqueName } from './helpers.js';

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

test('deleting a pile and keeping its cards moves them to Unsorted', async ({ page }) => {
  const pileName = uniqueName('Keep');
  const question = uniqueName('Kept card?');
  await page.goto('/');
  await createPile(page, pileName);
  await addCard(page, pileName, question);

  await deletePileButton(page).click();
  const dialog = page.getByRole('dialog', { name: `Delete the ${pileName} pile?` });
  await expect(dialog.getByText('It still has 1 card. What should happen to them?')).toBeVisible();
  await dialog.getByRole('button', { name: /^Keep the cards/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: `${pileName} · 1` })).toHaveCount(0);
  // Other tests may have unsorted cards too, so match any count and look for our own card.
  const unsortedTab = page.getByRole('button', { name: /^Unsorted · \d+$/ });
  await unsortedTab.click();
  await expect(page.getByRole('heading', { name: 'Unsorted', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: question })).toBeVisible();
});

test('deleting a pile and its cards removes them for good', async ({ page }) => {
  const pileName = uniqueName('Delete');
  const question = uniqueName('Doomed card?');
  await page.goto('/');
  await createPile(page, pileName);
  await addCard(page, pileName, question);

  await deletePileButton(page).click();
  const dialog = page.getByRole('dialog', { name: `Delete the ${pileName} pile?` });
  await expect(dialog.getByText('That card is gone for good. No take-backs.')).toBeVisible();
  await dialog.getByRole('button', { name: /^Delete the cards too/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: `${pileName} · 1` })).toHaveCount(0);
  // The card did not go to Unsorted. Ask the API, since an Unsorted tab may exist for other tests' cards.
  const response = await page.request.get('/api/cards?pileId=unsorted');
  expect(response.ok()).toBe(true);
  const unsortedQuestions = (await response.json()).map((card) => card.question);
  expect(unsortedQuestions).not.toContain(question);
});
