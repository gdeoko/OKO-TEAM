#!/usr/bin/env bash
# Генерация картинки через Gemini API (nano banana).
# Использование: gen-image.sh "промпт" [выходной_файл.png]
set -euo pipefail

PROMPT="${1:?Нужен промпт первым аргументом}"
OUT="${2:-gemini-image.png}"
: "${GEMINI_API_KEY:?GEMINI_API_KEY не задан — добавь его в Environment variables окружения}"

RESP="$(mktemp)"
curl -sS --max-time 120 \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent" \
  -H 'Content-Type: application/json' \
  -H "X-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -d "$(python3 -c 'import json,sys; print(json.dumps({
    "contents":[{"parts":[{"text":sys.argv[1]}]}],
    "generationConfig":{"responseModalities":["IMAGE"]}
  }))' "$PROMPT")" > "$RESP"

python3 - "$RESP" "$OUT" <<'PY'
import json, base64, sys
resp, out = sys.argv[1], sys.argv[2]
d = json.load(open(resp))
if 'error' in d:
    sys.exit(f"Gemini API error {d['error'].get('code')}: {d['error'].get('message','')[:300]}")
for p in d['candidates'][0]['content']['parts']:
    if 'inlineData' in p:
        open(out, 'wb').write(base64.b64decode(p['inlineData']['data']))
        print(f"OK: {out} ({p['inlineData']['mimeType']})")
        break
else:
    sys.exit("В ответе нет картинки: " + json.dumps(d)[:300])
PY
rm -f "$RESP"
