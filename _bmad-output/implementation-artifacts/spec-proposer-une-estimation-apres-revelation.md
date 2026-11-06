---
title: 'Proposer une estimation après la révélation'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '6796487f2aefe5349c53c7388b5dfa2eaa7fbe52'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/contract/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Après la révélation, l'équipe voit moyenne, plus votée, min et max, mais aucune valeur ne lui est suggérée : la discussion repart de zéro à chaque ticket.

**Approach:** À la création de la session, le créateur choisit une règle de proposition, figée ensuite comme le jeu de cartes. À chaque tour révélé, le webservice calcule une carte proposée selon cette règle et l'envoie dans la synthèse ; le front l'affiche (« Proposition ») sans rien recalculer. C'est une suggestion : rien n'est retenu ni conservé.

Règles (décisions d'Eric du 06/11/2026) :
0. **Aucune** (`NONE`), présélectionnée et appliquée quand la requête n'en porte pas : pas de proposition.
1. **La plus grande** (`MAX`) : la carte maximale votée.
2. **La médiane** (`MEDIAN`) : la médiane des votes classés ; pour un nombre pair de votes, la carte **supérieure** des deux du milieu. Seulement si min et max sont à **3 niveaux au plus** ; au-delà, pas de proposition.
3. **Juste sous le max** (`BELOW_MAX`) : la carte **du jeu** juste sous le max, même si personne ne l'a votée (3, 3, 13 → 8).

**Écart trop grand, quelle que soit la règle** (`NONE` comprise ; décision d'Eric du 06/11/2026, voir le Spec Change Log) : si min et max sont à **plus de 3 niveaux**, le front affiche « Écart trop grand » et invite les pseudos ayant voté le min et le max à expliquer leur vote avant de revoter. `MAX` et `BELOW_MAX` gardent leur proposition, `MEDIAN` n'en donne pas.

## Boundaries & Constraints

**Always:**
- Calcul côté webservice seulement (`Summary`), comme le reste de la synthèse ; le front affiche.
- Seules les cartes classées comptent (chiffres et tailles ; `?` et `coffee` exclus). Sans vote classé : pas de proposition.
- Un « niveau » est un pas dans l'ordre des cartes **du jeu de la session** (cartes retenues, `?` et `coffee` exclus) : avec `1, 2, 3, 5, 8`, de 2 à 8 il y a 3 niveaux.
- Votes classés tous identiques (consensus ou vote unique) : la proposition est cette valeur, quelle que soit la règle sauf `NONE`.
- Contrat modifié par ajout seulement (AD-13), dans le même changement que les deux côtés (AD-6).
- La règle est visible de tous (aucun rôle privilégié, PRD §1) et ne change plus après la création.

**Never:**
- Pas de valeur retenue, d'historique ni de saisie de l'estimation finale (PRD §6, §7.2).
- Pas de changement de règle en cours de session, pas de droit propre au créateur.

## I/O & Edge-Case Matrix

| Scénario | Votes (jeu Fibonacci complet) | Règle | Proposition |
|---|---|---|---|
| Max | 3, 5, 8 | La plus grande | 8 |
| Médiane paire | 3, 5, 5, 8 | Médiane | 5 |
| Médiane paire, entre deux cartes | 3, 5 | Médiane | 5 |
| Médiane, écart trop grand | 2, 13 (4 niveaux) | Médiane | aucune, `spreadTooWide` vrai |
| Écart trop grand, autres règles | 2, 3, 13 (4 niveaux) | La plus grande / Juste sous le max / Aucune | 13 / 8 / aucune, `spreadTooWide` vrai |
| Médiane, 3 niveaux | 2, 8 | Médiane | 8 |
| Sous le max | 3, 3, 13 | Juste sous le max | 8 |
| Un seul vote / tous égaux | 5 | toutes sauf Aucune | 5 |
| Règle Aucune | 3, 8 (2 niveaux) | Aucune | aucune, `spreadTooWide` faux |
| Consensus | 5, 5 | toutes sauf Aucune | 5 |
| Rien de classé | ?, coffee | toutes | aucune |
| Tailles | S, M, M, XL | Médiane | M |

</frozen-after-approval>

## Code Map

- `contract/schemas/create-session-request.json`, `common.json` -- ajouter `estimationRule` facultatif (enum) à côté de `deck`.
- `contract/schemas/session-state.json` -- `estimationRule` dans l'état ; `summary.proposal` (carte classée ou null) ; exemples `examples/session-state/*` et `create-session-request/*` ; règles d'AD-5 dans `scripts/validate.mjs` (proposition cohérente avec les votes).
- `backend/.../domain/Summary.java` -- calcul de la proposition ; `Summary.of(votes)` reçoit le jeu et la règle. Réutiliser `Card` (ordre = ordre du jeu), `Deck.cards()`.
- `backend/.../domain/Session.java`, `Round.java` (`summary()`), `SessionSnapshot.java` -- porter la règle comme `deck` (figée à la création).
- `backend/.../application/CreateSessionUseCase.java`, `adapter/in/rest/CreateSessionRequest.java`, `SessionController.java`, `RestErrorHandler.java` -- même chemin que `deck` (`deckOrDefault`).
- `backend/.../adapter/in/ws/ServerMessages.java` -- `SummaryView.proposal`, `estimationRule`.
- `frontend/src/app/api/contract.ts` -- types, `isSummary`/`isSessionState` stricts (`hasExactly`), `createSessionRequest`.
- `frontend/src/app/entry-form/entry-form.component.ts` -- groupe radio « Proposition d'estimation » sous « Cartes de la session » (même motif que `deckTypes`, flèches comprises).
- `frontend/src/app/session/result.ts` -- « Proposition » dans `ResultPanelComponent`, `ResultLineComponent` et `revealAnnouncement`.
- Tests : `SummaryTest`, `SessionControllerTest`, `ContractRoundTripTest`, `WsContractRoundTripTest`, `result.spec.ts`, `entry-form.component.spec.ts`, `contract.spec.ts`, `e2e/create-session.spec.ts`, `e2e/reveal.spec.ts`.
- Précédent à suivre : commit `ce4fb4ce248441b592a17519fc6a473e95528df1` (jeu de cartes choisi à la création).

## Tasks & Acceptance

**Execution:**
- [x] `contract/` -- `common.json#/$defs/estimationRule` (`NONE`, `MAX`, `MEDIAN`, `BELOW_MAX`) ; `estimationRule` facultatif dans `create-session-request.json`, requis dans `session-state.json` ; `summary.proposal` (carte classée ou null) et `summary.spreadTooWide` (booléen) requis ; exemples mis à jour et ajoutés (médiane, écart trop grand) ; `validate.mjs` vérifie la proposition contre les votes et le jeu ; README.
- [x] `backend/.../domain/EstimationRule.java` (nouveau), `Summary.java` -- calcul de `proposal` et `spreadTooWide` à partir des votes, du jeu et de la règle.
- [x] `backend/.../domain/Session.java`, `Round.java`, `SessionSnapshot.java` -- porter la règle (figée) jusqu'à la synthèse et l'instantané.
- [x] `backend/.../application/CreateSessionUseCase.java`, `adapter/in/rest/CreateSessionRequest.java`, `SessionController.java` -- lire la règle (défaut `NONE`) ; valeur inconnue = corps mal formé (400 sans code).
- [x] `backend/.../adapter/in/ws/ServerMessages.java` -- exposer `estimationRule`, `proposal`, `spreadTooWide`.
- [x] Tests back -- `SummaryTest` (toute la matrice), `SessionControllerTest`, round-trips de contrat.
- [x] `frontend/src/app/api/contract.ts` -- types, parseurs stricts, `createSessionRequest`.
- [x] `frontend/src/app/entry-form/entry-form.component.ts` -- groupe radio « Proposition d'estimation » (Aucune, La plus grande, Médiane, Juste sous le max), « Aucune » cochée, flèches, envoyé à la création seulement.
- [x] `frontend/src/app/session/result.ts` (+ `styles/reveal.css` si besoin) -- « Proposition 8 » dans le panneau et la ligne téléphone et l'annonce `aria-live` ; « Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez » (pseudos des votes égaux au min et au max, dans l'ordre de la table).
- [x] Tests front -- `contract.spec.ts`, `entry-form.component.spec.ts`, `result.spec.ts`, e2e création et révélation.

**Acceptance Criteria:**
- Given une session créée avec « Médiane », when un tour est révélé, then tous les participants (votants et observateurs) voient la même proposition.
- Given une session créée sans choix (ou avec « Aucune »), when un tour est révélé, then aucune ligne « Proposition » ni « Écart trop grand » n'apparaît.
- Given un tour révélé puis effacé ou masqué, when il est de nouveau révélé, then la proposition est recalculée sur les votes du moment.

## Verification

**Commands:**
- `(cd contract && npm run validate && npm test)` -- succès
- `(cd backend && ./mvnw verify)` -- succès
- `(cd frontend && npm test)` -- succès
- `(cd frontend && npm run e2e)` après `build:e2e` -- succès

## Implementation Notes

- Médiane : `votes classés triés[n / 2]` (milieu pour un nombre impair, carte supérieure des deux du milieu pour un nombre pair). Niveaux = indices dans les cartes classées du jeu de la session. `spreadTooWide` est calculé pour toute règle (depuis le 06/11/2026, voir le Spec Change Log).
- `Summary.of(votes)` reste une commodité (règle `NONE`) ; le domaine passe par `Summary.of(votes, deck, rule)` depuis `Round.summary(deck, rule)`.
- Exemples : `hidden-round.json` passe en `NONE` (règle sans effet sur un tour caché) pour que les instantanés simulés des e2e qui le reprennent restent cohérents ; nouveaux `revealed-median.json`, `revealed-spread-too-wide.json`, `create-session-request/median.json`. `validate.mjs` exige un exemple de médiane et un d'écart trop grand.
- Front : pseudos de l'écart calculés par `spreadVoters(state)` dans l'ordre de `seatsOf` (ma place en tête de son groupe) ; dans l'annonce `aria-live`, « Proposition N. » (ou le message d'écart) vient après « Consensus ! ».
- Accueil 1280 × 600 : sur PC bas, les trois groupes radio posent leur libellé à gauche des boutons (marges 12 px) pour tenir sans défiler ; règles en 4 boutons segmentés sur PC, 2 × 2 sur téléphone.

