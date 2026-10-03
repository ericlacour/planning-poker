import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ALICE = hiddenRound.participants[0].participantId;
const BOB = hiddenRound.participants[1].participantId;
const EMMA = hiddenRound.participants[4].participantId;
const ROUND = hiddenRound.round.roundId;
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Vote = string | null;

/** Webservice simulé : éveillé, session existante ; jeton rangé pour la session. */
async function openWithToken(page: Page) {
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => route.fulfill({ status: 204, headers: CORS }));
  await page.addInitScript(
    ([id, token]) => localStorage.setItem(`pp.token.${id}`, token),
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

/**
 * Instantané vu par Alice : Alice et Bob votent, Emma observe. `mine` est le vote d'Alice, `bobVoted` dit si Bob a
 * voté (sa valeur reste cachée).
 */
function snapshot(version: number, mine: Vote, bobVoted: boolean) {
  const [alice, bob, , , emma] = hiddenRound.participants;
  const voted = (mine === null ? 0 : 1) + (bobVoted ? 1 : 0);
  return {
    ...hiddenRound,
    version,
    selfParticipantId: ALICE,
    participants: [
      { ...alice, vote: mine, hasVoted: mine !== null },
      { ...bob, vote: null, hasVoted: bobVoted },
      emma,
    ],
    progress: { voted, expected: 2 },
    lastChange: { action: 'VOTE', byParticipantId: ALICE },
  };
}

const hand = (page: Page) => page.getByRole('toolbar', { name: 'Ta carte' });
const card = (page: Page, name: string) => hand(page).getByRole('button', { name, exact: true });
const mySeat = (page: Page) => page.locator('.seat').first();

test('voter à l\'aveugle : choisir, changer, retirer, au clavier aussi, avec le compteur', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  // Faux serveur : applique les votes d'Alice comme le webservice et renvoie l'instantané filtré.
  let version = 7;
  let mine: Vote = null;
  const votes: unknown[] = [];
  await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(snapshot(version, mine, false)));
    // Remplace l'écoute du faux serveur après le `hello` : seuls les votes comptent désormais.
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string; roundId?: string; card?: Vote };
      if (json.type === 'vote') votes.push(json);
      if (json.type !== 'vote' || json.roundId !== ROUND || json.card === mine) return;
      mine = json.card ?? null;
      version += 1;
      ws.send(JSON.stringify(snapshot(version, mine, false)));
    });
  });
  await page.goto(`/s/${SESSION_ID}`);

  await expect(hand(page).getByRole('button')).toHaveCount(10);
  await expect(page.getByText('Choisis ta carte')).toBeVisible();
  await expect(hand(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.vote-counter')).toHaveText('0 vote sur 2');

  // Choisir.
  await card(page, 'Carte 8').click();
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');
  await expect(mySeat(page).locator('.seat-card-face .card-value')).toHaveText('8');
  await expect(mySeat(page).getByText('visible par toi seul')).toBeVisible();
  await expect(page.getByText('Choisis ta carte')).toHaveCount(0);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');
  const box = await card(page, 'Carte 8').boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(Math.round(((box?.height ?? 0) / (box?.width ?? 1)) * 10) / 10).toBe(1.5);

  // Changer.
  await card(page, 'Carte 5').click();
  await expect(card(page, 'Carte 5')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'false');
  await expect(mySeat(page).locator('.seat-card-face .card-value')).toHaveText('5');
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');

  // Retirer en recliquant la carte choisie.
  await card(page, 'Carte 5').click();
  await expect(hand(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(mySeat(page).locator('.seat-card-empty')).toHaveCount(1);
  await expect(page.locator('.vote-counter')).toHaveText('0 vote sur 2');

  // Clavier : flèche droite depuis la carte 5, puis Entrée choisit la 8.
  await card(page, 'Carte 5').focus();
  await page.keyboard.press('ArrowRight');
  await expect(card(page, 'Carte 8')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(card(page, 'Carte 8')).toHaveAttribute('aria-pressed', 'false');

  // Le ☕ s'affiche en texte.
  await expect(card(page, 'Carte pause café').locator('.card-value')).toHaveText('☕︎');

  expect(votes).toEqual([
    { type: 'vote', roundId: ROUND, card: '8' },
    { type: 'vote', roundId: ROUND, card: '5' },
    { type: 'vote', roundId: ROUND, card: null },
    { type: 'vote', roundId: ROUND, card: '8' },
    { type: 'vote', roundId: ROUND, card: null },
  ]);
  await check();
});

test('les autres votants : dos de carte quand ils ont voté, compteur mis à jour', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(snapshot(7, null, false))));
  await page.goto(`/s/${SESSION_ID}`);

  const bobSeat = page.locator('.seat').nth(1);
  await expect(bobSeat.locator('.seat-card-empty')).toHaveCount(1);
  server.routes[0].send(JSON.stringify({ ...snapshot(8, null, true), lastChange: { action: 'VOTE', byParticipantId: BOB } }));
  await expect(bobSeat.locator('.seat-card-back')).toHaveCount(1);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');
  await check();
});

test('un observateur n\'a pas de main : « Tu observes »', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify({ ...hiddenRound, selfParticipantId: EMMA })));
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.getByText('Tu observes')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toHaveCount(0);
  await expect(page.locator('.vote-counter')).toHaveText('3 votes sur 4');
  await check();
});
