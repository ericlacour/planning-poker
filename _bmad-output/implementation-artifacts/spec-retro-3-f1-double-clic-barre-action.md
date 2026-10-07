---
title: 'Rétrospective 3, F1 : un double-clic sur la barre d''action ne déclenche pas l''action suivante'
type: 'bugfix'
created: '2026-10-07'
status: 'done'
baseline_commit: 'c3978c0623942e870a20cf7ee9e38c6c19617234'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-retro-2026-10-07.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les deux boutons de la barre d'action restent à la même place et ne changent que de libellé d'un état du tour à l'autre (story 3.5). Le second clic d'un double-clic sur « Masquer » tombe donc sur « Effacer les votes » et efface tous les votes. De même, « Révéler les votes » enchaîne sur « Nouveau tour », et la synthèse n'est jamais vue. La garde de 1 s ne vaut que pour une action faite par un autre (FR-17), et `hide`/`reveal` gardent le `roundId`, donc le `clear` suivant n'est pas périmé. Constat F1 de la rétrospective de l'epic 3, observé contre le vrai webservice (action `epic-3-retro-item-17`).

**Approach:** Après mon propre clic sur un bouton de la barre d'action, un second clic ou une seconde frappe arrivés trop tôt ne déclenchent rien. Le correctif est entièrement côté front, dans la barre d'action. Le webservice, le contrat et `SessionService` ne changent pas.

## Boundaries & Constraints

