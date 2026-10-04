import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start server + client before the tests. If a dev server is already running,
  // Playwright reuses it (and its real database), so the tests always create their
  // own uniquely named cards and clean up after themselves.
  webServer: [
    {
      command: 'npm run start -w server',
      url: 'http://localhost:3001/api/ping',
      // NODE_ENV=test makes the server use a throwaway in-memory database.
      env: { NODE_ENV: 'test' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -w client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
