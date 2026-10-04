---
title: 'Story 2.6 : un service qui tient face aux abus'
type: 'feature'
created: '2026-10-04'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le webservice public n'a aucune limite (constat F2 de la rétrospective de l'epic 1). Un client anonyme peut créer des sessions sans fin, remplir une session ou envoyer des corps et messages énormes, puis épuiser la mémoire et faire tomber les ateliers en cours (NFR4, NFR6).

**Approach:** Cinq plafonds, réglables par propriétés `planning-poker.*`. Corps REST limité à 2 Ko (`413`), message WebSocket à 4 Ko (fermeture `1009`), 50 sessions en mémoire (`503 SESSION_LIMIT_REACHED`), 10 créations par minute et par IP cliente (`429 TOO_MANY_REQUESTS` + `Retry-After`), 30 participants par session (`409 SESSION_FULL`). Le contrat évolue par ajout. Le front affiche les trois libellés de refus.

## Boundaries & Constraints

**Always:**
- Les défauts sont 2 Ko, 4 Ko, 50, 10 par 1 min et 30. Le test de charge (5 × 13) passe sans refus.
- `413` : `Content-Length` au-delà de la limite → refus immédiat. Sans `Content-Length`, on lit au plus limite + 1 octets. Seules les deux routes `POST` sont concernées. Le problème renvoyé n'a pas de `code`.
- Le plafond de 50 sessions est strict même en cas de créations simultanées : on compte puis on enregistre dans une même section critique propre à la création. Une session expirée (2.5) libère sa place.
- `SESSION_FULL` ne vise qu'un **nouvel** participant. La reprise d'un participant déconnecté (2.4) n'ajoute personne, elle reste donc possible quand la session est pleine. Ordre de contrôle : session inconnue (404), pseudo invalide (400), pseudo pris (409 `PSEUDO_TAKEN`), session pleine (409 `SESSION_FULL`). Un retiré (2.3) ne compte plus.
- `429` : seules les créations réussies sont comptées. On refuse dès que l'IP a 10 créations dans la fenêtre glissante d'une minute. `Retry-After` donne en secondes entières (arrondi au supérieur, au moins 1) le temps avant que la plus ancienne sorte de la fenêtre. Les compteurs ne vivent qu'en mémoire et une IP sans création depuis 1 min est oubliée. Le contrôle du `429` passe avant celui du `503`.
- IP cliente : voir la question ouverte n° 1. La lecture est isolée dans une seule classe et testée, y compris sur un en-tête falsifié par le client.
- Journaux : jamais d'IP, de pseudo, de jeton ni d'identifiant de session. Une ligne par refus, sans détail identifiant.
- Front : « Trop de sessions sont ouvertes en ce moment. Réessaie plus tard. » et « Trop de sessions créées depuis ton réseau. Patiente une minute. » s'affichent sous le bouton de l'accueil. « Cette session est complète. » s'affiche sous le champ de Rejoindre. La saisie est conservée et le bouton redevient actif. Un `413` est traité comme aujourd'hui une réponse inattendue (« Impossible de joindre le serveur. »).

**Never:**
- Pas de limite de débit sur `join`, `GET` ou le WebSocket. Pas de plafond sur le nombre de participants retirés. Pas de persistance des compteurs.
- Pas de modification non additive du contrat (AD-13) : les réponses et codes existants restent valides tels quels.
- Le client ne change pas pour `1009` : la reconnexion de la story 2.2 s'applique déjà à tout code autre que `4401`/`4404`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Corps trop gros | `POST /api/sessions`, `Content-Length: 2049` | `413` problem+json, corps non lu | N/A |
| Corps chunked trop gros | `POST …/participants` sans `Content-Length`, 10 Ko | `413` après au plus 2049 octets lus | N/A |
| Corps à la limite | 2048 octets valides | traité normalement | N/A |
| Message WS trop gros | texte de 4097 caractères après `hello` | fermeture `1009`, le client se reconnecte | N/A |
| 51e session | 50 sessions en mémoire | `503 SESSION_LIMIT_REACHED`, store inchangé | front : libellé sous le bouton |
| Place libérée | 50 sessions dont une expire au passage du balayeur | la création suivante réussit | N/A |
| 11e création | même IP, 10 créations en 40 s | `429 TOO_MANY_REQUESTS`, `Retry-After: 20` | front : libellé sous le bouton |
| Autre IP | 10 créations depuis A, 1 depuis B | B créée | N/A |
| 31e participant | 30 participants | `409 SESSION_FULL`, rien ne change | front : libellé sous le champ |
| Reprise session pleine | 30 participants, pseudo d'un déconnecté | `200`, reprise (2.4) | N/A |
| Après retrait | 30 participants dont un retiré au bout de 5 min | le join suivant réussit | N/A |

