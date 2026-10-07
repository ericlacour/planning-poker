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
  /**
   * Opacité du dos posé sur la face (`::after`), relevée animation en pause au premier quart (dos visible) puis au
   * troisième quart (dos retiré) du retournement, après son délai ; `none` s'il n'y a pas de dos.
   */
  readonly back: { readonly early: string; readonly late: string } | 'none';
  readonly synthesis: string;
  readonly live: string;
  /** Délai entre l'apparition de la face et celle de la synthèse (ms). */
  readonly synthesisAfter: number;
}

/**
 * Observe la révélation qui va arriver. Un `MutationObserver`, posé avant l'envoi de l'instantané (`await`), date
 * l'apparition de la face de Bob dès l'écriture du DOM, sans attendre une image : démarrer le chrono à la première
 * image retardait la mesure (jusqu'à 150 ms sur WebKit en CI). À la première image suivante, on relève son nom
 * accessible, ses animations, la synthèse et l'annonce ; puis on attend que la synthèse devienne visible. Le dos n'est
 * visible que pendant les 100 premières ms : plutôt que de le lire à l'image où le test se réveille (une image en
 * retard lisait 0 sur WebKit en CI), on met l'animation en pause, on la place au premier puis au troisième quart, et on la relance. La fenêtre
 * reste bornée par les 400 ms de `session-flipping` : au-delà, la face n'a plus ni dos ni animation.
 * Renvoie la fonction qui rend ces relevés, à appeler après l'envoi.
 */
async function observeReveal(
  page: Page,
  synthesisSelector = '.result-panel',
): Promise<() => Promise<Observed>> {
  await page.evaluate((selector) => {
    const w = window as unknown as { flipAt?: number; synthesisAtFlip?: string };
    const visibility = () => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).visibility : 'missing';
    };
    const seen = () => {
      if (w.flipAt !== undefined || !document.querySelector('.seat-card-flip')) return;
      w.flipAt = performance.now();
      w.synthesisAtFlip = visibility();
      observer.disconnect();
    };
    const observer = new MutationObserver(seen);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  }, synthesisSelector);
  return () =>
    page.evaluate(async (selector) => {
      const w = window as unknown as { flipAt?: number; synthesisAtFlip?: string };
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      while (w.flipAt === undefined) await frame();
      await frame();
      const start = w.flipAt;
      const face = document.querySelector('.seat-card-flip')!;
      // Synthèse absente : « missing » plutôt qu'une TypeError, pour un échec lisible.
      const synthesis = () => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).visibility : 'missing';
      };
      // Opacité du dos à une fraction de la durée du retournement, après son délai (`--flip-delay`).
      const backAt = (animation: Animation, fraction: number) => {
        const timing = animation.effect!.getComputedTiming();
        animation.currentTime = Number(timing.delay) + Number(timing.duration) * fraction;
        return getComputedStyle(face, '::after').opacity;
      };
      const back = () => {
        if (getComputedStyle(face, '::after').content === 'none') return 'none' as const;
        const animation = face
          .getAnimations()
          .find((a) => (a as CSSAnimation).animationName === 'seat-card-flip');
        if (!animation) return { early: 'no-animation', late: 'no-animation' };
        const wasRunning = animation.playState === 'running';
        const resumeAt = animation.currentTime;
        animation.pause();
        const measured = { early: backAt(animation, 0.25), late: backAt(animation, 0.75) };
        // Reprendre là où elle était ; une animation déjà finie le reste (play() la rejouerait depuis le début).
        if (wasRunning && resumeAt !== null) {
          animation.currentTime = resumeAt;
          animation.play();
        } else {
          animation.finish();
        }
        return measured;
      };
      const observed = {
        label: face.getAttribute('aria-label'),
        animations: face.getAnimations().map((a) => (a as CSSAnimation).animationName),
        flipping: !!document.querySelector('app-session-page.session-flipping'),
        back: back(),
        synthesis: w.synthesisAtFlip!,
        live:
          document.querySelector('div.visually-hidden[aria-live="polite"]')?.textContent?.trim() ??
          '',
      };
      // Synthèse déjà visible à l'apparition de la face (mouvement réduit) : aucun délai.
      if (['visible', 'missing'].includes(observed.synthesis))
        return { ...observed, synthesisAfter: 0 };
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

  const observing = await observeReveal(page);
  server.routes[0].send(JSON.stringify(revealed));
  const observed = await observing();

  // État à jour dès la réception : face nommée et annonce ; seul l'affichage est animé.
  expect(observed.label).toBe('Carte 8');
  expect(observed.live).toMatch(/^Votes révélés\. Moyenne 6,5\./);
  expect(observed.flipping).toBe(true);
  expect(observed.animations).toEqual(['seat-card-flip']);
  expect(observed.back).toEqual({ early: '1', late: '0' });
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

  const observing = await observeReveal(page);
  server.routes[0].send(JSON.stringify(revealed));
  const observed = await observing();

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

    const observing = await observeReveal(page, '.result-line');
    server.routes[0].send(JSON.stringify(revealed));
    const observed = await observing();

    expect(observed.flipping).toBe(true);
    expect(observed.synthesis).toBe('hidden');
    expect(observed.synthesisAfter).toBeGreaterThan(250);
    expect(observed.synthesisAfter).toBeLessThan(1_000);
    await expect(page.locator('.result-line')).toBeVisible();
    await check();
  });
});
