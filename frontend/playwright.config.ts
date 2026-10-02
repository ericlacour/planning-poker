import { defineConfig, devices } from '@playwright/test';

/**
 * E2E du front construit (`npm run build:e2e` avec API_BASE_URL=http://127.0.0.1:4310) : le webservice est
 * simulé par interception réseau, ce qui laisse la CSP du index.html construit s'appliquer réellement.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4300' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Facultatif : un Chromium déjà installé (poste sans `npx playwright install`).
        launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined },
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4300/config.json',
    reuseExistingServer: !process.env['CI'],
  },
});
