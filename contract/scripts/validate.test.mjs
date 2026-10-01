// Cas de la matrice I/O de la story 1.1 : chaque test travaille sur une copie
// du contrat, la fausse, et vérifie que la validation le détecte.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateContract } from './validate.mjs';

const source = resolve(fileURLToPath(import.meta.url), '..', '..');
const copies = [];
after(() => copies.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function copyContract() {
  const dir = mkdtempSync(join(tmpdir(), 'contract-'));
  copies.push(dir);
  for (const entry of ['openapi.yaml', 'asyncapi.yaml', 'redocly.yaml', 'schemas', 'examples']) {
    cpSync(join(source, entry), join(dir, entry), { recursive: true });
  }
  return dir;
}

function editJson(dir, path, change) {
  const file = join(dir, path);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  change(data);
  writeFileSync(file, JSON.stringify(data));
}

function editText(dir, path, from, to) {
  const file = join(dir, path);
  const text = readFileSync(file, 'utf8');
  assert.ok(text.includes(from), `${path} ne contient pas ${from}`);
  writeFileSync(file, text.replace(from, to));
}

const hasError = (errors, ...parts) => errors.some((e) => parts.every((p) => e.includes(p)));

test('le contrat livré est valide', async () => {
  const { errors, stats } = await validateContract(source);
  assert.deepEqual(errors, []);
  assert.ok(stats.examples > 0);
});

test('un exemple sans champ requis est signalé avec son fichier', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/hidden-round.json', (s) => delete s.progress);
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'examples/session-state/hidden-round.json', 'progress'), errors.join('\n'));
});

test('un champ non décrit par le contrat est refusé', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/tick/tick.json', (s) => { s.serverTime = '2026-10-01T12:00:00Z'; });
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'examples/tick/tick.json', 'serverTime'), errors.join('\n'));
});

test('un message sans exemple est signalé', async () => {
  const dir = copyContract();
  rmSync(join(dir, 'examples/tick'), { recursive: true });
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'examples/tick/', 'aucun exemple'), errors.join('\n'));
});

test('une réponse d\'erreur REST sans exemple est signalée', async () => {
  const dir = copyContract();
  rmSync(join(dir, 'examples/problem/pseudo-taken.json'));
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'pseudo-taken', 'PseudoTaken'), errors.join('\n'));
});

test('un code d\'erreur qui ne correspond pas à sa réponse est refusé', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/problem/pseudo-taken.json', (p) => { p.code = 'SESSION_NOT_FOUND'; });
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'pseudo-taken.json', 'PseudoTaken'), errors.join('\n'));
});

test('un $ref cassé dans asyncapi.yaml est signalé', async () => {
  const dir = copyContract();
  editText(dir, 'asyncapi.yaml', './schemas/tick.json', './schemas/tock.json');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'asyncapi.yaml'), errors.join('\n'));
});

test('un document OpenAPI invalide est signalé', async () => {
  const dir = copyContract();
  editText(dir, 'openapi.yaml', "        '204':\n          description: The session exists.\n", "        '204': 42\n");
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'openapi.yaml', 'OpenAPI'), errors.join('\n'));
});

test('un endpoint hors de la surface fermée est refusé', async () => {
  const dir = copyContract();
  editText(dir, 'openapi.yaml', '  /api/health:\n    get:', '  /api/health:\n    delete:\n      operationId: deleteHealth\n      responses:\n        \'204\':\n          description: x\n    get:');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'surface REST', 'DELETE /api/health'), errors.join('\n'));
});

test('le vote d\'un autre participant visible pendant un tour caché est refusé', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/hidden-round.json', (s) => { s.participants[1].vote = '5'; });
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'hidden-round.json', 'Bob', 'tour caché'), errors.join('\n'));
});

test('une synthèse incohérente avec les votes est refusée', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/revealed-tie.json', (s) => { s.summary.average = 6.4; });
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'revealed-tie.json', 'summary'), errors.join('\n'));
});

test('une moyenne de 5,25 est arrondie à 5,3 (HALF_UP)', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/revealed-consensus.json', (s) => {
    ['3', '5', '5', '8'].forEach((v, i) => { s.participants[i].vote = v; s.participants[i].hasVoted = true; });
    s.progress.voted = 4;
    s.summary = { average: 5.3, mostVoted: { values: ['5'], count: 2 }, min: '3', max: '8', consensus: false };
  });
  const { errors } = await validateContract(dir);
  assert.deepEqual(errors, []);
});

test('l\'absence d\'exemple de tour révélé avec égalité est signalée', async () => {
  const dir = copyContract();
  rmSync(join(dir, 'examples/session-state/revealed-tie.json'));
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'égalité'), errors.join('\n'));
});

