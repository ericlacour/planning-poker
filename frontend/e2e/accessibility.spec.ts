import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, test, WebSocketRoute } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import revealedObserver from '../../contract/examples/session-state/revealed-seen-by-observer.json';
import { aloneSnapshot, fakeSessionSocket } from './fake-session-socket';

/**
 * Story 3.5 : audit axe (WCAG 2.2 AA) de tous les écrans dans les deux thèmes, séance menée au clavier seul,
 * focus conservé après une révélation faite par un autre, contenu des régions `aria-live`, zoom 200 % (640 × 400)
 * et 360 px sans défilement horizontal, avec des cibles d'au moins 44 × 44 px.
 */

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ALICE = hiddenRound.participants[0].participantId;
const BOB = hiddenRound.participants[1].participantId;
const ROUND = hiddenRound.round.roundId;
const NEXT_ROUND = 'Vn4pX9tA';
const JOINED = { participantId: ALICE, participantToken: TOKEN };
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Check = 'exists' | 'notFound' | 'abort';
type Join = 'joined' | 'pseudoTaken';

const problem = (status: number, title: string, path: string, code: string) =>
  JSON.stringify({ type: 'about:blank', title, status, detail: title, instance: path, code });

/** Webservice simulé : santé (`awake`), vérification de la session (`check`), rejoindre (`join`). */
async function mockApi(
  page: Page,
  { awake = true, check = 'exists' as Check, join = 'joined' as Join } = {},
) {
  await page.route(`${API}/api/health`, (route) =>
    awake
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS,
          body: '{"status":"UP"}',
        })
      : route.fulfill({ status: 503, headers: CORS, body: 'Service Unavailable' }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS });
    if (check === 'abort') return route.abort('connectionrefused');
    if (check === 'notFound') {
      return route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        headers: CORS,
        body: problem(404, 'Not Found', `/api/sessions/${SESSION_ID}`, 'SESSION_NOT_FOUND'),
      });
    }
    return route.fulfill({ status: 204, headers: CORS });
  });
  await page.route(`${API}/api/sessions/${SESSION_ID}/participants`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: CORS });
    if (join === 'pseudoTaken') {
      return route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        headers: CORS,
        body: problem(409, 'Conflict', `/api/sessions/${SESSION_ID}/participants`, 'PSEUDO_TAKEN'),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(JOINED),
    });
  });
}

/** Jeton rangé : la page de session s'ouvre directement. */
const storeToken = (page: Page) =>
  page.addInitScript(
    ([id, token]) => localStorage.setItem(`pp.token.${id}`, token),
    [SESSION_ID, TOKEN],
  );

const [alice, bob, chloe, , emma] = hiddenRound.participants;

/** Tour caché vu par Alice : Alice a voté 5, Bob a voté (caché), Chloé n'a pas voté, Emma observe. */
const hidden = (version: number, by = BOB) => ({
  ...hiddenRound,
  version,
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: null, hasVoted: true },
    chloe,
    emma,
  ],
  progress: { voted: 2, expected: 3 },
  lastChange: { action: 'VOTE', byParticipantId: by },
});

/** Le même tour révélé par `by`. */
const revealed = (version: number, by = BOB) => ({
  ...hidden(version),
  round: { roundId: ROUND, status: 'REVEALED' },
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: '8', hasVoted: true },
    chloe,
    emma,
  ],
  summary: {
    average: 6.5,
    mostVoted: { values: ['5', '8'], count: 1 },
    min: '5',
    max: '8',
    consensus: false,
  },
  lastChange: { action: 'REVEAL', byParticipantId: by },
});

/** Écran à auditer : prépare les routes, ouvre la page et attend l'état voulu. */
interface Screen {
  readonly name: string;
  open(page: Page): Promise<void>;
}

/** Ouvre la session avec un faux webservice qui envoie `snapshot` au `hello`. */
async function openSession(page: Page, snapshot: unknown, ready: (page: Page) => Locator) {
  await mockApi(page);
  await storeToken(page);
  await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(snapshot)));
  await page.goto(`/s/${SESSION_ID}`);
  await expect(ready(page)).toBeVisible();
}

