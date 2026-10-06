---
title: 'Story 3.6 : les trois parcours garantis de bout en bout'
type: 'feature'
created: '2026-10-06'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aucun test ne fait tourner le front et le webservice ensemble : tous les e2e simulent le webservice (`fake-session-socket.ts`, `page.route`). Une rupture entre les deux ne se verrait qu'en atelier. Les parcours UJ-1 à UJ-3 ne sont pas joués de bout en bout, et l'action 8 de la rétrospective de l'epic 1 reste ouverte.

**Approach:** Une suite Playwright à part, `frontend/e2e-journeys/`, joue UJ-1, UJ-2 et UJ-3 sur Chromium et WebKit contre le vrai webservice (jar lancé par Playwright). Un nouveau job de CI la fait tourner sur chaque PR et chaque push sur `main`. La suite e2e existante, simulée, ne change pas.

## Boundaries & Constraints

**Always:**
- Webservice réel : `backend/target/planning-poker.jar` sur le port 4310, `ALLOWED_ORIGINS=http://127.0.0.1:4300`, plafonds de création relevés par arguments (`--planning-poker.max-creations-per-ip`, `--planning-poker.max-sessions`) pour que les tests parallèles des deux navigateurs ne reçoivent ni 429 ni 503. Front : build `build:e2e` existant (CSP déjà ouverte sur 4310).
- Aucune interception REST dans la suite des parcours. La seule interception autorisée est un mandataire WebSocket (`routeWebSocket` + `connectToServer`) qui sert à couper et rétablir la connexion d'une page.
- UJ-1 : Eric crée la session comme observateur, copie le lien (presse-papiers lu sur Chromium, lien lu dans l'URL sur WebKit), sept votants le rejoignent. La table montre au fur et à mesure qui a voté. Révélation : votes nominatifs, moyenne attendue, pas de « Consensus ! » (un 3 et un 13). Effacement, revote à 5 partout, « Consensus ! ».
- UJ-2 sur gabarit téléphone (390 × 844, tactile) : Sofia rejoint, vote 8. Coupure : « Reconnexion… » chez elle, « déconnecté » chez un autre participant. Rétablissement : bannière disparue, carte 8 toujours choisie. Puis nouvelle coupure, Sofia rejoint avec son pseudo depuis un second contexte qui retrouve son vote. Au rétablissement, le premier affiche « Ta place a été reprise depuis un autre appareil. ».
- UJ-3 : Karim crée une session en votant pendant qu'une autre session (deux participants) vote et révèle. Aucun pseudo, vote, révélation ou compteur ne passe d'une session à l'autre.
- Onglet en arrière-plan : contre le vrai webservice, un participant dont l'onglet est caché (`visibilityState` simulé) pendant plus que `liveness-timeout` (15 s réelles) n'apparaît jamais « déconnecté » chez les autres. Les 20 minutes restent couvertes en horloge simulée par `e2e/reconnect.spec.ts:134` (autorisé par epics.md:659).
- Sélecteurs par rôle et libellés exacts de l'interface.

**Never:**
- Aucun changement du contrat, du webservice, ni du code applicatif du front.
- Pas de `waitForTimeout` pour attendre un état : attentes sur l'interface, sauf pour la durée de l'onglet caché.
- Ne pas modifier ni retirer les e2e simulés existants.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreurs |
|----------|--------------|---------------------|---------|
| Coupure courte | Mandataire fermé, reconnexions refusées | « Reconnexion… » chez Sofia ; « déconnecté » chez les autres | — |
| Rétablissement | Mandataire rouvert | Même place, carte 8 choisie | — |
| Reprise | Sofia coupée, second contexte rejoint « Sofia » | Second contexte à sa place avec le vote ; premier : message de reprise à son retour | 409 si le premier est encore connecté |
| Sessions parallèles | Session B révèle | Session A inchangée (tour caché, ses seuls participants) | — |

</frozen-after-approval>

## Open Questions

1. **Vrai webservice ou simulation ?** — (A, recommandé) parcours contre le vrai webservice en CI, ce qui solde l'action 8 de la rétrospective de l'epic 1 ; le job de CI construit aussi le jar (Java 25), soit environ 2 à 3 min de plus. (B) parcours avec la simulation actuelle, plus rapides, mais aucune vérification du couple front–webservice ; l'action 8 resterait ouverte.
2. **Pose de l'étiquette de déploiement** — (A, recommandé) la story livre les tests ; après fusion et CI verte sur `main`, Eric pose `v1.0` hors atelier (ajouté comme action ouverte dans `sprint-status.yaml`), l'agent ne pose aucune étiquette. (B) l'agent pose l'étiquette `v1.0` sur `main` après fusion, ce qui déclenche le déploiement Render et efface les sessions en cours.

## Code Map

- `frontend/playwright.config.ts` -- modèle : WebKit en CI, `PLAYWRIGHT_CHROMIUM_PATH`, `webServer` `serve-dist`. Ne pas modifier (la nouvelle suite a son propre fichier).
- `frontend/scripts/serve-dist.mjs` -- sert `dist/frontend/browser` sur 4300, à réutiliser comme second `webServer`.
- `backend/pom.xml:49` -- `finalName` `planning-poker` : `./mvnw -B package -DskipTests` produit le jar.
- `backend/src/main/resources/application.properties` -- `server.port=${PORT:8080}`, `allowed-origins`, `max-creations-per-ip=10`/min, `max-sessions=50`, `liveness-timeout=15s`. Santé : `/api/health`.
- `frontend/src/app/session/session.service.ts` -- perte détectée sur toute fermeture hors 4401/4404, bannière après 2 s, reconnexion à 0, 1, 2, 4, 8 s puis 10 s.
- `backend/.../domain/Session.java:93-105` -- reprise acceptée seulement si le participant n'a plus de connexion ; l'ancien jeton reçoit 4401 au `hello`, d'où `TAKEN_OVER_MESSAGE` (`entry-form/entry-messages.ts:5`).
- Libellés : « Ton pseudo », « Je vote », « J'observe », « Créer une session », « Rejoindre », « Carte 5 » (`exact: true`), « Révéler les votes », « Effacer les votes », « Nouveau tour », « Copier le lien » / « Lien copié », « Reconnexion… », « Consensus ! » (`.consensus-badge`), moyenne `.result-average .result-value` (format de `session/result.ts`).
- Modèles : `e2e/create-session.spec.ts:107-134` (presse-papiers Chromium), `e2e/reconnect.spec.ts:134` (onglet caché), `e2e/reveal.spec.ts`.
- `.github/workflows/ci.yml` -- jobs `backend` (setup-java temurin 25) et `frontend` (Node 24, `build:e2e`, `playwright install --with-deps chromium webkit`) à combiner.
- Local : Java 25 absent (21 seulement) ; installer `openjdk-25-jdk-headless` si possible (déjà fait en 3.2), sinon parcours vérifiés en CI.

## Tasks & Acceptance

**Execution:**
- [ ] `frontend/playwright.journeys.config.ts` -- `testDir: 'e2e-journeys'`, projets Chromium et WebKit (même règle que la config existante), `webServer` en tableau : jar sur 4310 (santé, 120 s) puis `serve-dist` -- vrai couple front–webservice.
- [ ] `frontend/package.json` -- script `e2e:journeys` -- lancement local et CI.
- [ ] `frontend/e2e-journeys/journey-helpers.ts` -- `join(context, sessionUrl, pseudo, role)`, `cuttableSocket(page)` (mandataire avec `cut()` / `restore()`, nouvelles connexions fermées pendant la coupure) -- réutilisés par les trois parcours.
- [ ] `frontend/e2e-journeys/uj1-affinage.spec.ts` -- UJ-1 (8 contextes).
- [ ] `frontend/e2e-journeys/uj2-telephone.spec.ts` -- UJ-2, reprise, et onglet caché > 15 s.
- [ ] `frontend/e2e-journeys/uj3-sessions-paralleles.spec.ts` -- UJ-3.
- [ ] `.github/workflows/ci.yml` -- job `journeys` : Java 25 + jar, Node 24 + `build:e2e`, Playwright Chromium et WebKit, `npm run e2e:journeys` -- à chaque PR et push sur `main`.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- action `epic-1-retro-item-8` passée à `done` avec sa résolution (selon la réponse 1) ; action de pose de `v1.0` (selon la réponse 2).
- [ ] `deploy/README.md` -- rappeler que la CI verte inclut le job `journeys`.

**Acceptance Criteria:**
- Given la CI GitHub Actions, when un commit est poussé sur une PR ou sur `main`, then UJ-1, UJ-2 et UJ-3 passent sur Chromium et WebKit contre le vrai webservice.
- Given le webservice ou le front cassé sur un de ces parcours, when la suite tourne, then le job `journeys` est rouge.
- Given `npm run e2e`, when il tourne, then la suite simulée existante est inchangée et verte.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd backend && ./mvnw -B -q package -DskipTests` -- expected: `target/planning-poker.jar`.
- `cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npm run e2e:journeys` -- expected: trois parcours verts (Chromium en local).
- `cd frontend && npm run e2e` -- expected: suite existante verte.
- `cd frontend && npx prettier --check e2e-journeys playwright.journeys.config.ts` -- expected: aucun écart.
