import { expect, Page, test } from '@playwright/test';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const CREATED = {
  sessionId: SESSION_ID,
  participantId: '3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90',
  participantToken: 'Xb4Rt9LmQ2vN7cZp1HsK0w',
};
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Answer = 'created' | 'abort' | 'error503';

/** Simule le webservice : `/api/health` éveillé, `POST /api/sessions` selon `answer()`. */
async function mockApi(page: Page, answer: () => Answer) {
  const bodies: unknown[] = [];
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  await page.route(`${API}/api/sessions`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS });
    }
    bodies.push(request.postDataJSON());
    switch (answer()) {
      case 'abort':
        return route.abort('connectionrefused');
      case 'error503':
        return route.fulfill({ status: 503, headers: CORS, body: 'Service Unavailable' });
      default:
        return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: JSON.stringify(CREATED) });
    }
  });
  return bodies;
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

test('l\'accueil montre le formulaire d\'entrée : panneau de 400 px, « Je vote » choisi, bouton pleine largeur', async ({ page }) => {
  const check = await watchPage(page);
  await mockApi(page, () => 'created');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const form = page.locator('form.entry-form');
  await expect(form).toBeVisible();
  expect((await form.boundingBox())?.width).toBe(400);
  await expect(page.getByLabel('Ton pseudo')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Ton rôle' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Je vote' })).toBeChecked();
  await expect(page.getByRole('radio', { name: "J'observe" })).not.toBeChecked();

  const submit = page.getByRole('button', { name: 'Créer une session' });
  await expect(submit).toBeDisabled();
  const formBox = (await form.boundingBox())!;
  const submitBox = (await submit.boundingBox())!;
  expect(submitBox.width).toBeCloseTo(formBox.width - 48, 0);
  await check();
});

test('créer une session mène à /s/{id}, avec le jeton et le pseudo enregistrés, et « Copier le lien » copie le lien', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  const check = await watchPage(page);
  const bodies = await mockApi(page, () => 'created');
  await page.goto('/');

  await page.getByLabel('Ton pseudo').fill('  Eric ');
  await page.getByRole('radio', { name: "J'observe" }).click();
  await page.getByLabel('Ton pseudo').press('Enter');

  await expect(page).toHaveURL(`${APP}/s/${SESSION_ID}`);
  expect(bodies).toEqual([{ pseudo: '  Eric ', role: 'OBSERVER' }]);
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBe(CREATED.participantToken);
  expect(await page.evaluate(() => localStorage.getItem('pp.pseudo'))).toBe('Eric');

  const link = `${APP}/s/${SESSION_ID}`;
  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();
  await expect(page.getByText(link, { exact: true })).toBeVisible();
  const inTopBar = page.locator('header.top-bar').getByRole('button', { name: 'Copier le lien' });
  await expect(inTopBar).toBeVisible();

  // Le nom accessible du bouton change avec son libellé : on le désigne par sa place.
  const primary = page.locator('.invite button');
  await expect(primary).toHaveText('Copier le lien');
  await primary.click();
  await expect(primary).toHaveText('Lien copié');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await expect(primary).toHaveText('Copier le lien', { timeout: 4_000 });

  expect(page.url()).not.toContain(CREATED.participantToken);
  await check();
});

test('au retour sur l\'accueil, le dernier pseudo est prérempli', async ({ page }) => {
  const check = await watchPage(page);
  await mockApi(page, () => 'created');
  await page.addInitScript(() => localStorage.setItem('pp.pseudo', 'Eric'));
  await page.goto('/');
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('Eric');
  await expect(page.getByRole('button', { name: 'Créer une session' })).toBeEnabled();
  await check();
});

for (const answer of ['abort', 'error503'] as const) {
  test(`un échec (${answer}) affiche « Impossible de joindre le serveur. », garde la saisie et permet de réessayer`, async ({
    page,
  }) => {
    const check = await watchPage(page);
    let current: Answer = answer;
    await mockApi(page, () => current);
    await page.goto('/');

    await page.getByLabel('Ton pseudo').fill('Sofia');
    await page.getByRole('button', { name: 'Créer une session' }).click();
    await expect(page.getByRole('alert')).toHaveText('Impossible de joindre le serveur.');
    await expect(page.getByLabel('Ton pseudo')).toHaveValue('Sofia');
    await expect(page).toHaveURL(`${APP}/`);

    current = 'created';
    await page.getByRole('button', { name: 'Créer une session' }).click();
    await expect(page).toHaveURL(`${APP}/s/${SESSION_ID}`);
    // Le navigateur journalise lui-même l'échec réseau ou le 503 : seules ces erreurs sont tolérées.
    await check({ allowConsoleErrors: true });
  });
}

test('pendant l\'envoi, le bouton affiche « Connexion… » et le champ reste lisible', async ({ page }) => {
  const check = await watchPage(page);
  await mockApi(page, () => 'created');
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${API}/api/sessions`, async (route) => {
    if (route.request().method() === 'POST') await held;
    return route.fallback();
  });
  await page.goto('/');
  await page.getByLabel('Ton pseudo').fill('Sofia');
  await page.getByRole('button', { name: 'Créer une session' }).click();

  const busy = page.getByRole('button', { name: 'Connexion…' });
  await expect(busy).toBeDisabled();
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('Sofia');
  release();
  await expect(page).toHaveURL(`${APP}/s/${SESSION_ID}`);
  await check();
});
