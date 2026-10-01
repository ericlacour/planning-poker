---
title: 'Story 1.1 : le contrat d''échange front / webservice'
type: 'feature'
created: '2026-10-01'
status: 'done'
baseline_commit: 'c021ad63b628136e6417d0e7ab077b6874860fce'
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
- [x] `contract/schemas/*.json` -- un fichier par type, en JSON Schema 2020-12 avec `$id` relatif : `card`, `role`, les requêtes et réponses REST, `health`, `problem`, et chaque message WS (`hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole`, `sessionState`, `tick`, `error`) -- source unique des charges utiles.
- [x] `contract/openapi.yaml` -- les 4 endpoints, avec leurs `operationId`, statuts, `$ref` vers les schémas et réponses `application/problem+json` -- AD-2.
- [x] `contract/asyncapi.yaml` -- le canal `/ws/sessions/{sessionId}`, les opérations `send` et `receive` et les 10 messages. Les codes d'erreur et de fermeture sont décrits dans la description du canal et dans `x-close-codes` -- AD-4, AD-5, AD-7.
- [x] `contract/examples/<schéma>/<cas>.json` -- au moins un exemple par message et par réponse REST, dont `sessionState/hidden-round.json` (le vote des autres à `null`) et `sessionState/revealed-tie.json` (égalité sur la plus votée) -- le répertoire nomme le schéma visé.
- [x] `contract/scripts/validate.mjs` et `contract/package.json` -- lint des deux documents, validation de chaque exemple, contrôle que chaque schéma de message ou de réponse a au moins un exemple, et cas négatifs intégrés -- AC 3.
- [x] `contract/README.md` -- structure, règles d'évolution (ajout seulement, AD-13) et commande `npm ci && npm run validate`.
- [x] `.gitignore` -- `node_modules/`.

**Acceptance Criteria :**
- Étant donné `openapi.yaml`, quand on le lit, alors il décrit exactement `GET /api/health`, `POST /api/sessions`, `GET /api/sessions/{sessionId}` (204 ou 404) et `POST /api/sessions/{sessionId}/participants`, avec des erreurs `problem+json` qui portent `code` ∈ {`PSEUDO_TAKEN`, `INVALID_PSEUDO`, `SESSION_NOT_FOUND`}.
- Étant donné `asyncapi.yaml`, quand on le lit, alors il contient les messages `hello`, `heartbeat`, `vote`, `reveal`, `hide`, `clear`, `changeRole`, `sessionState`, `tick` et `error`, les codes WS `ROUND_REVEALED`, `NOT_A_VOTER`, `INVALID_CARD` et `INVALID_MESSAGE`, et les fermetures `4401` et `4404`.
- Étant donné le script, quand on fausse un exemple, alors la validation échoue.

## Implementation Notes

