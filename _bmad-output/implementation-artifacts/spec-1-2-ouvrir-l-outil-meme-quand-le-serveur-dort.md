---
title: 'Story 1.2 : ouvrir l''outil, même quand le serveur dort'
type: 'feature'
created: '2026-10-01'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-planning-poker-2026-09-29/ARCHITECTURE-SPINE.md'
  - '{project-root}/deploy/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le dépôt ne contient que le contrat. Il manque le webservice, le front, la CI et le déploiement. Sur Render Free, le webservice s'endort, et un premier chargement afficherait une erreur au lieu de faire patienter (NFR-2).

**Approach:** Amorcer le monodépôt de bout en bout :
- `backend/` (Spring Boot 4.1.1, Java 25, hexagonal, `/api/health`, image Docker compatible OpenShift) ;
- `frontend/` (Angular 22 : `config.json`, jetons DESIGN en propriétés CSS, écran de réveil, puis accueil provisoire) ;
- la CI GitHub Actions ;
- le blueprint Render, avec un déploiement sur étiquette `v*`, le webservice d'abord.

Story gardée entière, à la demande de l'utilisateur.

## Boundaries & Constraints

**Always :**
- Versions : Spring Boot 4.1.1, Java 25, Maven 3.9.16 (via `mvnw`), ArchUnit 1.5.1, Angular 22, Node ≥ 24.15, et les images `eclipse-temurin:25.0.4.1_1-jdk-noble` (build) et `25.0.4.1_1-jre-noble` (exécution).
- `/api/health` renvoie exactement l'exemple du contrat, `{"status":"UP"}`. Les erreurs REST passent par `problem+json` (`spring.mvc.problemdetails.enabled=true`).
- `ALLOWED_ORIGINS` (liste séparée par des virgules) est la seule source des origines acceptées, pour CORS sur `/api/**` comme pour l'ouverture de `/ws/sessions/{sessionId}`. Aucune origine n'est acceptée par défaut.
- Configuration par variables d'environnement uniquement : `PORT` (défaut 8080) et `ALLOWED_ORIGINS`. Journaux JSON sur la sortie standard.
- L'image tourne sous un `USER` non root, dans le groupe 0, avec `chmod -R g=u`, et n'écrit que dans `/tmp`.
- Le front ne charge aucune ressource tierce et respecte une CSP sans `unsafe-inline` : aucun style de composant ni CSS critique injectée en ligne. Les styles vivent dans des feuilles globales.
- Libellés exacts : « Réveil du serveur… », « Ça peut prendre jusqu'à 2 minutes. », « Le serveur ne répond pas. » et « Réessayer ». `<html lang="fr">`, `LOCALE_ID` à `fr`.
- Aucun déploiement sur push. Le déploiement se fait sur une étiquette `v*`, le webservice avant le front. Les URL des Deploy Hooks et la clé d'API Render restent des secrets GitHub.

**Never :**
- Pas de STOMP ni de SockJS, aucun endpoint hors du contrat, et pas de `spring-boot-jackson2` ni de `com.fasterxml.jackson.databind`.
- Pas de logique métier de session : le WebSocket n'est ouvert que pour porter la règle d'origine et la poignée de main minimale.
- Pas de formulaire d'accueil (story 1.3) ni de choix de thème dans l'interface (story 3.3).

