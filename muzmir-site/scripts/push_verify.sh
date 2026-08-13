#!/bin/bash
# ВЫКЛАДКА СВЕРКИ ВЕДОМСТВ НА БОЕВОЙ СЕРВЕР.
#
# На сервере лежит код, но не лежат данные сверки: реестр организаций и куски
# data/verify/*.json живут в репозитории. Пока их там нет, apply-скрипту нечего
# применять, и все ведомства числятся несверенными — писем не получит никто.
#
# Скрипт кладёт на сервер ТОЛЬКО файлы данных. PHP-код не трогается: на этом же
# сервере может работать другая сессия, затирать её правки нельзя.
#
#   scripts/push_verify.sh          — выложить файлы
#   scripts/push_verify.sh apply    — выложить и применить к базе
set -eu
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$REPO/.." && pwd)"
MODE="${1:-push}"
source <(base64 -d "$ROOT/secrets.env.b64") 2>/dev/null

vexec() {
  curl -s --cacert /root/.ccr/ca-bundle.crt -m 180 -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'
}
# Команда на клиентском сервере: бастион → sshpass → сам сервер.
mm() {
  vexec "sshpass -p '$MUZMIR_ROOT_PW' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 root@$MUZMIR_SERVER_IP $(python3 -c 'import shlex,sys;print(shlex.quote("cd /var/www/muzmir && "+sys.argv[1]))' "$1")"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar czf "$TMP/verify.tgz" -C "$REPO" data/ministries_to_verify.json data/verify
base64 -w0 "$TMP/verify.tgz" > "$TMP/verify.b64"
SIZE=$(wc -c < "$TMP/verify.b64")
echo "архив сверки: $(wc -c < "$TMP/verify.tgz") байт, в base64 $SIZE"

# Ручка exec принимает команду строкой, поэтому большой архив едет кусками по
# 150 КБ: одним куском ручка давится, а докидывать частями она позволяет.
split -b 150000 "$TMP/verify.b64" "$TMP/chunk-"
mm "rm -f /tmp/verify.b64"
i=0
for f in "$TMP"/chunk-*; do
  i=$((i+1))
  printf '  кусок %d ... ' "$i"
  mm "cat >> /tmp/verify.b64 <<'B64EOF'
$(cat "$f")
B64EOF
wc -c < /tmp/verify.b64"
done

echo "распаковка на сервере:"
mm "tr -d '\n' < /tmp/verify.b64 | base64 -d > /tmp/verify.tgz && tar xzf /tmp/verify.tgz -C /var/www/muzmir && chown -R www-data:www-data data/verify data/ministries_to_verify.json && ls data/verify | wc -l && echo 'файлов сверки на сервере — выше'"

if [ "$MODE" = "apply" ]; then
  echo "=== ПРИМЕНЕНИЕ К БАЗЕ ==="
  mm "cp data/muzmir.sqlite data/backups/muzmir-preverify-\$(date +%Y%m%d-%H%M%S).sqlite && php scripts/apply_ministry_verify.php apply"
else
  echo "=== ПРЕДПРОСМОТР (в базу ничего не пишется) ==="
  mm "php scripts/apply_ministry_verify.php"
fi