const SCREENS: readonly Screen[] = [
  {
    name: 'accueil',
    async open(page) {
      await mockApi(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Planning Poker' })).toBeVisible();
    },
  },
  {
    name: 'rejoindre',
    async open(page) {
      await mockApi(page);
      await page.goto(`/s/${SESSION_ID}`);
      await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
    },
  },
  {
    name: 'rejoindre avec erreur',
    async open(page) {
      await mockApi(page, { join: 'pseudoTaken' });
      await page.goto(`/s/${SESSION_ID}`);
      await page.getByLabel('Ton pseudo').fill('Sofia');
      await page.getByRole('button', { name: 'Rejoindre' }).click();
      await expect(page.locator('#entry-pseudo-error')).toHaveText(
        'Ce pseudo est déjà pris dans cette session.',
      );
    },
  },
  {
    name: 'réveil',
    async open(page) {
      await mockApi(page, { awake: false });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Réveil du serveur…' })).toBeVisible();
    },
  },
  {
    name: 'le serveur ne répond pas',
    async open(page) {
      await page.route(`${APP}/config.json`, (route) =>
        route.fulfill({ status: 404, body: 'Not Found' }),
      );
      await page.goto('/');
      await expect(page.getByRole('alert')).toContainText('Le serveur ne répond pas.');
    },
  },
  {
    name: 'session introuvable',
    async open(page) {
      await mockApi(page, { check: 'notFound' });
      await page.goto(`/s/${SESSION_ID}`);
      await expect(
        page.getByRole('heading', { name: "Cette session n'existe plus." }),
      ).toBeVisible();
    },
  },
  {
    name: 'injoignable',
    async open(page) {
      await mockApi(page, { check: 'abort' });
      await page.goto(`/s/${SESSION_ID}`);
      await expect(
        page.getByRole('heading', { name: 'Impossible de joindre le serveur.' }),
      ).toBeVisible();
    },
  },
  {
    name: 'session seul',
    open: (page) =>
      openSession(page, aloneSnapshot(ALICE), (p) =>
        p.getByText('Partage le lien pour inviter ton équipe'),
      ),
  },
  {
    name: 'session cachée',
    open: (page) => openSession(page, hidden(8), (p) => p.locator('.vote-counter')),
  },
  {
    name: 'session révélée',
    open: (page) =>
      openSession(page, revealed(8), (p) => p.getByRole('button', { name: 'Nouveau tour' })),
  },
  {
    name: 'session en observateur',
    open: (page) =>
      // Sur téléphone, le tiroir de la main (et « Je veux voter ») se replie en tour révélé : on attend ma place.
      openSession(page, { ...revealedObserver, version: 30 }, (p) => p.locator('.seat-me')),
  },
];

test.describe('audit axe WCAG 2.2 AA', () => {
  // Sans mouvement : l'audit lit l'état final, pas une carte en plein retournement.
  test.use({ reducedMotion: 'reduce' });

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen.name}, thème ${colorScheme === 'light' ? 'clair' : 'sombre'}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await screen.open(page);
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
        expect(
          violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')) })),
          'violations axe',
        ).toEqual([]);
      });
    }
  }
});

