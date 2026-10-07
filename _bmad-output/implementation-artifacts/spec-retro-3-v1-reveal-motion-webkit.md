---
title: 'Rétrospective 3, V1 : un test de retournement qui ne dépend plus de la cadence des images'
type: 'bugfix'
created: '2026-10-07'
status: 'done'
baseline_commit: '4bacfe180c4cc946fc7b46a8006ebfbf6710db0e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-retro-2026-10-07.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le test « révélation par un autre : les faces se retournent… » de `frontend/e2e/reveal-motion.spec.ts` est instable. Il a rendu `main` rouge sur WebKit aux runs 60 et 70 (`expect(observed.back).toBe('1')`, reçu `"0"`). L'opacité du dos est relevée à la deuxième image après l'apparition de la face. Or le dos n'est visible que pendant les 100 premières millisecondes du retournement de Bob, si bien qu'une image en retard suffit à rater la mesure. Reproduit en local sur Chromium : 1 échec sur 8 sans bridage, 7 sur 8 avec le CPU bridé ×8. Constats V1, V3 et P1 de la rétrospective de l'epic 3 (action `epic-3-retro-item-18`).

**Approach:** Vérifier le dos à un instant précis de l'animation, et non à l'image où le test se réveille : mettre en pause l'animation `seat-card-flip` de la face, la placer dans sa première moitié (dos visible), puis dans la seconde (dos retiré), puis la relancer. Seul le test change. Les autres relevés et leurs bornes restent les mêmes.

## Boundaries & Constraints

