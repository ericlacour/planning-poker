import { expect, Locator, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

/*
 * Story 1.8 : l'écran Session tient sur PC (1280 × 650, 13 participants, sans défilement de page) et sur téléphone
 * (tiroir de 2 × 5 cartes, replié au tour révélé ; aucun défilement horizontal dès 360 px). Faux webservice : la
 * CSP du front construit s'applique réellement.
 */

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const ROUND = hiddenRound.round.roundId;
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PC = { width: 1280, height: 650 };
const PHONE = { width: 390, height: 844 };

/** 13 participants : 11 votants (dont moi, Alice, en premier) puis 2 observateurs ; pseudos longs compris. */
const PSEUDOS = [
  'Alice',
  'Bob',
  'Chloé',
  'David',
  'Maëlle-Victoire Dupo',
  'Farid',
  'Gaëlle',
  'Hugo',
  'Inès',
  'Jean-Christophe',
  'Karim',
  'Léa',
  'Eric',
];
const VOTERS = 11;
const VOTES = ['8', '5', '5', '3', '5', '13', '5', '8', '5', '?', '5'] as const;
const id = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
const SELF = id(0);

function participants(revealed: boolean, votes: readonly (string | null)[] = VOTES) {
  return PSEUDOS.map((pseudo, i) => {
    const voter = i < VOTERS;
    const vote = voter ? (votes[i] ?? null) : null;
    return {
      participantId: id(i),
      pseudo,
      role: voter ? 'VOTER' : 'OBSERVER',
      connected: i !== 7,
      joinOrder: i + 1,
      hasVoted: vote !== null,
      // Tour caché : seul mon vote m'est envoyé.
      vote: revealed || i === 0 ? vote : null,
      canVoteThisRound: voter,
    };
  });
}

/** Tour caché, vu par Alice (votante, a choisi 8) : 9 votes sur 11 (Chloé et Karim n'ont pas voté). */
const hidden = (version = 8) => {
  const votes = VOTES.map((v, i) => (i === 2 || i === 10 ? null : v));
  return {
    ...hiddenRound,
    version,
    selfParticipantId: SELF,
    round: { roundId: ROUND, status: 'HIDDEN' },
    participants: participants(false, votes),
    progress: { voted: 9, expected: VOTERS },
    summary: null,
    lastChange: { action: 'VOTE', byParticipantId: id(1) },
  };
};

/** Synthèse de la maquette (calculée par le webservice, ici donnée telle quelle). */
const MOCKUP_SUMMARY = { average: 5.9, mostVoted: { values: ['5'], count: 6 }, min: '3', max: '13', consensus: false };
/** Égalité à trois valeurs et consensus absent : la ligne condensée la plus longue. */
const TIE_SUMMARY = { average: 10.5, mostVoted: { values: ['3', '5', '13'], count: 3 }, min: '3', max: '21', consensus: false };

/** Tour révélé : tous ont voté sauf Karim (« n'a pas voté »). */
const revealed = (summary: object = MOCKUP_SUMMARY, version = 9) => ({
  ...hidden(version),
  round: { roundId: ROUND, status: 'REVEALED' },
  participants: participants(true, VOTES.map((v, i) => (i === 10 ? null : v))),
  progress: { voted: 10, expected: VOTERS },
  summary,
  lastChange: { action: 'REVEAL', byParticipantId: SELF },
});

/** Webservice simulé : éveillé, session existante, jeton rangé ; le faux WebSocket envoie `snapshot`. */
async function openSession(page: Page, snapshot: object) {
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
  await page.route(`${API}/api/health`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"status":"UP"}' }),
  );
  await page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => route.fulfill({ status: 204, headers: CORS }));
  await page.addInitScript(([sessionId, token]) => localStorage.setItem(`pp.token.${sessionId}`, token), [
    SESSION_ID,
    TOKEN,
  ]);
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(snapshot)));
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.seat')).toHaveCount(PSEUDOS.length);
  return {
    send: (next: object) => server.routes[0].send(JSON.stringify(next)),
    check: async () => {
      expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    },
  };
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b, 'élément à l’écran').not.toBeNull();
  return b!;
};

/** Défilement de la page : hauteur et largeur du document comparées à la fenêtre. */
const pageOverflow = (page: Page) =>
  page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));

/** Vrai si l'élément est entièrement dans la fenêtre. */
async function inViewport(page: Page, locator: Locator) {
  const b = await box(locator);
  const viewport = page.viewportSize()!;
  return b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= viewport.width + 0.5 && b.y + b.height <= viewport.height + 0.5;
}

