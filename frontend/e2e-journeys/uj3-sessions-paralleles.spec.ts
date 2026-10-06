import { action, counter, create, expect, join, seat, test, vote } from './journey-helpers';

/**
 * UJ-3 : deux équipes, deux sessions en même temps sur le même webservice. Karim crée la sienne et vote pendant
 * que l'autre session vote et révèle : aucun pseudo, vote, révélation ni compteur ne passe de l'une à l'autre.
 */

test('UJ-3 : deux sessions en parallèle restent étanches (pseudos, votes, révélation, compteur)', async ({
  contexts,
}) => {
  // Session B : Léa et Hugo.
  const { page: lea, sessionId: sessionB } = await create(await contexts.open(), 'Léa', 'Je vote');
  const hugo = await join(await contexts.open(), lea.url(), 'Hugo', 'Je vote');
  const [karimContext, nadiaContext] = [await contexts.open(), await contexts.open()];

  // Pendant que la session B vote et révèle, Karim crée la session A en votant, Nadia la rejoint, Karim vote.
  const [{ karim, nadia, sessionA }] = await Promise.all([
    (async () => {
      const { page: karim, sessionId: sessionA } = await create(karimContext, 'Karim', 'Je vote');
      const nadia = await join(nadiaContext, karim.url(), 'Nadia', 'Je vote');
      await vote(karim, '8');
      return { karim, nadia, sessionA };
    })(),
    (async () => {
      await Promise.all([vote(lea, '3'), vote(hugo, '13')]);
      await expect(counter(lea)).toHaveText('2 votes sur 2');
      await action(lea, 'Révéler les votes').click();
    })(),
  ]);
  expect(sessionA).not.toBe(sessionB);

  // La session B a révélé ses seuls votes.
  for (const page of [lea, hugo]) {
    await expect(
      seat(page, 'Léa').getByRole('img', { name: 'Carte 3', exact: true }),
    ).toBeVisible();
    await expect(
      seat(page, 'Hugo').getByRole('img', { name: 'Carte 13', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.result-average .result-value')).toHaveText('8');
  }

  // Session A inchangée : tour caché, ses seuls participants, son compteur, aucun résultat.
  for (const page of [karim, nadia]) {
    const seats = page.getByRole('list', { name: 'Participants' }).getByRole('listitem');
    await expect(seats).toHaveCount(2);
    await expect(seat(page, 'Karim')).toBeVisible();
    await expect(seat(page, 'Nadia')).toBeVisible();
    await expect(page.getByText(/Léa|Hugo/)).toHaveCount(0);
    await expect(counter(page)).toHaveText('1 vote sur 2');
    await expect(action(page, 'Révéler les votes')).toBeVisible();
    await expect(page.locator('.result-panel')).toHaveCount(0);
    await expect(page.getByText('Votes révélés')).toHaveCount(0);
  }
  await expect(
    seat(nadia, 'Karim').getByRole('img', { name: 'a voté', exact: true }),
  ).toBeVisible();
  await expect(
    seat(karim, 'Karim').getByRole('img', { name: 'Carte 8', exact: true }),
  ).toBeVisible();
  await expect(
    seat(karim, 'Nadia').getByRole('img', { name: "n'a pas voté", exact: true }),
  ).toBeVisible();

  // Et dans l'autre sens : rien de la session A dans la session B.
  for (const page of [lea, hugo]) {
    await expect(
      page.getByRole('list', { name: 'Participants' }).getByRole('listitem'),
    ).toHaveCount(2);
    await expect(page.getByText(/Karim|Nadia/)).toHaveCount(0);
    await expect(page.locator('.result-max .result-value')).toHaveText('13');
  }

  // Nadia vote à son tour ; la session A révèle sa propre synthèse, sans effet sur la session B.
  await vote(nadia, '5');
  await expect(counter(karim)).toHaveText('2 votes sur 2');
  await action(karim, 'Révéler les votes').click();
  await expect(karim.locator('.result-average .result-value')).toHaveText('6,5');
  await expect(
    seat(nadia, 'Karim').getByRole('img', { name: 'Carte 8', exact: true }),
  ).toBeVisible();
  await expect(lea.locator('.result-average .result-value')).toHaveText('8');
  await expect(lea.getByText(/Karim|Nadia/)).toHaveCount(0);
});
