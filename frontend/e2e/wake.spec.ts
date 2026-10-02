import { expect, Page, test } from '@playwright/test';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';

/** Simule /api/health : `healthy()` décide de la réponse à chaque appel. */
async function mockHealth(page: Page, healthy: () => boolean) {
  await page.route(`${API}/api/health`, (route) =>
    healthy()
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"UP"}' })
      : route.fulfill({ status: 503, body: 'Service Unavailable' }),
  );
}

/** Relève les violations de CSP et les requêtes vers une autre origine que le site ou le webservice. */
async function watchSecurity(page: Page) {
  const thirdParty: string[] = [];
  page.on('request', (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== APP && origin !== API) thirdParty.push(request.url());
  });
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return async () => {
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
    expect(thirdParty).toEqual([]);
  };
}

test('un serveur éveillé mène directement à l\'accueil, sans écran de réveil', async ({ page }) => {
  const checkSecurity = await watchSecurity(page);
  await mockHealth(page, () => true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible();
  await expect(page.getByText('Réveil du serveur…')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await checkSecurity();
});

test('un serveur endormi affiche l\'écran de réveil, puis l\'accueil dès son réveil', async ({ page }) => {
  const checkSecurity = await watchSecurity(page);
  let awake = false;
  await mockHealth(page, () => awake);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Réveil du serveur…' })).toBeVisible();
  await expect(page.getByText("Ça peut prendre jusqu'à 2 minutes.")).toBeVisible();
  await expect(page.locator('.deck .card-back')).toHaveCount(3);
  awake = true;
  await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible({ timeout: 10_000 });
  await checkSecurity();
});

test('au-delà de 3 minutes, « Le serveur ne répond pas. », puis « Réessayer » relance l\'attente', async ({ page }) => {
  const checkSecurity = await watchSecurity(page);
  await page.clock.install();
  let awake = false;
  await mockHealth(page, () => awake);
  await page.goto('/');
  await page.clock.runFor(2_000);
  await expect(page.getByRole('heading', { name: 'Réveil du serveur…' })).toBeVisible();
  await page.clock.runFor(180_000);
  await expect(page.getByRole('heading', { name: 'Le serveur ne répond pas.' })).toBeVisible();

  awake = true;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible();
  await checkSecurity();
});

test.describe('avec prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('les dos de carte du réveil ne bougent pas', async ({ page }) => {
    await mockHealth(page, () => false);
    await page.goto('/');
    const card = page.locator('.deck .card-back').first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

test('sans prefers-reduced-motion, les dos de carte sont animés', async ({ page }) => {
  await mockHealth(page, () => false);
  await page.goto('/');
  const card = page.locator('.deck .card-back').first();
  await expect(card).toBeVisible();
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe('shuffle-left');
});

test('la CSP du index.html construit bloque bien un style injecté en ligne', async ({ page }) => {
  await watchSecurity(page);
  await mockHealth(page, () => true);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible();
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body { color: red; }';
    document.head.append(style);
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations.length))
    .toBeGreaterThan(0);
});

test('sans config.json lisible, l\'écran « Le serveur ne répond pas. » s\'affiche au lieu d\'une page blanche', async ({ page }) => {
  const checkSecurity = await watchSecurity(page);
  await page.route(`${APP}/config.json`, (route) => route.fulfill({ status: 404, body: 'Not Found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Le serveur ne répond pas.');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await checkSecurity();
});
