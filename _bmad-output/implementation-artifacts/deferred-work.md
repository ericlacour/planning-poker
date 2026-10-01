- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Faire tourner `npm ci && npm run validate && npm test` dans `contract/` en CI GitHub Actions, sous Node 24.
  evidence: Aucun workflow n'existe ; la story 1.2 (AR15) crée la CI backend, frontend et contrat.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-le-contrat-d-echange-front-webservice.md`
  summary: Vérifier automatiquement que le contrat n'évolue que par ajout (AD-13), en le comparant à la dernière version étiquetée `v*`.
  evidence: Aucune version de référence n'existe encore ; la règle n'est aujourd'hui que documentée dans `contract/README.md`.
