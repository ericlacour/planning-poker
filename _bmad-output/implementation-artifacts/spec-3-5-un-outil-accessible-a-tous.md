---
title: 'Story 3.5 : un outil accessible à tous'
type: 'feature'
created: '2026-10-06'
status: 'in-progress'
baseline_commit: '6de6969f522eb5364c02ca261222769848a0f5cb'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'outil vise WCAG 2.2 AA (UX-DR17, NFR5), mais rien ne le vérifie : aucun audit axe, aucune annonce des arrivées ni du compteur, une révélation faite par un autre fait perdre le focus posé sur « Révéler les votes » (bouton remplacé, puis `disabled` pendant la garde de 1 s), et trois reports d'accessibilité visent cette story.

**Approach:** Combler ces écarts dans le front seul : annonces `aria-live` complètes et cadencées, boutons de la barre d'action stables et inactifs par `aria-disabled`, reports soldés. Puis garantir le tout par Playwright : audit `@axe-core/playwright` de chaque écran dans les deux thèmes, séance complète au clavier, zoom 200 % et 360 px.

## Boundaries & Constraints

**Always:**
- Région `aria-live="polite"` existante, une seule. Textes : révélation et « Nouveau tour » inchangés ; arrivée « Sofia a rejoint la session » (plusieurs arrivées dans un même instantané : phrases jointes) ; compteur « N votes sur M » (texte de `voteCounter`).
- Arrivée : `participantId` absent de l'instantané précédent, autre que moi ; jamais au premier instantané.
- Compteur : annoncé quand son texte change pendant un tour caché, sans changement de `roundId` ni révélation dans le même instantané. Au plus une annonce de compteur toutes les 5 s : hors fenêtre, tout de suite ; dans la fenêtre, une seule annonce différée en fin de fenêtre avec la valeur du moment. Révélation, nouveau tour ou destruction annulent l'annonce différée. Jamais d'annonce vote par vote.
- Barre d'action : deux boutons stables (secondaire, principal) dont seuls libellé et action changent entre tour caché et révélé ; inactifs par `aria-disabled="true"`, clic sans effet, aspect inchangé. Le focus ne bouge jamais à la suite d'un instantané.
- Reports : place d'un votant sans vote en tour caché lue « n'a pas voté » (texte masqué) ; `<app-hand>` dans un repère nommé « Ta main » ; présence soldée par la mention visible « déconnecté » (aucun libellé « en ligne »).
- Audit axe (étiquettes `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) sans violation : accueil, rejoindre, session introuvable, serveur injoignable, réveil en cours et échoué, session cachée avec menu du participant ouvert, session révélée ; thèmes clair et sombre (`pp.theme`).
- Aucun défilement horizontal ni actionnable sous 44 × 44 px sur ces écrans à 360 × 740 et à 640 × 400 (1280 × 800 à 200 %).

**Never:**
- Ni webservice, ni contrat, ni `SessionService` modifiés ; aucun calcul métier ajouté au front.
- Pas de désactivation de règle axe, pas d'exclusion de nœud, pas de test sauté.
- Aucune dépendance d'exécution nouvelle ; seule `@axe-core/playwright` en développement.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Arrivée | Sofia apparaît | « Sofia a rejoint la session » | — |
| Votes rapprochés | 1 sur 4 à t0, 2 à t0+1 s, 3 à t0+2 s | « 1 vote sur 4 » à t0, « 3 votes sur 4 » à t0+5 s seulement | — |
| Révélation en attente | Compteur différé, puis `REVEALED` | Annonce de révélation, compteur différé annulé | — |
| Focus sur « Révéler » | Un autre révèle | Focus sur le même bouton, devenu « Nouveau tour », `aria-disabled` 1 s | — |
| Clic pendant la garde | `aria-disabled="true"` | Aucune intention envoyée | — |

</frozen-after-approval>

## Code Map

- `frontend/src/app/session/session-page.component.ts` -- `effect` (l. 102-116) qui appelle `announcementFor` et remplit `announcements` ; y brancher arrivées et compteur cadencé ; `<app-hand>` hors `<main>` (l. 74).
- `frontend/src/app/session/result.ts:52-58` -- `NEW_ROUND_ANNOUNCEMENT`, `announcementFor` (révélation, nouveau tour) : à compléter par les arrivées.
- `frontend/src/app/session/cards.ts:23` -- `voteCounter(progress)`, texte du compteur à réutiliser.
- `frontend/src/app/session/action-bar.component.ts:46-56` -- boutons dans un `@if` et `[disabled]` : à rendre stables avec `aria-disabled`.
- `frontend/src/app/session/hand.component.ts:84-86` -- modèle existant d'`aria-disabled` qui garde le focus.
- `frontend/src/styles/base.css:56` -- `.btn:disabled` (opacité 0,4) à étendre à `[aria-disabled='true']` ; `.visually-hidden` l. 68.
- `frontend/src/app/session/participant-table.component.ts:102` -- carte vide `aria-hidden` ; `noteOf` l. 26.
- `frontend/src/styles/session-layout.css` -- placement de `.hand-dock` (à garder intact si la main change de parent).
- `frontend/e2e/fake-session-socket.ts`, `reveal.spec.ts:21-75` (`openWithToken`, `watchPage`, `hidden()`/`revealed()`), `layout.spec.ts:144` (`pageOverflow`), `theme.spec.ts`, `wake.spec.ts`, `join-session.spec.ts` -- modèles pour atteindre chaque écran.
- `frontend/playwright.config.ts` -- Chromium, WebKit en CI.

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/src/app/session/announcements.ts` (+ `.spec.ts`) -- `arrivalAnnouncement(previous, state)` et `CounterAnnouncer` (fenêtre 5 s, minuteurs injectés) -- règles d'annonce testées à part.
- [ ] `frontend/src/app/session/session-page.component.ts` (+ spec) -- annonces combinées ; main dans le repère « Ta main » -- point unique des annonces.
- [ ] `frontend/src/app/session/action-bar.component.ts` (+ spec), `frontend/src/styles/base.css` -- deux boutons stables, `aria-disabled`, clic ignoré -- focus conservé.
- [ ] `frontend/src/app/session/participant-table.component.ts` (+ spec) -- « n'a pas voté » masqué en tour caché.
- [ ] `frontend/package.json` -- `@axe-core/playwright` en `devDependencies`.
- [ ] `frontend/e2e/a11y.spec.ts` -- audit axe des écrans × thèmes ; 360 × 740 et 640 × 400 sans défilement horizontal, cibles ≥ 44 px.
- [ ] `frontend/e2e/keyboard.spec.ts` -- séance au clavier seul (rejoindre, voter, révéler, lire, effacer, changer de rôle), focus visible en `primary` ; focus conservé après la révélation d'un autre ; annonces d'arrivée et de compteur.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- marquer soldés les trois reports 1.5, 1.6 (×2).

**Acceptance Criteria:**
- Given chaque écran dans chaque thème, when axe s'exécute, then aucune violation WCAG 2.2 AA.
- Given un utilisateur au clavier, when il mène une séance complète, then tout passe par Tab, flèches, Entrée et Espace, avec un contour `primary` visible.
- Given `npm test` et `npx playwright test`, when ils s'exécutent, then tout est vert.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: vert.
- `cd frontend && npm run build:e2e && npx playwright test` -- expected: vert, dont `a11y.spec.ts` et `keyboard.spec.ts`.
- `cd frontend && npx prettier --check` sur les fichiers modifiés -- expected: aucun écart.
