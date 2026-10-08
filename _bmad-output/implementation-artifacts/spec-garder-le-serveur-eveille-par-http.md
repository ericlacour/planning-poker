---
title: 'Garder le serveur éveillé par un appel HTTP régulier'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Render Free endort le webservice après 15 min sans trafic entrant, et les sessions vivent en mémoire : une mise en veille pendant une séance les efface. Le `heartbeat` WebSocket toutes les 5 s est censé l'empêcher (AD-8, NFR-1b), mais personne n'a vérifié que Render compte bien les messages WebSocket comme trafic (rétro epic 1, point 2).

**Approach:** Pendant une session, le navigateur appelle aussi `GET /api/health` toutes les 5 min. Une requête HTTP entrante compte à coup sûr, donc le serveur reste éveillé tant que quelqu'un a la page de session ouverte, même si la connexion WebSocket est coupée.

</frozen-after-approval>

## Implementation Notes

- `frontend/src/app/session/session.service.ts` : `KEEP_AWAKE_INTERVAL_MS = 300_000`. `connect()` lance un `setInterval` qui appelle `HEALTH_PROBE` (déjà utilisé par l'écran de réveil, `fetch` en `no-store` avec délai de 10 s). `disconnect()` l'arrête, ce qui couvre aussi la destruction de la page et les fins `4401`/`4404` (`finish` appelle `disconnect`). La sonde tourne même pendant une reconnexion : c'est voulu, la page est toujours ouverte. Son résultat est ignoré.
- 5 min laisse trois appels par fenêtre de 15 min. Un onglet en arrière-plan ralentit ses minuteries à une fois par minute au plus, ce qui ne retarde pas un intervalle de 5 min. Un téléphone verrouillé suspend la page : rien ne part, comme pour le `heartbeat`.
- Aucun changement côté webservice : `GET /api/health` existe déjà et n'est pas limité.
- `ARCHITECTURE-SPINE.md` (AD-8) mentionne ce signal en plus du `heartbeat`.
- Relecture : description de `getHealth` (`contract/openapi.yaml`) et Javadoc de `HealthController` complétées ; la puce `heartbeat` d'AD-8 ne présente plus comme vérifié que Render compte les messages WebSocket.

## Review Triage Log

| # | Constat | Verdict | Preuve | Suite |
|---|---------|---------|--------|-------|
| 1 | Aucune vérification sur Render que le service ne s'endort plus | medium | Les tests unitaires et e2e simulent le serveur ; seul un essai réel le prouve | différé |
| 2 | AD-8 affirme que Render compte les messages WebSocket, juste au-dessus de la nouvelle puce qui en doute | low | Contradiction lue dans le texte | patch |
| 3 | `getHealth` et `HealthController` ne mentionnent pas le nouvel appelant | low | Description et Javadoc lues | patch |
| 4 | « Tant qu'il est connecté » alors que la minuterie tourne de `connect()` à `disconnect()` | low | `ConnectionStatus` : seul `open` veut dire connecté | patch |
| 5 | Pas de test de destruction de la page | low | `DestroyRef.onDestroy` appelle `disconnect()`, testé ; cas rare | rejeté |
| 6 | Une sonde qui rejette donnerait une promesse non gérée | false | `HEALTH_PROBE` par défaut attrape toute erreur ; seuls les tests le remplacent | rejeté |
| 7 | Premier appel 5 min après `connect()` | false | La page vient de faire `GET /api/health` (écran de réveil) et l'ouverture du WebSocket ; 5 min < 15 min | rejeté |
| 8 | Fichiers de suivi non mis à jour | false | Statut passé à `done` ici ; ce n'est pas une story d'epic | rejeté |
| 9 | Téléphones verrouillés : rien ne part (NFR-1b) | low | Limite existante, identique pour `heartbeat` ; pas causée par ce changement | rejeté |
| 10 | Un appel par onglet plutôt que par session | low | 65 requêtes minuscules toutes les 5 min, négligeable | rejeté |
