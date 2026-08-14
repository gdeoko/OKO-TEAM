#!/bin/bash
# ВЫКЛАДКА ОДНОГО ФАЙЛА НА БОЕВОЙ СЕРВЕР.
#
# Точечно и осознанно: на сервере может работать другая сессия, поэтому целиком
# каталоги не синхронизируем. Перед заменой скрипт сверяет, совпадает ли то, что
# лежит на сервере, с тем, от чего мы отталкивались (git HEAD), и делает копию.
#
#   scripts/push_file.sh core/ministries.php
#   scripts/push_file.sh core/ministries.php force   — заменить, даже если на
#                                                      сервере файл кто-то менял
set -eu
REL="${1:?путь относительно muzmir-site, например core/ministries.php}"
FORCE="${2:-}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$REPO/.." && pwd)"
source <(base64 -d "$ROOT/secrets.env.b64") 2>/dev/null

vexec() {
  curl -s --cacert /root/.ccr/ca-bundle.crt -m 180 -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""),end="");sys.stderr.write(d.get("stderr",""))'
}
mm() {
  vexec "sshpass -p '$MUZMIR_ROOT_PW' ssh -T -o StrictHostKeyChecking=no -o LogLevel=ERROR -o ConnectTimeout=20 root@$MUZMIR_SERVER_IP $(python3 -c 'import shlex,sys;print(shlex.quote("cd /var/www/muzmir && "+sys.argv[1]))' "$1")"
}

BASE=$(cd "$ROOT" && git show "HEAD:muzmir-site/$REL" 2>/dev/null | md5sum | cut -d' ' -f1 || echo none)
NOW=$(mm "md5sum $REL 2>/dev/null | cut -d' ' -f1" | tr -d '\r\n ')
if [ "$NOW" != "$BASE" ] && [ "$FORCE" != "force" ]; then
  echo "СТОП: на сервере $REL отличается от того, от чего мы отталкивались."
  echo "  на сервере: $NOW"
  echo "  ожидали:    $BASE"
  echo "Скорее всего файл правила другая сессия. Разберитесь и запустите с 'force'."
  exit 1
fi

B64=$(base64 -w0 "$REPO/$REL")
vexec "printf %s '$B64' | base64 -d > /tmp/push_one.tmp && md5sum /tmp/push_one.tmp | cut -d' ' -f1"
echo "  ожидали md5: $(md5sum "$REPO/$REL" | cut -d' ' -f1)"
vexec "sshpass -p '$MUZMIR_ROOT_PW' scp -o StrictHostKeyChecking=no -o LogLevel=ERROR /tmp/push_one.tmp root@$MUZMIR_SERVER_IP:/tmp/push_one.tmp >/dev/null && echo доставлен"
mm "cp -p $REL $REL.bak-\$(date +%Y%m%d-%H%M%S) && cp /tmp/push_one.tmp $REL && chown www-data:www-data $REL && php -l $REL"
