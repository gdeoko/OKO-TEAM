#!/bin/bash
# rx.sh <local-script> — выполнить bash-скрипт на проде muzmir.
# Отличие от rexec.sh: уникальное имя временного файла, поэтому параллельные
# вызовы не перетирают друг друга (из-за этого раньше приходил чужой вывод).
set -u
cd /home/user/OKO-TEAM || exit 1
source <(base64 -d secrets.env.b64) 2>/dev/null
B=$(base64 -w0 "$1")
T="/tmp/rx_$$_$RANDOM.sh"
CMD="source /opt/oko-poster/cfg/secrets.env; echo '$B' | base64 -d > $T; sshpass -p \"\$MUZMIR_ROOT_PW\" ssh -o StrictHostKeyChecking=no root@\$MUZMIR_SERVER_IP 'cat > $T && bash $T; rm -f $T' < $T; rm -f $T"
curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 300 \
  -X POST "$OKO_POSTER_URL" -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$CMD")" \
| python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'
