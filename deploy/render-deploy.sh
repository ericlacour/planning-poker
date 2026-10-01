#!/usr/bin/env bash
# Déclenche le Deploy Hook d'un service Render et attend que CE déploiement soit « live » (AD-13).
# Entrées : HOOK (URL du Deploy Hook), SERVICE_ID (srv-…), RENDER_API_KEY, GITHUB_SHA (commit attendu).
# Le déploiement suivi est le premier dont l'identifiant diffère du dernier connu avant le hook ;
# une erreur passagère de l'API ne fait que retarder l'interrogation suivante.
set -euo pipefail

for v in HOOK SERVICE_ID RENDER_API_KEY GITHUB_SHA; do
  [ -n "${!v:-}" ] || { echo "::error::$v n'est pas configuré (voir deploy/README.md)."; exit 1; }
done

api="https://api.render.com/v1/services/$SERVICE_ID/deploys?limit=1"
latest() {
  curl -fsS --retry 3 -H "Authorization: Bearer $RENDER_API_KEY" -H "Accept: application/json" "$api" \
    | jq -er '.[0].deploy | "\(.id) \(.status) \(.commit.id // "")"'
}

previous=$(latest | cut -d' ' -f1 || true)
curl -fsS --retry 3 -X POST "$HOOK" > /dev/null
echo "Déploiement de $SERVICE_ID demandé ; attente du statut live…"

for _ in $(seq 1 120); do
  sleep 15
  if ! line=$(latest); then
    echo "API Render indisponible ou réponse inattendue ; nouvel essai."
    continue
  fi
  read -r id status commit <<< "$line"
  [ "$id" != "$previous" ] || continue
  echo "$id : $status"
  case "$status" in
    live)
      if [ -n "$commit" ] && [ "$commit" != "$GITHUB_SHA" ]; then
        echo "::error::Render a déployé $commit au lieu de $GITHUB_SHA (main a bougé ?)."
        exit 1
      fi
      exit 0 ;;
    build_failed|update_failed|canceled|deactivated|pre_deploy_failed)
      echo "::error::Le déploiement $id a échoué ($status)."
      exit 1 ;;
  esac
done
echo "::error::Le déploiement de $SERVICE_ID n'est pas live au bout de 30 minutes."
exit 1
