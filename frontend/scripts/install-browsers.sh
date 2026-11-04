#!/usr/bin/env bash
# Installe Chromium et WebKit pour Playwright en CI. L'installation se fige parfois sur le runner (miroir apt lent) :
# chaque essai est borné à 5 min, trois essais. `timeout` n'arrête que npx : l'apt-get lancé en root par Playwright
# lui survit et garde le verrou dpkg, ce qui faisait échouer d'emblée les essais suivants. Entre deux essais, on
# l'arrête donc, on attend que le verrou soit libéré et on répare dpkg (les paquets déjà téléchargés restent en cache).
set -u

for i in 1 2 3; do
  timeout --kill-after=10 300 npx playwright install --with-deps chromium webkit && exit 0
  echo "Installation bloquée ou en échec, nouvel essai ($i/3)"
  sudo pkill -KILL -x apt-get || true
  for _ in $(seq 30); do
    pgrep -x apt-get >/dev/null || pgrep -x dpkg >/dev/null || break
    sleep 2
  done
  sudo dpkg --configure -a || true
done
exit 1