## Spec Change Log

- **2026-11-06, demande d'Eric** : l'écart trop grand (min et max à plus de 3 niveaux) est signalé **quelle que soit la règle**, `NONE` comprise, et plus seulement avec la médiane : les pseudos ayant voté le min et le max sont invités à expliquer leur vote. Choix d'implémentation : `MAX` et `BELOW_MAX` gardent leur proposition (affichée avec le message), `MEDIAN` reste sans proposition. `Summary.MAX_MEDIAN_LEVELS` devient `MAX_SPREAD_LEVELS` ; contrat (`session-state.json`, README, `validate.mjs`), `SummaryTest`, `validate.test.mjs`, `result.spec.ts` et `layout.spec.ts` mis à jour. Forme du contrat inchangée : seul le sens de `spreadTooWide` s'élargit.

## Review Triage Log

| # | Source | Constat | Verdict | Preuve / décision |
|---|---|---|---|---|
| 1 | verification-gap | `estimationRule`, `proposal`, `spreadTooWide` jamais vérifiés sur le WebSocket réel | medium | Constat pré-vérifié : `SessionStateMessage.of` n'est appelé par aucun test, `SessionSocketHandlerTest` ne lit pas ces champs. → patch |
| 2 | edge-case | `"estimationRule": null` accepté comme NONE sans test | low | Même précédent que `deck: null`, mais non épinglé. Correction directe (un test). → patch |
| 3 | edge-case | Un seul pseudo avec « expliquent » | false | Inatteignable : `spreadTooWide` exige min ≠ max, chacun voté par une place affichée (votes hors jeu refusés, votes des partis retirés). |
| 4 | blind | Règles non expliquées sur le formulaire | low | Réel : seuls les libellés, choix définitif. Correction simple (aide sous le groupe, comme pour le jeu). → patch |
| 5 | blind | La règle de la session n'est jamais affichée en séance | low | Réel : `estimationRule` n'est lu par aucun composant de séance ; on ne sait pas d'où vient la proposition. → patch (règle dans le libellé du panneau PC) |
| 6 | blind | Contrôle « exemple de médiane » de `validate.mjs` satisfait par un consensus | low | Réel : la condition ne demande pas min ≠ max. Correction directe. → patch |
| 7 | blind | Java lève une exception pour un vote hors jeu, JS non | false | Inatteignable : `Round.vote` refuse toute carte hors du jeu, figé à la création ; l'échec bruyant est voulu. |
| 8 | blind | Champs requis + `hasExactly` : un onglet de l'ancienne version rejette les nouveaux états pendant un déploiement | medium | Réel mais préexistant : `deck` a été ajouté de la même façon (commit ce4fb4c). → defer |
| 9 | blind | Aucun test de mise en page pour « Écart trop grand » et « Proposition » | maybe-false | Pas vérifié que le message long tienne sans défilement en 360 × 740 / 1280 × 650. Ajout direct de cas dans `layout.spec.ts`. → patch |
| 10 | blind | Commentaire périmé et `getByText('Proposition')` fragile dans `reveal.spec.ts` | low | Réel, correction directe. → patch |
| 11 | blind | `Summary.of(votes)` par défaut, piège | low | Côté développeurs seulement, sert aux tests ; refonte au-delà d'une correction directe. Rejeté. |
| 12 | blind | Constructeur `Session` recopié 8 fois | low | Dette préexistante (déjà 9 arguments). Rejeté. |
| 13 | blind | Groupe de règles réutilisant les classes `.role` | low | Même motif que le groupe du jeu ; refonte CSS. Rejeté. |
| 14 | blind | Test des flèches de la règle ne vérifie pas le jeu | low | Réel, correction directe (une assertion). → patch |
| 15 | blind | Repli « le min et le max expliquent leur vote » mal tourné | low | Réel (texte), correction directe : « ceux qui ont voté le min et le max ». → patch |
| 16 | blind | Seuil de 3 niveaux et liste des règles dupliqués | low | Le script de contrat est une référence indépendante voulue. Rejeté. |
| 17 | blind | Spec décalée de l'implémentation | — | Sa correction modifie la spec : rejeté. |
