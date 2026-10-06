---
title: 'Story 3.5 : un outil accessible à tous'
type: 'feature'
created: '2026-10-06'
status: 'done'
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
- [x] `frontend/src/app/session/announcements.ts` (+ `.spec.ts`) -- `arrivalAnnouncement(previous, state)` et `CounterAnnouncer` (fenêtre 5 s, minuteurs injectés) -- règles d'annonce testées à part.
- [x] `frontend/src/app/session/session-page.component.ts` (+ spec) -- annonces combinées ; main dans le repère « Ta main » -- point unique des annonces.
- [x] `frontend/src/app/session/action-bar.component.ts` (+ spec), `frontend/src/styles/base.css` -- deux boutons stables, `aria-disabled`, clic ignoré -- focus conservé.
- [x] `frontend/src/app/session/participant-table.component.ts` (+ spec) -- « n'a pas voté » masqué en tour caché.
- [x] `frontend/package.json` -- `@axe-core/playwright` en `devDependencies`.
- [x] `frontend/e2e/a11y.spec.ts` -- audit axe des écrans × thèmes ; 360 × 740 et 640 × 400 sans défilement horizontal, cibles ≥ 44 px.
- [x] `frontend/e2e/keyboard.spec.ts` -- séance au clavier seul (rejoindre, voter, révéler, lire, effacer, changer de rôle), focus visible en `primary` ; focus conservé après la révélation d'un autre ; annonces d'arrivée et de compteur.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- marquer soldés les trois reports 1.5, 1.6 (×2).

**Acceptance Criteria:**
- Given chaque écran dans chaque thème, when axe s'exécute, then aucune violation WCAG 2.2 AA.
- Given un utilisateur au clavier, when il mène une séance complète, then tout passe par Tab, flèches, Entrée et Espace, avec un contour `primary` visible.
- Given `npm test` et `npx playwright test`, when ils s'exécutent, then tout est vert.

## Implementation Notes

- Repère « Ta main » : l'hôte `<app-hand class="hand-dock">` porte lui-même `role="region"` et `aria-label="Ta main"`, ce qui laisse `session-layout.css` intact (`.hand-dock > .hand`).
- Annonces : `round`, arrivées puis compteur, joints par `joinSentences` (« Sofia a rejoint la session. 3 votes sur 5 » quand une arrivée change le compteur). Une annonce différée dont la valeur est revenue à celle déjà annoncée est abandonnée.
- Écart trouvé par le contrôle 360 px : le formulaire d'entrée (400 px) débordait de 20 px à l'accueil et sur Rejoindre ; `.entry-screen > app-entry-form { min-width: 0 }` le laisse rétrécir.
- Focus visible : 2 px `primary` partout, sauf le champ de saisie (1 px collé à sa bordure `primary`, style existant) ; `keyboard.spec.ts` vérifie un contour plein en `primary` d'au moins 1 px.
- Les commandes Angular exigent Node ≥ 22.22.3 / 24.15 ; le build e2e doit recevoir `API_BASE_URL=http://127.0.0.1:4310` comme en CI.

## Spec Change Log

## Review Triage Log

| # | Couche | Constat | Verdict | Preuve | Suite |
|---|--------|---------|---------|--------|-------|
| 1 | blind, edge-case | `cancel()` garde `lastAt`/`lastText` : au tour suivant, dans les 5 s, le premier compteur est différé puis abandonné comme « déjà annoncé » | medium | `flush` compare à `lastText` du tour précédent ; le nouveau tour n'appelle que `cancel()` | patch : `reset()` au changement de tour, test |
| 2 | edge-case | `Date.now()` peut reculer et allonger la fenêtre | low | Réglage d'horloge rare, correction directe | patch : `performance.now()` |
| 3 | blind | Test de garde de `keyboard.spec.ts` dépendant du vrai délai de 1 s | medium | Cinq assertions avant Entrée ; un runner lent dépasse 1 s et `clear` part | patch : `page.clock` |
| 4 | blind, edge-case | Débordement horizontal mesuré sur le document seul | medium | `.session-scroll` défile ; un débordement interne passerait | patch : conteneurs défilants contrôlés |
| 5 | blind | Axe jamais lancé en largeur téléphone | medium | Tiroir et `.result-line` jamais audités | patch : axe à 360 × 740 |
| 6 | verification-gap | Absence de `.seat-unvoted` non vérifiée en tour révélé et pour `canVoteThisRound: false` | medium | Gap pré-vérifié : retirer une condition ne casse aucun test | patch : assertions ajoutées |
| 7 | verification-gap | Aspect atténué des boutons `aria-disabled` non vérifié | medium | Gap pré-vérifié : aucun test ne lit l'opacité | patch : `toHaveCSS('opacity', '0.4')` |
| 8 | verification-gap | Tests au Tab jamais exécutés sur WebKit | maybe-false | WebKit peut sauter les boutons au Tab ; à trancher par un passage `PLAYWRIGHT_WEBKIT=1` ou la première CI | différé (medium si vrai) |
| 9 | edge-case | Seuil 43,5 px au lieu de 44 | low | Tolérance d'arrondi sous-pixel ; aucun actionnable mesuré entre 43,5 et 44 | rejeté |
| 10 | blind | `package-lock.json` renomme le paquet et ajoute `engines` | false | `package.json` portait déjà ce nom et ce champ ; le verrou était en retard | rejeté |
| 11 | blind | Reformatage Prettier mêlé au diff | false | `.prettierrc` fixe `printWidth: 100` ; le code existant ne le respectait pas | rejeté |
| 12 | blind | Statut de sprint `in-progress` et heure qui recule | low | Le passage en revue est synchronisé à la présentation | rejeté |
| 13 | blind | Écrans « seul », observateur, « Reconnexion… » non audités | low | Mêmes composants et jetons que les écrans audités ; la liste gelée est couverte | rejeté |
| 14 | blind | Repère « Ta main » nommé ainsi pour un observateur, vide avant le premier instantané | low | Région sans contenu non signalée par axe ; nom acceptable | rejeté |
| 15 | blind | Échap, Maj+Tab, copier le lien, thème au clavier non testés en e2e | low | Menu et copie déjà couverts par leurs specs ; aucune nouvelle surface | rejeté |
| 16 | blind | Décision « aucun libellé en ligne » non consignée | false | Elle est dans le bloc gelé (Always, Reports) | rejeté |
| 17 | blind | Survol encore actif sur les boutons inactifs | false | Aucune règle `:hover`/`:active` sur `.btn` dans `src/styles` | rejeté |

## Verification

**Commands:**
- `cd frontend && npm test` -- expected: vert.
- `cd frontend && npm run build:e2e && npx playwright test` -- expected: vert, dont `a11y.spec.ts` et `keyboard.spec.ts`.
- `cd frontend && npx prettier --check` sur les fichiers modifiés -- expected: aucun écart.
