---
title: 'Story 1.8 : un écran de séance qui tient sur PC et sur téléphone'
type: 'feature'
created: '2026-10-02'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-7-reveler-lire-le-resultat-passer-au-ticket-suivant.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'écran de séance fonctionne, mais rien ne garantit qu'il tienne sans défilement à 13 sur PC, ni qu'il soit utilisable au pouce sur téléphone (UX-DR15, UX-DR16, NFR-5).

**Approach:** Mettre en page l'écran Session selon la géométrie de DESIGN › Layout & Spacing et EXPERIENCE › Responsive & Platform (trois paliers : ≥ 900, 600–899, < 600 px), en CSS global uniquement, et le prouver par une suite Playwright sur Chromium et WebKit avec 13 participants simulés.

## Boundaries & Constraints

**Always :**
- **≥ 900 px** (cible 1280 × 650 utiles, 13 participants, tour caché puis révélé) : aucun défilement de page. Barre du haut 56 px ; table en grille de 7 places au plus par rangée, cartes de table 44 × 66 px ; barre d'action d'environ 72 px ; main d'une ligne de 10 cartes de 60 × 90 px, fixée en bas. Tour révélé : le résultat est intégré à la barre d'action, sur une rangée, à gauche des boutons, à la place du compteur. Fenêtre moins haute : seule la table défile, dans sa zone ; barre du haut, barre d'action et main restent visibles.
- **600–899 px** : table de 5 places au plus par rangée (seule elle défile) ; main sur une ligne, cartes d'au moins 44 px de large.
- **< 600 px** (dès 360 px) : barre du haut compacte (logo seul, « Copier le lien » en icône avec libellé accessible) ; table en grille de 3 places, qui défile ; main en tiroir fixe en bas, 2 lignes de 5 cartes, ombre vers le haut ; barre d'action juste au-dessus (compteur sur une ligne, boutons côte à côte en dessous). Tour révélé : le tiroir se replie complètement et le résultat condensé « Moy. 5,9 · Plus votée 5 (6) · Min 3 · Max 13 » (badge « Consensus ! » à côté) s'affiche au-dessus de la barre d'action ; s'il déborde, il passe sur deux lignes (moyenne + badge, puis le reste). Aucun défilement horizontal à 360 px.
- Zones tactiles ≥ 44 × 44 px partout ; `prefers-reduced-motion` respecté pour le repli du tiroir.
- CSS dans les feuilles globales (CSP : aucun style en ligne, aucune liaison `[style]`) ; seuls des jetons de DESIGN.
- Le formatage condensé du résultat est un affichage du `summary` du serveur (aucun calcul).
- Playwright : projets Chromium **et** WebKit ; viewports PC 1280 × 650 et téléphone 390 × 844 avec 13 participants simulés (faux serveur WebSocket) ; vérifie l'absence de défilement de page sur PC (caché et révélé), la présence à l'écran de la main et du résultat, le repli du tiroir sur téléphone, et l'absence de défilement horizontal à 360 px. La CI installe Chromium et WebKit.

**Never :**
- Pas de thème ni de menu du participant (stories 3.1, 3.3) ; pas d'animation de révélation (story 3.4).
- Aucun changement de comportement métier, du contrat ou du webservice.
- Pas de pose de l'étiquette `v1.0` ni de déploiement : c'est à l'utilisateur de le faire, hors atelier, après validation.

