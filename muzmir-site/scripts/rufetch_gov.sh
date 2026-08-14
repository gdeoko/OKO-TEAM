#!/bin/bash
# Читалка через ВТОРОЙ российский сервер (176.124.200.169, Timeweb СПб).
# Госпорталы на «Гостехе» (gov.karelia.ru, mincult.rkomi.ru, mari-el.gov.ru,
# ryazan.gov.ru, samregion.ru) режут IP основного бастиона, а этот сервер
# они пускают. Плюс -k: сертификаты выпущены «Russian Trusted Root CA»,
# которого нет в системном хранилище.
#   rufetch3.sh URL [raw]
set -u
URL="${1:?нужен URL}"
MODE="${2:-text}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null

INNER=$(python3 - "$URL" "$MODE" <<'PY'
import sys, shlex
url, mode = sys.argv[1], sys.argv[2]
curl = ("curl -k -sL -m 50 --compressed "
        "-A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' "
        "-H 'Accept-Language: ru-RU,ru;q=0.9' "
        f"{shlex.quote(url)}")
if mode == 'raw':
    print(curl)
else:
    clean = (
        "import sys,re,html\n"
        "t=sys.stdin.read()\n"
        "t=re.sub(r'<(script|style|noscript|svg)[^>]*>.*?</\\1>',' ',t,flags=re.S|re.I)\n"
        "t=re.sub(r'<!--.*?-->',' ',t,flags=re.S)\n"
        "t=re.sub(r'</(p|div|tr|li|h[1-6]|br)>','\\n',t,flags=re.I)\n"
        "t=re.sub(r'<[^>]+>',' ',t)\n"
        "t=html.unescape(t)\n"
        "t=re.sub(r'[ \\t\\xa0]+',' ',t)\n"
        "t=re.sub(r'\\n\\s*\\n+','\\n',t)\n"
        "sys.stdout.write(t.strip()[:70000])\n"
    )
    print(curl + " | python3 -c " + shlex.quote(clean))
PY
)

# Заворачиваем во внешнюю ssh-команду для моста.
REMOTE=$(python3 - "$INNER" "$MUZMIR_VPS_ROOT_PASS" <<'PY'
import sys, shlex
inner, pw = sys.argv[1], sys.argv[2]
print("sshpass -p %s ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "
      "root@176.124.200.169 %s" % (shlex.quote(pw), shlex.quote(inner)))
PY
)

for attempt in 1 2; do
  OUT=$(curl -s --cacert /root/.ccr/ca-bundle.crt -m 150 -X POST "$OKO_POSTER_URL" \
        -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
        --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$REMOTE")" \
      | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(3)
print(d.get("stdout",""),end="")' )
  [ -n "${OUT// /}" ] && { printf '%s\n' "$OUT"; exit 0; }
  sleep 3
done
echo "RUFETCH3: страница не открылась — $URL" >&2
exit 1
