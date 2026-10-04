---
title: 'Story 2.4 : reprendre sa place depuis un autre appareil'
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

**Problem:** Aujourd'hui, rejoindre avec le pseudo d'un participant déconnecté répond 409 `PSEUDO_TAKEN` : qui passe de son téléphone à son PC perd sa place et son vote. Le contrat (`openapi.yaml`, `joinSession` ; `asyncapi.yaml`, `4401`) décrit déjà la reprise, mais ni le webservice ni le front ne la font (FR8, AD-7, UX-DR14).

**Approach:** Dans la règle `join` du domaine, un pseudo porté par un participant **sans connexion** reprend ce participant : nouveau jeton, ancien révoqué, même `participantId`, pseudo affiché, rôle, vote et place. Le front affiche « Ta place a été reprise depuis un autre appareil. » sur l'écran Rejoindre prérempli quand la session se termine en `4401`.

## Boundaries & Constraints

**Always:**
- Reprise seulement si le participant n'a **aucune** connexion ouverte (`connected=false`), en attente de retrait ou non ; sinon 409 `PSEUDO_TAKEN` et rien ne change. Même comparaison de pseudo que `join` (normalisé, casse ignorée).
- Le participant repris garde son `participantId`, son pseudo tel qu'il était affiché, son rôle (celui de la requête est ignoré), son `joinOrder`, son vote, sa marque d'arrivée tardive et son `offlineSince` : le délai de retrait de 5 min continue de courir jusqu'à ce que le nouvel appareil se connecte.
- Seule l'empreinte du jeton change : changement caché, même `version`, rien n'est diffusé. Le nouvel appareil devient visible connecté par son `hello` (`PRESENCE`, déjà en place).
- L'ancien jeton est révoqué : son `hello` reçoit `4401`. Comme la reprise exige zéro connexion ouverte, aucune connexion n'utilise encore l'ancien jeton à cet instant, sous le verrou de la session : il n'y a rien à fermer.
- Réponse `200` inchangée (`participantId` du participant repris, nouveau jeton). Journal : identifiant du participant seulement (« took over »), jamais jeton, pseudo ni identifiant de session.
- Front : le message s'affiche à chaque fin `unknownToken` (fermeture `4401`, ou plus aucun jeton rangé), au-dessus du champ, en texte neutre (`role="status"`), et disparaît au premier envoi. L'arrivée directe sur Rejoindre (pas de jeton à l'ouverture du lien) ne l'affiche pas.

**Never:**
- Pas de changement du contrat, des codes de fermeture ni du message `4401`.
- Un participant retiré (`departed`) n'est pas repris par `join` : son pseudo est libre, `join` crée un nouveau participant (comportement de la story 2.3).
- Pas d'expiration (2.5), pas de plafond (2.6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reprise | « Bob » déconnecté, a voté 5 ; `join` « bob », rôle OBSERVER | 200, même `participantId`, nouveau jeton ; « Bob », votant, vote 5 conservés ; `version` inchangée, aucune diffusion | N/A |
| Jamais connecté | « Bob » entré par REST, aucun `hello` ; `join` « Bob » | reprise | N/A |
| Connecté | « Bob » a une connexion ouverte | 409 `PSEUDO_TAKEN`, rien ne change | message « déjà pris » existant |
| Ancien jeton | `hello` avec l'ancien jeton après la reprise | `4401` | front : écran Rejoindre prérempli + message, jeton effacé |
| Nouveau jeton | `hello` avec le nouveau jeton | connecté, `PRESENCE` diffusé, son vote dans son instantané | N/A |
| Reprise puis absence | reprise à T, aucun `hello`, `offlineSince` = T0 < T | retiré à T0 + 5 min | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/main/java/com/planningpoker/domain/Session.java` -- `join` : avant `requireFreePseudo`, chercher le participant de même `uniquenessKey` ; s'il est déconnecté, remplacer son jeton (nouvelle instance, même `version`, même `lastChange`) ; connecté → `PseudoTakenException`. Documenter la règle dans la Javadoc.
- `backend/src/main/java/com/planningpoker/domain/Participant.java` -- ajouter `withToken(ParticipantToken)` (package-private), qui garde tout le reste.
- `backend/src/main/java/com/planningpoker/application/JoinSessionUseCase.java` -- l'identifiant renvoyé est celui du participant qui porte le nouveau jeton (`participantWithToken`) ; `publish` seulement si la `version` change ; `save` toujours ; journal distinct pour une reprise.
- `backend/src/main/java/com/planningpoker/application/SessionConnectionUseCase.java` -- ne pas changer : jeton inconnu → `UnknownToken` → `4401`.
- `backend/src/test/java/com/planningpoker/domain/SessionTest.java` (l. 90-111) et `adapter/in/rest/JoinSessionControllerTest.java` (l. 160-172) -- les tests 409 actuels visent un participant jamais connecté, désormais repris : leur donner une connexion (`session.connect` / `SessionConnectionUseCase.connect` avec un `broadcaster.open` simulé, ou un client WS comme `SessionSocketHandlerTest`).
- `frontend/src/app/entry-form/entry-messages.ts` -- `TAKEN_OVER_MESSAGE`.
- `frontend/src/app/entry-form/entry-form.component.ts` -- entrée `notice` (texte neutre au-dessus du champ, `role="status"`).
- `frontend/src/app/session/session-entry.component.ts` -- l'effet sur `end() === 'unknownToken'` pose `notice` ; `join()` l'efface.
- Modèles de test : `SessionAbsenceTest`, `JoinSessionUseCaseTest`, `SessionConnectionUseCaseTest` (`MutableClock`, `RecordingBroadcaster`), `session-entry.component.spec.ts`, `entry-form.component.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `domain/Participant.java`, `domain/Session.java` -- `withToken`, règle de reprise dans `join`.
- [ ] `domain/SessionTakeOverTest.java` (nouveau) -- lignes de la matrice côté domaine : casse, rôle ignoré, vote / arrivée tardive / `joinOrder` / `offlineSince` gardés, même `version`, ancien jeton ne correspond plus, nouveau oui ; connecté → exception ; `departed` non repris.
- [ ] `application/JoinSessionUseCase.java` + `JoinSessionUseCaseTest.java` -- id du repris renvoyé, aucune diffusion à la reprise.
- [ ] `application/SessionConnectionUseCaseTest.java` -- ancien jeton → `UnknownToken` ; nouveau → `Connected` avec le même id.
- [ ] `SessionTest.java`, `JoinSessionControllerTest.java` -- adapter les tests 409 ; ajouter au contrôleur un 200 de reprise (même `participantId`).
- [ ] Front : `entry-messages.ts`, `entry-form.component.ts`, `session-entry.component.ts` et leurs specs -- message après `4401`, absent à l'arrivée directe, effacé à l'envoi.

**Acceptance Criteria:**
- Given un participant déconnecté qui a voté, when il rejoint depuis un autre appareil avec son pseudo puis s'y connecte, then il retrouve sa place, son rôle et son vote, et les autres le voient seulement repasser connecté.
- Given la reprise, when l'ancien appareil se reconnecte, then il affiche l'écran Rejoindre prérempli avec « Ta place a été reprise depuis un autre appareil. » et son jeton est effacé.
- Given la suite complète, when `./mvnw -B verify` et `npm test` tournent, then elles sont vertes, ArchUnit compris.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Pas de diffusion à la reprise :** l'instantané ne contient ni jeton ni rien que la reprise change ; incrémenter `version` diffuserait un état identique (AD-3).
- **Message sur tout `4401` :** le contrat range sous `4401` la reprise et le pseudo pris après retrait ; le client ne peut pas les distinguer, et dans les deux cas quelqu'un d'autre occupe désormais sa place. Les distinguer demanderait un nouveau code de fermeture.

## Verification

**Commands:**
- `cd backend && ./mvnw -B verify` -- expected: vert.
- `cd frontend && npm test` -- expected: vert.
- `cd contract && npm test` -- expected: vert (aucun changement attendu).
