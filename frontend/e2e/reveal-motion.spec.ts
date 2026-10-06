import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import { fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const BOB = hiddenRound.participants[1].participantId;
const ROUND = hiddenRound.round.roundId;
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Webservice simulé : éveillé, session existante ; jeton rangé pour la session. */
async function openWithToken(page: Page) {
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
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  return async () => {
    expect(
      await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    ).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
}

const [alice, bob, , , emma] = hiddenRound.participants;

/** Tour caché vu par Alice : Alice a voté 5, Bob a voté (caché), Emma observe. */
const hidden = {
  ...hiddenRound,
  version: 8,
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: null, hasVoted: true },
    emma,
  ],
  progress: { voted: 2, expected: 2 },
  lastChange: { action: 'VOTE', byParticipantId: BOB },
};

/** Le même tour révélé par Bob : 5 et 8. */
const revealed = {
  ...hidden,
  version: 9,
  round: { roundId: ROUND, status: 'REVEALED' },
  participants: [
    { ...alice, vote: '5', hasVoted: true },
    { ...bob, vote: '8', hasVoted: true },
    emma,
  ],
  summary: {
    average: 6.5,
    mostVoted: { values: ['5', '8'], count: 1 },
    min: '5',
    max: '8',
    consensus: false,
  },
  lastChange: { action: 'REVEAL', byParticipantId: BOB },
};

interface Observed {
  readonly label: string | null;
  readonly animations: string[];
  readonly flipping: boolean;
  /** Opacité du dos posé sur la face (`::after`), `none` s'il n'y en a pas. */
  readonly back: string;
  readonly synthesis: string;
  readonly live: string;
  /** Délai entre l'apparition de la face et celle de la synthèse (ms). */
  readonly synthesisAfter: number;
}

/**
 * Observe, dans la page et à chaque image, la révélation qui va arriver : l'instant où la face de Bob apparaît (son
 * nom accessible, ses animations, la synthèse et l'annonce à ce moment-là), puis celui où la synthèse devient visible.
 */
function observeReveal(page: Page, synthesisSelector = '.result-panel'): Promise<Observed> {
  return page.evaluate(async (selector) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let face: Element | null = null;
    while (!(face = document.querySelector('.seat-card-flip'))) await frame();
    const start = performance.now();
    // Synthèse absente : « missing » plutôt qu'une TypeError, pour un échec lisible.
    const synthesis = () => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).visibility : 'missing';
    };
    const observed = {
      label: face.getAttribute('aria-label'),
      animations: face.getAnimations().map((a) => (a as CSSAnimation).animationName),
      flipping: !!document.querySelector('app-session-page.session-flipping'),
      back:
        getComputedStyle(face, '::after').content === 'none'
          ? 'none'
          : getComputedStyle(face, '::after').opacity,
      synthesis: synthesis(),
      live:
        document.querySelector('div.visually-hidden[aria-live="polite"]')?.textContent?.trim() ??
        '',
    };
    while (!['visible', 'missing'].includes(synthesis()) && performance.now() - start < 2_000)
      await frame();
    return { ...observed, synthesisAfter: performance.now() - start };
  }, synthesisSelector);
}

test('révélation par un autre : les faces se retournent, puis la synthèse apparaît', async ({
  page,
}) => {
  const check = await watchPage(page);
  await openWithToken(page);
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(hidden)));
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

  const observing = observeReveal(page);
  server.routes[0].send(JSON.stringify(revealed));
  const observed = await observing;

  // État à jour dès la réception : face nommée et annonce ; seul l'affichage est animé.
  expect(observed.label).toBe('Carte 8');
  expect(observed.live).toMatch(/^Votes révélés\. Moyenne 6,5\./);
  expect(observed.flipping).toBe(true);
  expect(observed.animations).toEqual(['seat-card-flip']);
  expect(observed.back).toBe('1');
  expect(observed.synthesis).toBe('hidden');
  expect(observed.synthesisAfter).toBeGreaterThan(250);
  expect(observed.synthesisAfter).toBeLessThan(1_000);

  // Ma carte ne bouge pas ; la synthèse reste ensuite visible.
  await expect(page.locator('.seat-self .seat-card-face')).not.toHaveClass(/seat-card-flip/);
  await expect(page.locator('app-session-page')).not.toHaveClass(/session-flipping/);
  await expect(page.locator('.result-average .result-value')).toBeVisible();
  await check();
});

test('mouvement réduit : faces et synthèse aussitôt, sans animation', async ({ page }) => {
  const check = await watchPage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithToken(page);
  const server = await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(hidden)));
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

  const observing = observeReveal(page);
  server.routes[0].send(JSON.stringify(revealed));
  const observed = await observing;

  expect(observed.label).toBe('Carte 8');
  expect(observed.flipping).toBe(false);
  expect(observed.animations).toEqual([]);
  expect(observed.back).toBe('none');
  expect(observed.synthesis).toBe('visible');
  expect(observed.synthesisAfter).toBeLessThan(50);
  await check();
});

test.describe('téléphone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('la ligne de synthèse reste cachée pendant le retournement, puis apparaît', async ({
    page,
  }) => {
    const check = await watchPage(page);
    await openWithToken(page);
    const server = await fakeSessionSocket(page, SESSION_ID, (ws) =>
      ws.send(JSON.stringify(hidden)),
    );
    await page.goto(`/s/${SESSION_ID}`);
    await expect(page.locator('.vote-counter')).toHaveText('2 votes sur 2');

    const observing = observeReveal(page, '.result-line');
    server.routes[0].send(JSON.stringify(revealed));
    const observed = await observing;

    expect(observed.flipping).toBe(true);
    expect(observed.synthesis).toBe('hidden');
    expect(observed.synthesisAfter).toBeGreaterThan(250);
    expect(observed.synthesisAfter).toBeLessThan(1_000);
    await expect(page.locator('.result-line')).toBeVisible();
    await check();
  });
});
