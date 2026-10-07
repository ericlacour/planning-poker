import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, test } from '@playwright/test';

import { aloneSnapshot, fakeSessionSocket } from './fake-session-socket';

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

/**
 * Simule le webservice : `/api/health` éveillé, `POST /api/sessions` selon `answer()`, et toute session existante
 * (`GET /api/sessions/{id}` → 204).
 */
async function mockApi(page: Page, answer: () => Answer) {
  const bodies: unknown[] = [];
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  // Story 1.4 : la page du lien vérifie d'abord que la session existe.
  await page.route(`${API}/api/sessions/*`, (route) => route.fulfill({ status: 204, headers: CORS }));
  // Story 1.5 : la page de session ouvre le WebSocket ; le créateur y est seul.
  await fakeSessionSocket(page, SESSION_ID, (ws) =>
    ws.send(JSON.stringify(aloneSnapshot(CREATED.participantId, 'Eric', 'OBSERVER'))),
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
  browserName,
}) => {
  // WebKit (CI) ne connaît pas les permissions de presse-papiers de Playwright : la copie est lue sur Chromium seul.
  const clipboard = browserName === 'chromium';
  if (clipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
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
  const primary = page.locator('.invite .copy-link');
  await expect(primary).toHaveText('Copier le lien');
  if (clipboard) {
    await primary.click();
    await expect(primary).toHaveText('Lien copié');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await expect(primary).toHaveText('Copier le lien', { timeout: 4_000 });
  }

  expect(page.url()).not.toContain(CREATED.participantToken);
  await check();
});

/** Crée une session (thème forcé) et arrive sur la Session vide. */
async function openEmptySession(page: Page, theme: 'light' | 'dark' = 'light') {
  const check = await watchPage(page);
  await mockApi(page, () => 'created');
  await page.addInitScript((t) => localStorage.setItem('pp.theme', t), theme);
  await page.goto('/');
  await page.getByLabel('Ton pseudo').fill('Eric');
  await page.getByRole('button', { name: 'Créer une session' }).click();
  await expect(page).toHaveURL(`${APP}/s/${SESSION_ID}`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  return check;
}

/** Le panneau tient dans la largeur de la fenêtre, et son QR code y est visible en entier. */
async function expectInViewport(page: Page, panel: Locator) {
  const box = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  // Déplié en entier à l'écran, la zone de la table défilant si besoin.
  await expect(panel.getByRole('img')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

for (const theme of ['light', 'dark'] as const) {
  test(`« QR code » déplie un panneau non modal et accessible avec le QR code du lien, noir sur blanc (thème ${theme})`, async ({
    page,
  }) => {
    const check = await openEmptySession(page, theme);
    const link = `${APP}/s/${SESSION_ID}`;
    // Juste après « Copier le lien », dans la barre du haut comme dans la Session vide, toujours secondaire.
    await expect(page.locator('header.top-bar app-copy-link + app-qr-code-button')).toHaveCount(1);
    await expect(page.locator('.invite app-copy-link + app-qr-code-button')).toHaveCount(1);
    await expect(page.locator('header.top-bar').getByRole('button', { name: 'QR code' })).toBeVisible();
    const opener = page.locator('.invite').getByRole('button', { name: 'QR code' });
    await expect(opener).toHaveClass(/btn-secondary/);
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await opener.click();

    const panel = page.getByRole('group', { name: 'QR code de la session' });
    await expect(panel).toBeVisible();
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await expect(opener).toHaveAttribute('aria-controls', (await panel.getAttribute('id'))!);
    await expect(page.locator('dialog')).toHaveCount(0);
    const qr = panel.getByRole('img', { name: 'QR code du lien de la session' });
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute('viewBox', '0 0 41 41'); // version 4 (33 modules) + 2 × 4 de marge
    await expect(panel.getByText(link, { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Fermer' })).toBeVisible();
    expect(await qr.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await qr.locator('path').evaluate((e) => getComputedStyle(e).fill)).toBe('rgb(0, 0, 0)');
    const size = (await qr.boundingBox())!;
    expect(size.width).toBeLessThanOrEqual(240);
    expect(size.width).toBeCloseTo(size.height, 0);
    // Sous le bouton.
    const openerBox = (await opener.boundingBox())!;
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(openerBox.y + openerBox.height);
    await expectInViewport(page, panel);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Échap referme et rend le focus au bouton.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();

    // « Fermer » aussi.
    await opener.click();
    await panel.getByRole('button', { name: 'Fermer' }).click();
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();

    // Un nouveau clic sur le bouton aussi.
    await opener.click();
    await expect(panel).toBeVisible();
    await opener.click();
    await expect(panel).toBeHidden();

    // Depuis la barre du haut, un clic ailleurs le referme ; la page reste utilisable pendant ce temps.
    const inTopBar = page.locator('header.top-bar').getByRole('button', { name: 'QR code' });
    await inTopBar.click();
    await expect(panel).toBeVisible();
    await expectInViewport(page, panel);
    await page.getByText('Partage le lien pour inviter ton équipe').click();
    await expect(panel).toBeHidden();
    await expect(inTopBar).not.toBeFocused();
    await check();
  });
}

test('téléphone 360 px : le panneau QR code reste dans l\'écran, depuis la barre du haut comme depuis la Session vide', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const check = await openEmptySession(page);
  const panel = page.getByRole('group', { name: 'QR code de la session' });

  const inTopBar = page.locator('header.top-bar').getByRole('button', { name: 'QR code' });
  await expect(inTopBar).toBeVisible();
  expect((await inTopBar.boundingBox())!.width).toBeLessThan(60); // icône seule, libellé accessible conservé
  await inTopBar.click();
  await expect(panel).toBeVisible();
  await expectInViewport(page, panel);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  await page.locator('.invite').getByRole('button', { name: 'QR code' }).click();
  await expect(panel).toBeVisible();
  await expectInViewport(page, panel);
  await expect(panel.getByRole('img', { name: 'QR code du lien de la session' })).toBeVisible();
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
