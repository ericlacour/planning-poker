# Déploiement V1 sur Render

Ce document est la référence du déploiement V1 sur Render Free. Le blueprint `deploy/render.yaml` applique ces réglages. Si le blueprint et ce document divergent, c'est la spine d'architecture qui fait foi (`_bmad-output/planning-artifacts/architecture/architecture-planning-poker-2026-09-29/ARCHITECTURE-SPINE.md`, AD-11 à AD-13).

## Méthode recommandée : le blueprint

1. Crée un compte Render et relie-le au dépôt GitHub `ericlacour/planning-poker`.
2. Vérifie que `backend/`, `frontend/` et `deploy/render.yaml` sont sur la branche `main`.
3. Dans Render, choisis **New → Blueprint**, sélectionne le dépôt, puis renseigne le **Blueprint Path** : `deploy/render.yaml`.
4. Complète les deux variables qui dépendent des URL (voir « Ordre de création »).

La création manuelle, décrite plus bas, reste possible si le blueprint n'est pas utilisable.

## Service 1 : webservice Java (Web Service)

| Réglage | Valeur |
| --- | --- |
| Language (runtime) | **Docker**. C'est notre image compatible OpenShift (AD-12), pas le runtime Java de Render. |
| Branch | `main` |
| Root Directory | `backend` |
| Dockerfile Path | `./Dockerfile` (relatif à `backend`) |
| Build Command / Start Command | aucune : le `Dockerfile` s'en charge |
| Instance Type | Free |
| Health Check Path | `/api/health` |
| Region | Frankfurt (la plus proche des participants) |
| Auto-Deploy | **Off** (AD-13) |

| Variable d'environnement | Valeur |
| --- | --- |
| `PORT` | `8080` |
| `ALLOWED_ORIGINS` | l'URL du site statique, par exemple `https://planning-poker.onrender.com` (sans `/` final) |

## Service 2 : front Angular (Static Site)