/** Rangées occupées par une liste d'éléments (regroupés par position verticale). */
async function rows(locator: Locator): Promise<number[]> {
  const tops = await locator.evaluateAll((elements) => elements.map((e) => Math.round(e.getBoundingClientRect().top)));
  const counts = new Map<number, number>();
  for (const top of tops) counts.set(top, (counts.get(top) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a - b).map(([, n]) => n);
}

/** Nombre de lignes de texte occupées par des éléments de hauteurs différentes (chevauchement vertical). */
async function lines(locator: Locator): Promise<number> {
  const rects = await locator.evaluateAll((elements) =>
    elements.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })),
  );
  rects.sort((a, b) => a.top - b.top);
  let count = 0;
  let bottom = -Infinity;
  for (const r of rects) {
    if (r.top >= bottom - 1) {
      count += 1;
      bottom = r.bottom;
    } else bottom = Math.max(bottom, r.bottom);
  }
  return count;
}

const handCards = (page: Page) => page.getByRole('toolbar', { name: 'Ta carte' }).getByRole('button');
const actionBar = (page: Page) => page.locator('.action-bar');
const tableZone = (page: Page) => page.locator('.session-scroll');

test.describe('PC 1280 × 650, 13 participants', () => {
  test.use({ viewport: PC });

  test('tour caché : aucun défilement, 2 rangées de 7 places au plus, main de 10 cartes sur une ligne', async ({ page }) => {
    const { check } = await openSession(page, hidden());

    const overflow = await pageOverflow(page);
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    // Toute la table est visible : sa zone n'a rien à faire défiler.
    expect(await tableZone(page).evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0);

    expect(await rows(page.locator('.seat'))).toEqual([7, 6]);
    const seatCard = await box(page.locator('.seat-card').first());
    expect(seatCard.width).toBeCloseTo(44, 0);
    expect(seatCard.height).toBeCloseTo(66, 0);
    expect((await box(page.locator('header.top-bar'))).height).toBeCloseTo(56, 0);
    const bar = await box(actionBar(page));
    expect(bar.height).toBeGreaterThanOrEqual(64);
    expect(bar.height).toBeLessThanOrEqual(80);

    await expect(handCards(page)).toHaveCount(10);
    // Une ligne : la carte 8 choisie, soulevée de 12 px, au-dessus des 9 autres alignées.
    await expect.poll(() => rows(handCards(page))).toEqual([1, 9]);
    const unselected = await box(handCards(page).first());
    expect(unselected.width).toBeCloseTo(60, 0);
    expect(unselected.height).toBeCloseTo(90, 0);
    for (const locator of [page.locator('header.top-bar'), actionBar(page), page.locator('.hand-dock')]) {
      expect(await inViewport(page, locator)).toBe(true);
    }
    // Main fixée en bas.
    const dock = await box(page.locator('.hand-dock'));
    expect(dock.y + dock.height).toBeCloseTo(PC.height, 0);
    await expect(page.locator('.vote-counter')).toHaveText('9 votes sur 11');
    await check();
  });

  test('tour révélé : aucun défilement, résultat dans la barre d’action, sur une rangée, à gauche des boutons', async ({
    page,
  }) => {
    const { check } = await openSession(page, revealed());

    const overflow = await pageOverflow(page);
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    expect(await tableZone(page).evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(0);
    await expect(page.locator('.seat-card-face')).toHaveCount(10);
    await expect(page.getByText("n'a pas voté")).toHaveCount(1);

    const panel = actionBar(page).locator('.result-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('.vote-counter')).toHaveCount(0);
    await expect(page.locator('.result-line-dock')).toBeHidden();
    await expect(panel.locator('.result-average .result-value')).toHaveText('5,9');
    // Une seule rangée : toutes les valeurs ont le même axe vertical, dans une barre d'environ 72 px.
    const stats = await panel.locator('.result-stat').evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      }),
    );
    expect(Math.max(...stats) - Math.min(...stats)).toBeLessThanOrEqual(2);
    const bar = await box(actionBar(page));
    expect(bar.height).toBeLessThanOrEqual(80);
    const buttons = await box(actionBar(page).locator('.action-buttons'));
    const result = await box(panel);
    expect(result.x + result.width).toBeLessThanOrEqual(buttons.x);
    for (const name of ['Masquer', 'Nouveau tour']) {
      const button = actionBar(page).getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      expect(await inViewport(page, button)).toBe(true);
    }
    expect(await inViewport(page, actionBar(page))).toBe(true);
    expect(await inViewport(page, page.locator('.hand-dock'))).toBe(true);
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toHaveAttribute('aria-disabled', 'true');
    await check();
  });
});

