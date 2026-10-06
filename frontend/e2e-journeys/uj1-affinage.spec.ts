import { action, APP, counter, create, expect, join, seat, test, vote } from './journey-helpers';

/**
 * UJ-1 : Eric mène l'affinage. Il crée la session comme observateur, partage le lien, sept votants le rejoignent
 * et votent ; il révèle, lit le résultat, efface et fait revoter jusqu'au consensus. Contre le vrai webservice.
 */

const VOTERS = ['Alice', 'Bob', 'Chloé', 'David', 'Emma', 'Farid', 'Gaëlle'];
/** Premier tour : un 3, un 13, cinq 5 → moyenne 41 / 7 ≈ 5,9, pas de consensus. */
const FIRST_ROUND = ['3', '13', '5', '5', '5', '5', '5'];

test("UJ-1 : création par un observateur, sept votants, révélation, effacement et revote jusqu'au consensus", async ({
  contexts,
  browserName,
}) => {
  // Eric crée la session comme observateur.
  const ericContext = await contexts.open();
  // WebKit ne connaît pas les permissions de presse-papiers de Playwright : la copie est lue sur Chromium seul.
  const clipboard = browserName === 'chromium';
  if (clipboard)
    await ericContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  const { page: eric, sessionId } = await create(ericContext, 'Eric', "J'observe");
  await expect(eric.getByText('Tu observes')).toBeVisible();
  await expect(eric.getByText('Partage le lien pour inviter ton équipe')).toBeVisible();

  // Il copie le lien.
  let sessionUrl = eric.url();
  expect(sessionUrl).toBe(`${APP}/s/${sessionId}`);
  if (clipboard) {
    const invite = eric.locator('.invite');
    await invite.getByRole('button', { name: 'Copier le lien' }).click();
    await expect(invite.getByRole('button', { name: 'Lien copié' })).toBeVisible();
    sessionUrl = await eric.evaluate(() => navigator.clipboard.readText());
    expect(sessionUrl).toBe(`${APP}/s/${sessionId}`);
  }

  // Les sept votants rejoignent par le lien, l'un après l'autre.
  const voters = [];
  for (const [i, pseudo] of VOTERS.entries()) {
    voters.push(await join(await contexts.open(), sessionUrl, pseudo, 'Je vote'));
    await expect(seat(eric, pseudo)).toBeVisible();
    await expect(counter(eric)).toHaveText(`0 vote sur ${i + 1}`);
  }
  await expect(eric.getByRole('list', { name: 'Participants' }).getByRole('listitem')).toHaveCount(
    8,
  );

  // Ils votent : la table d'Eric montre au fur et à mesure qui a voté, sans la valeur.
  for (const [i, page] of voters.entries()) {
    const voterSeat = seat(eric, VOTERS[i]);
    await expect(voterSeat.getByRole('img', { name: "n'a pas voté", exact: true })).toBeVisible();
    await vote(page, FIRST_ROUND[i]);
    await expect(voterSeat.getByRole('img', { name: 'a voté', exact: true })).toBeVisible();
    await expect(counter(eric)).toHaveText(`${i + 1} ${i === 0 ? 'vote' : 'votes'} sur 7`);
    for (const later of VOTERS.slice(i + 1)) {
      await expect(
        seat(eric, later).getByRole('img', { name: "n'a pas voté", exact: true }),
      ).toBeVisible();
    }
  }

  // Révélation : votes nominatifs, moyenne, pas de consensus, chez Eric comme chez un votant.
  await action(eric, 'Révéler les votes').click();
  for (const page of [eric, voters[3]]) {
    for (const [i, pseudo] of VOTERS.entries()) {
      await expect(
        seat(page, pseudo).getByRole('img', { name: `Carte ${FIRST_ROUND[i]}`, exact: true }),
      ).toBeVisible();
    }
    await expect(page.locator('.result-average .result-value')).toHaveText('5,9');
    await expect(page.locator('.consensus-badge')).toHaveCount(0);
  }

  // Effacement (« Nouveau tour »), revote à 5 partout.
  await action(eric, 'Nouveau tour').click();
  await expect(counter(eric)).toHaveText('0 vote sur 7');
  for (const page of voters) await vote(page, '5');
  await expect(counter(eric)).toHaveText('7 votes sur 7');

  await action(eric, 'Révéler les votes').click();
  for (const page of [eric, voters[0]]) {
    for (const pseudo of VOTERS) {
      await expect(
        seat(page, pseudo).getByRole('img', { name: 'Carte 5', exact: true }),
      ).toBeVisible();
    }
    await expect(page.locator('.result-average .result-value')).toHaveText('5');
    await expect(page.locator('.consensus-badge').filter({ visible: true })).toHaveText(
      'Consensus !',
    );
  }
});