// Une règle d'AD-5 faussée dans une copie de hidden-round.json doit produire son erreur.
const hiddenRoundCases = [
  ['participants mal triés', (s) => s.participants.reverse(), 'mal triés'],
  ['progress.expected faux', (s) => { s.progress.expected += 1; }, 'progress.expected'],
  ['progress.voted faux', (s) => { s.progress.voted -= 1; }, 'progress.voted'],
  ['summary non nul sur tour caché', (s) => {
    s.summary = { average: null, mostVoted: null, min: null, max: null, consensus: false };
  }, 'summary doit valoir null'],
  ['selfParticipantId absent', (s) => { s.selfParticipantId = '00000000-0000-4000-8000-000000000000'; }, 'selfParticipantId absent'],
  ['observateur qui peut voter', (s) => { s.participants[4].canVoteThisRound = true; }, 'un observateur ne peut pas voter'],
  ['observateur qui a voté pendant un tour caché', (s) => {
    s.participants[4].hasVoted = true;
  }, 'un observateur n\'a pas de vote'],
  ['vote et hasVoted incohérents pour soi', (s) => { s.participants[0].hasVoted = false; s.progress.voted -= 1; }, 'vote et hasVoted incohérents'],
  ['joinOrder en double', (s) => { s.participants[1].joinOrder = 1; }, 'joinOrder en double'],
];
for (const [name, change, expected] of hiddenRoundCases) {
  test(`sessionState : ${name}`, async () => {
    const dir = copyContract();
    editJson(dir, 'examples/session-state/hidden-round.json', change);
    const { errors } = await validateContract(dir);
    assert.ok(hasError(errors, 'hidden-round.json', expected), errors.join('\n'));
  });
}

test('l\'absence d\'exemple de tour caché avec le vote d\'un autre à null est signalée', async () => {
  const dir = copyContract();
  for (const file of ['hidden-round.json', 'new-round-after-sweep.json']) {
    editJson(dir, `examples/session-state/${file}`, (s) => {
      s.participants.filter((p) => p.participantId !== s.selfParticipantId).forEach((p) => { p.hasVoted = false; });
      s.progress.voted = s.participants.filter((p) => p.role === 'VOTER' && p.hasVoted).length;
    });
  }
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'vote d\'un autre est à null'), errors.join('\n'));
});

test('une synthèse juste écrite dans un autre ordre de clés est acceptée', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/revealed-tie.json', (s) => {
    const { consensus, max, min, mostVoted, average } = s.summary;
    s.summary = { consensus, max, min, mostVoted, average };
  });
  const { errors } = await validateContract(dir);
  assert.deepEqual(errors, []);
});

test('un exemple non conforme à son schéma est signalé sans faire planter les règles d\'AD-5', async () => {
  const dir = copyContract();
  editJson(dir, 'examples/session-state/hidden-round.json', (s) => delete s.participants);
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'hidden-round.json', 'participants'), errors.join('\n'));
});

test('un message en trop dans asyncapi.yaml est refusé', async () => {
  const dir = copyContract();
  editText(dir, 'asyncapi.yaml', 'components:\n  messages:\n', 'components:\n  messages:\n    ping:\n      name: ping\n      payload:\n        $ref: \'./schemas/tick.json\'\n');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'asyncapi.yaml', 'les messages doivent être exactement'), errors.join('\n'));
});

test('un message retiré du canal est refusé', async () => {
  const dir = copyContract();
  editText(dir, 'asyncapi.yaml', "      vote:\n        $ref: '#/components/messages/vote'\n", '');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'asyncapi.yaml', 'le canal doit porter exactement'), errors.join('\n'));
});

test('une opération dans le mauvais sens est refusée', async () => {
  const dir = copyContract();
  editText(dir, 'asyncapi.yaml', '  receiveVote:\n    action: receive', '  receiveVote:\n    action: send');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'vote doit avoir exactement une opération receive'), errors.join('\n'));
});

test('une opération OpenAPI 3.2 additionalOperations hors surface est refusée', async () => {
  const dir = copyContract();
  editText(dir, 'openapi.yaml', '  /api/health:\n    get:', '  /api/health:\n    additionalOperations:\n      PURGE:\n        operationId: purgeHealth\n        responses:\n          \'204\':\n            description: x\n    get:');
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'surface REST', 'PURGE /api/health'), errors.join('\n'));
});

test('un exemple d\'erreur REST dont le nom ne correspond à aucune réponse est refusé', async () => {
  const dir = copyContract();
  writeFileSync(join(dir, 'examples/problem/teapot.json'), JSON.stringify({ type: 'about:blank', title: 'Teapot', status: 418 }));
  const { errors } = await validateContract(dir);
  assert.ok(hasError(errors, 'teapot.json', 'le nom doit commencer'), errors.join('\n'));
});
