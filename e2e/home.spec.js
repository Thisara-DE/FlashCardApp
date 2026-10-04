import { test, expect } from '@playwright/test';

test('home page shows the BrainCramBam title', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /brain\s*cram\s*bam/i }),
  ).toBeVisible();
});

test('API ping is reachable through the Vite proxy', async ({ request }) => {
  const res = await request.get('/api/ping');

  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ message: 'pong' });
});
