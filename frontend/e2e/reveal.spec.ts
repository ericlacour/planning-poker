import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ALICE = hiddenRound.participants[0].participantId;
const BOB = hiddenRound.participants[1].participantId;
const ROUND = hiddenRound.round.roundId;
const NEXT_ROUND = 'Vn4pX9tA';
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

const [alice, bob, , , emma] = hiddenRound.participants;

/** Tour caché vu par Alice : Alice a voté 5, Bob a voté (caché), Emma observe. */
const hidden = (version: number, by = ALICE) => ({
  ...hiddenRound,
  version,
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: null, hasVoted: true },
    emma,
  ],
  progress: { voted: 2, expected: 2 },
  lastChange: { action: 'VOTE', byParticipantId: by },
});

/** Le même tour révélé : 5 et 8 ; synthèse calculée par le webservice. */
const revealed = (version: number, by: string) => ({
  ...hidden(version),
  round: { roundId: ROUND, status: 'REVEALED' },
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: '8', hasVoted: true },
    emma,
  ],
  summary: { average: 6.5, mostVoted: { values: ['5', '8'], count: 1 }, min: '5', max: '8', consensus: false },
  lastChange: { action: 'REVEAL', byParticipantId: by },
});

/** Nouveau tour caché, sans vote. */
const newRound = (version: number, by: string) => ({
  ...hiddenRound,
  version,
  round: { roundId: NEXT_ROUND, status: 'HIDDEN' },
  participants: [
    { ...alice, vote: null, hasVoted: false },
    { ...bob, vote: null, hasVoted: false },
    emma,
  ],
  progress: { voted: 0, expected: 2 },
  lastChange: { action: 'CLEAR', byParticipantId: by },
});

const button = (page: Page, name: string) => page.locator('.action-bar').getByRole('button', { name, exact: true });
const live = (page: Page) => page.locator('[aria-live="polite"]');

test('révéler, lire le résultat, passer au tour suivant', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  const intents: unknown[] = [];
  let version = 8;
  await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(hidden(version)));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string; roundId?: string };
      if (json.type !== 'reveal' && json.type !== 'clear') return;
      intents.push(json);
      version += 1;
      ws.send(JSON.stringify(json.type === 'reveal' ? revealed(version, ALICE) : newRound(version, ALICE)));
    });
  });
  await page.goto(`/s/${SESSION_ID}`);

  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');
  await expect(button(page, 'Effacer les votes')).toHaveClass(/btn-secondary/);
  await expect(button(page, 'Révéler les votes')).toHaveClass(/btn-primary/);

  // Révéler.
  await button(page, 'Révéler les votes').click();
  const seats = page.locator('.seat');
  await expect(seats.nth(0).locator('.seat-card-face .card-value')).toHaveText('5');
  await expect(seats.nth(1).locator('.seat-card-face .card-value')).toHaveText('8');
  await expect(page.getByText('visible par toi seul')).toHaveCount(0);
  await expect(page.locator('.vote-counter')).toHaveCount(0);
  await expect(page.locator('.result-average .result-value')).toHaveText('6,5');
  await expect(page.locator('.result-most-voted')).toHaveText(/Plus votée\s*5 et 8\s*· 1 vote chacune/);
  await expect(page.locator('.result-min')).toHaveText(/Min\s*5/);
  await expect(page.locator('.result-max')).toHaveText(/Max\s*8/);
  await expect(page.locator('.consensus-badge')).toHaveCount(0);
  await expect(button(page, 'Masquer')).toBeDisabled();
  await expect(button(page, 'Nouveau tour')).toBeEnabled();
  await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toHaveAttribute('aria-disabled', 'true');
  await expect(live(page)).toHaveText(
    'Votes révélés. Moyenne 6,5. Plus votée 5 et 8, 1 vote chacune. Min 5, max 8.',
  );

  // Nouveau tour.
  await button(page, 'Nouveau tour').click();
  await expect(page.locator('.vote-counter')).toHaveText('0 vote sur 2');
  await expect(page.locator('.seat-card-face')).toHaveCount(0);
  await expect(page.locator('.result-panel')).toHaveCount(0);
  await expect(page.getByText('Choisis ta carte')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Ta carte' })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(live(page)).toHaveText('Nouveau tour');

  expect(intents).toEqual([
    { type: 'reveal', roundId: ROUND },
    { type: 'clear', roundId: ROUND },
  ]);
  await check();
});

test('après une révélation faite par un autre, les boutons restent inactifs 1 s', async ({ page }) => {
  const check = await watchPage(page);
  await openWithToken(page);
  const intents: unknown[] = [];
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(hidden(8, BOB)));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string };
      if (json.type === 'reveal' || json.type === 'clear') intents.push(json);
    });
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(button(page, 'Révéler les votes')).toBeEnabled();

  server.routes[0].send(JSON.stringify(revealed(9, BOB)));
  await expect(button(page, 'Nouveau tour')).toBeDisabled();
  const blockedAt = Date.now();
  await button(page, 'Nouveau tour').click({ force: true });
  await expect(button(page, 'Nouveau tour')).toBeEnabled({ timeout: 3_000 });
  expect(Date.now() - blockedAt).toBeGreaterThan(600);
  await expect(live(page)).toHaveText(/^Votes révélés\. Moyenne 6,5\./);
  expect(intents).toEqual([]);

  // Effacement par un autre : nouveau blocage, puis « Nouveau tour » annoncé.
  server.routes[0].send(JSON.stringify(newRound(10, BOB)));
  await expect(button(page, 'Révéler les votes')).toBeDisabled();
  await expect(live(page)).toHaveText('Nouveau tour');
  await expect(button(page, 'Révéler les votes')).toBeEnabled({ timeout: 3_000 });
  await button(page, 'Révéler les votes').click();
  await expect.poll(() => intents).toEqual([{ type: 'reveal', roundId: NEXT_ROUND }]);
  await check();
});
