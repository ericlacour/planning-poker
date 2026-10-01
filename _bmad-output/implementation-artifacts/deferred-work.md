- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Faire tourner `npm ci && npm run validate && npm test` dans `contract/` en CI GitHub Actions, sous Node 24.
  evidence: Aucun workflow n'existe ; la story 1.2 (AR15) crée la CI backend, frontend et contrat.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Vérifier automatiquement que le contrat n'évolue que par ajout (AD-13), en le comparant à la dernière version étiquetée `v*`.
  evidence: Aucune version de référence n'existe encore ; la règle n'est aujourd'hui que documentée dans `contract/README.md`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-ouvrir-l-outil-meme-quand-le-serveur-dort.md`
  summary: Ne déployer une étiquette `v*` que si la CI est verte sur ce commit (vérification des checks dans `deploy.yml`, ou règle de protection).
  evidence: Le workflow de déploiement ne consulte pas l'état de la CI ; seule la discipline humaine l'empêche aujourd'hui.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-ouvrir-l-outil-meme-quand-le-serveur-dort.md`
  summary: Confirmer au premier déploiement `v0.1` la forme réelle de la réponse `GET /v1/services/{id}/deploys` de Render et le blueprint `deploy/render.yaml`.
  evidence: `render-deploy.sh` est testé contre une fausse API ; aucun compte Render n'était accessible pendant la story 1.2.
