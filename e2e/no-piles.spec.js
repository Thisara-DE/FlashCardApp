import { test, expect } from '@playwright/test';
import { deletePileButton, uniqueName } from './helpers.js';

// This test deletes every pile in the shared database, so playwright.config.js runs it in its
// own "destructive" project, after all the other tests have finished.

// A safety net so a bug can never turn the loop below into an endless one.
const MAX_PILES_TO_DELETE = 100;

test('deleting every pile shows Start with a pile, and a new pile gets its tab', async ({ page }) => {
  await page.goto('/');
  const startHeading = page.getByRole('heading', { name: 'Start with a pile' });
  // Wait for the piles to load: either a pile is shown or there are none at all.
  await expect(deletePileButton(page).or(startHeading)).toBeVisible();

  for (let deleted = 0; await deletePileButton(page).isVisible(); deleted += 1) {
    expect(deleted).toBeLessThan(MAX_PILES_TO_DELETE);
    await deletePileButton(page).click();

    // A pile with cards asks what to do with them; an empty pile gets the simple confirm.
    const dialog = page.getByRole('dialog');
    const deleteCardsToo = dialog.getByRole('button', { name: /^Delete the cards too/ });
    const confirmDelete = dialog.getByRole('button', { name: 'Delete pile', exact: true });
    await deleteCardsToo.or(confirmDelete).click();
    // The dialog closes only after the piles were refetched, so the next pile is already on screen.
    await expect(dialog).toBeHidden();
  }

  await expect(startHeading).toBeVisible();
  await expect(page.getByText('0 piles', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Piles' })).toHaveCount(0);

  const pileName = uniqueName('Fresh start');
  await page.getByLabel('Pile name').fill(pileName);
  await page.getByRole('button', { name: 'Make the pile' }).click();

  await expect(page.getByRole('button', { name: `${pileName} · 0` })).toBeVisible();
  await expect(page.getByRole('heading', { name: pileName, exact: true })).toBeVisible();
});
