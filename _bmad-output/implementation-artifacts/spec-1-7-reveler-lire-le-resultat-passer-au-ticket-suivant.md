---
title: 'Story 1.7 : révéler, lire le résultat, passer au ticket suivant'
type: 'feature'
created: '2026-10-02'
status: 'in-progress'
baseline_commit: '67ceca091646aa6740b3650f08d55a949ecd65f7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-6-voter-a-l-aveugle.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On peut voter mais pas révéler : pas de résultat, pas de passage au ticket suivant (FR11, FR12, FR14, FR15, FR17, UJ-1).

**Approach:** Traiter les intentions `reveal {roundId}` et `clear {roundId}` dans le domaine, calculer la synthèse (moyenne, plus votée, min, max, consensus) dans le domaine seul, et l'envoyer dans l'instantané ; côté front, ajouter les boutons de la barre d'action, les faces révélées, le panneau de résultat, le blocage de 1 s et l'annonce `aria-live`.

## Boundaries & Constraints

**Always :**
- `reveal` : `roundId` périmé ou tour déjà révélé → rien (pas de `version`, pas d'erreur) ; sinon statut `REVEALED`, `version + 1`, `lastChange {REVEAL, auteur}`. Tout participant (votant ou observateur) peut révéler, même si personne n'a voté.
- `clear` : `roundId` périmé → rien ; sinon tous les votes supprimés, nouveau `roundId` (généré par `IdGenerator`), statut `HIDDEN`, `version + 1`, `lastChange {CLEAR, auteur}`. Autorisé sur un tour caché comme révélé, par tout participant ; un `clear` sur un tour caché sans aucun vote change quand même le `roundId` (nouveau tour).
- Tour révélé : `vote` → `ROUND_REVEALED` (règle 1.6) ; l'instantané remplit `vote` pour tous ceux qui ont voté ; `summary` non nul. Tour caché : `summary: null`.
- Synthèse (domaine, Java pur, `BigDecimal`) sur les seules cartes numériques (`?` et `coffee` exclus) : `average` arrondie au dixième en `HALF_UP` (5,25 → 5,3), sérialisée en nombre JSON ; `mostVoted {values (ordre du jeu), count}` avec toutes les valeurs à égalité ; `min`, `max` ; `consensus` vrai si au moins deux votes numériques tous identiques. Sans vote numérique : `average`, `mostVoted`, `min`, `max` nuls et `consensus` faux.
- Arrivée (rejoindre) pendant un tour révélé : `canVoteThisRound: false` jusqu'au prochain `clear` ; un `vote` de ce participant → `ROUND_REVEALED`.
- Intentions traitées une par une sous le verrou ; état final identique pour tous.
- Front, barre d'action (masquée si je suis seul) : tour caché → compteur, « Effacer les votes » (secondaire) et « Révéler les votes » (principal) ; tour révélé → panneau de résultat, « Masquer » (secondaire, toujours inactif dans cette story) et « Nouveau tour » (principal). « Révéler les votes » envoie `reveal`, « Nouveau tour » et « Effacer les votes » envoient `clear`, avec le `roundId` courant ; aucune confirmation ni raccourci clavier.
- Tour révélé : chaque place montre la face de la carte avec le pseudo, ou « n'a pas voté » ; la main est grisée (`aria-disabled`, clics sans effet) ; un votant arrivé pendant le tour révélé porte « votera au prochain tour ».
- Panneau de résultat (affichage pur du `summary`) : moyenne au format français (« 5,9 », `Intl`/`LOCALE_ID` `fr`) ; « Plus votée 5 · 6 votes » / « 5 et 8 · 3 votes chacune » / « 1 vote » ; « Min 3 », « Max 13 » ; badge « Consensus ! » ; sans chiffre : « Pas de résultat chiffré ». `☕` jamais dans les chiffres.
- Blocage : si l'instantané reçu a `lastChange.action` ∈ {REVEAL, HIDE, CLEAR} et `byParticipantId` ≠ moi, les boutons de la barre d'action sont inactifs pendant 1 s.
- Annonce : une région `aria-live="polite"` dit « Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes. Min 3, max 13. » à une révélation (adaptée : égalité « Plus votée 5 et 8, 3 votes chacune. », consensus ajoute « Consensus ! », sans chiffre « Votes révélés. Pas de résultat chiffré. ») et « Nouveau tour » à un effacement — que l'auteur soit moi ou un autre.
- Contrat : aller-retour des exemples `reveal`, `clear`, `session-state/revealed-*`, `session-state/new-round-after-sweep` à travers les types écrits à la main, des deux côtés (comparaison numérique de `average` : `3` et `3.0` sont égaux).
- Libellés exacts, tutoiement, CSP inchangée.

**Never :**
- Pas de `hide` (story 3.2) : « Masquer » est affiché inactif ; pas d'animation de retournement (story 3.4).
- Aucun calcul de synthèse côté front.
- Pas de disposition téléphone (story 1.8).
- Aucune modification du contrat.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Révéler | tour caché, votes 3, 5, 8 | `REVEALED`, tous les `vote` visibles, `summary` rempli, `lastChange REVEAL` | N/A |
| Déjà révélé | `reveal` sur un tour révélé | aucun changement, pas de `version` | N/A |
| Périmé | `reveal` ou `clear` avec un ancien `roundId` | aucun changement | N/A |
| Effacer | tour révélé avec votes | votes supprimés, nouveau `roundId`, `HIDDEN`, `summary null`, `lastChange CLEAR` | N/A |
| Clics croisés | deux `clear` avec le même `roundId` | un seul nouveau tour, une seule `version + 1` ; le second est périmé | N/A |
| Observateur | observateur révèle / efface | accepté | N/A |
| Moyenne | votes 5, 5, 5, 6 (5,25) | `average` 5.3 | N/A |
| Égalité | 5, 8, 5, 8, `?` | `mostVoted {["5","8"], 2}`, min 5, max 8, moyenne 6.5, pas de consensus | N/A |
| Un seul vote | 8 | moyenne 8, plus votée 8 (1), min = max = 8, pas de consensus | N/A |
| Consensus | 3, 3, `coffee` | `consensus true`, moyenne 3 | N/A |
| Sans chiffre | `?`, `coffee` | tout nul, `consensus false` | N/A |
| Aucun vote | révélé sans vote | tout nul, places « n'a pas voté » | N/A |
| Vote après révélation | `vote` sur tour révélé | rien | `ROUND_REVEALED` |
| Arrivée tardive | rejoindre pendant un tour révélé | `canVoteThisRound false` ; après `clear`, `true` | `vote` → `ROUND_REVEALED` |
| Front, boutons | tour caché / révélé | « Effacer les votes » + « Révéler les votes » / « Masquer » (inactif) + « Nouveau tour » | N/A |
| Front, blocage | instantané `REVEAL` d'un autre | boutons inactifs 1 s, puis actifs | N/A |
| Front, pas de blocage | instantané `REVEAL` par moi, ou `VOTE` d'un autre | boutons actifs | N/A |
| Front, résultat | `summary` de l'exemple `revealed-tie` | « 6,5 », « 5 et 8 · 2 votes chacune », « Min 5 », « Max 8 », pas de badge | N/A |
| Front, annonce | révélation puis effacement | « Votes révélés. Moyenne … » puis « Nouveau tour » dans la région polie | N/A |

</frozen-after-approval>

## Code Map

- Stories 1.5 et 1.6 (voir leurs specs et Implementation Notes) : domaine `Session` (tour, votes, `lastChange`, instantané `SessionSnapshot`, règle `vote`, `Card`), cas d'usage et diffusion, gestionnaire WebSocket (`reveal` et `clear` aujourd'hui ignorés), front `session/session.service.ts` (intentions), main, places, barre d'action avec compteur.
- `domain/IdGenerator.newRoundId()` -- nouveau `roundId` au `clear`.
- Contrat : `schemas/{reveal,clear,session-state}.json`, exemples `reveal/`, `clear/`, `session-state/revealed-*`, `session-state/new-round-after-sweep.json`.
- DESIGN.md › `result-panel`, `consensus-badge`, `action-bar`, `button-primary`, `button-secondary` ; maquettes `mockups/session-pc.html` (tour révélé sans consensus), `mockups/session-telephone.html` (consensus).
- Outillage : `JAVA_HOME=/opt/jdk25`, `PATH=/opt/node24/bin:$PATH`, Chromium `/opt/pw-browsers/chromium`.

