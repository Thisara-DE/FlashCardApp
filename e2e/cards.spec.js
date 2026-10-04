import { test, expect } from '@playwright/test';

// Unique per run so the test never collides with cards that already exist.
const q = `E2E question ${Date.now()}`;

test('create, flip, edit and delete a card', async ({ page }) => {
  await page.goto('/');

  // Create
  const createForm = page.getByRole('form', { name: 'Make a card' });
  await createForm.getByLabel(/^Question/).fill(q);
  await createForm.getByLabel(/^Answer/).fill('E2E answer');
  await createForm.getByRole('button', { name: 'Slam it in!' }).click();

  const card = page.getByRole('listitem').filter({ hasText: q });
  // The card face is the only button with aria-pressed (Edit and Toss are plain buttons).
  const face = card.locator('button[aria-pressed]');
  await expect(face).toBeVisible();
  await expect(face).toHaveAttribute('aria-pressed', 'false');

  // Flip
  await face.click();
  await expect(face).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('E2E answer')).toBeVisible();

  // Edit
  await card.getByRole('button', { name: 'Edit' }).click();
  const editForm = card.getByRole('form', { name: 'Fix this card' });
  await editForm.getByLabel(/^Question/).fill(`${q} edited`);
  await editForm.getByRole('button', { name: 'Save' }).click();
  // The form only closes once the PUT has finished, so wait for that before reloading.
  await expect(editForm).toBeHidden();
  await expect(card.getByText(`${q} edited`)).toBeVisible();

  // The edit must survive a reload, i.e. it reached the database.
  await page.reload();
  const editedCard = page.getByRole('listitem').filter({ hasText: `${q} edited` });
  await expect(editedCard).toBeVisible();

  // Escape closes the dialog without deleting.
  await editedCard.getByRole('button', { name: 'Toss' }).click();
  const dialog = page.getByRole('dialog', { name: 'Toss it for real?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editedCard).toBeVisible();

  // Confirm the delete.
  await editedCard.getByRole('button', { name: 'Toss' }).click();
  await dialog.getByRole('button', { name: 'Toss it' }).click();
  // The card only leaves the list after the DELETE succeeded and the list was refetched.
  await expect(editedCard).toHaveCount(0);

  // Still gone after a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The pile' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: q })).toHaveCount(0);
});

test('invalid input is rejected without calling the API', async ({ page }) => {
  const postRequests = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/cards')) {
      postRequests.push(request);
    }
  });

  await page.goto('/');

  const createForm = page.getByRole('form', { name: 'Make a card' });
  await createForm.getByLabel(/^Question/).fill('   ');
  await createForm.getByLabel(/^Answer/).fill('x');
  await createForm.getByRole('button', { name: 'Slam it in!' }).click();

  await expect(createForm.getByText('Question is required')).toBeVisible();
  expect(postRequests).toHaveLength(0);
});
