#!/usr/bin/env bash
# V.CODE daily autopilot — ОДНА команда: setup + сборка + доставка + реестры + push.
# Идемпотентно (1 ролик/день), headless-safe, с ретраями и таймаутами. Лог: vcode/daily/last_run.log
set -uo pipefail
ROOT=/home/user/OKO-TEAM
SKILL=$ROOT/.claude/skills/reels-machine
PIPE=$SKILL/pipeline
DAILY=$ROOT/vcode/daily
LOG=$DAILY/last_run.log
DATE=$(date -u +%Y-%m-%d)
exec > >(tee "$LOG") 2>&1
echo "=== AUTOPILOT $DATE $(date -u +%H:%M:%S)Z ==="

step(){ echo; echo "--- $* ---"; }
fail(){ echo "AUTOPILOT_FAIL: $*"; exit 1; }

# 0) секреты — надёжно: из b64 (стабильные ключи) + токен бота из окружения сессии (bootstrap),
#    с САМО-ФИКСАЦИЕЙ токена в b64 при первом же успешном появлении (дальше — офлайн, детерминированно).
step "secrets"
capture_env_token(){ bash -lc 'printf "%s" "${VCODE_MEDIA_BOT_TOKEN:-}"' 2>/dev/null; }
base64 -d "$ROOT/secrets.env.b64" > /tmp/vcode_secrets.env 2>/dev/null || fail "secrets decode"
set -a; . /tmp/vcode_secrets.env; set +a; rm -f /tmp/vcode_secrets.env
# токен мог прийти из окружения текущего/логин-шелла (bootstrap сессии)
[ -z "${VCODE_MEDIA_BOT_TOKEN:-}" ] && export VCODE_MEDIA_BOT_TOKEN="$(capture_env_token)"
export VCODE_ADMIN_IDS="${VCODE_ADMIN_IDS:-353975080,1966985736}"
# если токен есть и его ещё нет в b64 — сохранить навсегда
if [ -n "${VCODE_MEDIA_BOT_TOKEN:-}" ] && ! base64 -d "$ROOT/secrets.env.b64" 2>/dev/null | grep -q VCODE_MEDIA_BOT_TOKEN; then
  base64 -d "$ROOT/secrets.env.b64" > /tmp/se.env 2>/dev/null
  echo "export VCODE_MEDIA_BOT_TOKEN=${VCODE_MEDIA_BOT_TOKEN}" >> /tmp/se.env
  echo "export VCODE_ADMIN_IDS=${VCODE_ADMIN_IDS}" >> /tmp/se.env
  cp /tmp/se.env "$ROOT/secrets.env" 2>/dev/null || true
  base64 -w0 /tmp/se.env > "$ROOT/secrets.env.b64"; rm -f /tmp/se.env
  echo "VCODE токен зафиксирован в secrets.env.b64 (детерминированно на будущее)"
fi
: "${PEXELS_API_KEY:?}"  # для сборки достаточно PEXELS/FREESOUND из b64; токен нужен только на доставке

# 1) git sync (безопасно, без деструктивных reset -B)
step "git sync V.Code"
cd "$ROOT" || fail cd
for i in 1 2 3 4; do git fetch -q origin V.Code && break || sleep $((2**i)); done
git rev-parse --abbrev-ref HEAD 2>/dev/null | grep -qx V.Code || git checkout V.Code 2>/dev/null || git checkout -t origin/V.Code 2>/dev/null || true
git merge -q --ff-only origin/V.Code 2>/dev/null || echo "note: ff-merge пропущен (локальные изменения есть) — продолжаю на локальном дереве"

