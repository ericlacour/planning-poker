---
title: 'Rétrospective 3, V1 : un test de retournement qui ne dépend plus de la cadence des images'
type: 'bugfix'
created: '2026-10-07'
status: 'draft'
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
- [ ] `frontend/e2e/reveal-motion.spec.ts` -- `back` relevé par pause et positionnement de l'animation (`currentTime` à 50 puis 150 ms), puis relance ; champ `Observed` et attentes mis à jour -- V1.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- retirer le report `observeReveal` -- V3.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- `epic-3-retro-item-18` à `in-progress` (CI de `main` pas encore verte), avec une note, par `sprint_status.py`.

**Acceptance Criteria:**
- Given Chromium avec le CPU bridé ×8, when `reveal-motion.spec.ts` tourne 30 fois, then il ne relève aucun échec.
- Given toute la suite e2e, when elle tourne, then elle passe.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright test` -- expected: e2e verts sur Chromium (WebKit en CI).
- PR en brouillon : CI verte, jobs `frontend` (WebKit compris) et `journeys` -- vérifié après le push.
- Essai hors dépôt : `reveal-motion.spec.ts` avec `Emulation.setCPUThrottlingRate` ×8, `--repeat-each 30` -- expected: aucun échec.