## Tasks & Acceptance

**Execution :**
- [ ] `backend/.../domain/` -- règles `reveal` et `clear`, `Summary` (calculs), `canVoteThisRound` des arrivées tardives, instantané révélé ; tests JUnit de toute la matrice domaine (égalités, un seul vote, uniquement `?`, 5,25 → 5,3).
- [ ] `backend/.../application/` -- cas d'usage `reveal` et `clear` (verrou, diffusion si `version` change).
- [ ] `backend/.../adapter/in/ws/` -- traitement des messages ; tests d'intégration (révélation vue par deux clients, `clear` concurrents, périmés) et aller-retour des exemples.
- [ ] `frontend/src/app/session/session.service.ts` -- intentions `reveal()` et `clear()`.
- [ ] `frontend/src/app/session/` -- boutons de la barre d'action, blocage de 1 s, panneau de résultat, faces révélées, « n'a pas voté », « votera au prochain tour », main grisée, région `aria-live` ; styles globaux ; tests Vitest (formatage, libellés, blocage en faux temps, annonce).
- [ ] `frontend/e2e/reveal.spec.ts` -- faux serveur WebSocket : révéler, résultat, nouveau tour, blocage ; sans violation de CSP.

**Acceptance Criteria :**
- Étant donné le webservice réel en local et trois participants (deux votants, un observateur), quand les votants choisissent 5 et 8 puis que l'observateur révèle, alors tous voient les faces, « 6,5 », « 5 et 8 · 1 vote chacune », « Min 5 », « Max 8 » en moins d'une seconde ; « Nouveau tour » ramène tout le monde à un tour caché sans vote.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : tous les tests verts.
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert.
- `cd contract && PATH=/opt/node24/bin:$PATH npm run validate && npm test` -- attendu : inchangé, vert.