</frozen-after-approval>

## Open Questions

1. **D'où lire l'IP cliente derrière Render ?** Render passe par Cloudflare puis par son répartiteur. Cloudflare **ajoute** son entrée à `X-Forwarded-For` sans écraser celle du client, donc l'entrée la plus à gauche est falsifiable. La doc de Render recommande `CF-Connecting-IP`, que Cloudflare écrit sur chaque requête en écrasant toute valeur envoyée par le client.
   - **A (recommandée) :** `CF-Connecting-IP` si présent, sinon la dernière entrée de `X-Forwarded-For`, sinon `remoteAddr`. Fiable sur Render, mais l'en-tête principal n'est plus celui que nomme le critère.
   - **B :** la dernière entrée de `X-Forwarded-For` (« trust proxy 1 »), sinon `remoteAddr`. C'est la lettre du critère. Si Render ajoute une seconde étape de proxy, tous les clients partagent la même IP et le même quota de 10 créations par minute.
   - **C :** l'entrée de `X-Forwarded-For` à la position N en partant de la droite, N étant réglable (défaut 1). C'est B avec un levier de correction sans redéploiement de code.
2. **Retour d'un participant retiré quand la session est pleine** (sa poignée de main `hello` alors que 30 autres sont à la table) :
   - **A (recommandée) :** fermeture `4401`, comme pour un pseudo pris entre-temps. Il voit Rejoindre, prérempli, avec « Ta place a été reprise depuis un autre appareil. » (texte inexact), puis « Cette session est complète. » s'il valide. Aucun changement du front ni du contrat WebSocket.
   - **B :** il revient quand même et dépasse 30. Le plafond devient contournable par des allers-retours.

## Code Map

