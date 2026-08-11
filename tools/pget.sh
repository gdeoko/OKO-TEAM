#!/bin/bash
# pget.sh <удалённый-файл> <локальный> — забрать файл с хоста моста кусками.
set -u
cd /home/user/OKO-TEAM || exit 1
source <(base64 -d secrets.env.b64) 2>/dev/null
vx() {
  curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 120 \
    -X POST "$OKO_POSTER_URL" -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""),end="")'
}
SZ=$(vx "stat -c%s '$1' 2>/dev/null || echo 0" | tr -d '\r\n ')
[ "$SZ" = "0" ] && { echo "файла нет: $1"; exit 1; }
: > "$2.b64"; BLK=0; OFF=0
while [ "$OFF" -lt "$SZ" ]; do
  vx "dd if='$1' bs=45000 skip=$BLK count=1 2>/dev/null | base64 -w0" >> "$2.b64"
  BLK=$((BLK+1)); OFF=$((OFF+45000)); echo -n .
done
echo
python3 - "$2" <<'PY'
import sys,base64,re
p=sys.argv[1]
out=b''
for part in re.findall(r'[A-Za-z0-9+/=]+', open(p+'.b64').read()):
    out+=base64.b64decode(part+'='*(-len(part)%4))
open(p,'wb').write(out); print('получено', len(out), 'байт')
PY
