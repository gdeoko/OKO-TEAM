#!/bin/bash
# ВЫКЛАДКА СВЕРКИ ВЕДОМСТВ НА БОЕВОЙ СЕРВЕР.
#
# На сервере лежит код, но не лежат данные сверки: реестр организаций и куски
# data/verify/*.json живут в репозитории. Пока их там нет, apply-скрипту нечего
# применять, и все ведомства числятся несверенными - писем не получит никто.
#
# Скрипт кладёт на сервер ТОЛЬКО файлы данных. PHP-код не трогается: на этом же
# сервере может работать другая сессия, затирать её правки нельзя.
#
# Почему в два прыжка. Прямого пути из песочницы на клиентский сервер нет:
# порт 22 закрыт, всё идёт через ручку exec на мосту. Архив едет кусками на
# мост (одной командой ручка давится), там собирается и уходит на клиентский
# сервер обычным scp. Пробовали одним прыжком через вложенный ssh - архив
# приезжает битым: heredoc не переживает двойное экранирование.
#
#   scripts/push_verify.sh          — выложить и показать предпросмотр
#   scripts/push_verify.sh apply    — выложить и применить к базе
set -eu
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$REPO/.." && pwd)"
MODE="${1:-push}"
source <(base64 -d "$ROOT/secrets.env.b64") 2>/dev/null

# Команда на мосту.
vexec() {
  curl -s --cacert /root/.ccr/ca-bundle.crt -m 180 -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""),end="");sys.stderr.write(d.get("stderr",""))'
}
# Команда на клиентском сервере: мост -> sshpass -> сервер.
mm() {
  vexec "sshpass -p '$MUZMIR_ROOT_PW' ssh -T -o StrictHostKeyChecking=no -o LogLevel=ERROR -o ConnectTimeout=20 root@$MUZMIR_SERVER_IP $(python3 -c 'import shlex,sys;print(shlex.quote("cd /var/www/muzmir && "+sys.argv[1]))' "$1")"
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar czf "$TMP/verify.tgz" -C "$REPO" data/ministries_to_verify.json data/verify
base64 -w0 "$TMP/verify.tgz" > "$TMP/verify.b64"
echo "архив сверки: $(wc -c < "$TMP/verify.tgz") байт, в base64 $(wc -c < "$TMP/verify.b64")"
SUM=$(md5sum "$TMP/verify.tgz" | cut -d' ' -f1)

split -b 120000 "$TMP/verify.b64" "$TMP/c-"
vexec "rm -f /tmp/verify.b64 /tmp/verify.tgz"
n=0
for f in "$TMP"/c-*; do
  n=$((n+1))
  printf '  кусок %d: ' "$n"
  vexec "printf %s $(cat "$f") >> /tmp/verify.b64; wc -c < /tmp/verify.b64"
done

echo "сборка на мосту и отправка на сервер:"
vexec "base64 -d /tmp/verify.b64 > /tmp/verify.tgz && md5sum /tmp/verify.tgz | cut -d' ' -f1"
echo "  ожидали md5: $SUM"

vexec "sshpass -p '$MUZMIR_ROOT_PW' scp -o StrictHostKeyChecking=no -o LogLevel=ERROR /tmp/verify.tgz root@$MUZMIR_SERVER_IP:/tmp/verify.tgz && echo 'архив доставлен'"

mm "tar xzf /tmp/verify.tgz -C /var/www/muzmir && chown -R www-data:www-data data/verify data/ministries_to_verify.json && echo -n 'файлов сверки на сервере: ' && ls data/verify | wc -l"

if [ "$MODE" = "apply" ]; then
  echo "=== ПРИМЕНЕНИЕ К БАЗЕ (со снимком базы перед этим) ==="
  mm "mkdir -p data/backups && cp data/muzmir.sqlite data/backups/muzmir-preverify-\$(date +%Y%m%d-%H%M%S).sqlite && php scripts/apply_ministry_verify.php apply"
else
  echo "=== ПРЕДПРОСМОТР (в базу ничего не пишется) ==="
  mm "php scripts/apply_ministry_verify.php"
fi
