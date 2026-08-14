#!/bin/bash
# Чтение страницы с РОССИЙСКОГО VPS (176.124.200.169) через мост oko-poster.
# Нужно для сайтов, которые не пускают IP моста (krao.ru и т.п.).
#   rufetch2.sh https://example.ru/page        — текст
#   rufetch2.sh https://example.ru/page raw    — HTML
set -u
URL="${1:?нужен URL}"
MODE="${2:-text}"
REPO="/home/user/OKO-TEAM"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null

INNER=$(python3 - "$URL" "$MODE" <<'PY'
import sys, shlex
url, mode = sys.argv[1], sys.argv[2]
curl = ("curl -skL -m 45 --compressed "
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
        "print(t.strip()[:60000])\n"
    )
    print(curl + " | python3 -c " + shlex.quote(clean))
PY
)

REMOTE=$(python3 - "$INNER" "$MUZMIR_VPS_ROOT_PASS" <<'PY'
import sys, shlex
inner, pwd = sys.argv[1], sys.argv[2]
print("sshpass -p %s ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "
      "root@176.124.200.169 %s" % (shlex.quote(pwd), shlex.quote(inner)))
PY
)

for attempt in 1 2 3; do
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
echo "RUFETCH2: страница не открылась после 3 попыток — $URL" >&2
exit 1
