import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { aloneSnapshot, fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const EMMA = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Webservice simulé : éveillé, session existante ; jeton rangé pour la session. */
async function openWithToken(page: Page) {
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => route.fulfill({ status: 204, headers: CORS }));
  await page.addInitScript(
    ([id, token]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(`pp.token.${id}`, token);
        localStorage.setItem('pp.pseudo', 'Emma');
        sessionStorage.setItem('seeded', '1');
      }
    },
    [SESSION_ID, TOKEN],
  );
}

/** Relève les violations de CSP et les erreurs de console. */
async function watchPage(page: Page) {
  const consoleErrors: string[] = [];
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
  return async () => {
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
}

const seatNames = (page: Page) => page.locator('.seat .seat-who');

test('la table en direct : votants d\'abord, ma place en tête des observateurs avec « (toi) », mise à jour sans recharger', async ({
  page,
}) => {
  const check = await watchPage(page);
  await openWithToken(page);
  // Vu par Emma (observatrice) : Alice, Bob, Chloé, David votants ; Emma observatrice.
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) =>
    ws.send(JSON.stringify({ ...hiddenRound, selfParticipantId: EMMA })),
  );
  await page.goto(`/s/${SESSION_ID}`);

  await expect(seatNames(page)).toHaveText(['Alice', 'Bob', 'Chloé', 'David', 'Emma (toi)']);
  expect(server.received).toEqual([{ type: 'hello', participantToken: TOKEN }]);
  expect(page.url()).not.toContain(TOKEN);
  await expect(page.locator('.seat').nth(4).locator('.seat-card-observer')).toHaveText('observe');
  // Alice, Bob et David ont voté (dos), Chloé non (carte vide).
  await expect(page.locator('.seat .seat-card-back')).toHaveCount(3);
  await expect(page.locator('.seat .seat-card-empty')).toHaveCount(1);
  await expect(page.locator('.seat').nth(3).locator('.presence-dot')).toHaveClass(/presence-offline/);
  await expect(page.locator('.seat').nth(0).locator('.presence-dot')).toHaveClass(/presence-online/);
  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toHaveCount(0);

  // Un nouvel instantané remplace la table ; une version inférieure est ignorée.
  const ws = server.routes[0];
  const farid = { ...hiddenRound.participants[4], participantId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', pseudo: 'Farid', joinOrder: 6 };
  ws.send(JSON.stringify({ ...hiddenRound, selfParticipantId: EMMA, version: 8, participants: [...hiddenRound.participants, farid] }));
  await expect(seatNames(page)).toHaveText(['Alice', 'Bob', 'Chloé', 'David', 'Emma (toi)', 'Farid']);
  ws.send(JSON.stringify({ ...hiddenRound, selfParticipantId: EMMA, version: 7, participants: [] }));
  await page.waitForTimeout(200);
  await expect(seatNames(page)).toHaveCount(6);

  // Une coupure (hors 4401/4404) laisse la dernière table affichée et rejoue hello sur une nouvelle connexion
  // (story 2.2) ; son premier instantané fait foi, quelle que soit sa version.
  await ws.close({ code: 1011, reason: '' });
  await expect.poll(() => server.routes.length).toBe(2);
  await expect(seatNames(page)).toHaveText(['Alice', 'Bob', 'Chloé', 'David', 'Emma (toi)']);
  expect(server.received.filter((m) => (m as { type: string }).type === 'hello')).toHaveLength(2);
  await check();
});

test('avant le premier instantané : places vides en attente, sans pseudo ni sablier plein écran', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  await fakeSessionSocket(page, SESSION_ID, () => undefined);
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.locator('.seat-pending').first()).toBeVisible();
  await expect(page.locator('.seat-pending .seat-who')).toHaveText(['', '', '']);
  await expect(page.locator('header.top-bar')).toBeVisible();
  await expect(page.locator('main.state-screen')).toHaveCount(0);
  await check();
});

test('seul dans la session : « Partage le lien pour inviter ton équipe » et « Copier le lien » en bouton principal', async ({
  page,
}) => {
  const check = await watchPage(page);
  await openWithToken(page);
  await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(aloneSnapshot(EMMA, 'Emma', 'OBSERVER'))));
  await page.goto(`/s/${SESSION_ID}`);

  await expect(seatNames(page)).toHaveText(['Emma (toi)']);
  await expect(page.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();
  await expect(page.locator('.invite button')).toHaveText('Copier le lien');
  await expect(page.locator('.invite button')).toHaveClass(/btn-primary/);
  await expect(page.locator('main .btn-primary')).toHaveCount(1);
  await check();
});

test('fermeture 4404 : écran « Session introuvable » et jeton effacé', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  await fakeSessionSocket(page, SESSION_ID, (ws) => void ws.close({ code: 4404, reason: 'Session not found' }));
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByRole('heading', { name: "Cette session n'existe plus." })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer une session' })).toBeVisible();
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBeNull();
  await check();
});

test('fermeture 4401 : écran Rejoindre avec le pseudo prérempli et jeton effacé', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  await fakeSessionSocket(page, SESSION_ID, (ws) => void ws.close({ code: 4401, reason: 'Unknown token' }));
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
  await expect(page.getByLabel('Ton pseudo')).toHaveValue('Emma');
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBeNull();
  await check();
});

test('rafraîchir la page reprend la même place, sans écran Rejoindre', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  const server = await fakeSessionSocket(page, SESSION_ID, (ws, token) =>
    ws.send(JSON.stringify(token === TOKEN ? { ...hiddenRound, selfParticipantId: EMMA } : {})),
  );
  await page.goto(`/s/${SESSION_ID}`);
  await expect(seatNames(page)).toHaveText(['Alice', 'Bob', 'Chloé', 'David', 'Emma (toi)']);

  await page.reload();
  await expect(seatNames(page)).toHaveText(['Alice', 'Bob', 'Chloé', 'David', 'Emma (toi)']);
  await expect(page.getByRole('button', { name: 'Rejoindre' })).toHaveCount(0);
  expect(server.received.filter((m) => (m as { type: string }).type === 'hello')).toHaveLength(2);
  await check();
});
