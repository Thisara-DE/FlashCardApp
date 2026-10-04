import { test, expect } from '@playwright/test';

test('home page shows the app title', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /flash card app/i }),
  ).toBeVisible();
});

test('API ping is reachable through the Vite proxy', async ({ request }) => {
  const res = await request.get('/api/ping');

  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ message: 'pong' });
});
