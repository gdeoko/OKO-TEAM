#!/bin/bash
# pexec.sh <локальный-скрипт> — выполнить bash НА ХОСТЕ МОСТА (104.171.132.45).
# Отличие от rx.sh: тот уходит дальше, на сервер сайта, а здесь нужен именно
# хост моста — там стоит Chrome, а сайты РФ из облака недоступны.
set -u
cd /home/user/OKO-TEAM || exit 1
. ~/.oko/secrets.env 2>/dev/null
B=$(base64 -w0 "$1")
T="/tmp/px_$$_$RANDOM.sh"
CMD="echo '$B' | base64 -d > $T; bash $T; rm -f $T"
curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 300 \
  -X POST "$OKO_POSTER_URL" -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$CMD")" \
| python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'
