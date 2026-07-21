#!/usr/bin/env bash
# ПОЧАСОВАЯ ПРОВЕРКА ВСЕГО — «мост с проверкой каждый час». Чинит что может, алертит бота
# ТОЛЬКО при проблеме (без спама). Проверяет: git, окружение, очередь, квоту, IG-сессию, диск.
set -o pipefail
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
CA=/root/.ccr/ca-bundle.crt
PROB=""   # накопитель проблем для алерта
ok(){ :; }
bad(){ PROB="$PROB%0A• $1"; }

# 1) git свежий
cd "$REPO" && git checkout -q tappio.app 2>/dev/null && git pull -q origin tappio.app 2>/dev/null || bad "git pull не прошёл"
cd "$FACT"

# 2) окружение
bash setup_env.sh > work/_health_env.log 2>&1
grep -q "ENV READY" work/_health_env.log || bad "окружение не готово (ENV)"

# 3) очередь — держим >=8, иначе генерируем
Q=$(ls scripts/queue/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "${Q:-0}" -lt 8 ] 2>/dev/null; then
  python3 gen_scripts.py topup 12 >/dev/null 2>&1
  Q2=$(ls scripts/queue/*.json 2>/dev/null | wc -l | tr -d ' ')
  [ "${Q2:-0}" -lt 8 ] && bad "очередь не наполняется ($Q2)"
fi

# 4) квота — корректна?
QST=$(python3 quota.py status 2>/dev/null) || bad "quota.py сломан"

# 5) диск
AVAIL=$(df -Pk "$FACT" 2>/dev/null | awk 'NR==2{print $4}')
[ -n "$AVAIL" ] && [ "$AVAIL" -lt 200000 ] 2>/dev/null && bad "мало места на диске (${AVAIL}KB)"

# 6) IG-сессия жива?
vexec(){ local body; body=$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1"); \
  curl -s $([ -f "$CA" ] && echo --cacert "$CA") -m "${2:-120}" -X POST "$OKO_VPS_CTRL_URL/exec" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" -H "Content-Type: application/json" --data-binary "$body" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("stdout",""))' 2>/dev/null; }
IGA=$(vexec "cd /opt/oko-poster && node ig_alive.mjs 2>/dev/null | tail -1" 90)
echo "$IGA" | grep -q ALIVE || bad "IG-сессия мертва — нужен вход в @tappio.pro"

# git-фиксация возможных изменений очереди/флагов
cd "$REPO"; git add -A 2>/dev/null; git commit -q -m "health: автопроверка $(date -u +%H:%M)" 2>/dev/null
for i in 1 2 3; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done
cd "$FACT"

# итог
if [ -n "$PROB" ]; then
  MSG="<b>⚠️ TAPPIO health — есть проблемы</b>$PROB%0A%0A<i>$QST · очередь=$Q · IG=$(echo $IGA|tr -d '\n')</i>"
  curl -s --cacert $CA -m 20 "https://api.telegram.org/bot$TAPPIO_ANALYTICS_BOT_TOKEN/sendMessage" \
    --data-urlencode "chat_id=${TAPPIO_ANALYTICS_CHAT_ID:-1966985736}" -d "text=$MSG" -d "parse_mode=HTML" >/dev/null 2>&1
  echo "HEALTH PROBLEMS:$PROB"
else
  echo "HEALTH OK | $QST | очередь=$Q | IG=$(echo $IGA|tr -d '\n')"
fi
