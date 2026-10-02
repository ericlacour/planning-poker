# planning-poker

Planning poker pour les ateliers d'affinage : sans compte, sans publicité, sur PC et sur téléphone.

| Dossier | Contenu |
| --- | --- |
| `contract/` | Contrat d'échange front / webservice (OpenAPI, AsyncAPI, JSON Schema, exemples). Voir `contract/README.md`. |
| `backend/` | Webservice Java 25 / Spring Boot 4.1 (architecture hexagonale), et son image Docker. |
| `frontend/` | Front Angular 22. |
| `deploy/` | Blueprint et mode d'emploi du déploiement sur Render. Voir `deploy/README.md`. |
| `.github/workflows/` | CI (`ci.yml`) et déploiement sur étiquette `v*` (`deploy.yml`). |

## Lancer en local

Prérequis : JDK 25 et Node.js ≥ 24.15. Deux terminaux, depuis la racine du dépôt :

```bash
# Terminal 1 : webservice, sur http://localhost:8080
(cd backend && ALLOWED_ORIGINS=http://localhost:4200 ./mvnw spring-boot:run)

# Terminal 2 : front, sur http://localhost:4200 (config.json pointe vers http://localhost:8080)
(cd frontend && npm ci && npm start)
```

## Tester

Depuis la racine du dépôt :

```bash
(cd contract && npm ci && npm run validate && npm test)
(cd backend && ./mvnw verify)
(cd frontend && npm ci && npm test)
(cd frontend && API_BASE_URL=http://127.0.0.1:4310 npm run build:e2e && npx playwright install chromium && npm run e2e)
bash deploy/render-deploy.test.sh
```

## Configuration

- Webservice : `PORT` (8080 par défaut) et `ALLOWED_ORIGINS` (origines `http(s)://hôte[:port]` du front, séparées par des virgules ; aucune par défaut ; un joker `*` ou un chemin empêche le démarrage).
- Front : `API_BASE_URL` au build, qui produit `config.json` et la CSP du `index.html`.