# idempotent: уже собран сегодня?
LAST=$(python3 -c "import json,os;p='$DAILY/state.json';print(json.load(open(p)).get('last_date','') if os.path.exists(p) else '')" 2>/dev/null)
if [ "$LAST" = "$DATE" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "AUTOPILOT_SKIP: уже собран сегодня ($DATE). FORCE=1 для повтора."; exit 0
fi

# 2) окружение (идемпотентно)
step "env setup"
cat /root/.ccr/ca-bundle.crt >> "$(python3 -m certifi)" 2>/dev/null || true
python3 -c "import torch,PIL,numpy" 2>/dev/null || pip3 install -q edge-tts rembg onnxruntime pillow numpy certifi fonttools torch 2>&1 | tail -1
cd "$SKILL" || fail cd-skill
[ -f package.json ] || echo '{"name":"rm","private":true}' > package.json
if [ ! -d node_modules/playwright ] || [ ! -d node_modules/gl-transitions ] || [ ! -d node_modules/three ]; then
  for i in 1 2 3; do npm i --no-audit --no-fund playwright three gl-transitions lottie-web 2>&1 | tail -2 && break || sleep $((5*i)); done
fi
# шрифты в cwd конвейера
mkdir -p "$PIPE/fonts"
cp -f "$SKILL/fonts/soyuz.ttf" "$PIPE/fonts/soyuz.ttf" 2>/dev/null
for src in montserrat-v31-cyrillic_latin-900.ttf montserrat-900.ttf; do
  [ -f "$SKILL/fonts/$src" ] && { cp -f "$SKILL/fonts/$src" "$PIPE/fonts/MontserratBlack.ttf"; cp -f "$SKILL/fonts/$src" "$PIPE/fonts/golos-text-v7-cyrillic_latin-900.ttf"; break; }
done
for src in manrope-v20-cyrillic_latin-800.ttf manrope-800.ttf; do
  [ -f "$SKILL/fonts/$src" ] && cp -f "$SKILL/fonts/$src" "$PIPE/fonts/manrope-v20-cyrillic_latin-800.ttf" && break
done
mkdir -p ~/.fonts; cp -f "$SKILL/fonts/soyuz.ttf" ~/.fonts/ 2>/dev/null; fc-cache -f >/dev/null 2>&1 || true
cd "$PIPE" || fail cd-pipe
cp -f motion/fx_page.html fx_page.html
ln -sfn three/three3d three3d
mkdir -p models
[ -s models/v4_ru.pt ] || curl -sL --cacert /root/.ccr/ca-bundle.crt -o models/v4_ru.pt https://models.silero.ai/models/tts/ru/v4_ru.pt
export RM_NODE_MODULES="$SKILL/node_modules" RM_CHROMIUM=/opt/pw-browsers/chromium PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
[ -x /opt/pw-browsers/chromium ] || fail "chromium missing"

# 3) выбрать тему
step "pick spec"
PICK=$(python3 "$DAILY/pick_spec.py") || fail "pick_spec"
SPECID=$(echo "$PICK" | awk '{print $1}'); N=$(echo "$PICK" | awk '{print $2}'); LOWQ=$(echo "$PICK" | awk '{print $3}')
echo "spec=$SPECID  n=$N  queue=$LOWQ"
DAY="auto/$DATE"

# 4) сборка (таймаут 20 мин)
step "build (build_one.py)"
timeout 1200 python3 "$DAILY/build_one.py" "$DAILY/current_spec.json" "$DAY" "$N" "$DAILY/used_ids.json" || fail "build (см. лог)"
[ -s "$PIPE/$DAY/reel.mp4" ] || fail "reel.mp4 не создан"
SZ=$(stat -c%s "$PIPE/$DAY/reel.mp4"); echo "reel size $((SZ/1024/1024))MB"
[ "$SZ" -lt 52428800 ] || fail "reel > 50MB (лимит бота)"

# 5) доставка (токен нужен именно здесь; ролик уже собран и сохранён)
step "deliver to bot"
[ -z "${VCODE_MEDIA_BOT_TOKEN:-}" ] && export VCODE_MEDIA_BOT_TOKEN="$(capture_env_token)"
if [ -z "${VCODE_MEDIA_BOT_TOKEN:-}" ]; then
  echo "AUTOPILOT_FAIL_DELIVERY: нет VCODE_MEDIA_BOT_TOKEN (bootstrap окружения не отдал токен)."
  echo "Ролик СОБРАН и готов: $PIPE/$DAY/reel.mp4 — доставить повтором, когда токен доступен: FORCE=1 bash vcode/daily/autopilot.sh"
  exit 2
fi
NOTE=""; [ "$LOWQ" = "LOW" ] && NOTE="Очередь тем на исходе — пополнить банк vcode/daily/queue.json."
python3 "$DAILY/deliver.py" "$PIPE/$DAY" "$NOTE" || fail "deliver"

# 6) реестры + state
step "registers"
python3 "$DAILY/register.py" "$PIPE/$DAY" "$SPECID" "$DATE" || echo "WARN: register failed"

# 7) превью для чата (сжатое, <30МБ)
ffmpeg -y -v error -i "$PIPE/$DAY/reel.mp4" -vf scale=720:1280 -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k -movflags +faststart "$PIPE/$DAY/reel_preview.mp4" 2>/dev/null || true

# 8) commit + push
step "commit + push"
cd "$ROOT"
git add "$DAILY/state.json" "$DAILY/used_ids.json" \
  "$SKILL/reference/USED_FOOTAGE.md" "$SKILL/reference/USED_ANIM.md" \
  "$PIPE/$DAY/clips_manifest.json" "$PIPE/$DAY/POST.txt" 2>/dev/null
git commit -q -m "V.CODE автопилот: ролик дня $DATE ($SPECID) — собран и доставлен в бот" 2>&1 | tail -1
for i in 1 2 3 4; do git push -u origin V.Code 2>&1 | tail -1 && break || sleep $((2**i)); done

echo; echo "AUTOPILOT_OK $DATE $SPECID  preview=$PIPE/$DAY/reel_preview.mp4"
