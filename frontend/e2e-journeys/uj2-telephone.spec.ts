import { BrowserContextOptions, Page } from '@playwright/test';

import {
  card,
  Contexts,
  create,
  cuttableSocket,
  expect,
  join,
  reconnecting,
  seat,
  test,
  vote,
} from './journey-helpers';

/**
 * UJ-2 : Sofia vote depuis son téléphone. Une coupure réseau la montre « déconnecté » chez les autres et lui
 * affiche « Reconnexion… » ; au retour elle retrouve sa place et sa carte. Si elle rejoint avec son pseudo depuis
 * un autre appareil pendant une coupure, le nouvel appareil reprend sa place et l'ancien l'apprend à son retour.
 * Enfin, un onglet caché et inactif (seul `visibilityState` est simulé) au-delà du seuil de vivacité du vrai
 * webservice ne passe jamais « déconnecté ». Les minuteries ne sont pas ralenties ici : un onglet réellement mis en
 * veille est couvert par le pong de protocole du webservice (`LivenessTest`) et par le test de 20 min en horloge
 * simulée de `e2e/reconnect.spec.ts`.
 */

/** Gabarit téléphone : 390 × 844, tactile. */
const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
};

/** Seuil de vivacité du webservice (`planning-poker.liveness-timeout=15s`), dépassé d'une marge. */
const BACKGROUND_MS = 20_000;

/** Eric ouvre la session sur son poste ; le téléphone de Sofia est prêt, sans page ouverte. */
async function ericAndPhone(contexts: Contexts) {
  const { page: eric } = await create(await contexts.open(), 'Eric', 'Je vote');
  const phone = await contexts.open(PHONE);
  return { eric, phone, sessionUrl: eric.url() };
}

test('UJ-2 : sur téléphone, Sofia vote, perd le réseau, revient à sa place, puis reprend sa place depuis un autre appareil', async ({
  contexts,
}) => {
  const { eric, phone, sessionUrl } = await ericAndPhone(contexts);
  const network = await cuttableSocket(phone);
  const sofia = await join(phone, sessionUrl, 'Sofia', 'Je vote');
  await vote(sofia, '8', { tap: true });
  await expect(seat(eric, 'Sofia').getByRole('img', { name: 'a voté', exact: true })).toBeVisible();

  // Coupure : « Reconnexion… » chez Sofia, « déconnecté » chez Eric.
  await network.cut();
  await expect(reconnecting(sofia)).toBeVisible();
  await expect(seat(eric, 'Sofia')).toContainText('déconnecté');
  await expect(seat(sofia, 'Sofia')).toBeVisible();

  // Rétablissement : bannière disparue, même place, carte 8 toujours choisie.
  network.restore();
  await expect(reconnecting(sofia)).toHaveCount(0, { timeout: 20_000 });
  await expect(seat(sofia, 'Sofia')).toContainText('(toi)');
  await expect(card(sofia, '8')).toHaveAttribute('aria-pressed', 'true');
  await expect(seat(eric, 'Sofia')).not.toContainText('déconnecté');
  await expect(seat(eric, 'Sofia').getByRole('img', { name: 'a voté', exact: true })).toBeVisible();
  await expect(eric.getByRole('list', { name: 'Participants' }).getByRole('listitem')).toHaveCount(
    2,
  );

  // Tant que le premier téléphone est connecté, le pseudo « Sofia » est refusé ailleurs.
  const secondPhone = await (await contexts.open(PHONE)).newPage();
  await secondPhone.goto(sessionUrl);
  await secondPhone.getByLabel('Ton pseudo').fill('Sofia');
  await secondPhone.getByRole('radio', { name: 'Je vote', exact: true }).click();
  await expect(secondPhone.getByRole('radio', { name: 'Je vote', exact: true })).toBeChecked();
  await secondPhone.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  await expect(secondPhone.getByText('Ce pseudo est déjà pris dans cette session.')).toBeVisible();

  // Nouvelle coupure : Sofia rejoint avec son pseudo depuis le second téléphone, qui retrouve son vote.
  await network.cut();
  await expect(seat(eric, 'Sofia')).toContainText('déconnecté');
  await expect(secondPhone.getByRole('radio', { name: 'Je vote', exact: true })).toBeChecked();
  await secondPhone.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  await expect(seat(secondPhone, 'Sofia')).toContainText('(toi)');
  await expect(card(secondPhone, '8')).toHaveAttribute('aria-pressed', 'true');
  await expect(seat(eric, 'Sofia')).not.toContainText('déconnecté');
  await expect(eric.getByRole('list', { name: 'Participants' }).getByRole('listitem')).toHaveCount(
    2,
  );

  // Au rétablissement, le premier téléphone apprend que sa place a été reprise.
  network.restore();
  await expect(
    sofia
      .getByRole('status')
      .filter({ hasText: 'Ta place a été reprise depuis un autre appareil.' }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(sofia.getByRole('button', { name: 'Rejoindre', exact: true })).toBeVisible();
  await expect(sofia.getByLabel('Ton pseudo')).toHaveValue('Sofia');
  await expect(card(secondPhone, '8')).toHaveAttribute('aria-pressed', 'true');
  await expect(seat(eric, 'Sofia')).not.toContainText('déconnecté');
});

/**
 * Simule un onglet caché (ou revenu au premier plan) : seuls `visibilityState`, `hidden` et `visibilitychange`
 * changent ; les minuteries de la page ne sont pas ralenties.
 */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('onglet caché et inactif plus longtemps que le seuil de vivacité (minuteries non ralenties) : jamais « déconnecté » chez les autres', async ({
  contexts,
}) => {
  const { eric, phone, sessionUrl } = await ericAndPhone(contexts);
  const sofia = await join(phone, sessionUrl, 'Sofia', 'Je vote');
  await vote(sofia, '8', { tap: true });
  await expect(seat(eric, 'Sofia')).not.toContainText('déconnecté');

  // Chez Eric, toute apparition du texte « déconnecté » dans la liste des participants est relevée, même fugace.
  await eric.evaluate(() => {
    const w = window as unknown as { sawOffline: boolean };
    w.sawOffline = false;
    const check = () => {
      const list = document.querySelector('ul[aria-label="Participants"]') as HTMLElement | null;
      if (list?.innerText.includes('déconnecté')) w.sawOffline = true;
    };
    new MutationObserver(check).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });

  await setHidden(sofia, true);
  // Seule attente fixe autorisée : la durée de l'onglet caché, au-delà du seuil de 15 s du webservice. Sofia reste
  // inactive ; ses minuteries tournent normalement (le ralentissement réel est couvert ailleurs, voir plus haut).
  await sofia.waitForTimeout(BACKGROUND_MS);
  expect(await eric.evaluate(() => (window as unknown as { sawOffline: boolean }).sawOffline)).toBe(
    false,
  );
  await expect(seat(eric, 'Sofia')).not.toContainText('déconnecté');
  await expect(reconnecting(sofia)).toHaveCount(0);

  await setHidden(sofia, false);
  await expect(card(sofia, '8')).toHaveAttribute('aria-pressed', 'true');
  await expect(seat(eric, 'Sofia').getByRole('img', { name: 'a voté', exact: true })).toBeVisible();
  expect(await eric.evaluate(() => (window as unknown as { sawOffline: boolean }).sawOffline)).toBe(
    false,
  );
});
