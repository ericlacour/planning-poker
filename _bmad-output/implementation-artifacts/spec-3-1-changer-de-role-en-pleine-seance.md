---
title: 'Story 3.1 : changer de rôle en pleine séance'
type: 'feature'
created: '2026-10-05'
status: 'in-review'
baseline_commit: '9ed0afc13d388d3aa55cfa5480361eaed06c64a9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un participant ne peut pas passer de votant à observateur, ni l'inverse, sans quitter la session (FR5) : le webservice ignore `changeRole`, et la barre du haut n'a pas de menu du participant. Avant d'ajouter cette intention, la rétrospective de l'epic 2 demande trois préalables (action 14) : extraire le squelette commun des cas d'usage (D1), corriger le délai du `hello` (F2) et décider du découpage de `Session.java` (T1).

**Approach:** D'abord les préalables : un seul point d'écriture « verrou → règle → enregistrer si l'instance change → publier si la `version` change », repris par tous les cas d'usage, et un délai de `hello` enregistré avant d'être programmé. Puis la règle `Session.changeRole` (domaine), le cas d'usage branché sur le WebSocket, et côté front le menu du participant (« Je vote » / « J'observe ») et le lien « Je veux voter ». Le contrat ne change pas : `changeRole`, `ROLE` et `canVoteThisRound` y sont déjà.

## Boundaries & Constraints

**Always:**
- Règles du domaine (FR5), toutes sur `Session.changeRole(participantId, role)` :
  - même rôle → même instance, aucune `version++` ;
  - votant → observateur, tour caché : son vote est retiré ;
  - votant → observateur, tour révélé : son vote reste, visible et compté dans la synthèse jusqu'au `clear` ;
  - observateur → votant, tour révélé : marqué comme arrivée tardive (`lateArrivals`), donc `canVoteThisRound: false` jusqu'au `clear`, **sauf** s'il a un vote dans ce tour (il l'avait posé comme votant) ;
  - observateur → votant, tour caché : vote possible tout de suite ;
  - tout changement effectif : `version + 1`, `lastChange {ROLE, participantId}` ; `joinOrder` inchangé (la place rejoint la fin de son nouveau groupe par le tri existant).
- Ces règles soldent l'entrée de `deferred-work.md` de la spec 1.6 (`hasVoted` d'un votant devenu observateur) : en tour caché, un observateur n'a jamais de vote. `progress` continue de ne compter que les votants.
- Le squelette commun remplace toutes les copies listées dans la rétrospective (D1) sans changer aucun comportement observable : les tests existants passent sans modification de leurs attentes.
- `hello` : le délai est inscrit dans `pendingHellos` avant d'être programmé ; un délai qui expire avant la fin de `afterConnectionEstablished` ferme quand même la connexion en `1008`.
- Front : le menu du participant affiche mon pseudo et une flèche ; il s'ouvre en liste déroulante sous la barre du haut, avec « Je vote » et « J'observe », mon rôle actuel coché. Il n'existe que sur l'écran Session, une fois le premier instantané reçu. L'observateur voit « Tu observes » et le lien « Je veux voter » (envoie `changeRole VOTER`). Aucune mise à jour optimiste : l'instantané fait foi ; rien n'est envoyé hors connexion rétablie.
- Table : un observateur qui garde un vote en tour révélé montre la face de sa carte, avec la mention « observe ».
- Journaux : une ligne par changement de rôle, avec le seul `participantId`.
- Découpage de `Session.java` (décision d'Eric, 2026-10-05, option B de la rétrospective T1) : l'état du tour (`roundId`, statut, `votes`, `lateArrivals`) sort dans un record immuable du domaine `Round`, que `Session` porte en un seul champ. Les règles qui ne touchent que le tour (`vote`, `reveal`, `clear`, et la part « tour » de `changeRole`) y vivent ; `Session` garde ses méthodes publiques et ses accesseurs `roundId()`, `roundStatus()`, `votes()`, `lateArrivals()`, `voteOf()`, `summary()`, `canVoteThisRound()` (délégués), pour que les tests et les appelants existants ne changent pas d'attente. La présence et les départs restent dans `Session`.
- Taille de la spec : gardée entière (décision d'Eric, 2026-10-05), malgré une estimation d'environ 3 000 tokens au-delà de la cible de 1 600.

**Never:**
- Pas de `hide` (story 3.2), pas de choix du thème dans le menu (story 3.3) : le menu est construit pour les accueillir, sans les livrer.
- Aucune modification du contrat (`contract/`).
- Pas de nouveau code d'erreur : un `changeRole` d'un participant inconnu est ignoré sans réponse, comme `reveal` et `clear`.
- Pas de confirmation ni de raccourci clavier pour changer de rôle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Même rôle | votant, `changeRole VOTER` | rien ne change, aucune diffusion | N/A |
| Devenir observateur, tour caché | votant avec vote 5 | vote retiré, `hasVoted: false`, M baisse de 1, `ROLE` diffusé | N/A |
| Devenir observateur, tour révélé | votant avec vote 8 | rôle OBSERVER, vote 8 visible, synthèse inchangée | N/A |
| Devenir votant, tour révélé | observateur sans vote | rôle VOTER, `canVoteThisRound: false`, « votera au prochain tour » ; vote refusé `ROUND_REVEALED` | N/A |
| Aller-retour, tour révélé | votant avec vote 3 → observateur → votant | vote 3 conservé, `canVoteThisRound: true` | N/A |
| Après `clear` | votant tardif | `canVoteThisRound: true` | N/A |
| Devenir votant, tour caché | observateur | rôle VOTER, peut voter | N/A |
| `hello` tardif | `hello-timeout` plus court que l'enregistrement | fermeture `1008` | N/A |

</frozen-after-approval>

## Code Map

- `backend/…/domain/Session.java` -- record immuable (393 lignes) ; `vote`, `reveal`, `clear` sont le modèle de `changeRole` ; `lateArrivals` + `canVoteThisRound` portent déjà « votera au prochain tour » ; `summary()` compte tous les `votes` (observateur compris, voulu en tour révélé).
- `backend/…/domain/SessionSnapshot.java` -- `hasVoted = vote != null` quel que soit le rôle ; `progress` ne compte que les votants. Aucun changement attendu.
- `backend/…/application/` -- copies du squelette (D1) : `JoinSessionUseCase:179-182`, `SessionConnectionUseCase:258-264, 305-312, 327-331` et `rejoin:290-291`, `SweepUseCase:428-432, 447-449`, `RoundUseCase.apply:95-108`, `VoteUseCase:43-46`. `SessionLocks.withLock` reste l'unique verrou.
- `backend/…/adapter/in/ws/SessionSocketHandler.java` -- `afterConnectionEstablished:87-95` (délai programmé avant d'être enregistré, F2) ; `case Intent` ignoré à remplacer pour `changeRole` (`hide` reste ignoré). Câblage Spring des cas d'usage : `config/SessionConfig.java` (`RoundUseCase` ligne 89).
- `backend/…/adapter/in/ws/ClientMessages.java` -- `changeRole` déjà validé ; ajouter un `ChangeRoleMessage(role)` ; `Intent` ne garde que `hide`.
- `frontend/src/app/api/contract.ts` -- ajouter `ChangeRoleMessage` et son constructeur, sur le modèle de `revealMessage`.
- `frontend/src/app/session/session.service.ts` -- `changeRole(role)` : envoi seulement sur connexion `open` (ne passe pas par `sendForRound`, pas de `roundId`).
- `frontend/src/app/app.ts`, `top-bar/top-bar-state.ts` -- la barre du haut est rendue par `App` ; `SessionService` est `providedIn: 'root'`, son `state()` donne mon pseudo et mon rôle.
- `frontend/src/app/session/hand.component.ts` -- branche observateur : ajouter « Je veux voter ».
- `frontend/src/app/session/participant-table.component.ts` -- `noteOf` et le gabarit montrent « observe » sans carte pour tout non-votant : à ouvrir pour l'observateur qui garde un vote.
- `frontend/e2e/fake-session-socket.ts` -- faux serveur des tests Playwright.
- Ne pas toucher : `contract/`, `SessionSnapshot` (sauf si un test le prouve faux), les autres libellés.

## Tasks & Acceptance

**Execution:**
- [x] `backend/…/application/` -- extraire le squelette commun (un composant appelé par tous les cas d'usage : `withLock` + `find` + règle + « `save` si l'instance change, `publish` si la `version` change ») et y faire passer toutes les copies D1 ; garder `publishTo` de la connexion quand rien n'est diffusé -- D1, action 13 de l'epic 1.
- [x] `backend/…/adapter/in/ws/SessionSocketHandler.java` -- enregistrer l'attente du `hello` avant de programmer son délai ; test avec un délai quasi nul qui ferme en `1008` -- F2.
- [x] `backend/…/domain/Round.java` (nouveau), `Session.java` -- sortir l'état du tour dans `Round` (sans changer d'attente dans les tests), avant d'ajouter la règle -- T1.
- [x] `backend/…/domain/Session.java`, `Round.java` -- `changeRole` selon les règles ; tests du domaine pour chaque ligne de la matrice -- FR5.
- [x] `backend/…/application/` -- cas d'usage `changeRole` sur le squelette, ligne de journal -- AD-3.
- [x] `backend/…/adapter/in/ws/` -- `ChangeRoleMessage`, routage dans le handler, test d'intégration WebSocket (diffusion `ROLE` à tous) -- AD-4.
- [x] `frontend/src/app/api/contract.ts`, `session/session.service.ts` -- message et méthode `changeRole`, tests Vitest -- AD-10.
- [x] `frontend/src/app/` (nouveau `participant-menu` + `app.ts`) -- menu du participant accessible (bouton à `aria-expanded`, liste de deux choix cochables, Échap ferme et rend le focus) -- UX-DR11.
- [x] `frontend/src/app/session/hand.component.ts`, `participant-table.component.ts` -- « Je veux voter » ; face + « observe » pour un observateur qui garde un vote ; tests Vitest -- FR5, UX-DR5, UX-DR7.
- [x] `frontend/e2e/` -- parcours Playwright : passer observateur pendant un tour caché, puis revenir votant -- FR16.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- retirer l'entrée de la spec 1.6 ; réduire celle de la spec 1.7 à ce qui relève de `hide` (3.2) -- action 15.

**Acceptance Criteria:**
- Given le menu du participant, when je l'ouvre, then il affiche mon pseudo et « Je vote » / « J'observe », mon rôle actuel coché, and mon choix envoie `changeRole {role}`.
- Given un changement de rôle effectif, when il est traité, then tous reçoivent en moins d'une seconde un instantané avec `lastChange.action: ROLE` et un M recalculé par le serveur.
- Given que je suis observateur, when je regarde ma main, then je vois « Tu observes » et « Je veux voter », and « Je veux voter » me fait passer votant.
- Given toute la suite existante, when elle tourne après l'extraction du squelette, then elle passe sans changement d'attente.

## Implementation Notes

- **Squelette commun (D1)** : `application/SessionWriter` (paquet, non public) porte `withLock`, `commit(before, after)` (enregistre si l'instance change, diffuse si la `version` change, renvoie vrai s'il a diffusé) et `apply(sessionId, participantId, rule)`. Toutes les copies relevées passent par lui : `VoteUseCase`, `RoundUseCase`, `JoinSessionUseCase`, `SessionConnectionUseCase` (`connect`, `rejoin`, `disconnect`, `touch`), `SweepUseCase`. Les constructeurs des cas d'usage ne changent pas (le writer est construit à l'intérieur), donc ni `SessionConfig` ni les tests ne bougent pour ce point. Pas de `requireNonNull` dans `SessionWriter` : `SweepSchedulerTest` construit un balayeur sans diffuseur ; `RoundUseCase` garde ses propres contrôles.
- **`hello` (F2)** : `PendingHello` est inscrit dans `pendingHellos` avant que son délai soit programmé ; le délai ne retire que sa propre attente (`remove(key, value)`). `HelloTimeoutTest` (délai `0ms`, 20 connexions) échouait avant la correction (une connexion jamais fermée) et passe après.
- **Découpage (T1, option B)** : nouveau record `domain/Round` (`id`, `status`, `votes`, `lateArrivals`) avec les règles du tour (`vote`, `reveal`, `withArrival`, `without`, `withRole`, `summary`). `Session` passe de 11 à 8 composants ; ses accesseurs `roundId()`, `roundStatus()`, `votes()`, `lateArrivals()` délèguent. `Session.java` fait 411 lignes avec `changeRole` (393 avant) : les règles du tour en sortent, mais les accesseurs délégués et la Javadoc de `changeRole` compensent ; `Round.java` fait 135 lignes.
- **Écart avec la Code Map** : `SessionService` n'est pas fourni à la racine mais par `SessionEntryComponent`. Le menu du participant, rendu par `App`, le reçoit donc par `TopBarState.session`, que l'écran Session pose et retire comme `shareUrl`.
- **Attentes de tests modifiées par la fonctionnalité (et non par le refactor)** : `SessionSocketHandlerTest.heartbeatStaleVotesAndConformingIntentsGetNoAnswer` ne range plus `changeRole` parmi les intentions sans réponse ; `WsContractRoundTripTest` attend `ChangeRoleMessage` au lieu d'`Intent` ; `hand.component.spec` attend « Tu observes » et « Je veux voter ». Aucune autre attente n'a changé.
- **Front** : `ParticipantMenuComponent` (`top-bar/`) suit le motif menu ARIA (`aria-haspopup="menu"`, `menuitemradio` cochés, flèches, Échap, clic extérieur) ; choisir son rôle actuel n'envoie rien. « Je veux voter » est un bouton à l'aspect de lien (`.link-button`, 44 px), grisé hors connexion. Prettier n'est appliqué ni en CI ni sur les fichiers existants : le style suit le code voisin.
- **Environnement** : tests du webservice lancés avec `JAVA_HOME` sur Java 25 ; front sous Node 24.21 (nvm).
- **Vérification** : webservice 437 tests verts (ArchUnit compris) ; front 19 fichiers Vitest verts, `node --test` des scripts vert ; Playwright 48/48 sur Chromium (WebKit seulement en CI) ; contrat inchangé, `validate` et 33 tests verts.

## Spec Change Log

## Review Triage Log

## Design Notes

Entrées de `deferred-work.md` qui visent la story 3.1 (action 15 de la rétrospective de l'epic 2) :
- **Spec 1.6, `hasVoted` d'un votant devenu observateur** : soldée ici — le vote est retiré au passage observateur en tour caché, et reste voulu en tour révélé.
- **Spec 1.7, arrivées tardives face à `hide` et `changeRole`** : la part 3.1 (« marquage d'un observateur devenu votant en tour révélé ») est soldée par `lateArrivals`. Le reste (place dans `progress.expected` et raison du refus après un masquage) relève de `hide` et reste ouvert pour la spec 3.2.

Un seul ensemble de règles d'écriture (D1) : « enregistrer si l'instance change, diffuser si la `version` change » couvre les deux variantes actuelles, puisque toute règle sans effet renvoie la même instance et qu'un changement caché garde la même `version`.

## Verification

**Commands:**
- `cd backend && ./mvnw -q verify` -- expected: tous les tests verts, ArchUnit compris.
- `cd frontend && npm test` -- expected: Vitest vert.
- `cd frontend && npx playwright test` -- expected: e2e verts sur Chromium et WebKit.
- `cd contract && npm run validate && npm test` -- expected: inchangé et vert.