- `backend/…/adapter/in/rest/SessionController.java` -- `create` : contrôle du `429` (nouveau `CreationRateLimiter`, IP lue par un `ClientAddress`) avant l'appel, comptage après succès. `RestErrorHandler.java` -- nouvelles exceptions → `503`/`429` (+ `Retry-After`)/`409 SESSION_FULL`, même forme que `pseudoTaken`.
- `backend/…/adapter/in/rest/` (nouveaux) -- `RequestBodyLimitFilter` (`OncePerRequestFilter`, deux routes `POST`, écrit le `413` problem+json avec `type: about:blank`), `CreationRateLimiter` (fenêtre glissante par IP, `Clock`, purge), `ClientAddress`.
- `backend/…/application/CreateSessionUseCase.java` -- paramètre `maxSessions`. Compter puis enregistrer dans une section critique de création, et lever `SessionLimitReachedException` (application). `SessionStore` + `InMemorySessionStore` : ajouter `count()`.
- `backend/…/domain/Session.java` -- `join(…)` et `rejoin(…)` reçoivent `maxParticipants`. Un nouvel arrivant au-delà lève `SessionFullException` (domaine), seulement après les contrôles de pseudo. La reprise n'est pas concernée. `JoinSessionUseCase` et `SessionConnectionUseCase` (l. 76-90 : traiter `SessionFullException` comme `PseudoTakenException`) transmettent le plafond.
- `backend/…/config/WebSocketConfig.java` -- bean `ServletServerContainerFactoryBean` avec `maxTextMessageBufferSize`/`maxBinaryMessageBufferSize` = 4096 (Tomcat ferme alors en `1009`). `SessionConfig.java` + `application.properties` -- propriétés `planning-poker.max-request-body=2KB`, `max-ws-message=4KB`, `max-sessions=50`, `max-creations-per-ip=10`, `creation-window=1m`, `max-participants=30`.
- `contract/openapi.yaml` -- réponses nommées `PayloadTooLarge` (413), `TooManyRequests` (429, en-tête `Retry-After`), `SessionLimitReached` (503), `SessionFull` (409). Le `409` de `joinSession` accepte `PSEUDO_TAKEN` **ou** `SESSION_FULL` (`oneOf`). `PseudoTaken` reste valide. `schemas/problem.json` : les 3 codes ajoutés à l'enum. `examples/problem/` : un exemple par réponse nommée, préfixe en kebab (règle de `scripts/validate.mjs` `checkProblemResponses`, l. 154). `asyncapi.yaml` `x-close-codes` : `1009`.
- `frontend/src/app/api/contract.ts` (`ProblemCode`, `PROBLEM_CODES`), `api/session-api.ts` (`KNOWN_PROBLEMS`, types d'erreur `sessionLimitReached`, `tooManyRequests`, `sessionFull`), `entry-form/entry-messages.ts`, `home/home.component.ts` (`submitError`), `session/session-entry.component.ts` (`pseudoError`).
- Ne pas changer : `SessionService` (reconnexion), `SweepUseCase`, `deploy/load-test.mjs`.
- Modèles de test : `SessionControllerTest`, `JoinSessionControllerTest`, `ContractRoundTripTest` (+ `ContractExamples`), `LivenessTest` (WS de bout en bout), `CreateSessionUseCaseTest`, `SessionTest`/`SessionTakeOverTest`, `session-api.spec.ts`, `home`/`session-entry` specs, `contract/scripts/validate.test.mjs`.

## Tasks & Acceptance

**Execution:**
- [ ] `domain/Session.java`, `domain/SessionFullException.java` + tests domaine -- plafond des participants, reprise permise, retirés non comptés.
- [ ] `application/CreateSessionUseCase.java`, `SessionLimitReachedException`, `SessionStore.count`, `JoinSessionUseCase`, `SessionConnectionUseCase` + tests -- 50 sessions strict (test concurrent), place libérée par `delete`, retour d'un retiré sur session pleine (Q2).
- [ ] `adapter/in/rest/*` + `RestErrorHandler` + tests MockMvc -- `413` (avec et sans `Content-Length`, limite exacte), `429` + `Retry-After` (horloge contrôlée), IP lue selon Q1 y compris avec un en-tête falsifié, `503`, `409 SESSION_FULL`.
- [ ] `config/*`, `application.properties` -- propriétés et assemblage. Test WS de bout en bout : un message de 4097 caractères ferme en `1009`.
- [ ] `contract/*` -- réponses, codes, exemples, `1009`, puis `npm test`.
- [ ] `frontend/*` + specs -- trois libellés, saisie conservée, bouton réactivé.

**Acceptance Criteria:**
- Given les plafonds, when les refus se produisent, then aucune IP, aucun pseudo, aucun jeton ni identifiant de session n'apparaît dans les journaux.
- Given le contrat, when `npm test` (contrat) tourne, then chacune des réponses `413`, `429`, `503` et `409 SESSION_FULL` a un exemple valide, et les exemples existants restent valides.
- Given la suite complète, when `./mvnw -B verify`, `npm test` (front) et `npm test` (contrat) tournent, then elles sont vertes, ArchUnit compris.

## Design Notes

- **Section critique de création plutôt qu'un verrou global :** la création est rare. Compter puis enregistrer dans un `synchronized` du cas d'usage suffit, puisque les suppressions ne font que libérer des places.
- **`413` écrit par le filtre :** il passe avant le `DispatcherServlet`, donc sans en-têtes CORS. Le front ne l'envoie jamais (pseudo de 200 caractères au plus) et l'afficherait comme une erreur réseau, ce qui est acceptable.

## Verification

**Commands:**
- `cd backend && JAVA_HOME=/usr/lib/jvm/java-25-openjdk-amd64 ./mvnw -B verify` -- expected: vert.
- `cd frontend && npx -y node@24 node_modules/@angular/cli/bin/ng.js test --watch=false` -- expected: vert.
- `cd contract && npm test` -- expected: vert.