**Décisions de conception (prises au plan) :**
- **WebSocket minimal** : seul le contrat est respecté. Si aucun `hello` valide n'arrive dans les 5 s, la connexion est fermée en `1008`. Sur un `hello` valide, elle est fermée en `4404`, puisqu'aucune session n'existe avant la story 1.3. La story 1.5 remplacera ce gestionnaire.
- **Écran de réveil** : il n'apparaît que si `/api/health` n'a pas répondu 200 en 1 s, pour éviter un flash. Le front interroge toutes les 3 s, avec un délai d'attente de 10 s par requête. Au bout de 3 min sans réponse, il affiche « Le serveur ne répond pas. ». « Réessayer » relance un nouveau cycle de 3 min.
- **CSP** : une balise `<meta http-equiv="Content-Security-Policy">` est injectée dans `index.html` au build, à partir de `API_BASE_URL` : `default-src 'self'; connect-src 'self' <https-api> <wss-api>`. Elle remplace l'en-tête Render, qu'il aurait fallu tenir à jour à la main.
- **`config.json`** : il est généré par `scripts/write-config.mjs`. `API_BASE_URL` est obligatoire et doit commencer par `https://`, sauf avec `--dev`, qui prend `http://localhost:8080` par défaut. Le fichier est ignoré par git.
- **Accueil provisoire** : la barre du haut (logo en dos de carte et « Planning Poker »), puis un titre « Planning Poker ». La story 1.3 le remplacera.
- **Thème** : les jetons `-dark` redéfinissent les mêmes propriétés sous `@media (prefers-color-scheme: dark)`, sauf avec `[data-theme="light"]`, et toujours sous `[data-theme="dark"]`.
- **Tests du contrat côté Java et côté TS** : ils arrivent avec les premiers types écrits à la main (stories 1.3 et 1.5). La CI valide le contrat avec `npm run validate` et `npm test`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Santé | `GET /api/health` | 200 `{"status":"UP"}` | N/A |
| CORS autorisé | `Origin` présente dans `ALLOWED_ORIGINS` | en-têtes CORS présents | N/A |
| CORS refusé | `Origin` absente, ou `ALLOWED_ORIGINS` vide | 403 sur le préflight, aucun en-tête `Access-Control-Allow-Origin` | N/A |
| WS, origine refusée | ouverture de `/ws/sessions/x` depuis une origine inconnue | poignée de main HTTP refusée (403) | N/A |
| WS, pas de `hello` | connexion ouverte, rien pendant 5 s | fermeture `1008` | N/A |
| WS, `hello` valide | `{"type":"hello","participantToken":"…"}` | fermeture `4404` | N/A |
| Domaine pollué | une classe de `domain` importe Spring, Jackson ou `jakarta` | le build échoue (ArchUnit) | N/A |
| Serveur réveillé | santé 200 en moins d'1 s | accueil provisoire, sans écran de réveil | N/A |
| Serveur endormi | santé sans réponse pendant 1 s | « Réveil du serveur… » et l'animation, puis l'accueil dès le premier 200 | erreurs réseau et 5xx ignorées pendant 3 min |
| Serveur absent | aucune réponse 200 pendant 3 min | « Le serveur ne répond pas. » et « Réessayer » | « Réessayer » relance le cycle |
| Animation réduite | `prefers-reduced-motion: reduce` | les cartes ne bougent pas | N/A |
| Config absente | `API_BASE_URL` vide au build, sans `--dev` | `write-config.mjs` sort en erreur | message explicite |

</frozen-after-approval>

## Code Map

- `contract/` (story 1.1) : `openapi.yaml`, `asyncapi.yaml` et les exemples `examples/health-response/up.json` et `examples/hello/hello.json`. Rien n'y change.
- `deploy/README.md` : les réglages Render, les noms de secrets `RENDER_DEPLOY_HOOK_BACKEND` et `RENDER_DEPLOY_HOOK_FRONTEND`, et l'ordre de création. À mettre à jour pour la CSP par balise `<meta>`.
- Maquette de l'écran de réveil : `_bmad-output/planning-artifacts/ux-designs/ux-planning-poker-2026-09-29/mockups/etats.html`. On reprend ses classes `.deck`, `.back` et `.center` et son `@keyframes shuffle-*`.
- Jetons : le front matter YAML de `…/ux-planning-poker-2026-09-29/DESIGN.md` (`colors`, `typography`, `rounded`, `spacing`).
- Outillage local : JDK 25 dans `/usr/lib/jvm/java-25-openjdk-amd64`, Node 24 dans `/opt/node-v24.21.0-linux-x64/bin`, Chromium pour Playwright dans `/opt/pw-browsers`. Pas de démon Docker : l'image n'est construite qu'en CI.

## Tasks & Acceptance

