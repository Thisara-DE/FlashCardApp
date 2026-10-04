import { defineConfig, devices } from '@playwright/test';

// e2e gets its own ports (not the dev ports 3001/5173) so it can never reuse a running
// `npm run dev` and write test cards into the real flashcards.db.
const API_PORT = 3101;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Why only 2 workers: with 4 or more browsers starting at once, some page loads on this machine
  // stall (requests to Vite and to Google Fonts hang until the 30 s timeout), while Vite itself
  // still answers instantly. 3 browsers never stalled in our measurements; 2 leaves a margin.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /no-piles\.spec\.js/ },
    // Deletes every pile, so it must not run alongside the other tests on the shared database.
    {
      name: 'destructive',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /no-piles\.spec\.js/,
      dependencies: ['chromium'],
    },
  ],
  // Start our own server + client for the tests and never reuse one that is already running
  // (reuse could silently point the tests at a dev server and its real database). Each run
  // starts fresh; the tests create their own uniquely named cards and clean up after themselves.
  webServer: [
    {
      command: 'npm run start -w server',
      url: `http://localhost:${API_PORT}/api/ping`,
      // NODE_ENV=test makes the server use a throwaway in-memory database.
      env: { NODE_ENV: 'test', PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
    {
      // --strictPort fails loudly instead of quietly moving to another port.
      command: `npm run dev -w client -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      // Point Vite's /api proxy at the e2e server instead of the dev server.
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
