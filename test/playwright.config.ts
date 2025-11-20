import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for UI-based portal integration tests
 * Tests interact with the frontend UI like a real user would
 */
export default defineConfig({
  testDir: './ui-tests',
  fullyParallel: false, // Run tests serially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run one test at a time
  reporter: 'html',
  use: {
    baseURL: process.env.FRONTEND_URL || 'https://www.aividahealth.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'echo "Frontend should be accessible at https://www.aividahealth.ai"',
    url: process.env.FRONTEND_URL || 'https://www.aividahealth.ai',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