- Fichiers : `contract/{openapi.yaml, asyncapi.yaml, redocly.yaml, README.md, package.json, package-lock.json}`, 20 schémas dans `contract/schemas/`, 30 exemples dans `contract/examples/`, `contract/scripts/{validate.mjs, validate.test.mjs}`, et `.gitignore` à la racine.
- Les cas négatifs sont dans `scripts/validate.test.mjs` (`npm test`, 13 tests). Chaque test fausse une copie du contrat. `npm run validate` ne vérifie que le contrat livré.
- Statuts choisis : `POST /api/sessions` → 201, `POST …/participants` → 200, puisqu'une reprise de pseudo ne crée rien.
- `vote.card` est une chaîne quelconque ou `null`, sans être restreinte au paquet. Sinon, `INVALID_CARD` serait inatteignable, car une carte inconnue deviendrait `INVALID_MESSAGE`. De même, `hello.participantToken` est une chaîne libre : un jeton mal formé donne `4401`.
- Les réponses d'erreur sont nommées dans `components.responses` (`BadRequest`, `SessionNotFound`, `PseudoTaken`). Leurs exemples sont `examples/problem/<nom-en-kebab>*.json` et sont validés contre le schéma exact de la réponse.
- Le script vérifie aussi la surface fermée (liste en dur des 4 opérations et des 10 messages) et les règles d'AD-5 propres à `sessionState` : tri, filtrage du tour caché, `progress`, et `summary` recalculé.
- AsyncAPI 3.1 refuse `info.license.identifier`, alors qu'OpenAPI 3.2 l'accepte. Les charges utiles AsyncAPI gardent `$schema` 2020-12, ce que le parseur accepte.
- `openapi.yaml` déclare `security: []` (pas d'authentification REST) et le serveur local. `redocly.yaml` part de `minimal` et coupe seulement `no-server-example.com`.
- `engines.node` vaut `>=24.15.0`, comme le front. En local, avec Node 22, npm affiche seulement `EBADENGINE`.
- Revue 1 : surface AsyncAPI contrôlée aussi sur le canal et les opérations (sens send/receive) et sur `additionalOperations` ; règles d'AD-5 appliquées aux seuls exemples conformes (plus de plantage) ; comparaison de `summary` insensible à l'ordre des clés ; observateur ou votant hors tour sans vote pendant un tour caché ; paramètre `sessionId` REST non contraint ; réponse `default` sur chaque opération ; règles du protocole WS (second `hello`, `1008`, bornes → `INVALID_MESSAGE`, ordre des contrôles de `vote`) ; exemple `revealed-seen-by-observer.json` (destinataire observateur, `canVoteThisRound: false`, moyenne 5,25 → 5,3) ; 17 tests négatifs ajoutés.

## Review Triage Log

| # | Source | Constat | Verdict | Suite |
|---|---|---|---|---|
| 1 | blind, edge | La surface WS ne contrôle ni le canal ni les opérations ni leur sens | medium : reproduit par l'edge hunter (vote retiré du canal → « Contrat valide ») | patch |
| 2 | blind, edge | `additionalOperations` d'OpenAPI 3.2 échappe à la surface fermée | low : correction directe d'une ligne | patch |
| 3 | blind, edge | Paramètre `sessionId` contraint par un motif alors que la forme fausse doit donner 404 | medium : un validateur généré répondrait 400 | patch |
| 4 | blind, edge | Bornes `maxLength` (`card`, jeton, `roundId`, pseudo brut) contraires aux erreurs documentées | medium : comportement non dit pour les valeurs hors bornes | patch (documenté : `INVALID_MESSAGE`, `1008`, 400 sans code) |
| 5 | blind, edge | Second `hello`, intention avant `hello`, ordre des contrôles de `vote` non spécifiés | medium : deux implémentations divergeraient | patch (règles dans `asyncapi.yaml`) |
| 6 | blind, edge | Aucune réponse 5xx/`default` alors que le réveil Render renvoie 502/503 | medium : le front n'a rien sur quoi s'appuyer | patch |
| 7 | blind, edge | Plantage (TypeError) quand un exemple `sessionState` hors schéma atteint les règles d'AD-5 | medium : reproduit ; cas courant en éditant un exemple | patch |
| 8 | edge | Comparaison de `summary` sensible à l'ordre des clés | low : faux échec reproduit, correction directe | patch |
| 9 | edge | Observateur avec un vote pendant un tour caché accepté | medium : exemple faux accepté (AC 3) | patch |
| 10 | blind | Exemples manquants (destinataire observateur, `canVoteThisRound: false`, moyenne non entière) | low | patch (un exemple) |
| 11 | verification-gap | Règles de tri, `progress`, `summary` caché, exemple caché à null, surface des messages, `selfParticipantId`, observateur, `vote`/`hasVoted`, noms `problem/` non testées | gap pré-vérifié | patch (17 tests) |
| 12 | blind, edge | Plantages sur YAML illisible, `$id` dupliqué, `$ref` irrésoluble, fichier parasite dans `examples/` | low : échec bruyant (sortie ≠ 0), jamais un faux succès | rejeté |
| 13 | edge | Script lancé par un lien symbolique : sortie 0 sans rien valider | low : improbable, `npm run validate` n'y passe pas | rejeté |
| 14 | edge | Réponses `problem+json` inline sous un chemin, ou acronymes dans les noms de réponse, hors couverture | low : aucune n'existe, convention du README | rejeté |
| 15 | edge | `BadRequest` sans `code` requis | false : décision de conception du bloc gelé | rejeté |
| 16 | blind | Pas de CI qui lance la validation | medium : prévu par la story 1.2 | defer |
| 17 | blind | Évolution par ajout seul (AD-13) non vérifiée automatiquement | medium : demande une version de référence publiée | defer |
| 18 | blind | Statut du sprint resté `in-progress` | false : mis à `review` à la présentation (étape 5) | rejeté |
| 19 | blind | Validé sous Node 22 alors que `engines` exige 24.15 | low : la CI de la story 1.2 tournera en Node 24 | rejeté |

## Verification

**Commands :**
- `cd contract && npm ci && npm run validate` -- attendu : sortie 0, avec un résumé des documents et des exemples validés.
- `cd contract && npm test` -- attendu : 30 tests verts (cas de la matrice I/O et une règle faussée par test).