**Always:**
- Les attentes du test restent les mêmes : nom « Carte 8 », annonce, `session-flipping`, animation `seat-card-flip`, dos visible puis retiré, synthèse cachée puis visible entre 250 et 1 000 ms.
- Les trois tests de `reveal-motion.spec.ts` passent 30 fois de suite sur Chromium avec le CPU bridé ×8 (`Emulation.setCPUThrottlingRate`, réglage d'essai hors dépôt).
- Le report `observeReveal` de la spec 3.4 est retiré de `deferred-work.md`.
- **WebKit et `main`** (décision d'Eric, 2026-10-07, option A) : une fois le correctif poussé, l'agent ouvre une PR en brouillon de `claude/pensive-brahmagupta-0ieru1` vers `main` (rétrospective, F1 et ce correctif) et suit sa CI, WebKit compris. Eric fusionne quand elle est verte.

**Never:**
- Aucun changement du code applicatif, de `reveal.css` ni du contrat.
- Pas de nouvelle tentative automatique (`retries`), pas de test sauté ni marqué instable, pas de seuil relâché.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Image en retard | Premier relevé plus de 100 ms après l'apparition de la face | Dos à 1 au premier quart de l'animation, à 0 au troisième quart ; test vert | — |
| Mouvement réduit | `prefers-reduced-motion: reduce` | Aucune animation, `back` à `none` (inchangé) | — |
| Régression réelle | `::after` sans `opacity` liée à `--seat-card-flip-back` | Test rouge | — |

</frozen-after-approval>

## Code Map

- `frontend/e2e/reveal-motion.spec.ts:107-166` -- `observeReveal` : le `MutationObserver` date l'apparition de la face, et `observing()` fait ses relevés une image plus tard. Le champ `back` y lit `getComputedStyle(face, '::after').opacity`.
- `frontend/e2e/reveal-motion.spec.ts:168-196` -- test PC : `expect(observed.back).toBe('1')`. Le test « mouvement réduit » attend `back` à `none`, et le test « téléphone » ne lit pas `back`.
- `frontend/src/styles/reveal.css` -- `@keyframes seat-card-flip` (200 ms) : `--seat-card-flip-back` vaut 1 jusqu'à 49,9 % et 0 à partir de 50 % ; `::after` porte `opacity: var(--seat-card-flip-back)`. Une seule autre carte (Bob), donc un délai de 0. À ne pas toucher.
- `_bmad-output/implementation-artifacts/deferred-work.md:47-49` -- report `observeReveal` à retirer.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/e2e/reveal-motion.spec.ts` -- `back` relevé par pause et positionnement de l'animation (`currentTime` à 50 puis 150 ms), puis relance ; champ `Observed` et attentes mis à jour -- V1.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- retirer le report `observeReveal` -- V3.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `epic-3-retro-item-18` à `in-progress` (CI de `main` pas encore verte), avec une note, par `sprint_status.py`.

**Acceptance Criteria:**
- Given Chromium avec le CPU bridé ×8, when `reveal-motion.spec.ts` tourne 30 fois, then il ne relève aucun échec.
- Given toute la suite e2e, when elle tourne, then elle passe.

## Implementation Notes

- Implémenté directement dans la session, sans sous-agent.
- `observeReveal` : `back` vaut désormais `{ early, late }`, relevés animation en pause au premier puis au troisième quart de sa durée, après son délai (`getComputedTiming`). L'animation reprend ensuite où elle était, ou reste finie si elle l'était déjà ; il vaut `none` sans dos (mouvement réduit), et `no-animation` si la face n'a pas d'animation `seat-card-flip`. Les autres relevés et leurs bornes ne changent pas.
- Essai hors dépôt : copie temporaire du fichier avec `Emulation.setCPUThrottlingRate` dans les trois tests, puis supprimée. Avant le correctif, la même mesure donnait 1 échec sur 8 sans bridage et 7 sur 8 bridé ×8. Après, y compris les correctifs de relecture : 90 passages sur 90 sans bridage, et 90 sur 90 bridé ×8 (`--repeat-each 30`).
- Régression simulée : sans `opacity: var(--seat-card-flip-back)` dans `reveal.css`, le test PC échoue (`late` à `1`). CSS restauré ensuite.
- Suite e2e Chromium : 104 sur 104. WebKit sera vérifié par la CI de la PR en brouillon.
- `deferred-work.md` : report `observeReveal` (spec 3.4) retiré. L'observateur était déjà posé par un `evaluate` attendu avant l'envoi (`f932a2b`), et la seule instabilité restante, le relevé du dos, est corrigée ici.
- Fenêtre restante : la face ne garde son dos et son animation que pendant les 400 ms de `session-flipping`. Un réveil plus tardif ferait encore échouer le test, contre 100 ms avant le correctif (90 sur 90 bridé ×8). `epic-3-retro-item-18` passe à `in-progress` jusqu'à ce que `main` soit vert.

## Spec Change Log

## Review Triage Log

Relecture du 2026-10-07 (Blind Hunter, Edge Case Hunter, Verification Gap), diff `4bacfe1…` → arbre de travail.

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | blind, edge-case, verification-gap | Une animation déjà finie est rejouée par `play()` | low | Web Animations : `play()` au-delà de la fin revient à 0 ; le retournement se rejouait si le test se réveillait après 200 ms | patch : `play()` seulement si l'animation tournait, sinon `finish()` ; `currentTime` nul évité |
| 2 | blind, edge-case | Instants de 50 et 150 ms qui supposent un délai nul et une durée de 200 ms | low | `currentTime` inclut `--flip-delay` ; vrai seulement parce que Bob est la seule autre carte | patch : instants tirés de `getComputedTiming()` (délai + 25 % et 75 % de la durée) |
| 3 | blind, edge-case | Le test dépend encore de la cadence au-delà de 400 ms | low | `session-flipping` retiré au bout de 400 ms ; la fenêtre passe de 100 à 400 ms | consigné dans le commentaire et les notes ; 90 sur 90 bridé ×8 |
| 4 | blind, edge-case | `epic-3-retro-item-18` passé à `in-progress` sans la note prévue | low | La tâche demande une note | patch : `resolution` qui dit ce qui reste (CI WebKit de la PR, puis `main`) |
| 5 | blind | Report `observeReveal` retiré sans trace | low | Aucune note ne disait pourquoi il était soldé | patch : raison donnée dans les notes |
| 6 | blind, edge-case | WebKit non vérifié en local | low | WebKit ne s'installe pas dans le bac à sable ; décision A : la CI de la PR en brouillon le joue | suivi par la PR |
| 7 | blind | La régression simulée ne couvre que `late` | low | Un dos jamais visible ferait échouer `early` de la même façon ; vérifier en plus une mutation de keyframe n'apporte rien au correctif | rejeté |
| 8 | blind | Pause et reprise faussent `synthesisAfter` | false | `synthesisAfter` dépend du minuteur de 400 ms de `session-page.component.ts`, pas de l'animation | rejeté |
| 9 | blind | Résultat `no-animation` sous forme d'objet, message d'échec peu clair | low | `animations` est vérifié juste avant dans le test, et son échec dit déjà la cause | rejeté |
| 10 | verification-gap | Aucun écart de vérification | — | — | — |

## Verification

**Commands:**
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright test` -- expected: e2e verts sur Chromium (WebKit en CI).
- PR en brouillon : CI verte, jobs `frontend` (WebKit compris) et `journeys` -- vérifié après le push.
- Essai hors dépôt : `reveal-motion.spec.ts` avec `Emulation.setCPUThrottlingRate` ×8, `--repeat-each 30` -- expected: aucun échec.
