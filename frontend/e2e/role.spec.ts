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

test('changer de rôle en pleine séance : bascule « Je vote » / « J\'observe » en bas à gauche, cartes grisées en observateur', async ({
  page,
}) => {
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

  const hand = page.getByRole('toolbar', { name: 'Ta carte' });
  const roleGroup = page.getByRole('group', { name: 'Ton rôle' });
  const vote = roleGroup.getByRole('button', { name: 'Je vote' });
  const observe = roleGroup.getByRole('button', { name: "J'observe" });
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');
  await expect(vote).toHaveAttribute('aria-pressed', 'true');
  await expect(observe).toHaveAttribute('aria-pressed', 'false');

  // En bas à gauche : la bascule est à gauche des cartes et sous le haut de la main.
  const roleBox = (await roleGroup.boundingBox())!;
  const cardsBox = (await hand.boundingBox())!;
  expect(roleBox.x + roleBox.width).toBeLessThanOrEqual(cardsBox.x + 1);
  expect(roleBox.y + roleBox.height).toBeGreaterThan(cardsBox.y);

  // Le menu du participant ne propose pas le rôle.
  await page.getByRole('button', { name: 'Menu du participant : Alice' }).click();
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  await expect(menu.getByRole('menuitemradio', { name: "J'observe" })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // « J'observe » : les cartes restent visibles mais grisées, sans « Tu observes » ni « Je veux voter ».
  await observe.click();
  await expect(observe).toHaveAttribute('aria-pressed', 'true');
  await expect(hand).toHaveAttribute('aria-disabled', 'true');
  await expect(hand.getByRole('button')).toHaveCount(11);
  await expect(page.getByText('Tu observes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Je veux voter' })).toHaveCount(0);
  await expect(seatOf(page, 'Alice').locator('.seat-card-observer')).toHaveText('observe');
  await expect(page.locator('.seat .seat-pseudo')).toHaveText(['Bob', 'Alice', 'Emma']);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 1');

  // « Je vote » : la main redevient active.
  await vote.click();
  await expect(hand).not.toHaveAttribute('aria-disabled', /.*/);
  await expect(page.getByText('Choisis ta carte')).toBeVisible();
  await expect(page.locator('.seat .seat-pseudo')).toHaveText(['Alice', 'Bob', 'Emma']);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');

  expect(changes).toEqual([
    { type: 'changeRole', role: 'OBSERVER' },
    { type: 'changeRole', role: 'VOTER' },
  ]);
});
