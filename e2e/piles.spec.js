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

test('deleting a pile keeps its cards in Unsorted, and Move to… moves them into a pile', async ({ page }) => {
  const pileName = uniqueName('Keep');
  const targetName = uniqueName('Target');
  const question = uniqueName('Kept card?');
  await page.goto('/');
  await createPile(page, targetName);
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
  const card = page.getByRole('listitem').filter({ hasText: question });
  await expect(card).toBeVisible();

  // Press and hold the card (400 ms) to select it.
  const face = card.getByRole('button', { name: question });
  await face.hover();
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await expect(face).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Move to…').selectOption({ label: targetName });
  await page.getByRole('button', { name: 'Move', exact: true }).click();

  await expect(page.getByText(`Moved 1 card to ${targetName}`)).toBeAttached();
  await expect(page.getByRole('button', { name: `${targetName} · 1` })).toBeVisible();
  // Other tests may have left their own cards in Unsorted, so the Unsorted tab can stay. Check that
  // our card left Unsorted by asking the API rather than by the tab disappearing.
  const response = await page.request.get('/api/cards?pileId=unsorted');
  expect(response.ok()).toBe(true);
  const unsortedQuestions = (await response.json()).map((unsorted) => unsorted.question);
  expect(unsortedQuestions).not.toContain(question);

  await page.getByRole('button', { name: `${targetName} · 1` }).click();
  await expect(page.getByRole('heading', { name: targetName, exact: true })).toBeVisible();
  await expect(card).toBeVisible();
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