**Execution :**
- [ ] `backend/pom.xml`, `backend/mvnw*` et `backend/.mvn/` -- parent `spring-boot-starter-parent` 4.1.1, `java.version` 25, `spring-boot-starter-webmvc`, `spring-boot-starter-websocket`, tests et `archunit-junit5` 1.5.1 ; wrapper épinglé sur Maven 3.9.16.
- [ ] `backend/src/main/java/com/planningpoker/` -- `PlanningPokerApplication` ; un `package-info.java` par couche (`domain`, `application`, `adapter.in.rest`, `adapter.in.ws`, `adapter.out.memory`, `config`) ; `adapter.in.rest.HealthController` ; `adapter.in.ws.SessionSocketHandler`, avec la poignée de main minimale ; `config.AllowedOrigins`, `config.WebConfig` (CORS) et `config.WebSocketConfig` (origines) ; `Clock` UTC en bean.
- [ ] `backend/src/main/resources/application.properties` -- `server.port=${PORT:8080}`, origines, `problemdetails`, `logging.structured.format.console=logstash`, et un arrêt qui n'écrit nulle part ailleurs que dans `/tmp`.
- [ ] `backend/src/test/java/com/planningpoker/` -- `ArchitectureTest` (domaine pur et sens des dépendances AD-1), `HealthControllerTest` (corps égal à l'exemple du contrat), `CorsTest`, `SessionSocketHandlerTest` (403, 1008 en horloge réduite, 4404) et un test de journal JSON.
- [ ] `backend/Dockerfile` et `backend/.dockerignore` -- build multi-étape, image d'exécution non root, groupe 0, `-Djava.io.tmpdir=/tmp`, `EXPOSE 8080`.
- [ ] `frontend/` -- projet Angular 22 généré par la CLI (CSS, routage, sans SSR), avec `inlineCritical: false` ; `src/index.html` en `lang="fr"` ; `LOCALE_ID` à `fr`.
- [ ] `frontend/scripts/write-config.mjs` et `frontend/scripts/inject-csp.mjs` -- `public/config.json` et la balise CSP dans `dist/…/index.html` ; scripts npm `start` (`--dev`) et `build`.
- [ ] `frontend/src/styles/tokens.css` et `frontend/src/styles/*.css` -- tous les jetons de DESIGN, le thème sombre, la base, l'écran d'état et le dos de carte.
- [ ] `frontend/src/app/` -- `config/app-config.ts` (chargement au démarrage), `wake/server-wake.service.ts` (cycle d'interrogation de la santé, horloge injectable) et `wake/wake-screen.component.ts` ; un `home/home.component.ts` provisoire ; le routage.
- [ ] `frontend/src/**/*.spec.ts` (Vitest) -- les règles de `ServerWakeService` en faux temps (1 s, 3 s, 3 min, Réessayer), les libellés de l'écran et la présence de chaque jeton de DESIGN dans `tokens.css`.
- [ ] `frontend/e2e/` et `playwright.config.ts` -- sur Chromium, servir `dist` avec la CSP et une santé simulée : écran de réveil, puis accueil, sans violation de CSP ni requête tierce.
- [ ] `.github/workflows/ci.yml` -- sur push vers `main` et sur pull request : les tâches `contract`, `backend` (`./mvnw verify` puis `docker build`) et `frontend` (tests, build, e2e), en Node 24 et Temurin 25.
- [ ] `.github/workflows/deploy.yml` -- sur une étiquette `v*` : Deploy Hook du webservice, attente du statut `live` par l'API Render, puis Deploy Hook du front.
- [ ] `deploy/render.yaml` et `deploy/README.md` -- web service Docker (plan free, `PORT=8080`, `healthCheckPath`, sans déploiement automatique) et site statique (réécriture SPA, `API_BASE_URL`, `NODE_VERSION`) ; le README documente la CSP par `<meta>` et les secrets.
- [ ] `README.md` et `.gitignore` -- lancement local (`./mvnw spring-boot:run` avec `ALLOWED_ORIGINS=http://localhost:4200`, et `npm start`).

**Acceptance Criteria :**
- Étant donné le dépôt, quand la CI tourne, alors les tâches contrat, backend (image Docker comprise) et frontend (e2e compris) sont vertes.
- Étant donné une étiquette `v0.1` et un compte Render configuré, quand le déploiement se lance, alors le webservice puis le front sont en ligne, et l'écran de réveil s'observe après une mise en veille. Ce critère est vérifié manuellement par l'utilisateur.

## Verification

**Commands :**
- `cd backend && JAVA_HOME=/usr/lib/jvm/java-25-openjdk-amd64 ./mvnw -q verify` -- attendu : build et tests verts.
- `cd frontend && npm ci && npm test && npm run build && npm run e2e` -- attendu : tests verts, build sans avertissement de budget, e2e vert.
- `cd contract && npm run validate && npm test` -- attendu : inchangé, vert.
