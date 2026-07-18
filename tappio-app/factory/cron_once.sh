#!/usr/bin/env bash
# ОДИН тик автопрогона — детерминированно, без LLM. Триггер-сессия просто вызывает этот скрипт.
# setup -> проверка дневной квоты -> берёт следующий сценарий из scripts/queue/ -> auto_run
# (сборка+публикация 3 соцсети+отчёт) -> quota inc -> убирает сценарий из очереди -> commit.
# Печатает финальную строку: BUILT <id> ... | QUOTA_DONE | QUEUE_EMPTY | FAILED <id>
set -o pipefail
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
export CURL_CA=/root/.ccr/ca-bundle.crt

# свежий код/очередь/квота
cd "$REPO" && git checkout -q tappio.app 2>/dev/null && git pull -q origin tappio.app 2>/dev/null; cd "$FACT"

# среда
bash setup_env.sh > work/_setup.log 2>&1
grep -q "ENV READY" work/_setup.log || { echo "ENV_NOT_READY"; tail -3 work/_setup.log; exit 1; }

# квота
REMAIN=$(python3 quota.py check 2>/dev/null || echo 0)
if [ "${REMAIN:-0}" -le 0 ] 2>/dev/null; then echo "QUOTA_DONE ($(python3 quota.py status))"; exit 0; fi

# автодозаливка очереди (без LLM) — генератор держит >=12 сценариев
python3 gen_scripts.py topup 12 >/dev/null 2>&1 || true

# следующий сценарий из очереди
NEXT=$(ls scripts/queue/*.json 2>/dev/null | sort | head -1)
[ -z "$NEXT" ] && { echo "QUEUE_EMPTY — генератор не дал сценариев (см. gen_scripts.py)"; exit 0; }
ID=$(basename "$NEXT" .json)
cp "$NEXT" "scripts/$ID.json"
CAP=$(python3 -c "import json;d=json.load(open('scripts/$ID.json'));print(d.get('caption') or (d['cta']['text']))" 2>/dev/null)
YT=$(python3 -c "import json;d=json.load(open('scripts/$ID.json'));print(d.get('yt_title','New reel #shorts'))" 2>/dev/null)

# сборка + публикация
OUT=$(bash auto_run.sh "$ID" "$CAP" "$YT" 2>&1 | tail -3)
echo "$OUT"
if echo "$OUT" | grep -q "AUTO_DONE"; then
  python3 quota.py inc >/dev/null 2>&1
  git rm -q "$NEXT" 2>/dev/null; git add -A 2>/dev/null
  git commit -q -m "autopilot: собран+опубликован $ID, снят с очереди" 2>/dev/null
  for i in 1 2 3; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done
  echo "BUILT $ID | остаток очереди: $(ls scripts/queue/*.json 2>/dev/null | wc -l) | квота: $(python3 quota.py status)"
else
  echo "FAILED $ID (см. work/${ID}_auto.log) — сценарий оставлен в очереди"
  exit 2
fi
