# Déploiement V1 sur Render

Ce document est la référence du déploiement V1 sur Render Free. La story 1.2 (`bmad-build`) crée le blueprint `deploy/render.yaml` à partir de ces réglages. Si le blueprint et ce document divergent, c'est la spine d'architecture qui fait foi (`_bmad-output/planning-artifacts/architecture/architecture-planning-poker-2026-09-29/ARCHITECTURE-SPINE.md`, AD-11 à AD-13).

## Méthode recommandée : le blueprint

1. Crée un compte Render et relie-le au dépôt GitHub `ericlacour/planning-poker`.
2. Attends que la story 1.2 ait livré `backend/`, `frontend/` et `deploy/render.yaml`.
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
| Build Command | `npm ci && node scripts/write-config.mjs && npm run build` (provisoire : la story 1.2 fixe les commandes exactes) |
| Publish Directory | `dist/<nom-du-projet>/browser` (le nom exact sera fixé par la story 1.2) |
| Auto-Deploy | **Off** (AD-13) |
| Redirects/Rewrites | Source `/*`, Destination `/index.html`, Action **Rewrite**. Sans cette règle, les liens de session directs répondent « Not Found ». |
| Headers | Path `/*`, `Content-Security-Policy` : `default-src 'self'; connect-src 'self' https://<url-webservice> wss://<url-webservice>` (AD-11) |

| Variable d'environnement | Valeur |
| --- | --- |
| `API_BASE_URL` | l'URL du webservice, par exemple `https://planning-poker-api.onrender.com`. `scripts/write-config.mjs` l'écrit dans `config.json` pendant le build. |
| `NODE_VERSION` | `24` (Angular 22 demande au moins Node 24.15) |

## Ordre de création

Les deux services dépendent chacun de l'URL de l'autre :

1. Crée les deux services. Render leur attribue leur URL `*.onrender.com`.
2. Renseigne `API_BASE_URL` (front) avec l'URL du webservice, et `ALLOWED_ORIGINS` (webservice) avec l'URL du front.
3. Mets à jour l'en-tête CSP du front avec l'URL du webservice, en `https://` et en `wss://`.
4. Redéploie les deux services.

## Déclencher un déploiement (AD-13)

- Aucun déploiement automatique à chaque push.
- On déploie en posant une étiquette Git `v*` (par exemple `v0.1`), **en dehors des ateliers**, puisqu'un déploiement efface les sessions en cours.
- La story 1.2 met en place un workflow GitHub Actions déclenché par l'étiquette. Il appelle les **Deploy Hooks** Render, le webservice d'abord, puis le front.
- Les URL des deux Deploy Hooks sont des secrets : on les copie depuis Render (onglet Settings de chaque service) dans les secrets GitHub du dépôt, sous les noms `RENDER_DEPLOY_HOOK_BACKEND` et `RENDER_DEPLOY_HOOK_FRONTEND`. Elles ne doivent jamais être commitées.

## À savoir sur Render Free

- Le webservice s'endort après 15 minutes sans requête ni message WebSocket. Son réveil peut prendre jusqu'à 2 minutes, pendant lesquelles le front affiche « Réveil du serveur… » (NFR-2). Ouvre l'outil quelques minutes avant l'atelier.
- Pendant une séance, le `heartbeat` envoyé toutes les 5 s garde le webservice éveillé (AD-8).
- Un seul web service gratuit est prévu (AD-13) : 750 h par mois, pas d'environnement de préproduction.
- Les libellés de l'interface Render peuvent évoluer. Les réglages ci-dessus décrivent l'intention ; adapte-les aux noms de champs du moment.