| Réglage | Valeur |
| --- | --- |
| Branch | `main` |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` (écrit `config.json`, construit l'application, puis injecte la CSP dans `index.html`) |
| Publish Directory | `dist/frontend/browser` |
| Auto-Deploy | **Off** (AD-13) |
| Redirects/Rewrites | Source `/*`, Destination `/index.html`, Action **Rewrite**. Sans cette règle, les liens de session directs répondent « Not Found ». |
| Headers | Sur `/*` : `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cache-Control: no-cache`, et une CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` (directives qu'une balise `<meta>` ne peut pas porter, qui s'ajoutent à celle du build). |
| CSP | **Aucun réglage dans Render.** Le build injecte dans `index.html` la balise `<meta http-equiv="Content-Security-Policy">` avec `default-src 'self'; connect-src 'self' https://<url-webservice> wss://<url-webservice>`, à partir de `API_BASE_URL` (AD-11). Elle suit donc toujours l'URL du webservice. |

| Variable d'environnement | Valeur |
| --- | --- |
| `API_BASE_URL` | l'URL du webservice, en `https://` et sans chemin, par exemple `https://planning-poker-api.onrender.com`. Le build échoue si elle manque. Elle produit `config.json` et la CSP. |
| `NODE_VERSION` | `24` (Angular 22 demande au moins Node 24.15) |

## Ordre de création

Les deux services dépendent chacun de l'URL de l'autre :

1. Crée les deux services. Render leur attribue leur URL `*.onrender.com`. Si le nom est déjà pris, il y ajoute un suffixe (par exemple `https://planning-poker-api-wukg.onrender.com`) : relève l'URL exacte sur la page de chaque service.
2. Renseigne `API_BASE_URL` (front) avec l'URL du webservice, et `ALLOWED_ORIGINS` (webservice) avec l'URL du front.
3. Redéploie les deux services : le webservice d'abord, puis le front (sa CSP est calculée au build).

## Déclencher un déploiement (AD-13)

- Aucun déploiement automatique à chaque push.
- On déploie en posant une étiquette Git `v*` (par exemple `v0.1`), **en dehors des ateliers**, puisqu'un déploiement efface les sessions en cours.
- L'étiquette doit pointer sur la tête de `main`, puisque Render déploie la branche `main`. Le workflow refuse sinon.
- **Avant de poser l'étiquette, vérifier que la CI de `main` est verte sur ce commit** (onglet Actions → workflow **CI** → branche `main` : le run déclenché par le *push* du dernier commit porte une coche verte). Le workflow de déploiement ne le vérifie pas : une étiquette posée sur une CI rouge ou encore en cours déploie quand même. Contrôle manuel retenu le 2026-10-04 (action V3 de la rétrospective de l'epic 1).
- La CI verte comprend le job **journeys** : les parcours UJ-1 à UJ-3 joués sur Chromium et WebKit par le front construit contre le vrai webservice (`frontend/e2e-journeys`, `npm run e2e:journeys`). Une coche verte sur le run sans ce job ne suffit pas (story 3.6).
- Le workflow `.github/workflows/deploy.yml` appelle le **Deploy Hook** du webservice, attend par l'API Render que ce déploiement soit `live` sur le commit étiqueté (30 minutes au plus), puis fait de même pour le front (`deploy/render-deploy.sh`, testé par `deploy/render-deploy.test.sh`).
- Réglages GitHub du dépôt (Settings → Secrets and variables → Actions) :

| Nom | Type | Où le trouver |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_BACKEND` | secret | Render, webservice, Settings → Deploy Hook |
| `RENDER_DEPLOY_HOOK_FRONTEND` | secret | Render, site statique, Settings → Deploy Hook |
| `RENDER_API_KEY` | secret | Render, Account Settings → API Keys |
| `RENDER_BACKEND_SERVICE_ID` | variable | identifiant `srv-…` du webservice, visible dans son URL Render |
| `RENDER_FRONTEND_SERVICE_ID` | variable | identifiant `srv-…` du site statique |

- Crée-les au niveau du **dépôt** (sections « Repository secrets » et « Repository variables »), pas dans un environnement. Les environnements `main - planning-poker-api` et `main - planning-poker` que propose GitHub sont créés par l'intégration Render pour afficher ses déploiements ; le workflow ne déclare aucun `environment:` et ne lirait pas ce qui y est rangé.
- Ces valeurs ne doivent jamais être commitées.

```bash
git checkout main && git pull
git tag v0.1 && git push origin v0.1
```

Sans terminal, on peut aussi publier une release GitHub (Releases → Draft a new release) avec une nouvelle étiquette `v*` ciblant `main` ; le titre et la description sont facultatifs.

Pour vérifier un déploiement, Render n'affiche pas l'étiquette mais le **commit** : en haut de la page de chaque service, le commit à côté de `main` doit être celui de l'étiquette (`git rev-parse --short v0.1`), et l'onglet **Events** montre un déploiement déclenché par le Deploy Hook à l'heure du workflow. Le workflow vérifie lui-même que Render a déployé ce commit.

## À savoir sur Render Free

- Le webservice s'endort après 15 minutes sans requête ni message WebSocket. Son réveil peut prendre jusqu'à 2 minutes, pendant lesquelles le front affiche « Réveil du serveur… » (NFR-2). Ouvre l'outil quelques minutes avant l'atelier.
- Observé le 2026-10-03 sur v0.2 : après une mise en veille, le front affiche bien « Réveil du serveur… » puis ouvre l'application (durée du réveil non mesurée).
- Pendant une séance, le `heartbeat` envoyé toutes les 5 s garde le webservice éveillé (AD-8).
- Un seul web service gratuit est prévu (AD-13) : 750 h par mois, pas d'environnement de préproduction.
- Les libellés de l'interface Render peuvent évoluer. Les réglages ci-dessus décrivent l'intention ; adapte-les aux noms de champs du moment.

## Test de charge (story 1.5)

Le script `deploy/load-test.mjs` vérifie la capacité visée : 5 sessions de 13 participants, soit 65 connexions WebSocket. Il n'a aucune dépendance (Node 24 et son WebSocket natif suffisent).

- Il crée N sessions (`--sessions`, 5 par défaut) de M participants (`--participants`, 13 par défaut), un participant sur quatre en observateur, et mesure la diffusion de chaque arrivée.
- Il garde les connexions ouvertes pendant D minutes (`--minutes`, 10 par défaut) en envoyant `heartbeat` toutes les 5 s.
- Dans chaque session, un participant quitte la table puis revient (fermeture puis réouverture de sa connexion) toutes les `--churn-seconds` (10 par défaut).
- Pour chaque changement, il mesure le délai entre la mutation et la réception de l'instantané par chaque participant connecté.
- Il affiche les latences p50, p95, p99 et max, toutes diffusions confondues puis par type de mutation : `JOIN` (arrivée par REST), `PRESENCE+` (connexion ou retour) et `PRESENCE-` (départ), avec le nombre de diffusions au-delà de 1 s.
- Il sort en erreur (code 1) si une diffusion dépasse son seuil ou n'arrive pas, ou si une connexion tombe. Sinon il sort avec le code 0. Le seuil est de 1 s, sauf pour un départ (`PRESENCE-`) : 6 s. Derrière Render, la fermeture d'une connexion met environ 5 s à atteindre le webservice, et l'équipe a accepté ce délai le 2026-10-03 (FR-16).

`ALLOWED_ORIGINS` filtre l'en-tête `Origin` des WebSocket. Le script n'en envoie aucun par défaut ; si le webservice le refuse, passe l'URL du front avec `--origin`.

```bash
# Contre Render : réveille d'abord le webservice (ouvre le front), hors atelier.
node deploy/load-test.mjs --url https://planning-poker-api.onrender.com \
  --origin https://planning-poker.onrender.com --minutes 10
```

| Date | Cible | Paramètres | Résultat |
| --- | --- | --- | --- |
| 2026-10-02 | webservice local (`java -jar`, poste de développement) | 5 × 13, 2 min, départ / retour toutes les 10 s | OK : 1 500 diffusions mesurées, p50 11,7 ms, p95 28,2 ms, p99 38,5 ms, max 65,2 ms ; aucune connexion tombée |
| 2026-10-03 | Render Free (v0.2), depuis un poste Windows | 5 × 13, 1 min, départ / retour toutes les 10 s | **ÉCHEC** : 1 020 diffusions mesurées, p50 297,8 ms, p95 4 608,6 ms, p99 4 796,3 ms, max 4 797,1 ms ; 65 connexions ouvertes en 9 s, aucune connexion tombée. Environ 5 % des diffusions arrivent en 4,6 à 4,8 s. Hypothèse à vérifier avec le détail par type : la fermeture d'une connexion (`PRESENCE-`) met environ 5 s à traverser Render. |
| 2026-10-03 | Render Free (v0.2), depuis un poste Windows | 5 × 13, 1 min, avec le détail par type | **ÉCHEC, limité aux départs** : 1 020 diffusions, p50 200,6 ms, max 4 869,1 ms ; 65 connexions ouvertes en 6 s, aucune tombée. `JOIN` (390) : p50 198,9 ms, max 504,0 ms ; `PRESENCE+` (510) : p50 197,0 ms, max 638,5 ms ; `PRESENCE-` (120) : p50 4 691,4 ms, max 4 869,1 ms, 108 au-delà de 1 s. Hypothèse confirmée : un départ met environ 4,7 s à être diffusé derrière Render, alors que les arrivées et les retours restent sous 0,7 s. Avec le seuil de 6 s pour un départ, accepté ensuite par l'équipe, cet essai passerait. |
| 2026-10-03 | Render Free (v0.2), depuis un poste Windows | 5 × 13, 10 min, départ / retour toutes les 10 s | **OK** au regard des seuils retenus (1 s, 6 s pour un départ) ; exécuté avec la version du script qui appliquait encore 1 s aux départs, d'où son verdict « ÉCHEC ». 3 660 diffusions, aucune non reçue, aucune connexion tombée ; 65 connexions ouvertes en 5,6 s ; 7 608 `tick` reçus (≈ 117 par connexion). `JOIN` (390) : p50 104,2 ms, max 300,8 ms ; `PRESENCE+` (1 830) : p50 136,6 ms, max 560,3 ms ; `PRESENCE-` (1 440) : p50 4 851,4 ms, max 4 895,7 ms. |
