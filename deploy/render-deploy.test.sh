#!/usr/bin/env bash
# Tests de render-deploy.sh contre une fausse API Render (curl et sleep simulés). Usage : bash deploy/render-deploy.test.sh
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fails=0

# run <réponses GET, une par ligne ; "ERR" = échec réseau> <code de sortie attendu> <texte attendu>
run() {
  local responses=$1 expected_code=$2 expected_text=$3 bin
  bin=$(mktemp -d)
  printf '%s\n' "$responses" > "$bin/responses"
  cat > "$bin/curl" <<'FAKE'
#!/usr/bin/env bash
dir=$(dirname "$0")
for a in "$@"; do [ "$a" = "POST" ] && exit 0; done
line=$(head -n1 "$dir/responses"); sed -i 1d "$dir/responses"
[ "$line" = "ERR" ] && exit 22
echo "$line"
FAKE
  printf '#!/usr/bin/env bash\nexit 0\n' > "$bin/sleep"
  chmod +x "$bin/curl" "$bin/sleep"
  output=$(PATH="$bin:$PATH" HOOK=https://hook SERVICE_ID=srv-1 RENDER_API_KEY=k GITHUB_SHA=abc bash "$here/render-deploy.sh" 2>&1)
  code=$?
  if [ "$code" -ne "$expected_code" ] || [[ "$output" != *"$expected_text"* ]]; then
    echo "ÉCHEC ($expected_text) : code $code"; echo "$output"; fails=$((fails + 1))
  else
    echo "ok : $expected_text"
  fi
  rm -rf "$bin"
}

d() { echo "[{\"deploy\":{\"id\":\"$1\",\"status\":\"$2\",\"commit\":{\"id\":\"$3\"}}}]"; }

run "$(d dep-old live abc)
$(d dep-old live abc)
$(d dep-new build_in_progress abc)
$(d dep-new live abc)" 0 "dep-new : live"

run "$(d dep-old live abc)
ERR
{\"unexpected\":true}
$(d dep-new live abc)" 0 "nouvel essai"

run "$(d dep-old live abc)
$(d dep-new build_failed abc)" 1 "a échoué (build_failed)"

run "$(d dep-old live abc)
$(d dep-new live zzz)" 1 "au lieu de abc"

run "[]
$(d dep-first live abc)" 0 "dep-first : live"

exit "$fails"
