import { defineConfig, devices, Project } from '@playwright/test';

/**
 * Parcours UJ-1 à UJ-3 de bout en bout (story 3.6) : le front construit (`npm run build:e2e` avec
 * API_BASE_URL=http://127.0.0.1:4310) contre le vrai webservice (`backend/target/planning-poker.jar`, construit par
 * `./mvnw -B package -DskipTests`). Aucune interception REST : seul un mandataire WebSocket coupe et rétablit la
 * connexion d'une page (`e2e-journeys/journey-helpers.ts`). La suite simulée reste dans `playwright.config.ts`.
 *
 * WebKit : toujours en CI ; en local seulement avec `PLAYWRIGHT_WEBKIT=1`, comme la suite simulée.
 */
const withWebkit = !!process.env['CI'] || process.env['PLAYWRIGHT_WEBKIT'] === '1';
const webkit: Project[] = withWebkit
  ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
  : [];

/** Java 25 : celui de `JAVA_HOME` s'il est défini, sinon celui du `PATH`. */
const java = process.env['JAVA_HOME'] ? `"${process.env['JAVA_HOME']}/bin/java"` : 'java';

export default defineConfig({
  testDir: 'e2e-journeys',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // Un parcours fait vivre plusieurs contextes, des coupures réelles et un onglet caché plus de 15 s.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Facultatif : un Chromium déjà installé (poste sans `npx playwright install`).
        launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] || undefined },
      },
    },
    ...webkit,
  ],
  webServer: [
    {
      // Plafonds de création relevés : les parcours des deux navigateurs créent leurs sessions en parallèle.
      command: `${java} -jar ../backend/target/planning-poker.jar --planning-poker.max-creations-per-ip=1000 --planning-poker.max-sessions=1000`,
      url: 'http://127.0.0.1:4310/api/health',
      env: { PORT: '4310', ALLOWED_ORIGINS: 'http://127.0.0.1:4300' },
      timeout: 120_000,
      // Toujours un webservice neuf : un serveur déjà lancé n'aurait ni les plafonds relevés ni ALLOWED_ORIGINS.
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'node scripts/serve-dist.mjs',
      url: 'http://127.0.0.1:4300/config.json',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
