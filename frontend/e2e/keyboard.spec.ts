import { expect, Locator, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ROUND = hiddenRound.round.roundId;
const NEXT_ROUND = 'Vn4pX9tA';
const [alice, bob, chloe, david, emma] = hiddenRound.participants;
const ALICE = alice.participantId;
const BOB = bob.participantId;
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Role = 'VOTER' | 'OBSERVER';
type Intent = { type: string; roundId?: string; card?: string | null; role?: Role };

/** Webservice simulé : éveillé, session existante, `join` accepté pour Alice. */
async function mockApi(page: Page) {
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: '{"status":"UP"}',
    }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) =>
    route.fulfill({ status: 204, headers: CORS }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}/participants`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({ participantId: ALICE, participantToken: TOKEN }),
    });
  });
}

/**
 * Relève chaque texte posé dans la région `aria-live`, pour vérifier qu'aucune annonce intermédiaire n'a eu lieu.
 */
async function recordAnnouncements(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { announced: string[] }).announced = seen;
    new MutationObserver(() => {
      const region = document.querySelector('div.visually-hidden[aria-live="polite"]');
      const text = region?.textContent?.trim() ?? '';
      if (text && seen[seen.length - 1] !== text) seen.push(text);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  return () => page.evaluate(() => (window as unknown as { announced: string[] }).announced);
}

/**
 * Faux webservice qui applique les intentions comme le vrai : Alice (moi) et Bob votent, Emma observe ; la
 * synthèse est fournie toute faite (Bob a voté 8).
 */
function fakeServer() {
  let version = 7;
  let roundId = ROUND;
  let status: 'HIDDEN' | 'REVEALED' = 'HIDDEN';
  let role: Role = 'VOTER';
  let mine: string | null = null;
  let bobVote: string | null = '8';
  const intents: Intent[] = [];

  const snapshot = (action: string, by: string | null = ALICE) => {
    const revealed = status === 'REVEALED';
    const me = {
      ...alice,
      role,
      vote: mine,
      hasVoted: mine !== null,
      canVoteThisRound: role === 'VOTER',
    };
    const other = { ...bob, vote: revealed ? bobVote : null, hasVoted: bobVote !== null };
    const voters = role === 'VOTER' ? [me, other] : [other];
    const votes = voters.filter((p) => p.hasVoted).length;
    const values = [mine, bobVote].filter((v): v is string => v !== null).map(Number);
    return {
      ...hiddenRound,
      version,
      round: { roundId, status },
      participants: role === 'VOTER' ? [me, other, emma] : [other, me, emma],
      progress: { voted: votes, expected: voters.length },
      summary:
        revealed && values.length
          ? {
              average: values.reduce((a, b) => a + b, 0) / values.length,
              mostVoted: {
                values: [...new Set(values)].sort((a, b) => a - b).map(String),
                count: 1,
              },
              min: String(Math.min(...values)),
              max: String(Math.max(...values)),
              consensus: new Set(values).size === 1,
            }
          : null,
      lastChange: { action, byParticipantId: by },
    };
  };

  return {
    intents,
    snapshot,
    /** Change d'état comme si `by` avait agi, et renvoie l'instantané à diffuser. */
    apply(intent: Intent, by = ALICE) {
      if (by === ALICE) intents.push(intent);
      version += 1;
      switch (intent.type) {
        case 'vote':
          if (by === ALICE) mine = intent.card ?? null;
          else bobVote = intent.card ?? null;
          return snapshot('VOTE', by);
        case 'reveal':
          status = 'REVEALED';
          return snapshot('REVEAL', by);
        case 'clear':
          roundId = roundId === ROUND ? NEXT_ROUND : ROUND;
          status = 'HIDDEN';
          mine = null;
          bobVote = null;
          return snapshot('CLEAR', by);
        case 'changeRole':
          role = intent.role ?? role;
          if (role === 'OBSERVER' && status === 'HIDDEN') mine = null;
          return snapshot('ROLE', by);
        default:
          return snapshot('PRESENCE', by);
      }
    },
  };
}

/** Appuie sur Tab (au plus 40 fois) jusqu'à ce que `target` ait le focus : il est atteignable au clavier. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 40; i++) {
    if (await target.evaluate((e) => e === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/**
 * Le focus est visible : contour plein en `primary` (2 px en général ; 1 px collé à la bordure `primary` pour le
 * champ de saisie, DESIGN.md › input-focus).
 */
async function expectPrimaryFocusRing(page: Page) {
  const ring = await page.evaluate(() => {
    const focused = document.activeElement as HTMLElement;
    const probe = document.createElement('span');
    probe.style.color = 'var(--primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(focused);
    return {
      matches: focused.matches(':focus-visible'),
      style: style.outlineStyle,
      width: style.outlineWidth,
      color: style.outlineColor,
      primary,
    };
  });
  expect(ring.matches).toBe(true);
  expect(ring.style).toBe('solid');
  expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(1);
  expect(ring.color).toBe(ring.primary);
}

const live = (page: Page) => page.locator('div.visually-hidden[aria-live="polite"]');
const actionButton = (page: Page, name: string) =>
  page.locator('.action-bar').getByRole('button', { name, exact: true });
const card = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Ta carte' }).getByRole('button', { name, exact: true });

test('une séance complète au clavier seul : rejoindre, voter, révéler, lire, effacer, changer de rôle', async ({
  page,
}) => {
  await mockApi(page);
  const server = fakeServer();
  await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(server.snapshot('JOIN')));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as Intent;
      if (['vote', 'reveal', 'clear', 'changeRole'].includes(json.type))
        ws.send(JSON.stringify(server.apply(json)));
    });
  });
  await page.goto(`/s/${SESSION_ID}`);

  // Rejoindre : pseudo, rôle (flèches), puis Entrée.
  const pseudo = page.getByLabel('Ton pseudo');
  await tabTo(page, pseudo);
  await expectPrimaryFocusRing(page);
  await page.keyboard.type('Alice');
  await page.keyboard.press('Tab');
  const voter = page.getByRole('radio', { name: 'Je vote' });
  await expect(voter).toBeFocused();
  await expectPrimaryFocusRing(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: "J'observe" })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(voter).toBeFocused();
  await expect(voter).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeFocused();
  await page.keyboard.press('Enter');

  // Voter : la main est un seul arrêt de tabulation, les flèches vont de carte en carte, Espace choisit.
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');
  await tabTo(page, card(page, 'Carte 0'));
  await expectPrimaryFocusRing(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(card(page, 'Carte 5')).toBeFocused();
  await page.keyboard.press(' ');
  await expect(card(page, 'Carte 5')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

  // Révéler, puis lire le résultat : le focus reste sur le même bouton, devenu « Nouveau tour ».
  await tabTo(page, actionButton(page, 'Révéler les votes'));
  await expectPrimaryFocusRing(page);
  await page.keyboard.press('Enter');
  await expect(actionButton(page, 'Nouveau tour')).toBeFocused();
  await expect(page.locator('.result-average .result-value')).toHaveText('6,5');
  await expect(live(page)).toHaveText(
    'Votes révélés. Moyenne 6,5. Plus votée 5 et 8, 1 vote chacune. Min 5, max 8.',
  );

  // Nouveau tour, au clavier.
  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('Nouveau tour');
  await expect(actionButton(page, 'Révéler les votes')).toBeFocused();

  // Revoter puis effacer les votes (Espace sur le bouton secondaire).
  await tabTo(page, card(page, 'Carte 5'));
  await page.keyboard.press('Enter');
  await expect(card(page, 'Carte 5')).toHaveAttribute('aria-pressed', 'true');
  await tabTo(page, actionButton(page, 'Effacer les votes'));
  await expectPrimaryFocusRing(page);
  await page.keyboard.press(' ');
  await expect(card(page, 'Carte 5')).toHaveAttribute('aria-pressed', 'false');

  // Changer de rôle par le menu du participant : Entrée l'ouvre, flèche bas, Entrée choisit.
  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  await tabTo(page, trigger);
  await expectPrimaryFocusRing(page);
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toBeFocused();
  await expectPrimaryFocusRing(page);
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitemradio', { name: "J'observe" })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tu observes')).toBeVisible();
  await expect(trigger).toBeFocused();

  expect(server.intents).toEqual([
    { type: 'vote', roundId: ROUND, card: '5' },
    { type: 'reveal', roundId: ROUND },
    { type: 'clear', roundId: ROUND },
    { type: 'vote', roundId: NEXT_ROUND, card: '5' },
    { type: 'clear', roundId: NEXT_ROUND },
    { type: 'changeRole', role: 'OBSERVER' },
  ]);
});

/** Page de session ouverte avec un jeton rangé, sur le faux webservice. */
async function openSession(page: Page, server: ReturnType<typeof fakeServer>) {
  await mockApi(page);
  await page.addInitScript(
    ([id, token]) => localStorage.setItem(`pp.token.${id}`, token),
    [SESSION_ID, TOKEN],
  );
  const socket = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(server.snapshot('PRESENCE')));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as Intent;
      if (['vote', 'reveal', 'clear', 'changeRole'].includes(json.type))
        ws.send(JSON.stringify(server.apply(json)));
    });
  });
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');
  return (snapshot: object) => socket.routes[0].send(JSON.stringify(snapshot));
}

test("le focus posé sur « Révéler les votes » survit à la révélation d'un autre, inactif 1 s", async ({
  page,
}) => {
  // Horloge simulée : la garde de 1 s n'expire que par `runFor`, jamais pendant les vérifications.
  await page.clock.install();
  const server = fakeServer();
  const send = await openSession(page, server);

  const primary = page.locator('.action-bar .btn-primary');
  await tabTo(page, actionButton(page, 'Révéler les votes'));
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  send(server.apply({ type: 'reveal', roundId: ROUND }, BOB));

  // Même bouton, devenu « Nouveau tour », inactif par aria-disabled : le focus n'a pas bougé.
  await expect(primary).toHaveText('Nouveau tour');
  await expect(primary).toBeFocused();
  await expect(primary).toHaveAttribute('aria-disabled', 'true');
  await expect(primary).not.toHaveAttribute('disabled', /.*/);
  await expectPrimaryFocusRing(page);

  // Pendant la garde, Entrée ou un clic n'envoient rien.
  await page.keyboard.press('Enter');
  await primary.click({ force: true });
  await expect(primary).toHaveAttribute('aria-disabled', 'true');
  await page.clock.runFor(900);
  await expect(primary).toHaveAttribute('aria-disabled', 'true');
  // Au-delà de 1 s (plus le rendu qui suit), la garde est levée.
  await page.clock.runFor(200);
  await expect(primary).not.toHaveAttribute('aria-disabled', 'true');
  await expect(primary).toBeFocused();
  expect(server.intents).toEqual([]);
  await page.clock.resume();

  await page.keyboard.press('Enter');
  await expect(live(page)).toHaveText('Nouveau tour');
  expect(server.intents).toEqual([{ type: 'clear', roundId: ROUND }]);
});

test('annonces : les arrivées, et le compteur au plus toutes les 5 s, jamais vote par vote', async ({
  page,
}) => {
  const announced = await recordAnnouncements(page);
  await page.clock.install();
  await mockApi(page);
  await page.addInitScript(
    ([id, token]) => localStorage.setItem(`pp.token.${id}`, token),
    [SESSION_ID, TOKEN],
  );
  const base = {
    ...hiddenRound,
    version: 7,
    lastChange: { action: 'PRESENCE', byParticipantId: null },
  };
  const voters = [alice, bob, chloe, david].map((p) => ({ ...p, vote: null, hasVoted: false }));
  const socket = await fakeSessionSocket(page, SESSION_ID, (ws) =>
    ws.send(
      JSON.stringify({
        ...base,
        participants: [...voters, emma],
        progress: { voted: 0, expected: 4 },
      }),
    ),
  );
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.vote-counter')).toHaveText('0 vote sur 4');
  const send = (snapshot: object) => socket.routes[0].send(JSON.stringify(snapshot));

  // Arrivée d'une observatrice : le compteur ne change pas, seule l'arrivée est annoncée.
  const sofia = {
    ...emma,
    participantId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    pseudo: 'Sofia',
    joinOrder: 6,
  };
  const table = [...voters, emma, sofia];
  send({
    ...base,
    version: 8,
    participants: table,
    progress: { voted: 0, expected: 4 },
    lastChange: { action: 'JOIN', byParticipantId: sofia.participantId },
  });
  await expect(live(page)).toHaveText('Sofia a rejoint la session');

  // Votes rapprochés : 1 tout de suite, puis 3 seulement en fin de fenêtre de 5 s.
  const voted = (version: number, n: number) => ({
    ...base,
    version,
    participants: table.map((p, i) => (i > 0 && i <= n ? { ...p, hasVoted: true } : p)),
    progress: { voted: n, expected: 4 },
    lastChange: { action: 'VOTE', byParticipantId: BOB },
  });
  send(voted(9, 1));
  await expect(live(page)).toHaveText('1 vote sur 4');
  await page.clock.runFor(1_000);
  send(voted(10, 2));
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 4');
  await page.clock.runFor(1_000);
  send(voted(11, 3));
  await expect(page.locator('.vote-counter')).toHaveText('3 votes sur 4');
  await expect(live(page)).toHaveText('1 vote sur 4');
  await page.clock.runFor(3_000);
  await expect(live(page)).toHaveText('3 votes sur 4');

  expect(await announced()).toEqual([
    'Sofia a rejoint la session',
    '1 vote sur 4',
    '3 votes sur 4',
  ]);
});
