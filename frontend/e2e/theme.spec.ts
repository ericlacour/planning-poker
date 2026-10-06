import { expect, Page, test } from '@playwright/test';

import hiddenRound from '../../contract/examples/session-state/hidden-round.json';
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
/** background de tokens.css, en clair et en sombre. */
const LIGHT_BACKGROUND = 'rgb(246, 244, 240)';
const DARK_BACKGROUND = 'rgb(20, 22, 29)';
/** card-ink sombre : contour de la carte choisie. */
const DARK_CARD_INK = 'rgb(184, 50, 61)';

/** Webservice simulé : éveillé, session existante ; jeton rangé une seule fois (il survit au rechargement). */
async function openSession(page: Page) {
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
    ([id, token]) => {
      if (!sessionStorage.getItem('pp.e2e.seeded')) {
        localStorage.setItem(`pp.token.${id}`, token);
        sessionStorage.setItem('pp.e2e.seeded', '1');
      }
    },
    [SESSION_ID, TOKEN],
  );
  // Instantané vu par Alice, votante qui a choisi 8.
  return fakeSessionSocket(page, SESSION_ID, (ws) => ws.send(JSON.stringify(hiddenRound)));
}

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const storedTheme = (page: Page) => page.evaluate(() => localStorage.getItem('pp.theme'));

test('choisir son thème : sombre automatique sans ombre, puis « Clair » forcé et mémorisé', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const server = await openSession(page);
  await page.goto(`/s/${SESSION_ID}`);

  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  await expect(trigger).toHaveText('Alice');

  // Premier passage : pas de data-theme, le système sombre s'applique.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  expect(await background(page)).toBe(DARK_BACKGROUND);
  expect(await storedTheme(page)).toBeNull();

  // Sombre : aucune ombre d'élévation ; la carte choisie a un contour card-ink.
  await expect(page.locator('.session-table')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.action-bar')).toHaveCSS('box-shadow', 'none');
  const selected = page.locator('.poker-card-selected');
  await expect(selected).toHaveCSS('box-shadow', 'none');
  await expect(selected).toHaveCSS('border-top-color', DARK_CARD_INK);

  // « Automatique » coché ; choisir « Clair » l'applique sans rechargement et ferme le menu.
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  await expect(menu.getByRole('group', { name: 'Thème' })).toBeVisible();
  // Sombre : la liste du menu se détache par sa surface (surface-muted), sans ombre.
  await expect(page.locator('.participant-menu-list')).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.participant-menu-list')).toHaveCSS(
    'background-color',
    'rgb(38, 42, 53)',
  );
  await expect(menu.getByRole('menuitemradio', { name: 'Automatique' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toBeFocused();
  await menu.getByRole('menuitemradio', { name: 'Clair' }).click();
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await background(page)).toBe(LIGHT_BACKGROUND);
  expect(await storedTheme(page)).toBe('light');
  await expect(page.locator('.session-table')).not.toHaveCSS('box-shadow', 'none');

  // Rien n'est parti sur le WebSocket, hormis le hello.
  expect(server.received.map((m) => (m as { type: string }).type)).toEqual(['hello']);

  // Coché à la réouverture.
  await trigger.click();
  await expect(menu.getByRole('menuitemradio', { name: 'Clair' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');

  // Rechargement : clair dès le démarrage, avant même la session.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(trigger).toHaveText('Alice');
  expect(await background(page)).toBe(LIGHT_BACKGROUND);
});

test("« Sombre » forcé l'emporte sur un système clair, « Automatique » le retire", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openSession(page);
  await page.goto(`/s/${SESSION_ID}`);

  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  const menu = page.getByRole('menu', { name: 'Menu du participant : Alice' });
  expect(await background(page)).toBe(LIGHT_BACKGROUND);

  // Au clavier : de « Je vote », Fin va à « Sombre ».
  await trigger.click();
  await expect(menu.getByRole('menuitemradio', { name: 'Je vote' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitemradio', { name: 'Sombre' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await background(page)).toBe(DARK_BACKGROUND);
  expect(await storedTheme(page)).toBe('dark');
  await expect(page.locator('.session-table')).toHaveCSS('box-shadow', 'none');

  await trigger.click();
  await menu.getByRole('menuitemradio', { name: 'Automatique' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  expect(await background(page)).toBe(LIGHT_BACKGROUND);
  expect(await storedTheme(page)).toBe('auto');
});

test('une valeur corrompue de pp.theme vaut « Automatique »', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('pp.theme', 'bleu'));
  await openSession(page);
  await page.goto(`/s/${SESSION_ID}`);

  const trigger = page.getByRole('button', { name: 'Menu du participant : Alice' });
  await expect(trigger).toHaveText('Alice');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  expect(await background(page)).toBe(DARK_BACKGROUND);
  await trigger.click();
  await expect(page.getByRole('menuitemradio', { name: 'Automatique' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test.describe('téléphone en sombre', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("le tiroir de la main n'a pas d'ombre", async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openSession(page);
    await page.goto(`/s/${SESSION_ID}`);

    await expect(page.locator('.hand-dock > .hand')).toBeVisible();
    await expect(page.locator('.hand-dock > .hand')).toHaveCSS('box-shadow', 'none');
  });
});
