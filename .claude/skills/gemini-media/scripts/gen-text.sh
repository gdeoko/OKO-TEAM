#!/usr/bin/env bash
# Быстрый текстовый запрос к Gemini (бесплатный тариф).
# Использование: gen-text.sh "вопрос"
set -euo pipefail

PROMPT="${1:?Нужен промпт первым аргументом}"
: "${GEMINI_API_KEY:?GEMINI_API_KEY не задан — добавь его в Environment variables окружения}"

curl -sS --max-time 60 \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent" \
  -H 'Content-Type: application/json' \
  -H "X-goog-api-key: $GEMINI_API_KEY" \
  -X POST \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"contents":[{"parts":[{"text":sys.argv[1]}]}]}))' "$PROMPT")" \
| python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'error' in d:
    sys.exit(f\"Gemini API error {d['error'].get('code')}: {d['error'].get('message','')[:300]}\")
print(''.join(p.get('text','') for p in d['candidates'][0]['content']['parts']))
"