test.describe('PC bas 1280 × 500', () => {
  test.use({ viewport: { width: 1280, height: 500 } });

  test('seule la zone de la table défile ; barre du haut, barre d’action et main restent visibles', async ({ page }) => {
    const { check } = await openSession(page, hidden());

    const overflow = await pageOverflow(page);
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    expect(await tableZone(page).evaluate((e) => e.scrollHeight - e.clientHeight)).toBeGreaterThan(0);
    for (const locator of [page.locator('header.top-bar'), actionBar(page), page.locator('.hand-dock')]) {
      expect(await inViewport(page, locator)).toBe(true);
    }
    await expect(handCards(page)).toHaveCount(10);
    expect(await inViewport(page, handCards(page).last())).toBe(true);

    // La dernière place s'atteint en faisant défiler la table, sans bouger le reste.
    const lastSeat = page.locator('.seat').last();
    await lastSeat.scrollIntoViewIfNeeded();
    await expect(lastSeat).toBeInViewport();
    expect(await tableZone(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await inViewport(page, page.locator('header.top-bar'))).toBe(true);
    expect(await inViewport(page, actionBar(page))).toBe(true);
    await check();
  });
});

test.describe('fenêtre moyenne 800 × 700', () => {
  test.use({ viewport: { width: 800, height: 700 } });

  test('5 places au plus par rangée ; main sur une ligne, cartes d’au moins 44 px', async ({ page }) => {
    const { check } = await openSession(page, hidden());

    const seatRows = await rows(page.locator('.seat'));
    expect(Math.max(...seatRows)).toBe(5);
    expect(seatRows).toEqual([5, 5, 3]);
    await expect(handCards(page)).toHaveCount(10);
    // Une ligne : la carte choisie soulevée de 12 px, les autres sur le même axe.
    await expect.poll(() => rows(handCards(page))).toEqual([1, 9]);
    for (const card of await handCards(page).all()) {
      expect((await box(card)).width).toBeGreaterThanOrEqual(44);
    }
    const overflow = await pageOverflow(page);
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    expect(await inViewport(page, page.locator('.hand-dock'))).toBe(true);
    expect(await inViewport(page, actionBar(page))).toBe(true);
    await check();
  });
});

test.describe('téléphone 390 × 844', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('tour caché : tiroir de 2 × 5 cartes en bas, barre d’action juste au-dessus, barre du haut compacte', async ({
    page,
  }) => {
    const { check } = await openSession(page, hidden());

    const overflow = await pageOverflow(page);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(await rows(page.locator('.seat'))).toEqual([3, 3, 3, 3, 1]);

    // Tiroir : 2 lignes de 5 (la carte 8 choisie, soulevée, compte à part dans sa ligne), en bas de l'écran.
    await expect(handCards(page)).toHaveCount(10);
    expect(await lines(handCards(page))).toBe(2);
    const firstLine = await handCards(page).evaluateAll((elements) => {
      const top = elements[0].getBoundingClientRect().bottom;
      return elements.filter((e) => e.getBoundingClientRect().top < top - 2).length;
    });
    expect(firstLine).toBe(5);
    const dock = await box(page.locator('.hand-dock'));
    expect(dock.y + dock.height).toBeCloseTo(PHONE.height, 0);
    expect(await page.locator('.hand').evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none');

    // Barre d'action collée au-dessus du tiroir : compteur sur une ligne, boutons côte à côte en dessous.
    const bar = await box(actionBar(page));
    expect(bar.y + bar.height).toBeCloseTo(dock.y, 0);
    const counter = await box(page.locator('.vote-counter'));
    const clear = await box(actionBar(page).getByRole('button', { name: 'Effacer les votes' }));
    const reveal = await box(actionBar(page).getByRole('button', { name: 'Révéler les votes' }));
    expect(counter.y + counter.height).toBeLessThanOrEqual(clear.y);
    expect(clear.y).toBeCloseTo(reveal.y, 0);
    expect(clear.x + clear.width).toBeLessThan(reveal.x);

    // Barre du haut compacte : le logo seul, « Copier le lien » en icône avec son libellé accessible.
    expect((await box(page.locator('.brand-name'))).width).toBeLessThanOrEqual(1);
    const copy = page.locator('header.top-bar').getByRole('button', { name: 'Copier le lien' });
    await expect(copy).toBeVisible();
    expect((await box(copy)).width).toBeLessThan(60);
    await check();
  });

  test('tour révélé : le tiroir se replie, le résultat condensé s’affiche au-dessus de la barre d’action', async ({
    page,
  }) => {
    const { send, check } = await openSession(page, hidden());
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeVisible();

    send(revealed());
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeHidden();
    await expect.poll(async () => (await box(page.locator('.hand-dock'))).height).toBeLessThanOrEqual(0.5);
    const line = page.locator('.result-line-dock');
    await expect(line).toBeVisible();
    await expect(line.locator('.result-line-items')).toHaveText(/^Moy\.\s*5,9\s*Plus votée 5 \(6\)\s*Min 3\s*Max 13$/);
    await expect(actionBar(page).locator('.result-panel')).toBeHidden();
    const result = await box(line);
    const bar = await box(actionBar(page));
    expect(result.y + result.height).toBeLessThanOrEqual(bar.y);
    expect(bar.y + bar.height).toBeCloseTo(PHONE.height, 0);
    await expect(actionBar(page).getByRole('button', { name: 'Nouveau tour' })).toBeVisible();
    const overflow = await pageOverflow(page);
    expect(overflow.horizontal).toBeLessThanOrEqual(0);
    expect(overflow.vertical).toBeLessThanOrEqual(0);

    // Nouveau tour : le tiroir se redéploie.
    send({ ...hidden(10), round: { roundId: 'Vn4pX9tA', status: 'HIDDEN' }, lastChange: { action: 'CLEAR', byParticipantId: SELF } });
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeVisible();
    await expect(line).toHaveCount(0);
    await expect.poll(async () => (await box(page.locator('.hand-dock'))).height).toBeGreaterThan(200);
    await check();
  });

  test('animations réduites : le tiroir se replie sans transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { send, check } = await openSession(page, hidden());
    expect(await page.locator('.hand-dock').evaluate((e) => getComputedStyle(e).transitionDuration)).toMatch(/^0s(, 0s)*$/);
    send(revealed());
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeHidden();
    expect((await box(page.locator('.hand-dock'))).height).toBeLessThanOrEqual(0.5);
    await check();
  });

  test('zones tactiles : chaque carte et chaque bouton mesure au moins 44 × 44 px', async ({ page }) => {
    const { send, check } = await openSession(page, hidden());
    const all = page.getByRole('button');
    await expect(handCards(page)).toHaveCount(10);
    const check44 = async () => {
      for (const button of await all.all()) {
        if (!(await button.isVisible())) continue;
        const b = await box(button);
        expect(b.width, await button.innerText()).toBeGreaterThanOrEqual(44);
        expect(b.height, await button.innerText()).toBeGreaterThanOrEqual(44);
      }
    };
    expect(await all.count()).toBeGreaterThanOrEqual(13); // 10 cartes, 2 boutons d'action, « Copier le lien »
    await check44();
    send(revealed());
    await expect(actionBar(page).getByRole('button', { name: 'Nouveau tour' })).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Ta carte' })).toBeHidden();
    await check44();
    await check();
  });
});

