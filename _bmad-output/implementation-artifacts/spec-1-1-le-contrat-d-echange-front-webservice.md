---
title: 'Story 1.1 : le contrat d''échange front / webservice'
type: 'feature'
created: '2026-10-01'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-planning-poker-2026-09-29/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le front et le webservice seront construits séparément. Sans un contrat unique, chacun inventerait ses propres messages et noms de champs (AD-6).

**Approach:** Livrer `contract/`, avec `openapi.yaml` (3.2.0) et `asyncapi.yaml` (3.1.0). Leurs charges utiles sont des JSON Schema 2020-12 partagés, dans `contract/schemas/`. On ajoute un exemple par message et par réponse, et un script Node qui valide les documents, les exemples et la couverture.

## Boundaries & Constraints

**Always :**
- Le squelette `sessionState` d'AD-5 est respecté au champ près, et ses champs sont tous requis.
- Identifiants et noms en anglais, champs en camelCase, enveloppe WS `{type}`, `additionalProperties: false` partout.
- Cartes : `"0","1","2","3","5","8","13","21","?","coffee"`.
- Formats : `sessionId` et `participantToken` en base64url sans remplissage, 22 caractères (`^[A-Za-z0-9_-]{22}$`) ; `participantId` en UUID.
- Chaque schéma n'est défini qu'une fois. Les deux documents le référencent par `$ref`.
- `participantToken` n'apparaît que dans `hello` et dans les réponses de création et de jonction.

**Never :**
- Pas de code backend ni frontend : il arrive avec la story 1.2, qui branchera la CI et les tests côté Java et côté TS.
- Pas d'endpoint, de message ou de code d'erreur hors de la liste d'AD-2 et des Conventions.
- Pas de STOMP. Aucun jeton dans une URL.

**Décisions de conception (prises au plan) :**
- `GET /api/health` renvoie 200 `{"status":"UP"}`.
- REST : `INVALID_PSEUDO` en 400, `PSEUDO_TAKEN` en 409, `SESSION_NOT_FOUND` en 404. Un corps mal formé (rôle inconnu, champ manquant) donne un 400 `problem+json` sans `code`.
- Dans les requêtes, `pseudo` est une simple chaîne, puisque la normalisation relève du domaine. Dans `sessionState`, il fait 1 à 20 caractères.
- `tick` et `heartbeat` sont réduits à `{type}`. `error` vaut `{type, code}`.
- `summary` vaut `null` pour un tour caché. Pour un tour révélé sans vote numérique, c'est un objet avec `average`, `mostVoted`, `min` et `max` à `null`, et `consensus: false`. `min`, `max` et `mostVoted.values` ne contiennent que des cartes numériques.
- Codes de fermeture : `4404` et `4401`, plus `1008` si le premier message n'est pas un `hello` ou s'il n'arrive pas dans les 5 s. Pour tout autre code, le client se reconnecte.
- `version` est un entier ≥ 1. `joinOrder` est un entier ≥ 1. `lastChange` n'est jamais `null`, mais `byParticipantId` peut l'être.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Exemples valides | `contract/examples/**` | `npm run validate` sort en 0 | N/A |
| Exemple invalide | un `sessionState` sans `progress` | sortie ≠ 0, fichier et chemin JSON signalés | message lisible |
| Message sans exemple | un message AsyncAPI sans fichier d'exemple | sortie ≠ 0, message nommé | message lisible |
| Document mal formé | `$ref` cassé ou document invalide selon sa spécification | sortie ≠ 0 | diagnostic de l'outil relayé |

</frozen-after-approval>

## Code Map

- Dépôt sans code : seulement `_bmad/`, `_bmad-output/`, `deploy/README.md` et `README.md`. Rien à réutiliser, rien à préserver hors de `contract/`.
- Outils vérifiés : `@asyncapi/parser` 3.6 accepte AsyncAPI 3.1.0 ; `@redocly/cli` 2.x lit OpenAPI 3.2.0 (avec `--extends=minimal`, car la règle `recommended` réclame `servers` et `security`) ; `ajv` 8 avec `Ajv2020` et `ajv-formats`.

## Tasks & Acceptance

**Execution :**
- [ ] `contract/schemas/*.json` -- un fichier par type, en JSON Schema 2020-12 avec `$id` relatif : `card`, `role`, les requêtes et réponses REST, `health`, `problem`, et chaque message WS (`hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole`, `sessionState`, `tick`, `error`) -- source unique des charges utiles.
- [ ] `contract/openapi.yaml` -- les 4 endpoints, avec leurs `operationId`, statuts, `$ref` vers les schémas et réponses `application/problem+json` -- AD-2.
- [ ] `contract/asyncapi.yaml` -- le canal `/ws/sessions/{sessionId}`, les opérations `send` et `receive` et les 10 messages. Les codes d'erreur et de fermeture sont décrits dans la description du canal et dans `x-close-codes` -- AD-4, AD-5, AD-7.
- [ ] `contract/examples/<schéma>/<cas>.json` -- au moins un exemple par message et par réponse REST, dont `sessionState/hidden-round.json` (le vote des autres à `null`) et `sessionState/revealed-tie.json` (égalité sur la plus votée) -- le répertoire nomme le schéma visé.
- [ ] `contract/scripts/validate.mjs` et `contract/package.json` -- lint des deux documents, validation de chaque exemple, contrôle que chaque schéma de message ou de réponse a au moins un exemple, et cas négatifs intégrés -- AC 3.
- [ ] `contract/README.md` -- structure, règles d'évolution (ajout seulement, AD-13) et commande `npm ci && npm run validate`.
- [ ] `.gitignore` -- `node_modules/`.

**Acceptance Criteria :**
- Étant donné `openapi.yaml`, quand on le lit, alors il décrit exactement `GET /api/health`, `POST /api/sessions`, `GET /api/sessions/{sessionId}` (204 ou 404) et `POST /api/sessions/{sessionId}/participants`, avec des erreurs `problem+json` qui portent `code` ∈ {`PSEUDO_TAKEN`, `INVALID_PSEUDO`, `SESSION_NOT_FOUND`}.
- Étant donné `asyncapi.yaml`, quand on le lit, alors il contient les messages `hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole`, `sessionState`, `tick` et `error`, les codes WS `ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD` et `INVALID_MESSAGE`, et les fermetures `4401` et `4404`.
- Étant donné le script, quand on fausse un exemple, alors la validation échoue.

## Verification

**Commands :**
- `cd contract && npm ci && npm run validate` -- attendu : sortie 0, avec un résumé des documents et des exemples validés.
