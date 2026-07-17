#!/usr/bin/env bash
# Ждёт появления VCODE_MEDIA_BOT_TOKEN из bootstrap-окружения (эндпоинт бывает недоступен),
# как только токен есть — фиксирует его в secrets.env.b64 (навсегда) и доставляет собранный
# ролик за сегодня обоим админам. Разовый добор доставки, когда основной прогон уперся в токен.
#   bash deliver_when_ready.sh [DAY_ABS_DIR] [SPECID] [max_minutes]
set -uo pipefail
ROOT=/home/user/OKO-TEAM; DAILY=$ROOT/vcode/daily
DAY="${1:-$ROOT/.claude/skills/reels-machine/pipeline/auto/$(date -u +%Y-%m-%d)}"
SPECID="${2:-$(python3 -c "import json;print(json.load(open('$DAILY/current_spec.json'))['id'])" 2>/dev/null)}"
MAXMIN="${3:-40}"; DATE=$(date -u +%Y-%m-%d)
[ -s "$DAY/reel.mp4" ] || { echo "нет собранного ролика в $DAY"; exit 1; }
for i in $(seq 1 $MAXMIN); do
  T=$(bash -lc 'printf "%s" "${VCODE_MEDIA_BOT_TOKEN:-}"' 2>/dev/null)
  if [ -n "$T" ]; then
    echo "токен появился (мин $i) — фиксирую и доставляю"
    base64 -d "$ROOT/secrets.env.b64" > /tmp/se.env 2>/dev/null
    grep -qv nomatch /tmp/se.env
    if ! grep -q VCODE_MEDIA_BOT_TOKEN /tmp/se.env; then
      echo "export VCODE_MEDIA_BOT_TOKEN=$T" >> /tmp/se.env
      echo "export VCODE_ADMIN_IDS=353975080,1966985736" >> /tmp/se.env
      cp /tmp/se.env "$ROOT/secrets.env"; base64 -w0 /tmp/se.env > "$ROOT/secrets.env.b64"
      echo "VCODE токен зафиксирован в secrets.env.b64"
    fi
    rm -f /tmp/se.env
    export VCODE_MEDIA_BOT_TOKEN="$T" VCODE_ADMIN_IDS="353975080,1966985736"
    python3 "$DAILY/deliver.py" "$DAY" && {
      python3 "$DAILY/register.py" "$DAY" "$SPECID" "$DATE" 2>/dev/null || true
      echo "DELIVERED_OK $SPECID"; exit 0; }
    echo "доставка не удалась, повтор"
  fi
  sleep 60
done
echo "TOKEN_NEVER_CAME за $MAXMIN мин — ролик готов ($DAY/reel.mp4), доставится следующим прогоном"
exit 2
