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

1. Crée les deux services. Render leur attribue leur URL `*.onrender.com`.
2. Renseigne `API_BASE_URL` (front) avec l'URL du webservice, et `ALLOWED_ORIGINS` (webservice) avec l'URL du front.
3. Redéploie les deux services : le webservice d'abord, puis le front (sa CSP est calculée au build).

## Déclencher un déploiement (AD-13)

- Aucun déploiement automatique à chaque push.
- On déploie en posant une étiquette Git `v*` (par exemple `v0.1`), **en dehors des ateliers**, puisqu'un déploiement efface les sessions en cours.
- L'étiquette doit pointer sur la tête de `main`, puisque Render déploie la branche `main`. Le workflow refuse sinon.
- Le workflow `.github/workflows/deploy.yml` appelle le **Deploy Hook** du webservice, attend par l'API Render que ce déploiement soit `live` sur le commit étiqueté (30 minutes au plus), puis fait de même pour le front (`deploy/render-deploy.sh`, testé par `deploy/render-deploy.test.sh`).
- Réglages GitHub du dépôt (Settings → Secrets and variables → Actions) :

| Nom | Type | Où le trouver |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_BACKEND` | secret | Render, webservice, Settings → Deploy Hook |
| `RENDER_DEPLOY_HOOK_FRONTEND` | secret | Render, site statique, Settings → Deploy Hook |
| `RENDER_API_KEY` | secret | Render, Account Settings → API Keys |
| `RENDER_BACKEND_SERVICE_ID` | variable | identifiant `srv-…` du webservice, visible dans son URL Render |
| `RENDER_FRONTEND_SERVICE_ID` | variable | identifiant `srv-…` du site statique |

- Ces valeurs ne doivent jamais être commitées.

```bash
git checkout main && git pull
git tag v0.1 && git push origin v0.1
```

## À savoir sur Render Free

- Le webservice s'endort après 15 minutes sans requête ni message WebSocket. Son réveil peut prendre jusqu'à 2 minutes, pendant lesquelles le front affiche « Réveil du serveur… » (NFR-2). Ouvre l'outil quelques minutes avant l'atelier.
- Pendant une séance, le `heartbeat` envoyé toutes les 5 s garde le webservice éveillé (AD-8).
- Un seul web service gratuit est prévu (AD-13) : 750 h par mois, pas d'environnement de préproduction.
- Les libellés de l'interface Render peuvent évoluer. Les réglages ci-dessus décrivent l'intention ; adapte-les aux noms de champs du moment.
