import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

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

type Role = 'VOTER' | 'OBSERVER';

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

/**
 * Instantané vu par Alice : Alice votante (avec ou sans vote) ou observatrice, Bob votant qui a voté, Emma observe.
 * Ordre du serveur : votants puis observateurs, chacun par ordre d'arrivée.
 */
function snapshot(version: number, role: Role, mine: string | null) {
  const [alice, bob, , , emma] = hiddenRound.participants;
  const me = { ...alice, role, vote: mine, hasVoted: mine !== null, canVoteThisRound: role === 'VOTER' };
  const voters = role === 'VOTER' ? 2 : 1;
  return {
    ...hiddenRound,
    version,
    selfParticipantId: ALICE,
    participants: role === 'VOTER' ? [me, bob, emma] : [bob, me, emma],
    progress: { voted: 1 + (mine === null ? 0 : 1), expected: voters },
    lastChange: { action: 'ROLE', byParticipantId: ALICE },
  };
}

const seatOf = (page: Page, pseudo: string) =>
  page.locator('.seat').filter({ has: page.locator('.seat-pseudo', { hasText: pseudo }) });

test('changer de rôle en pleine séance : menu du participant, puis « Je veux voter »', async ({ page }) => {
  await openWithToken(page);
  // Faux serveur : applique `changeRole` comme le webservice (le vote est retiré en tour caché).
  let version = 7;
  let role: Role = 'VOTER';
  let mine: string | null = '8';
  const changes: unknown[] = [];
  await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(snapshot(version, role, mine)));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string; role?: Role };
      if (json.type !== 'changeRole') return;
      changes.push(json);
      if (json.role === role) return;
      role = json.role ?? role;
      if (role === 'OBSERVER') mine = null;
      version += 1;
      ws.send(JSON.stringify(snapshot(version, role, mine)));
    });
  });
  await page.goto(`/s/${SESSION_ID}`);

  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  await expect(trigger).toHaveText('Alice');
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

  // Le menu s'ouvre sous la barre, mon rôle actuel coché.
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toHaveAttribute('aria-checked', 'true');
  await expect(menu.getByRole('menuitemradio', { name: "J'observe" })).toHaveAttribute('aria-checked', 'false');

  // Au clavier : flèche bas puis Entrée choisit « J'observe ».
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Observatrice : plus de main, mon vote retiré, ma place chez les observateurs, M recalculé.
  await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toHaveCount(0);
  await expect(page.getByText('Tu observes')).toBeVisible();
  await expect(seatOf(page, 'Alice').locator('.seat-card-observer')).toHaveText('observe');
  await expect(page.locator('.seat .seat-pseudo')).toHaveText(['Bob', 'Alice', 'Emma']);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 1');

  // « Je veux voter » me rend votante, avec une main active.
  await page.getByRole('button', { name: 'Je veux voter' }).click();
  await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeVisible();
  await expect(page.getByText('Choisis ta carte')).toBeVisible();
  await expect(page.locator('.seat .seat-pseudo')).toHaveText(['Alice', 'Bob', 'Emma']);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');

  expect(changes).toEqual([
    { type: 'changeRole', role: 'OBSERVER' },
    { type: 'changeRole', role: 'VOTER' },
  ]);
});