**Always:**
- **Garde au clic** (décision d'Eric, 2026-10-07, option A) : tout clic ou toute frappe acceptés sur l'un des deux boutons (intention envoyée) rendent les deux boutons inactifs pendant 1 s (`CROSS_CLICK_GUARD_MS`), dès le clic, sans attendre l'instantané. Un clic ignoré (bouton inactif) ne relance pas la garde. Option B (garde à l'instantané) et option C (`event.detail > 1`) écartées.
- Taille de la spec : gardée entière (décision d'Eric, 2026-10-07), environ 2 100 tokens pour une cible de 1 600.
- La garde existante après un REVEAL, HIDE ou CLEAR fait par un autre (1 s, `blocksActions`) reste inchangée.
- Un bouton gardé reste dans le même état que les boutons inactifs actuels : `aria-disabled="true"`, opacité 40 %, clic et Entrée/Espace sans effet, le focus reste posé (story 3.5).
- La protection couvre la souris, le toucher et le clavier (deux Entrée distinctes, pas seulement la répétition de touche).
- Aucune confirmation et aucun raccourci clavier (EXPERIENCE, FR-15).
- `EXPERIENCE.md` (Barre d'action, Temps réel) et `epics.md` (UX-DR8) décrivent la nouvelle règle, dans les mêmes termes que le code.

**Never:**
- Aucun changement du webservice, du contrat ni de `SessionService`.
- Pas de jeton par cycle dans les intentions (rejeté au tri de 3.2, ECH1).
- Ne pas désactiver la main (cartes) ni le menu du participant.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Double-clic sur « Masquer » | Tour révélé, 2 clics à 150 ms, HIDE revenu entre les deux | Un seul `hide` envoyé ; aucun `clear` ; votes gardés | — |
| Double-clic sur « Révéler les votes » | Tour caché, 2 clics à 150 ms, REVEAL revenu entre les deux | Un seul `reveal` ; la synthèse reste affichée | — |
| Double Entrée au clavier | Focus sur « Révéler les votes », Entrée puis Entrée 150 ms après | Un seul `reveal` ; le focus reste sur « Nouveau tour » | — |
| Clic voulu après la garde | Tour révélé par moi, clic sur « Nouveau tour » après la fin de la garde | `clear` envoyé | — |
| Action d'un autre | REVEAL de Bob | Garde de 1 s, comme aujourd'hui | — |

</frozen-after-approval>

## Code Map

- `frontend/src/app/session/action-bar.component.ts` -- seul fichier de code touché. `guarded` (signal), `inactive` (garde ou connexion), `secondary()`/`primary()` (sortie anticipée si inactif), `onKeydown` (répétitions ignorées), `effect` qui pose la garde de 1 s sur `blocksActions` et `timer` nettoyé à la destruction. `CROSS_CLICK_GUARD_MS` est à réutiliser.
- `frontend/src/app/session/action-bar.component.spec.ts` -- `render()` avec faux minuteurs et faux `SessionService` (`reveal`, `hide`, `clear` espionnés). Le test « no block for my own REVEAL… » (l. 147) reste valable pour un instantané seul (sans clic) : la garde vient du clic, pas de l'instantané. Ajouter la matrice I/O.
- `frontend/e2e/accessibility.spec.ts:384-395` -- séance au clavier : Entrée sur « Révéler les votes », puis Entrée aussitôt sur « Nouveau tour ». Avec la garde, attendre que le bouton soit actif avant la seconde Entrée (`toBeEnabled`, que Playwright lie à `aria-disabled`).
- `frontend/e2e/reveal.spec.ts:124-143, 209-221` -- clics enchaînés sur mes propres actions : `click()` attend un bouton actif, mais `toBeEnabled()` (l. 135-136) juste après mon REVEAL attend désormais la fin de la garde. Vérifier l'attente.
- `frontend/e2e-journeys/uj1-affinage.spec.ts:63-80` -- `click()` enchaînés : ils attendent seuls, rien à changer a priori.
- `_bmad-output/planning-artifacts/ux-designs/*/EXPERIENCE.md:69,111` et `_bmad-output/planning-artifacts/epics.md:166` -- texte de la garde, à compléter.
- Ne pas toucher : `session.service.ts`, `contract/`, `backend/`, `hand.component.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/app/session/action-bar.component.ts` -- garde de 1 s au clic accepté, sur le mécanisme `guarded` existant (même minuteur que la garde des actions des autres) ; mettre à jour la Javadoc de la classe -- F1.
- [x] `frontend/src/app/session/action-bar.component.spec.ts` -- matrice I/O avec faux minuteurs : double clic et double Entrée sur chaque bouton, clic après la garde, garde des autres inchangée -- non-régression.
- [x] `frontend/e2e/reveal.spec.ts` -- double-clic sur « Masquer » contre le faux serveur (l'instantané HIDE envoyé entre les deux clics) : un seul `hide` reçu, aucun `clear` -- reproduction de F1.
- [x] `frontend/e2e/accessibility.spec.ts`, `frontend/e2e/reveal.spec.ts` -- attentes ajustées aux enchaînements de mes propres actions.
- [x] `EXPERIENCE.md`, `epics.md` (UX-DR8) -- règle de garde complétée -- spec alignée sur le code.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- action `epic-3-retro-item-17` à `done` avec sa résolution, par `sprint_status.py update --set-action-status`.

**Acceptance Criteria:**
- Given un tour révélé avec des votes, when je double-clique sur « Masquer », then le tour est masqué et tous les votes sont gardés.
- Given toute la suite existante, when elle tourne, then elle passe ; seules changent les attentes qui supposaient aucune garde après mon propre clic.
- Given que je viens de cliquer sur un bouton de la barre d'action, when 1 s s'est écoulée, then les deux boutons redeviennent actifs.

## Implementation Notes

- Implémenté directement dans la session, sans sous-agent.
- `ActionBarComponent.guard()` : un seul minuteur pour la garde au clic et la garde des actions des autres ; chacune relance l'autre. Il est appelé après l'envoi de l'intention, dans `primary()` et `secondary()`, et seulement si le bouton était actif. Un clic ignoré ne relance donc pas la garde.
- Tests unitaires : sept cas, dont la matrice I/O (double-clic sur chacun des quatre libellés ; la double Entrée au clavier n'est couverte qu'en e2e, car Entrée sur un bouton passe par le même clic). Le test « Révéler sends reveal, Effacer sends clear » attend désormais la fin de la garde entre les deux clics. « no block for my own REVEAL » est inchangé, car la garde vient du clic, pas de l'instantané.
- E2E : nouveau test de double-clic sur « Masquer » dans `reveal.spec.ts`. La séance au clavier de `accessibility.spec.ts` envoie une seconde Entrée tout de suite, puis attend que le bouton redevienne actif. Sans le correctif, les deux échouent (« 0 vote sur 2 ») ; avec lui, ils passent.
- Documents : la règle est complétée dans `EXPERIENCE.md` (Barre d'action, Temps réel), `epics.md` (UX-DR8) et `epic-3-context.md`. L'action `epic-3-retro-item-17` est passée à `done` avec sa résolution, par `sprint_status.py`.
- Prettier : les trois fichiers qui échouaient à `prettier --check` avant la story échouent toujours, et `accessibility.spec.ts` passe (constat M1 de la rétrospective).
- Vérifié sous Java 25 et Node 24.21, après les correctifs de relecture : 312 tests Vitest et 15 tests de scripts ; 104 e2e sur Chromium ; 4 parcours réels sur Chromium. WebKit ne tourne qu'en CI.

## Spec Change Log

## Review Triage Log

Relecture du 2026-10-07 (Blind Hunter, Edge Case Hunter, Verification Gap), diff `c3978c0…` → arbre de travail.

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | blind, edge-case | Javadoc de `CROSS_CLICK_GUARD_MS` et de `guarded` limitées à l'action d'un autre | low | `action-bar.component.ts` : seule la Javadoc de la classe parlait du clic | patch : les deux commentaires citent aussi mon propre clic |
| 2 | blind, edge-case | E2E de double-clic : le commentaire annonce 150 ms, le second clic dépend du temps de rendu | low | Le second clic attend le relibellé ; si cela dépassait 1 s, l'échec ressemblerait à une régression | patch : commentaire corrigé, `aria-disabled="true"` vérifié avant le second clic |
| 3 | blind, edge-case | Seconde Entrée de `accessibility.spec.ts` : assertion immédiate faible, dépend du temps | low | `toHaveText('6,5')` passe avant tout retour serveur ; c'est la liste finale des intentions (un seul `clear`) qui prouve la garde | patch : `aria-disabled="true"` vérifié avant la seconde Entrée, commentaire renvoyant aux intentions |
| 4 | blind, edge-case, verification-gap | Tâche « double clic et double Entrée sur chaque bouton » non tenue en unitaire | low | Aucun double-clic sur « Nouveau tour » ni « Effacer les votes » ; pas de clavier en unitaire | patch : test des deux libellés manquants ; la double Entrée reste en e2e, ce que les notes précisent |
| 5 | blind | Le test du clic ignoré ne vérifie pas qu'aucune intention n'est envoyée | low | Une régression qui enverrait l'intention sans garde passerait | patch : `reveal` appelé une seule fois |
| 6 | edge-case | Garde posée même si `SessionService` n'envoie rien (socket pas `OPEN` alors que la connexion est `open`) | low | La fenêtre entre la fermeture du socket et `connection` ≠ `open` est négligeable ; seul effet : boutons grisés 1 s. Corriger demanderait une valeur de retour dans `SessionService`, hors périmètre | rejeté |
| 7 | edge-case | Attentes existantes de `reveal.spec.ts` (l. 135-136, 221) non revues | false | `toBeEnabled` et `click()` attendent la fin de la garde ; la suite passe (104/104) | rejeté |
| 8 | blind | `epic-3-retro-item-17` passé à `done` avant la relecture | low | La relecture est faite dans cette même exécution, avant toute fusion | rejeté |
| 9 | blind | La nouvelle règle est rangée sous FR-17 dans `EXPERIENCE.md` | low | Rattachement de documentation, sans effet sur le code ; la règle est aussi dans UX-DR8 | rejeté |
| 10 | blind | `epics.md` : « désactivés » plutôt que « inactifs (aria-disabled) » | low | La puce reprend le mot de la puce précédente, déjà en place avant cette story | rejeté |
| 11 | verification-gap | Aucun écart de vérification | — | — | — |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: Vitest et tests de scripts verts.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright test` -- expected: e2e verts sur Chromium (WebKit en CI).
- `cd frontend && npm run e2e:journeys` -- expected: parcours verts contre le vrai webservice.
