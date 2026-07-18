#!/usr/bin/env bash
# Детерминированный автопрогон ОДНОГО ролика: сборка -> коммит -> git-raw доставка ->
# публикация TikTok+YouTube+Instagram -> отчёт в бот -> реестры. Каждый шаг с таймаутом,
# best-effort (сбой шага не роняет весь прогон). Обложка — HTML (надёжно, без коннекторов/квот).
# Использование: bash auto_run.sh <id> "<caption>" "<yt_title>"
set -o pipefail   # без -e/-u: сбой одного шага не должен ронять весь автопрогон
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
ID="${1:?need id}"; CAP="${2:-Check the room before you relax. Comment PRIVACY for the app.}"; YTTITLE="${3:-Hidden camera check #shorts}"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
export CURL_CA=/root/.ccr/ca-bundle.crt
CA=/root/.ccr/ca-bundle.crt
log(){ echo "[auto_run $(date -u +%H:%M:%S 2>/dev/null||echo) ] $*"; }
STATUS=""

# 1) СБОРКА (таймбокс 20 мин)
log "BUILD $ID"
if timeout 1200 bash make_reel4.sh "$ID" > "work/${ID}_auto.log" 2>&1; then
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "output/$ID.mp4" 2>/dev/null || echo 0)
  log "built, dur=$DUR"
else
  log "BUILD FAILED"; tail -5 "work/${ID}_auto.log"; echo "BUILD_FAILED"; exit 2
fi
[ -s "output/$ID.mp4" ] || { log "no output"; exit 2; }
# контроль длины 20-45с: >47 = сценарий слишком длинный, НЕ публиковать (сессия перепишет короче)
DUR_INT=$(printf '%.0f' "$DUR" 2>/dev/null || echo 0)
if [ "$DUR_INT" -gt 47 ] 2>/dev/null; then log "TOO_LONG ${DUR}s (>47) — не публикую"; echo "TOO_LONG $DUR"; exit 3; fi

# 1b) ОБЛОЖКА рила = кадр-0 (наш брендовый дизайн) в JPG для IG
ffmpeg -y -ss 0.06 -i "output/$ID.mp4" -vframes 1 -q:v 2 "output/${ID}_cover.jpg" 2>/dev/null && log "cover jpg готов" || log "cover jpg fail"

# 2) КОММИТ ролика (нужно для git-raw доставки на VPS)
cd "$REPO"
git add "tappio-app/factory/output/$ID.mp4" "tappio-app/factory/output/${ID}_cover.jpg" "tappio-app/factory/scripts/$ID.json" 2>/dev/null
git commit -q -m "auto: ролик $ID (автопрогон)" 2>/dev/null || true
for i in 1 2 3 4; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done
log "pushed reel to tappio.app"
cd "$FACT"

# 3) TikTok (Hooppy)
if timeout 240 python3 vps/hooppy_post_api.py "${HOOPPY_TT_PAGE_TAPPIO:-2350868}" "output/$ID.mp4" "$CAP" > work/${ID}_tt.log 2>&1; then
  grep -q '"id"' work/${ID}_tt.log && { STATUS="$STATUS TikTok:submitted"; log "TikTok submitted"; } || { STATUS="$STATUS TikTok:?"; }
else STATUS="$STATUS TikTok:FAIL"; log "TikTok fail"; fi

# 4) YouTube (API)
if timeout 400 python3 vps/yt_upload.py TAPPIO_YT_CLIENT_ID TAPPIO_YT_CLIENT_SECRET TAPPIO_YT_REFRESH_TOKEN "output/$ID.mp4" "$YTTITLE" "$CAP" "hidden camera,airbnb,privacy,spy camera,travel safety" > work/${ID}_yt.log 2>&1; then
  YT=$(grep -oE 'shorts/[A-Za-z0-9_-]+' work/${ID}_yt.log | head -1)
  [ -n "$YT" ] && { STATUS="$STATUS YouTube:$YT"; log "YouTube $YT"; } || { STATUS="$STATUS YouTube:?"; cat work/${ID}_yt.log|tail -2; }
else STATUS="$STATUS YouTube:FAIL"; log "YouTube fail"; fi

# 5) Instagram (git-raw -> VPS -> stealth reel-постер)
IG="IG:FAIL"
RAW="https://raw.githubusercontent.com/gdeoko/OKO-TEAM/tappio.app/tappio-app/factory/output/$ID.mp4"
RAWCOV="https://raw.githubusercontent.com/gdeoko/OKO-TEAM/tappio.app/tappio-app/factory/output/${ID}_cover.jpg"
# vexec: команду шлём как ПЛЕЙН-строку, JSON-экранирование через python (пуленепробиваемо)
vexec(){ local body; body=$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1"); \
  curl -s $([ -f "$CA" ] && echo --cacert "$CA") -m "${2:-120}" -X POST "$OKO_VPS_CTRL_URL/exec" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" -H "Content-Type: application/json" --data-binary "$body" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("stdout",""))' 2>/dev/null; }
