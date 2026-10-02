import { expect, Page, test } from '@playwright/test';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const LINK = `${APP}/s/${SESSION_ID}`;
const JOINED = { participantId: '7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45', participantToken: 'pQ7wE3rT5yU1iO9aS2dF4g' };
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const problem = (status: number, title: string, detail: string, path: string, code: string) =>
  JSON.stringify({ type: 'about:blank', title, status, detail, instance: path, code });

type CheckAnswer = 'exists' | 'notFound' | 'abort';
type JoinAnswer = 'joined' | 'pseudoTaken' | 'notFound' | 'abort';

/**
 * Simule le webservice : `/api/health` éveillé, `GET /api/sessions/{id}` selon `check()`,
 * `POST /api/sessions/{id}/participants` selon `join()`.
 */
async function mockApi(page: Page, check: () => CheckAnswer, join: () => JoinAnswer = () => 'joined') {
  const calls = { checks: 0, joins: [] as unknown[] };
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.checks++;
    switch (check()) {
      case 'abort':
        return route.abort('connectionrefused');
      case 'notFound':
        return route.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          headers: CORS,
          body: problem(404, 'Not Found', 'Session not found.', `/api/sessions/${SESSION_ID}`, 'SESSION_NOT_FOUND'),
        });
      default:
        return route.fulfill({ status: 204, headers: CORS });
    }
  });
  await page.route(`${API}/api/sessions/${SESSION_ID}/participants`, (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.joins.push(request.postDataJSON());
    const path = `/api/sessions/${SESSION_ID}/participants`;
    switch (join()) {
      case 'abort':
        return route.abort('connectionrefused');
      case 'pseudoTaken':
        return route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          headers: CORS,
          body: problem(409, 'Conflict', 'Pseudo already taken in this session.', path, 'PSEUDO_TAKEN'),
        });
      case 'notFound':
        return route.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          headers: CORS,
          body: problem(404, 'Not Found', 'Session not found.', path, 'SESSION_NOT_FOUND'),
        });
      default:
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(JOINED) });
    }
  });
  return calls;
}

/** Relève les violations de CSP, les erreurs de console et les requêtes vers une autre origine. */
async function watchPage(page: Page) {
  const thirdParty: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== APP && origin !== API) thirdParty.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return async ({ allowConsoleErrors = false } = {}) => {
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
    expect(thirdParty).toEqual([]);
    if (!allowConsoleErrors) expect(consoleErrors).toEqual([]);
  };
}

test('un lien mort affiche « Session introuvable », efface le jeton et « Créer une session » mène à l\'accueil', async ({
  page,
}) => {
  const check = await watchPage(page);
  await mockApi(page, () => 'notFound');
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(`pp.token.${id}`, 'oldTokenOldTokenOldTok');
      sessionStorage.setItem('seeded', '1');
    }
  }, SESSION_ID);
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByRole('heading', { name: "Cette session n'existe plus." })).toBeVisible();
  await expect(page.getByText('Elle a peut-être expiré, ou le serveur a redémarré.')).toBeVisible();
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBeNull();
  await expect(page.locator('main').getByRole('button')).toHaveCount(1);

  await page.getByRole('button', { name: 'Créer une session' }).click();
  await expect(page).toHaveURL(`${APP}/`);
  await expect(page.getByRole('button', { name: 'Créer une session' })).toBeVisible();
  await expect(page.getByLabel('Ton pseudo')).toBeVisible();
  // Le navigateur journalise lui-même la réponse 404 : seule cette erreur est tolérée.
  await check({ allowConsoleErrors: true });
});