**Décisions (prises par l'agent, validation groupée en fin de série) :**
- **WebKit en local** : le bac à sable n'a que Chromium ; la suite tourne localement sur Chromium et le projet WebKit est vérifié en CI (`npx playwright install --with-deps chromium webkit`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PC caché | 1280 × 650, 13 participants (11 votants, 2 observateurs), tour caché | `scrollHeight ≤ innerHeight` ; 2 rangées de table ; main de 10 cartes visible sur une ligne | N/A |
| PC révélé | idem, tour révélé avec synthèse | pas de défilement ; résultat dans la barre d'action, visible ; boutons visibles | N/A |
| PC bas | 1280 × 500 | seule la zone de table défile ; barre du haut, barre d'action et main visibles | N/A |
| Moyen | 800 × 700 | au plus 5 places par rangée ; main sur une ligne, cartes ≥ 44 px | N/A |
| Téléphone caché | 390 × 844 | tiroir 2 × 5 visible, barre d'action au-dessus, pas de défilement horizontal | N/A |
| Téléphone révélé | 390 × 844, tour révélé | tiroir replié (main absente de l'écran), résultat condensé visible au-dessus de la barre d'action | N/A |
| Étroit | 360 × 740, tour révélé avec égalité | aucun défilement horizontal ; résultat sur deux lignes au plus | N/A |
| Zones tactiles | téléphone | chaque carte et bouton ≥ 44 × 44 px | N/A |

</frozen-after-approval>

## Code Map

- Stories 1.5 à 1.7 (voir leurs specs et Implementation Notes) : composants de `frontend/src/app/session/` (page de session, table, places, main, barre d'action, panneau de résultat) et leurs feuilles globales dans `frontend/src/styles/` (importées par `styles.css`). La barre du haut vit dans `app.ts` + `styles/top-bar.css`, « Copier le lien » dans `share/copy-link.ts` + `styles/copy-link.css`.
- Jetons : `styles/tokens.css` (`--spacing-seat-card-width-pc`, `--spacing-hand-card-width-pc`, `--spacing-session-min-height-pc`, `--spacing-touch-min`, `--spacing-margin-mobile`…).
- Maquettes : `mockups/session-pc.html`, `mockups/session-telephone.html` (tiroir, résultat condensé) ; DESIGN.md › Layout & Spacing, Components (`result-panel` sur PC et téléphone).
- Tests e2e existants : `frontend/e2e/*.spec.ts` (faux serveur WebSocket et API simulée, contrôle CSP) ; `frontend/playwright.config.ts` (projet Chromium seul, `PLAYWRIGHT_CHROMIUM_PATH`) ; CI `.github/workflows/ci.yml` (installe Chromium seul).
- Outillage : `PATH=/opt/node24/bin:$PATH`, Chromium `/opt/pw-browsers/chromium` (WebKit indisponible localement).

## Tasks & Acceptance

**Execution :**
- [ ] `frontend/src/styles/session-layout.css` (+ ajustements des feuilles de la table, de la main, de la barre d'action, du résultat et de la barre du haut) -- trois paliers, budget vertical PC, défilement limité à la table, tiroir téléphone et repli.
- [ ] `frontend/src/app/session/` -- seuls les ajustements de structure nécessaires (conteneurs, classe d'état révélé pour le repli, résultat condensé pour téléphone).
- [ ] `frontend/playwright.config.ts` -- projet WebKit ajouté (lancé seulement si disponible localement via une variable, toujours en CI).
- [ ] `frontend/e2e/layout.spec.ts` -- toute la matrice, avec 13 participants simulés ; contrôle CSP.
- [ ] `.github/workflows/ci.yml` -- `npx playwright install --with-deps chromium webkit`.

**Acceptance Criteria :**
- Étant donné la suite Playwright, quand elle s'exécute sur Chromium localement, alors toute la matrice est verte ; le projet WebKit est configuré pour la CI.
- Étant donné le webservice réel en local et 13 participants connectés par script, quand on ouvre la session en 1280 × 650 puis en 390 × 844, alors les captures montrent l'écran complet sans défilement de page (PC) et le tiroir (téléphone).

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands :**
- `cd frontend && PATH=/opt/node24/bin:$PATH npm test && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` -- attendu : tout vert (Chromium).
- `cd backend && JAVA_HOME=/opt/jdk25 ./mvnw -q verify` -- attendu : inchangé, vert.
