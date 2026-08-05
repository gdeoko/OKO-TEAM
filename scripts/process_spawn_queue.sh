#!/usr/bin/env bash
# Читает /opt/oko-agents/data_runtime/bridge.db → spawn_queue → выводит
# JSON-массив pending заявок для последующей обработки в Claude Code сессии
# через CCR MCP create_trigger.
# Использование: process_spawn_queue.sh [limit]
set -euo pipefail
: "${OKO_POSTER_URL:?}"
: "${OKO_POSTER_TOKEN:?}"

LIMIT="${1:-10}"

curl -s --max-time 30 -X POST "$OKO_POSTER_URL" \
  -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c "import json;print(json.dumps({'cmd':'cd /opt/oko-agents && .venv/bin/python -c \"from core import claude_bridge as cb; import json; print(json.dumps(cb.pending_spawns($LIMIT), ensure_ascii=False))\"'}))")" \
  | python3 -c "import sys,json
try: d=json.load(sys.stdin)
except: d={}
print(d.get('stdout',''),end='');sys.stderr.write(d.get('stderr',''))"
