import { expect, Page, test, WebSocketRoute } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket, WS } from './fake-session-socket';

/**
 * Story 2.2 : la page se reconnecte d'elle-même après une coupure (FR7, AD-8). Main et boutons désactivés dès la
 * perte, bandeau « Reconnexion… » après 2 s, premier instantané accepté au retour ; `4404` met fin aux tentatives.
 */

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ALICE = hiddenRound.participants[0].participantId;
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Vu par Alice, qui a choisi 8 (exemple du contrat). */
const snapshot = (version: number) => ({ ...hiddenRound, version, selfParticipantId: ALICE });

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
        sessionStorage.setItem('seeded', '1');
      }
    },
    [SESSION_ID, TOKEN],
  );
}

const hand = (page: Page) => page.getByRole('toolbar', { name: 'Ta carte' });
const card = (page: Page, name: string) => hand(page).getByRole('button', { name, exact: true });
const banner = (page: Page) => page.getByRole('status').filter({ hasText: 'Reconnexion…' });
const actionButtons = (page: Page) => page.locator('.action-buttons button');
const intents = (received: unknown[]) =>
  received.filter((m) => !['hello', 'heartbeat'].includes((m as { type: string }).type));

test('coupure brève : main et boutons désactivés aussitôt, aucun bandeau, tout revient au premier instantané', async ({
  page,
}) => {
  await openWithToken(page);
  let hellos = 0;
  let reply: (() => void) | null = null;
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    hellos++;
    if (hellos === 1) ws.send(JSON.stringify(snapshot(7)));
    else reply = () => ws.send(JSON.stringify(snapshot(7)));
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');
  await expect(hand(page)).not.toHaveAttribute('aria-disabled');

  await server.routes[0].close({ code: 1001, reason: '' });
  await expect(hand(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(actionButtons(page)).toHaveCount(2);
  for (const button of await actionButtons(page).all()) await expect(button).toBeDisabled();
  // La carte grisée reste cliquable pour l'utilisateur : le clic ne doit rien envoyer.
  await card(page, 'Carte 5').click({ force: true });
  await expect.poll(() => reply !== null).toBe(true);
  expect(intents(server.received)).toEqual([]);

  (reply as unknown as () => void)();
  await expect(hand(page)).not.toHaveAttribute('aria-disabled');
  for (const button of await actionButtons(page).all()) await expect(button).toBeEnabled();
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');
  await expect(banner(page)).toHaveCount(0);
});

test('coupure longue : bandeau « Reconnexion… » après 2 s, table visible, puis retour avec le vote intact', async ({
  page,
}) => {
  await openWithToken(page);
  let hellos = 0;
  let pending: WebSocketRoute | null = null;
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    hellos++;
    if (hellos === 1) ws.send(JSON.stringify(snapshot(7)));
    else pending = ws;
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');

  await server.routes[0].close({ code: 1006, reason: '' });
  await expect.poll(() => pending !== null).toBe(true);
  await expect(banner(page)).toHaveCount(0);
  await expect(banner(page)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.seat')).toHaveCount(5);
  await expect(hand(page)).toHaveAttribute('aria-disabled', 'true');

  // Retour : version plus basse acceptée (premier instantané de la nouvelle connexion).
  (pending as unknown as WebSocketRoute).send(JSON.stringify(snapshot(3)));
  await expect(banner(page)).toHaveCount(0);
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');
  await expect(hand(page)).not.toHaveAttribute('aria-disabled');
  expect(intents(server.received)).toEqual([]);
});

test('redémarrage du webservice : actions désactivées, « Reconnexion… », puis « Session introuvable » au 4404', async ({
  page,
}) => {
  await openWithToken(page);
  let hellos = 0;
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    hellos++;
    if (hellos === 1) ws.send(JSON.stringify(snapshot(7)));
    // Le webservice relancé a perdu la session : il répond 4404 une fois réveillé.
    else setTimeout(() => void ws.close({ code: 4404, reason: 'Session not found' }), 3_000);
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');

  await server.routes[0].close({ code: 1001, reason: '' });
  await expect(hand(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(banner(page)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('heading', { name: "Cette session n'existe plus." })).toBeVisible({ timeout: 5_000 });
  expect(await page.evaluate((id) => localStorage.getItem(`pp.token.${id}`), SESSION_ID)).toBeNull();

  // Plus aucune tentative après le 4404.
  await page.waitForTimeout(1_500);
  expect(server.routes).toHaveLength(2);
});

test('onglet caché 20 min derrière la visio : la connexion tient, sans aucune reconnexion', async ({ page }) => {
  await openWithToken(page);
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  });
  await page.clock.install();
  // Le serveur envoie `tick` ; ici, en réponse à chaque `heartbeat`, pour suivre l'horloge simulée.
  const server: { routes: WebSocketRoute[]; received: unknown[] } = { routes: [], received: [] };
  await page.routeWebSocket(`${WS}/ws/sessions/${SESSION_ID}`, (ws) => {
    server.routes.push(ws);
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string };
      server.received.push(json);
      if (json.type === 'hello') ws.send(JSON.stringify(snapshot(7)));
      if (json.type === 'heartbeat') ws.send('{"type":"tick"}');
    });
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');

  // 20 minutes simulées, par pas d'une seconde pour laisser les `tick` arriver entre deux pas.
  for (let second = 0; second < 20 * 60; second++) {
    await page.clock.runFor(1_000);
  }

  expect(server.routes).toHaveLength(1);
  expect(server.received.filter((m) => (m as { type: string }).type === 'heartbeat').length).toBeGreaterThan(200);
  await expect(banner(page)).toHaveCount(0);
  await expect(hand(page)).not.toHaveAttribute('aria-disabled');
});