/** Appuie sur `key` (Tab ou Shift+Tab) jusqu'à ce que `target` ait le focus. */
async function tabTo(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab') {
  for (let i = 0; i < 40; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

/** Le focus est visible : contour plein de la couleur `--primary` (1 px doublé d'une bordure primary sur un champ). */
async function expectPrimaryOutline(page: Page) {
  const { outlineStyle, outlineColor, outlineWidth, primary } = await page.evaluate(() => {
    const focused = document.activeElement as HTMLElement;
    const probe = document.createElement('span');
    probe.style.color = 'var(--primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(focused);
    return {
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      primary,
    };
  });
  expect(outlineStyle).toBe('solid');
  expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(1);
  expect(outlineColor).toBe(primary);
}

/** Faux webservice qui applique les intentions comme le vrai, pour Alice qui rejoint avec Bob déjà là. */
function keyboardServer() {
  let version = 10;
  let roundId = ROUND;
  let status: 'HIDDEN' | 'REVEALED' = 'HIDDEN';
  let role: 'VOTER' | 'OBSERVER' = 'VOTER';
  let mine: string | null = null;
  const bobVote = '8';
  const intents: unknown[] = [];
  const snapshot = (action: string) => {
    const me = {
      ...alice,
      role,
      vote: mine,
      hasVoted: mine !== null,
      canVoteThisRound: role === 'VOTER',
    };
    const other = { ...bob, vote: status === 'REVEALED' ? bobVote : null, hasVoted: true };
    const voters = role === 'VOTER' ? 2 : 1;
    const numbers = [Number(bobVote), ...(mine !== null && role === 'VOTER' ? [Number(mine)] : [])];
    return {
      ...hiddenRound,
      version: ++version,
      round: { roundId, status },
      participants: role === 'VOTER' ? [me, other] : [other, me],
      progress: { voted: 1 + (mine !== null && role === 'VOTER' ? 1 : 0), expected: voters },
      summary:
        status === 'REVEALED'
          ? {
              average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
              mostVoted: { values: [bobVote], count: 1 },
              min: String(Math.min(...numbers)),
              max: String(Math.max(...numbers)),
              consensus: numbers.every((n) => n === numbers[0]),
            }
          : null,
      lastChange: { action, byParticipantId: ALICE },
    };
  };
  const onHello = (ws: WebSocketRoute) => {
    ws.send(JSON.stringify(snapshot('JOIN')));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as {
        type: string;
        card?: string | null;
        role?: 'VOTER' | 'OBSERVER';
      };
      if (json.type === 'hello' || json.type === 'ping') return;
      intents.push(json);
      if (json.type === 'vote') mine = json.card ?? null;
      if (json.type === 'reveal') status = 'REVEALED';
      if (json.type === 'clear') {
        status = 'HIDDEN';
        roundId = NEXT_ROUND;
        mine = null;
      }
      if (json.type === 'changeRole' && json.role) {
        role = json.role;
        if (role === 'OBSERVER') mine = null;
      }
      const action = { vote: 'VOTE', reveal: 'REVEAL', clear: 'CLEAR', changeRole: 'ROLE' }[
        json.type
      ];
      if (action) ws.send(JSON.stringify(snapshot(action)));
    });
  };
  return { intents, onHello };
}

