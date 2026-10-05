---
title: 'Story 3.2 : masquer pour revoter'
type: 'feature'
created: '2026-10-05'
status: 'in-progress'
baseline_commit: '338dface456d5acbca5d2e7cc6be962eb659e4b8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une équipe ne peut pas revoter après une discussion sans effacer les votes (FR13). Le bouton « Masquer » est toujours inactif, et le webservice ignore `hide`.

**Approach:** Ajouter la règle `Session.hide` dans le domaine (avec sa part « tour » dans `Round`). Ajouter un cas d'usage `hide` qui passe par le `SessionWriter` existant, puis le router depuis le WebSocket. Côté front, activer « Masquer » pour envoyer `hide {roundId}`. Le contrat ne change pas : `hide`, `HIDE` et ses exemples y sont déjà.

## Boundaries & Constraints

**Always:**
- Règles du domaine (FR13, AD-4), toutes sur `Session.hide(participantId, roundId)` :
  - tout participant (votant ou observateur) peut masquer ;
  - un `roundId` périmé, ou un tour déjà caché, renvoie la même instance, sans `version++` ;
  - sinon : le tour redevient caché, avec le même `roundId`, puis `version + 1` et `lastChange {HIDE, participantId}` ;
  - le vote de chaque participant qui est observateur au moment du masquage est retiré ; les votes des votants restent et redeviennent modifiables ;
  - un participant inconnu lève `IllegalArgumentException`, comme pour `reveal` : l'intention est ignorée sans réponse ;
  - **arrivées tardives** (décision d'Eric, 2026-10-05, option A) : le masquage vide `lateArrivals`. Tout votant, arrivé pendant la révélation ou devenu votant pendant la révélation, peut voter sur le tour redevenu caché (`canVoteThisRound: true`) et compte dans M. Une arrivée tardive n'existe donc que pendant un tour révélé.
- Taille de la spec : gardée entière (décision d'Eric, 2026-10-05), malgré environ 2 200 tokens pour une cible de 1 600.
- `progress` et `summary` sont recalculés par le serveur à partir de l'instantané existant ; aucun calcul côté front.
- Front : « Masquer » (bouton secondaire, tour révélé) envoie `hide` avec le `roundId` courant. Il est inactif dans les mêmes cas que « Nouveau tour » : pendant la garde de 1 s, ou quand la connexion n'est pas `open`. Pas de confirmation, pas de raccourci clavier.
- Après un masquage, l'écran est celui d'un tour caché : dos des cartes, compteur, main active et aucune synthèse. L'état suffit à le montrer, sans annonce `aria-live` dédiée (EXPERIENCE : la table suffit).
- Journaux : une ligne par masquage effectif, avec le seul `participantId`, comme pour `changeRole`.

**Never:**
- Aucune modification du contrat (`contract/`).
- Pas de nouveau code d'erreur, pas de réponse à un `hide` sans effet.
- Ne pas changer le `roundId` au masquage.
- Pas de thème (3.3), pas d'animation (3.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Masquer | tour révélé, votes 3 et 8 | tour caché, même `roundId`, votes gardés, `HIDE` diffusé, synthèse absente | N/A |
| Déjà caché | tour caché | même instance, aucune diffusion | N/A |
| `roundId` périmé | `hide` d'un ancien tour | même instance, aucune diffusion | N/A |
| Deux masquages simultanés | deux `hide` du même tour | le premier s'applique, le second ne fait rien | N/A |
| Observateur avec vote | votant (vote 5) devenu observateur pendant la révélation | au masquage, vote retiré, `hasVoted: false` | N/A |
| Revoter | votant avec vote 3, tour masqué | `vote 5` accepté | N/A |
| Masqué par un observateur | observateur, tour révélé | masquage effectif | N/A |
| Arrivée tardive | votant arrivé pendant la révélation, ou observateur devenu votant | au masquage, `canVoteThisRound: true`, compté dans M, peut voter | N/A |

</frozen-after-approval>

## Code Map

- `backend/…/domain/Round.java` -- record immuable du tour ; `reveal()` est le modèle. Ajouter `hide(Set<UUID> observers)` (package-private) : même instance si caché ; sinon statut `HIDDEN`, votes des `observers` retirés, `lateArrivals` vidé.
- `backend/…/domain/Session.java:337-343` -- `reveal` est le modèle exact de `hide` : `requireParticipant`, contrôle du `roundId`, puis `withRound(round.hide(observateurs), ChangeAction.HIDE, participantId)`. `ChangeAction.HIDE` existe déjà.
- `backend/…/domain/SessionSnapshot.java` -- aucun changement : `hasVoted`, `progress`, `canVoteThisRound` et `summary` dérivent déjà de l'état.
- `backend/…/application/RoundUseCase.java` -- ajouter `hide(sessionId, participantId, roundId)` via `writer.apply`, sur le modèle de `reveal`. Pour la ligne de journal, suivre `ChangeRoleUseCase` (journal seulement si `commit` a diffusé).
- `backend/…/adapter/in/ws/ClientMessages.java` -- ajouter `HideMessage(type, roundId)` sur le modèle de `RevealMessage`. `Intent` n'a plus d'usage : le supprimer avec sa branche `default`.
- `backend/…/adapter/in/ws/SessionSocketHandler.java:128-136` -- router `HideMessage` vers `rounds.hide` ; retirer `case Intent`. Mettre à jour la Javadoc de la classe (ligne 53).
- Tests backend à ajuster : `SessionSocketHandlerTest.heartbeatStaleVotesAndConformingIntentsGetNoAnswer` (ligne 359, `hide` sur un tour caché reste sans réponse : à garder, c'est une intention déjà satisfaite) ; `WsContractRoundTripTest:145` attend `HideMessage` au lieu d'`Intent`. Nouveaux tests dans `domain/SessionRoundTest.java`, `application/RoundUseCaseTest.java`, et un test d'intégration WebSocket (diffusion `HIDE` à tous) dans `SessionSocketHandlerTest`.
- `frontend/src/app/api/contract.ts:212-230` -- ajouter `HideMessage` et `hideMessage(roundId)` sur le modèle de `revealMessage`.
- `frontend/src/app/session/session.service.ts:144-152` -- ajouter `hide()` via `sendForRound(hideMessage)`.
- `frontend/src/app/session/action-bar.component.ts:46` -- « Masquer » : `[disabled]="inactive()"`, `(click)="session.hide()"` ; corriger la Javadoc (« inactif : story 3.2 »). La garde de 1 s couvre déjà `HIDE`.
- `frontend/src/app/session/result.ts:56-64` -- `announcementFor` ne renvoie rien pour révélé → caché (même tour) : comportement voulu, ne pas changer.
- Tests front à ajuster : `action-bar.component.spec.ts:73,101` (« Masquer » toujours inactif), `e2e/reveal.spec.ts:129` (`toBeDisabled`). `e2e/fake-session-socket.ts` ne fait qu'enregistrer les messages reçus.
- Ne pas toucher : `contract/`, `SessionWriter`, `SessionSnapshot`.

## Tasks & Acceptance

**Execution:**
- [ ] `backend/…/domain/Round.java`, `Session.java` -- `Round.hide` et `Session.hide` selon les règles ; tests du domaine pour chaque ligne de la matrice -- FR13, AD-4.
- [ ] `backend/…/application/RoundUseCase.java` -- `hide` sur le `SessionWriter`, ligne de journal ; tests du cas d'usage (diffusion seulement si la `version` change) -- AD-3.
- [ ] `backend/…/adapter/in/ws/ClientMessages.java`, `SessionSocketHandler.java` -- `HideMessage` et son routage, suppression d'`Intent` ; tests du handler, du contrat et de la diffusion `HIDE` à tous -- AD-4.
- [ ] `frontend/src/app/api/contract.ts`, `session/session.service.ts` -- `hideMessage` et `SessionService.hide()` ; tests Vitest -- AD-10.
- [ ] `frontend/src/app/session/action-bar.component.ts` -- « Masquer » actif, avec la même garde que « Nouveau tour » ; tests Vitest (envoi, garde de 1 s après un `HIDE` d'un autre, hors connexion) -- FR13, UX-DR8.
- [ ] `frontend/e2e/reveal.spec.ts` -- parcours Playwright : révéler, masquer (`hide` envoyé avec le `roundId`), puis l'instantané caché remet les dos et rend la main active -- FR16.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- solder l'entrée de la spec 1.7 : le masquage vide `lateArrivals`, donc aucune arrivée tardive n'existe pendant un tour caché.

**Acceptance Criteria:**
- Given un tour révélé, when je clique sur « Masquer », then le client envoie `hide {roundId}` et tous reçoivent en moins d'une seconde un instantané caché, avec le même `roundId` et `lastChange.action: HIDE`.
- Given un tour masqué, when je regarde l'écran, then les cartes de la table sont de dos, la synthèse a disparu, le compteur « N votes sur M » est revenu et ma main est active.
- Given qu'un autre participant masque, when l'instantané arrive, then mes boutons d'action restent inactifs pendant 1 s.
- Given toute la suite existante, when elle tourne, then elle passe ; seules changent les attentes qui supposaient « Masquer » inactif ou `hide` ignoré.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd backend && ./mvnw -q verify` -- expected: tous les tests verts, ArchUnit compris.
- `cd frontend && npm test` -- expected: Vitest vert.
- `cd frontend && npx playwright test` -- expected: e2e verts sur Chromium (WebKit en CI).
- `cd contract && npm run validate && npm test` -- expected: inchangé et vert.
