---
title: 'Story 3.1 : changer de rôle en pleine séance'
type: 'feature'
created: '2026-10-05'
status: 'draft'
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

## Open Questions

- **Découpage de `Session.java` (rétrospective T1), à décider avant `changeRole` et `hide`** — options :
  - **A. Sortir la présence et les départs** dans un objet immuable à part (connexions, activité, absence, `departed`, `rejoin`, reprise) : `Session.java` repasse sous ~250 lignes, mais le chantier touche une dizaine de tests du domaine et alourdit nettement cette story.
  - **B. Sortir l'état du tour** (`roundId`, statut, `votes`, `lateArrivals`) dans un objet `Round` : c'est la partie que `changeRole` et `hide` modifient, donc ces deux stories deviennent plus simples ; gain de lignes plus modeste.
  - **C. Ne pas découper maintenant** : `changeRole` ajoute ~35 lignes (≈ 430) ; on consigne un seuil (par exemple 450 lignes) qui déclenche le découpage au plus tard dans la spec 3.2.

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
- [ ] `backend/…/application/` -- extraire le squelette commun (un composant appelé par tous les cas d'usage : `withLock` + `find` + règle + « `save` si l'instance change, `publish` si la `version` change ») et y faire passer toutes les copies D1 ; garder `publishTo` de la connexion quand rien n'est diffusé -- D1, action 13 de l'epic 1.
- [ ] `backend/…/adapter/in/ws/SessionSocketHandler.java` -- enregistrer l'attente du `hello` avant de programmer son délai ; test avec un délai quasi nul qui ferme en `1008` -- F2.
- [ ] `backend/…/domain/Session.java` (+ découpage selon la réponse à la question ouverte) -- `changeRole` selon les règles ; tests du domaine pour chaque ligne de la matrice -- FR5.
- [ ] `backend/…/application/` -- cas d'usage `changeRole` sur le squelette, ligne de journal -- AD-3.
- [ ] `backend/…/adapter/in/ws/` -- `ChangeRoleMessage`, routage dans le handler, test d'intégration WebSocket (diffusion `ROLE` à tous) -- AD-4.
- [ ] `frontend/src/app/api/contract.ts`, `session/session.service.ts` -- message et méthode `changeRole`, tests Vitest -- AD-10.
- [ ] `frontend/src/app/` (nouveau `participant-menu` + `app.ts`) -- menu du participant accessible (bouton à `aria-expanded`, liste de deux choix cochables, Échap ferme et rend le focus) -- UX-DR11.
- [ ] `frontend/src/app/session/hand.component.ts`, `participant-table.component.ts` -- « Je veux voter » ; face + « observe » pour un observateur qui garde un vote ; tests Vitest -- FR5, UX-DR5, UX-DR7.
- [ ] `frontend/e2e/` -- parcours Playwright : passer observateur pendant un tour caché, puis revenir votant -- FR16.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- retirer l'entrée de la spec 1.6 ; réduire celle de la spec 1.7 à ce qui relève de `hide` (3.2) -- action 15.

**Acceptance Criteria:**
- Given le menu du participant, when je l'ouvre, then il affiche mon pseudo et « Je vote » / « J'observe », mon rôle actuel coché, and mon choix envoie `changeRole {role}`.
- Given un changement de rôle effectif, when il est traité, then tous reçoivent en moins d'une seconde un instantané avec `lastChange.action: ROLE` et un M recalculé par le serveur.
- Given que je suis observateur, when je regarde ma main, then je vois « Tu observes » et « Je veux voter », and « Je veux voter » me fait passer votant.
- Given toute la suite existante, when elle tourne après l'extraction du squelette, then elle passe sans changement d'attente.

## Implementation Notes

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