test('une séance complète au clavier seul, avec un contour primary visible', async ({ page }) => {
  await mockApi(page);
  const server = keyboardServer();
  await fakeSessionSocket(page, SESSION_ID, server.onHello);
  await page.goto(`/s/${SESSION_ID}`);

  // Rejoindre : Tab jusqu'au pseudo, saisie, Entrée.
  const pseudo = page.getByLabel('Ton pseudo');
  await tabTo(page, pseudo);
  await expectPrimaryOutline(page);
  await page.keyboard.type('Alice');
  // Comme un utilisateur, attendre que « Rejoindre » soit actif : un bouton encore désactivé bloque l'envoi par Entrée.
  await expect(page.getByRole('button', { name: 'Rejoindre', exact: true })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');

  // Voter : un seul arrêt de tabulation pour la main, flèches pour choisir, Espace pour voter.
  const hand = page.getByRole('toolbar', { name: 'Ta carte' });
  await tabTo(page, hand.getByRole('button', { name: 'Carte 0', exact: true }));
  await expectPrimaryOutline(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(hand.getByRole('button', { name: 'Carte 5', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(hand.getByRole('button', { name: 'Carte 5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

  // Révéler à l'Entrée : le focus reste sur le même bouton, devenu « Nouveau tour ».
  const actions = page.locator('.action-bar');
  await tabTo(page, actions.getByRole('button', { name: 'Révéler les votes' }), 'Shift+Tab');
  await expectPrimaryOutline(page);
  await page.keyboard.press('Enter');
  await expect(actions.getByRole('button', { name: 'Nouveau tour' })).toBeFocused();
  await expect(page.locator('.result-average .result-value')).toHaveText('6,5');
  await expectPrimaryOutline(page);

  // Seconde Entrée pendant la garde de 1 s après mon propre clic : rien n'est effacé (intentions vérifiées en fin de test).
  await expect(actions.getByRole('button', { name: 'Nouveau tour' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.result-average .result-value')).toHaveText('6,5');
  await expect(actions.getByRole('button', { name: 'Nouveau tour' })).toBeFocused();

  // Effacer à l'Entrée, une fois la garde passée : le focus reste, le bouton redevient « Révéler les votes ».
  await expect(actions.getByRole('button', { name: 'Nouveau tour' })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(actions.getByRole('button', { name: 'Révéler les votes' })).toBeFocused();
  await expect(page.locator('.vote-counter')).toHaveText('1 vote sur 2');

  // Changer de rôle par le menu du participant : Entrée, flèche bas, Entrée.
  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  await tabTo(page, trigger, 'Shift+Tab');
  await expectPrimaryOutline(page);
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tu observes')).toBeVisible();

  // Revenir votant par « Je veux voter », à l'Espace.
  const becomeVoter = page.getByRole('button', { name: 'Je veux voter' });
  await tabTo(page, becomeVoter);
  await expectPrimaryOutline(page);
  await page.keyboard.press('Space');
  await expect(hand).toBeVisible();

  expect(server.intents).toEqual([
    { type: 'vote', roundId: ROUND, card: '5' },
    { type: 'reveal', roundId: ROUND },
    { type: 'clear', roundId: ROUND },
    { type: 'changeRole', role: 'OBSERVER' },
    { type: 'changeRole', role: 'VOTER' },
  ]);
});

test('révélation et effacement faits par un autre : le focus reste sur le même bouton', async ({
  page,
}) => {
  await mockApi(page);
  await storeToken(page);
  const intents: unknown[] = [];
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => {
    ws.send(JSON.stringify(hidden(8)));
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string };
      if (json.type === 'reveal' || json.type === 'clear' || json.type === 'hide')
        intents.push(json);
    });
  });
  await page.goto(`/s/${SESSION_ID}`);
  const actions = page.locator('.action-bar');
  const reveal = actions.getByRole('button', { name: 'Révéler les votes' });
  await tabTo(page, reveal, 'Shift+Tab');

  // Bob révèle : même bouton, devenu « Nouveau tour », inactif 1 s, le focus toujours posé.
  server.routes[0].send(JSON.stringify(revealed(9)));
  const newRound = actions.getByRole('button', { name: 'Nouveau tour' });
  await expect(newRound).toBeFocused();
  await expect(newRound).toHaveAttribute('aria-disabled', 'true');
  await expect(newRound).toHaveCSS('opacity', '0.4');
  await page.keyboard.press('Enter');
  await expect(newRound).not.toHaveAttribute('aria-disabled', { timeout: 3_000 });
  await expect(newRound).toBeFocused();
  expect(intents).toEqual([]);

  // Bob efface : le focus reste encore, sur « Révéler les votes ».
  server.routes[0].send(
    JSON.stringify({
      ...hidden(10),
      round: { roundId: NEXT_ROUND, status: 'HIDDEN' },
      participants: [
        { ...alice, vote: null, hasVoted: false },
        { ...bob, vote: null, hasVoted: false },
        chloe,
        emma,
      ],
      progress: { voted: 0, expected: 3 },
      lastChange: { action: 'CLEAR', byParticipantId: BOB },
    }),
  );
  await expect(reveal).toBeFocused();
  await expect(reveal).not.toHaveAttribute('aria-disabled', { timeout: 3_000 });
  await page.keyboard.press('Enter');
  await expect.poll(() => intents).toEqual([{ type: 'reveal', roundId: NEXT_ROUND }]);
});

test('régions live : arrivées, compteur au plus toutes les 5 s, révélation ; places muettes nommées', async ({
  page,
}) => {
  await mockApi(page);
  await storeToken(page);
  const start = {
    ...hiddenRound,
    version: 8,
    participants: [
      { ...alice, vote: null, hasVoted: false },
      { ...bob, hasVoted: false },
    ],
    progress: { voted: 0, expected: 2 },
    lastChange: { action: 'JOIN', byParticipantId: BOB },
  };
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(start)));
  await page.goto(`/s/${SESSION_ID}`);
  const live = page.locator('div.visually-hidden[aria-live="polite"]:not(.counter-region)');
  const counter = page.locator('.counter-region');
  await expect(counter).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.vote-counter')).toHaveText('0 vote sur 2');
  // Premier instantané : aucune arrivée annoncée ; les places sans vote sont nommées.
  await expect(live).toHaveText('');
  await expect(page.getByRole('img', { name: "n'a pas voté" })).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Ta main' })).toBeVisible();

  // Sofia arrive.
  const sofia = { ...chloe, pseudo: 'Sofia' };
  const send = (snapshot: unknown) => server.routes[0].send(JSON.stringify(snapshot));
  send({
    ...start,
    version: 9,
    participants: [...start.participants, sofia],
    progress: { voted: 0, expected: 3 },
  });
  await expect(live).toHaveText('Sofia a rejoint la session');
  await expect(counter).toHaveText('0 vote sur 3');

  // Votes en rafale : rien de plus avant l'échéance, puis le dernier compte.
  const voted = (version: number, n: number) => ({
    ...start,
    version,
    participants: [
      { ...alice, vote: null, hasVoted: n >= 3 },
      { ...bob, hasVoted: n >= 1 },
      { ...sofia, hasVoted: n >= 2 },
    ],
    progress: { voted: n, expected: 3 },
    lastChange: { action: 'VOTE', byParticipantId: BOB },
  });
  const sentAt = Date.now();
  send(voted(10, 1));
  send(voted(11, 2));
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 3');
  await expect(counter).toHaveText('0 vote sur 3');
  await expect(counter).toHaveText('2 votes sur 3', { timeout: 8_000 });
  expect(Date.now() - sentAt).toBeGreaterThan(3_000);

  // Révélé avant l'échéance d'un compteur différé : seule la révélation est annoncée.
  send(voted(12, 3));
  send({
    ...voted(13, 3),
    round: { roundId: ROUND, status: 'REVEALED' },
    participants: voted(13, 3).participants.map((p) => ({ ...p, vote: '5' })),
    summary: {
      average: 5,
      mostVoted: { values: ['5'], count: 3 },
      min: '5',
      max: '5',
      consensus: true,
    },
    lastChange: { action: 'REVEAL', byParticipantId: BOB },
  });
  await expect(live).toHaveText(/^Votes révélés\. Moyenne 5\./);
  await page.waitForTimeout(5_500);
  await expect(counter).toHaveText('2 votes sur 3');
  // Tour révélé : la place sans vote n'a plus d'image nommée, la mention visible suffit.
  await expect(page.getByRole('img', { name: "n'a pas voté" })).toHaveCount(0);
});

/** Cibles interactives visibles : boutons, liens, champs. */
const targets = (page: Page) =>
  page.locator('button, a[href], input, select, textarea, [role="menuitemradio"]');

async function expectReflowAndTargets(page: Page, screen: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${screen} : défilement horizontal`).toBeLessThanOrEqual(0);
  for (const target of await targets(page).all()) {
    if (!(await target.isVisible())) continue;
    // Bouton radio natif : la cible est son libellé entier.
    const type = await target.getAttribute('type');
    const box =
      type === 'radio'
        ? await target.locator('xpath=ancestor::label[1]').boundingBox()
        : await target.boundingBox();
    if (!box) continue;
    const name = `${screen} : ${(await target.getAttribute('aria-label')) || (await target.innerText()) || type}`;
    expect(box.width, name).toBeGreaterThanOrEqual(44);
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
}

for (const viewport of [
  { label: 'zoom 200 % (640 × 400)', size: { width: 640, height: 400 } },
  { label: '360 px', size: { width: 360, height: 740 } },
]) {
  test.describe(viewport.label, () => {
    test.use({ viewport: viewport.size, reducedMotion: 'reduce' });

    for (const screen of SCREENS) {
      test(`${screen.name} : aucun défilement horizontal, cibles d'au moins 44 × 44 px`, async ({
        page,
      }) => {
        await screen.open(page);
        await expectReflowAndTargets(page, screen.name);
      });
    }
  });
}
