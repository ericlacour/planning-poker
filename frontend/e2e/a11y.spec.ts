import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
import revealedConsensus from '../../contract/examples/session-state/revealed-consensus.json';
import { fakeSessionSocket } from './fake-session-socket';

const API = 'http://127.0.0.1:4310';
const APP = 'http://127.0.0.1:4300';
const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const CORS = {
  'Access-Control-Allow-Origin': APP,
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};
/** WCAG 2.2 AA, tel que l'étiquette axe-core (aucune règle désactivée, aucun nœud exclu). */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const THEMES = ['light', 'dark'] as const;
/** Téléphone, et PC 1280 × 800 zoomé à 200 % (même fenêtre CSS de 640 × 400). */
const VIEWPORTS = [
  { name: '360 × 740', size: { width: 360, height: 740 }, audit: true },
  { name: '1280 × 800 à 200 %', size: { width: 640, height: 400 }, audit: false },
];

const health = (page: Page, up: () => boolean = () => true) =>
  page.route(`${API}/api/health`, (route) =>
    up()
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS,
          body: '{"status":"UP"}',
        })
      : route.fulfill({ status: 503, body: 'Service Unavailable' }),
  );

/** Vérification de la session : existante, introuvable ou réseau coupé. */
const sessionCheck = (page: Page, answer: 'exists' | 'notFound' | 'abort') =>
  page.route(`${API}/api/sessions/${SESSION_ID}`, (route) => {
    if (answer === 'abort') return route.abort('connectionrefused');
    if (answer === 'exists') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({
      status: 404,
      contentType: 'application/problem+json',
      headers: CORS,
      body: JSON.stringify({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Session not found.',
        instance: `/api/sessions/${SESSION_ID}`,
        code: 'SESSION_NOT_FOUND',
      }),
    });
  });

/** Page de session ouverte avec un jeton rangé, sur l'instantané donné (vu par Alice). */
async function openSession(page: Page, snapshot: object) {
  await health(page);
  await sessionCheck(page, 'exists');
  await page.addInitScript(
    ([id, token]) => localStorage.setItem(`pp.token.${id}`, token),
    [SESSION_ID, TOKEN],
  );
  await fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(snapshot)));
  await page.goto(`/s/${SESSION_ID}`);
  await expect(page.locator('.seat-pseudo').first()).toHaveText('Alice');
}

interface Screen {
  readonly name: string;
  readonly open: (page: Page) => Promise<void>;
}

const SCREENS: readonly Screen[] = [
  {
    name: 'accueil',
    open: async (page) => {
      await health(page);
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Créer une session' })).toBeVisible();
    },
  },
  {
    name: 'rejoindre',
    open: async (page) => {
      await health(page);
      await sessionCheck(page, 'exists');
      await page.goto(`/s/${SESSION_ID}`);
      await expect(page.getByRole('button', { name: 'Rejoindre' })).toBeVisible();
    },
  },
  {
    name: 'session introuvable',
    open: async (page) => {
      await health(page);
      await sessionCheck(page, 'notFound');
      await page.goto(`/s/${SESSION_ID}`);
      await expect(
        page.getByRole('heading', { name: "Cette session n'existe plus." }),
      ).toBeVisible();
    },
  },
  {
    name: 'serveur injoignable',
    open: async (page) => {
      await health(page);
      await sessionCheck(page, 'abort');
      await page.goto(`/s/${SESSION_ID}`);
      await expect(page.getByText('Impossible de joindre le serveur.')).toBeVisible();
    },
  },
  {
    name: 'réveil en cours',
    open: async (page) => {
      await health(page, () => false);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Réveil du serveur…' })).toBeVisible();
    },
  },
  {
    name: 'réveil échoué',
    open: async (page) => {
      await page.clock.install();
      await health(page, () => false);
      await page.goto('/');
      await page.clock.runFor(2_000);
      await expect(page.getByRole('heading', { name: 'Réveil du serveur…' })).toBeVisible();
      await page.clock.runFor(180_000);
      await expect(page.getByRole('heading', { name: 'Le serveur ne répond pas.' })).toBeVisible();
    },
  },
  {
    name: 'session cachée, menu du participant ouvert',
    open: async (page) => {
      await openSession(page, hiddenRound);
      await page.getByRole('button', { name: 'Menu du participant : Alice' }).click();
      await expect(page.getByRole('menu', { name: 'Menu du participant : Alice' })).toBeVisible();
    },
  },
  {
    name: 'session révélée',
    open: async (page) => {
      await openSession(page, revealedConsensus);
      await expect(page.locator('.consensus-badge').first()).toBeAttached();
    },
  },
];

/** Thème forcé, comme si l'utilisateur l'avait choisi dans le menu du participant. */
const useTheme = (page: Page, theme: (typeof THEMES)[number]) =>
  page.addInitScript((value) => localStorage.setItem('pp.theme', value), theme);

/** Violations résumées (règle, nœuds) pour un message d'échec lisible. */
async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    nodes: v.nodes.map((n) => n.target.join(' ')),
  }));
}

for (const theme of THEMES) {
  test.describe(`axe, thème ${theme === 'light' ? 'clair' : 'sombre'}`, () => {
    for (const screen of SCREENS) {
      test(`${screen.name} : aucune violation WCAG 2.2 AA`, async ({ page }) => {
        await useTheme(page, theme);
        await screen.open(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

/** Défilement horizontal du document, et actionnables visibles de moins de 44 × 44 px. */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const selector =
      'a[href], button, input, select, textarea, [role="button"], [role="radio"], [role="menuitemradio"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
    const small = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: false }))
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5))
      .map(
        ({ e, r }) =>
          `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} « ${e.textContent?.trim() || e.getAttribute('aria-label')} » ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
    // Défilement horizontal caché dans une zone qui défile (ex. `.session-scroll`, dont l'overflow-y rend
    // l'overflow-x automatique).
    const scrolling = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((e) => e.checkVisibility({ visibilityProperty: true, opacityProperty: false }))
      .filter((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowX))
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map(
        (e) =>
          `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${e.scrollWidth} > ${e.clientWidth}`,
      );
    return {
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
      scrolling,
      small,
    };
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`fenêtre ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    for (const screen of SCREENS) {
      test(`${screen.name} : pas de défilement horizontal, cibles d'au moins 44 × 44 px${viewport.audit ? ', axe' : ''}`, async ({
        page,
      }) => {
        await screen.open(page);
        const problems = await layoutProblems(page);
        expect(problems.horizontal).toBeLessThanOrEqual(0);
        expect(problems.scrolling).toEqual([]);
        expect(problems.small).toEqual([]);
        // Téléphone : la mise en page propre au téléphone (tiroir, résultat condensé) passe aussi l'audit axe.
        if (viewport.audit) expect(await violations(page)).toEqual([]);
      });
    }
  });
}