# ЗАЩИТА ОТ ДУБЛЕЙ: если этот id уже публиковали в IG (есть код в реестре) — НЕ постим повторно
ALREADY=$(python3 -c "import json,os;d=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {};print(d.get('$ID',{}).get('ig_code','') or '')" 2>/dev/null)
if [ -n "$ALREADY" ]; then
  IG="IG:already($ALREADY)"; log "IG уже публиковали ($ALREADY) — пропуск, дубль не создаём"
  STATUS="$STATUS $IG"
else
# git-raw на GitHub CDN обновляется не мгновенно после push — ретраим до 6 раз
DL=0
for att in 1 2 3 4 5 6; do
  DL=$(vexec "curl -s -o /opt/oko-poster/cfg/$ID.mp4 '$RAW'; wc -c < /opt/oko-poster/cfg/$ID.mp4" 200 | tr -d ' \n')
  [ "${DL:-0}" -gt 500000 ] 2>/dev/null && { log "git-raw ready ($DL) att=$att"; break; }
  log "git-raw not ready att=$att (dl=$DL), ждём 15с"; sleep 15
done
if [ "${DL:-0}" -gt 500000 ] 2>/dev/null; then
  # обложку тянем тем же git-raw (best-effort — если не дойдёт, постер сам возьмёт кадр 0 ползунком)
  COVDL=$(vexec "curl -s -o /opt/oko-poster/cfg/${ID}_cover.jpg '$RAWCOV'; wc -c < /opt/oko-poster/cfg/${ID}_cover.jpg" 60 | tr -d ' \n')
  log "cover dl=$COVDL"
  CAPB64=$(printf '%s' "$CAP" | base64 -w0)
  RES=$(vexec "cd /opt/oko-poster && CAPB64=$CAPB64 IG_TAG=auto IG_COVER=/opt/oko-poster/cfg/${ID}_cover.jpg IG_VIDEO=/opt/oko-poster/cfg/$ID.mp4 timeout 300 node ig_reel_state.mjs 2>&1 | tail -4" 340)
  echo "$RES" | grep -q "SHARED confirmed\|LIKELY_SHARED" && IG="IG:posted" || IG="IG:check($(echo "$RES"|tail -1))"
  log "IG $IG"
else log "IG delivery failed (dl=$DL)"; fi
STATUS="$STATUS $IG"
# САМОПРОВЕРКА + захват кода: считываем ленту, пишем shortcode нового рила в реестр (для дедупа/удаления)
if [ "$IG" = "IG:posted" ]; then
  NEWCODE=$(vexec "cd /opt/oko-poster && IG_N=1 node ig_list.mjs 2>/dev/null" 120 | python3 -c 'import sys,json
try: a=json.load(sys.stdin); print(a[0]["code"] if a else "")
except: print("")' 2>/dev/null)
  python3 - "$ID" "$NEWCODE" <<'PY' 2>/dev/null
import json,sys,os
reg="posted_reels.json"; d={}
if os.path.exists(reg):
    try: d=json.load(open(reg))
    except Exception: d={}
rid,code=sys.argv[1],(sys.argv[2] if len(sys.argv)>2 else "")
e=d.get(rid,{}); e["ig_code"]=code or e.get("ig_code",""); d[rid]=e
json.dump(d,open(reg,"w"),ensure_ascii=False,indent=1)
print("registry",rid,code)
PY
  log "IG code записан: ${NEWCODE:-?}"
fi
fi   # конец блока ЗАЩИТЫ ОТ ДУБЛЕЙ

# 6) ОТЧЁТ в бот
CHAT="${TAPPIO_ANALYTICS_CHAT_ID:-1966985736}"
MSG="<b>TAPPIO · автопрогон ✅</b>%0A🎬 $ID ($DUR c)%0A$STATUS%0A%0A<i>Собрано и опубликовано автоматически.</i>"
curl -s --cacert $CA -m 25 "https://api.telegram.org/bot$TAPPIO_ANALYTICS_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$CHAT" -d "text=$MSG" -d "parse_mode=HTML" -d "disable_web_page_preview=true" >/dev/null 2>&1 && log "report sent"

# 7) РЕЕСТРЫ (footage ids) + коммит
grep -oE "shot_[0-9]+ <- .* id [0-9]+" "work/${ID}_auto.log" 2>/dev/null | while read -r line; do
  vid=$(echo "$line" | grep -oE 'id [0-9]+' | grep -oE '[0-9]+')
  echo "| $vid | pexels | auto | $(date +%F 2>/dev/null) | $ID |" >> "$REPO/.claude/skills/oko-content-factory/reference/USED_FOOTAGE.md"
done
cd "$REPO"
git add .claude/skills/oko-content-factory/reference/USED_FOOTAGE.md tappio-app/factory/posted_reels.json 2>/dev/null
git commit -q -m "auto: реестр footage+posted $ID" 2>/dev/null || true
for i in 1 2 3; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done

log "DONE $ID | $STATUS"
echo "AUTO_DONE $ID |$STATUS"