test.describe('téléphone étroit 360 × 740', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('tour révélé avec égalité : aucun défilement horizontal, résultat sur deux lignes au plus', async ({ page }) => {
    const { check } = await openSession(page, revealed(TIE_SUMMARY));

    const line = page.locator('.result-line-dock');
    await expect(line).toBeVisible();
    await expect(line.locator('.result-line-items')).toHaveText(
      /^Moy\.\s*10,5\s*Plus votée 3, 5 et 13 \(3\)\s*Min 3\s*Max 21$/,
    );
    expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(0);
    expect(await lines(line.locator('.result-line-item'))).toBeLessThanOrEqual(2);
    // Rien n'est rogné : chaque élément tient dans le panneau.
    const panel = await box(line.locator('.result-line'));
    for (const item of await line.locator('.result-line-item').all()) {
      const b = await box(item);
      expect(b.x + b.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
    }
    await check();
  });

  test('consensus : moyenne et badge sur la première ligne, le reste sur la seconde', async ({ page }) => {
    const { check } = await openSession(
      page,
      revealed({ average: 13, mostVoted: { values: ['13'], count: 10 }, min: '13', max: '13', consensus: true }),
    );
    const line = page.locator('.result-line-dock');
    await expect(line.locator('.consensus-badge')).toHaveText('Consensus !');
    const average = await box(line.locator('.result-line-average'));
    const badge = await box(line.locator('.consensus-badge'));
    const mostVoted = await box(line.locator('.result-line-most-voted'));
    expect(Math.abs(badge.y + badge.height / 2 - (average.y + average.height / 2))).toBeLessThanOrEqual(4);
    expect(badge.x).toBeGreaterThan(average.x);
    expect(await lines(line.locator('.result-line-item'))).toBeLessThanOrEqual(2);
    expect(mostVoted.y).toBeGreaterThanOrEqual(average.y);
    expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(0);
    await check();
  });

  test('tour caché : aucun défilement horizontal, tiroir de 2 × 5 cartes d’au moins 44 px', async ({ page }) => {
    const { check } = await openSession(page, hidden());
    expect((await pageOverflow(page)).horizontal).toBeLessThanOrEqual(0);
    expect(await lines(handCards(page))).toBe(2);
    for (const card of await handCards(page).all()) {
      const b = await box(card);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(360);
    }
    await check();
  });
});
