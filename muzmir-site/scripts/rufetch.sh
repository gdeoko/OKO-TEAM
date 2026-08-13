#!/bin/bash
# ЧИТАЛКА РОССИЙСКИХ САЙТОВ ИЗ ПЕСОЧНИЦЫ.
#
# Сайты ведомств почти поголовно закрыты для зарубежных IP: WebFetch получает
# 503, курл из контейнера — обрыв соединения. Поэтому страница берётся курлом с
# российского VPS (бастион OKO) и возвращается сюда уже текстом, без разметки.
#
#   scripts/rufetch.sh https://example.ru/contacts        — текст страницы
#   scripts/rufetch.sh https://example.ru/contacts raw    — исходный HTML
#
# Второй аргумент 'raw' нужен редко: когда ФИО спрятано в атрибутах или в
# JSON-LD, а не в видимом тексте.
set -u
URL="${1:?нужен URL}"
MODE="${2:-text}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null

# Команда для VPS собирается на питоне: в URL бывают кавычки и амперсанды.
REMOTE=$(python3 - "$URL" "$MODE" <<'PY'
import sys, shlex
url, mode = sys.argv[1], sys.argv[2]
curl = ("curl -sL -m 45 --compressed "
        "-A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' "
        "-H 'Accept-Language: ru-RU,ru;q=0.9' "
        f"{shlex.quote(url)}")
if mode == 'raw':
    print(curl)
else:
    # Чистка на самом VPS: тянуть сюда сырой HTML дорого и незачем.
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

for attempt in 1 2 3; do
  OUT=$(curl -s --cacert /root/.ccr/ca-bundle.crt -m 120 -X POST "$OKO_POSTER_URL" \
        -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
        --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$REMOTE")" \
      | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(3)
print(d.get("stdout",""),end="")' )
  # Пустой ответ — сайт мог не пустить с первого раза; повторяем.
  [ -n "${OUT// /}" ] && { printf '%s\n' "$OUT"; exit 0; }
  sleep 3
done
echo "RUFETCH: страница не открылась после 3 попыток — $URL" >&2
exit 1
