import { test, expect } from '@playwright/test';
import {
  addCard,
  centreOf,
  createPile,
  deletePileButton,
  pressAndHold,
  uniqueName,
  waitForDragToSettle,
} from './helpers.js';

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

test('two held cards can be dragged onto another pile tab', async ({ page }) => {
  // Tall enough to see the tabs and the cards at once: a drag can't reach a tab that is off screen,
  // and the other tests' piles can wrap the tab row onto several lines.
  await page.setViewportSize({ width: 1280, height: 1200 });
  const pileA = uniqueName('Drag A');
  const pileB = uniqueName('Drag B');
  const question1 = uniqueName('Drag one?');
  const question2 = uniqueName('Drag two?');
  await page.goto('/');
  await createPile(page, pileB);
  await createPile(page, pileA);
  await addCard(page, pileA, question1);
  // The form stays open after a save, so type the second card straight into it.
  const form = page.getByRole('form', { name: `New ${pileA} card` });
  await form.getByLabel(/^Question/).fill(question2);
  await form.getByLabel(/^Answer/).fill('Another answer');
  await form.getByRole('button', { name: 'Slam it in!' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: question2 })).toBeVisible();
  await expect(page.getByRole('button', { name: `${pileA} · 2` })).toBeVisible();
  // Close the form, so the cards don't jump up when selecting hides it.
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(form).toHaveCount(0);

  // Press and hold card 1 (400 ms) to select it.
  const face1 = page.getByRole('listitem').filter({ hasText: question1 }).getByRole('button', { name: question1 });
  await pressAndHold(page, face1);
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();

  // Hold card 2, then drag it (and the rest of the selection) onto tab B.
  const face2 = page.getByRole('listitem').filter({ hasText: question2 }).getByRole('button', { name: question2 });
  const tabB = page.getByRole('button', { name: `${pileB} · 0` });
  // Scroll to the top, then check both are fully on screen before measuring either, so neither
  // measurement scrolls the page (centreOf scrolls only what is off screen). At the very top,
  // dnd-kit's auto-scroll can't move the page while the pointer rests on a tab near the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(face2).toBeInViewport({ ratio: 1 });
  await expect(tabB).toBeInViewport({ ratio: 1 });
  const start = await centreOf(face2);
  const target = await centreOf(tabB);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(450);
  // Still holding: wait for the drag to start (the "2 cards" ghost). Moving more than 8 px before
  // that would cancel the hold, and on a busy machine the page's 400 ms timer can run late.
  await expect(page.getByText('2 cards', { exact: true })).toBeVisible();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await expect(page.getByRole('button', { name: `Drop into ${pileB} · 0` })).toBeVisible();
  await page.mouse.up();
  await waitForDragToSettle(page);

  await expect(page.getByRole('button', { name: `${pileA} · 0` })).toBeVisible();
  await expect(page.getByRole('button', { name: `${pileB} · 2` })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: `Moved 2 cards to ${pileB}` })).toBeAttached();

  await page.getByRole('button', { name: `${pileB} · 2` }).click();
  await expect(page.getByRole('heading', { name: pileB, exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: question1 })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: question2 })).toBeVisible();
});

test('deleting a pile keeps its cards in General, and Move to… moves them into a pile', async ({ page }) => {
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
  // Other tests may have cards in General too, so match any count and look for our own card.
  const generalTab = page.getByRole('button', { name: /^General · \d+$/ });
  await generalTab.click();
  await expect(page.getByRole('heading', { name: 'General', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Unsorted/ })).toHaveCount(0);
  const card = page.getByRole('listitem').filter({ hasText: question });
  await expect(card).toBeVisible();

  // Press and hold the card (400 ms) to select it.
  const face = card.getByRole('button', { name: question });
  await pressAndHold(page, face);
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await expect(face).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Move to…').selectOption({ label: targetName });
  await page.getByRole('button', { name: 'Move', exact: true }).click();

  await expect(page.getByText(`Moved 1 card to ${targetName}`)).toBeAttached();
  await expect(page.getByRole('button', { name: `${targetName} · 1` })).toBeVisible();

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