test('rejoindre par le lien : formulaire « Rejoindre », « Je vote » choisi, puis page de session sans recharger', async ({
  page,
}) => {
  const check = await watchPage(page);
  const calls = await mockApi(page, () => 'exists');
  await page.addInitScript(() => localStorage.setItem('pp.pseudo', 'Sofia'));
  await page.goto(`/s/${SESSION_ID}`);

  const submit = page.getByRole('button', { name: 'Rejoindre' });
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('Sofia');
  await expect(page.getByRole('radio', { name: 'Je vote' })).toBeChecked();
  await expect(page.getByRole('radio', { name: "J'observe" })).not.toBeChecked();

  await page.getByLabel('Ton pseudo').fill('  Bob ');
  await page.evaluate(() => ((window as unknown as { notReloaded: boolean }).notReloaded = true));
  await submit.click();

  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();
  await expect(page.getByText(LINK, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(LINK);
  expect(await page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded)).toBe(true);
  expect(calls.joins).toEqual([{ pseudo: '  Bob ', role: 'VOTER' }]);
  expect(calls.checks).toBe(1);
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBe(JOINED.participantToken);
  expect(await page.evaluate(() => localStorage.getItem('pp.pseudo'))).toBe('Bob');
  expect(page.url()).not.toContain(JOINED.participantToken);
  await check();
});

test('un pseudo déjà pris affiche le message sous le champ, garde la saisie et permet de réessayer', async ({ page }) => {
  const check = await watchPage(page);
  let joinAnswer: JoinAnswer = 'pseudoTaken';
  await mockApi(page, () => 'exists', () => joinAnswer);
  await page.goto(`/s/${SESSION_ID}`);

  await page.getByLabel('Ton pseudo').fill('SOFIA');
  await page.getByLabel('Ton pseudo').press('Enter');

  await expect(page.locator('#entry-pseudo-error')).toHaveText('Ce pseudo est déjà pris dans cette session.');
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('SOFIA');
  await expect(page.getByLabel('Ton pseudo')).toHaveAttribute('aria-invalid', 'true');
  const submit = page.getByRole('button', { name: 'Rejoindre' });
  await expect(submit).toBeEnabled();
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBeNull();

  joinAnswer = 'joined';
  await page.getByLabel('Ton pseudo').fill('Sofia 2');
  await submit.click();
  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();
  // Le navigateur journalise lui-même la réponse 409 : seule cette erreur est tolérée.
  await check({ allowConsoleErrors: true });
});

test('déjà membre (jeton rangé) : la page de session s\'ouvre directement', async ({ page }) => {
  const check = await watchPage(page);
  const calls = await mockApi(page, () => 'exists');
  await page.addInitScript((id) => localStorage.setItem(`pp.token.${id}`, 'Xb4Rt9LmQ2vN7cZp1HsK0w'), SESSION_ID);
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejoindre' })).toHaveCount(0);
  expect(calls.checks).toBe(1);
  expect(calls.joins).toEqual([]);
  await check();
});

test('un échec réseau de la vérification affiche « Impossible de joindre le serveur. » et « Réessayer » la relance', async ({
  page,
}) => {
  const check = await watchPage(page);
  let checkAnswer: CheckAnswer = 'abort';
  const calls = await mockApi(page, () => checkAnswer);
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByRole('heading', { name: 'Impossible de joindre le serveur.' })).toBeVisible();
  checkAnswer = 'exists';
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
  expect(calls.checks).toBe(2);
  // Le navigateur journalise lui-même l'échec réseau : seule cette erreur est tolérée.
  await check({ allowConsoleErrors: true });
});

test('un échec réseau en rejoignant affiche « Impossible de joindre le serveur. » sous le bouton', async ({ page }) => {
  const check = await watchPage(page);
  await mockApi(page, () => 'exists', () => 'abort');
  await page.goto(`/s/${SESSION_ID}`);
  await page.getByLabel('Ton pseudo').fill('Bob');
  await page.getByRole('button', { name: 'Rejoindre' }).click();
  await expect(page.locator('.submit-error')).toHaveText('Impossible de joindre le serveur.');
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('Bob');
  await check({ allowConsoleErrors: true });
});
