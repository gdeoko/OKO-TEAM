#!/bin/bash
# Заливка файлов сайта на прод (176.124.200.169:/var/www/muzmir) через мост vexec.
# Файл идёт кусками base64 — целиком не влезает в одну команду.
# Использование: push.sh core/launch_run.php admin/launch.php ...
set -u
cd /home/user/OKO-TEAM || exit 1
source <(base64 -d secrets.env.b64) 2>/dev/null

vexec() {
  curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 180 \
    -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'
}

for REL in "$@"; do
  SRC="/home/user/OKO-TEAM/muzmir-site/$REL"
  [ -f "$SRC" ] || { echo "НЕТ ФАЙЛА: $SRC"; continue; }
  MD5L=$(md5sum "$SRC" | cut -d' ' -f1)
  B64=$(base64 -w0 "$SRC")
  TMP="/tmp/push_$(echo "$REL" | tr '/.' '__').b64"
  vexec "rm -f $TMP" >/dev/null
  n=0
  while [ -n "$B64" ]; do
    CH=${B64:0:30000}
    B64=${B64:30000}
    vexec "printf '%s' '$CH' >> $TMP" >/dev/null
    n=$((n+1))
  done
  OUT=$(vexec "source /opt/oko-poster/cfg/secrets.env; base64 -d $TMP > /tmp/push_file && sshpass -p \"\$MUZMIR_ROOT_PW\" ssh -o StrictHostKeyChecking=no root@\$MUZMIR_SERVER_IP 'cat > /var/www/muzmir/$REL && chown www-data:www-data /var/www/muzmir/$REL && php -l /var/www/muzmir/$REL && md5sum /var/www/muzmir/$REL' < /tmp/push_file; rm -f $TMP /tmp/push_file")
  echo "--- $REL (кусков: $n)"
  echo "$OUT" | grep -v '^$'
  echo "локальный md5: $MD5L"
done
