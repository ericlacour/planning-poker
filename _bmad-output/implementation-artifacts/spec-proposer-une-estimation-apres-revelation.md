---
title: 'Proposer une estimation après la révélation'
type: 'feature'
created: '2026-11-06'
status: 'in-progress'
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
2. **La médiane** (`MEDIAN`) : la médiane des votes classés ; pour un nombre pair de votes, la carte **supérieure** des deux du milieu. Seulement si min et max sont à **3 niveaux au plus** ; au-delà, pas de proposition : le front affiche « Écart trop grand » et invite les pseudos ayant voté le min et le max à expliquer leur vote avant de revoter.
3. **Juste sous le max** (`BELOW_MAX`) : la carte **du jeu** juste sous le max, même si personne ne l'a votée (3, 3, 13 → 8).

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
| Médiane, 3 niveaux | 2, 8 | Médiane | 8 |
| Sous le max | 3, 3, 13 | Juste sous le max | 8 |
| Un seul vote / tous égaux | 5 | toutes sauf Aucune | 5 |
| Règle Aucune | 3, 8 | Aucune | aucune |
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
- [ ] `contract/` -- `common.json#/$defs/estimationRule` (`NONE`, `MAX`, `MEDIAN`, `BELOW_MAX`) ; `estimationRule` facultatif dans `create-session-request.json`, requis dans `session-state.json` ; `summary.proposal` (carte classée ou null) et `summary.spreadTooWide` (booléen) requis ; exemples mis à jour et ajoutés (médiane, écart trop grand) ; `validate.mjs` vérifie la proposition contre les votes et le jeu ; README.
- [ ] `backend/.../domain/EstimationRule.java` (nouveau), `Summary.java` -- calcul de `proposal` et `spreadTooWide` à partir des votes, du jeu et de la règle.
- [ ] `backend/.../domain/Session.java`, `Round.java`, `SessionSnapshot.java` -- porter la règle (figée) jusqu'à la synthèse et l'instantané.
- [ ] `backend/.../application/CreateSessionUseCase.java`, `adapter/in/rest/CreateSessionRequest.java`, `SessionController.java` -- lire la règle (défaut `NONE`) ; valeur inconnue = corps mal formé (400 sans code).
- [ ] `backend/.../adapter/in/ws/ServerMessages.java` -- exposer `estimationRule`, `proposal`, `spreadTooWide`.
- [ ] Tests back -- `SummaryTest` (toute la matrice), `SessionControllerTest`, round-trips de contrat.
- [ ] `frontend/src/app/api/contract.ts` -- types, parseurs stricts, `createSessionRequest`.
- [ ] `frontend/src/app/entry-form/entry-form.component.ts` -- groupe radio « Proposition d'estimation » (Aucune, La plus grande, Médiane, Juste sous le max), « Aucune » cochée, flèches, envoyé à la création seulement.
- [ ] `frontend/src/app/session/result.ts` (+ `styles/reveal.css` si besoin) -- « Proposition 8 » dans le panneau et la ligne téléphone et l'annonce `aria-live` ; « Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez » (pseudos des votes égaux au min et au max, dans l'ordre de la table).
- [ ] Tests front -- `contract.spec.ts`, `entry-form.component.spec.ts`, `result.spec.ts`, e2e création et révélation.

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

## Spec Change Log

## Review Triage Log
