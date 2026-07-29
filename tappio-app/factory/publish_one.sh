#!/usr/bin/env bash
# Публикация ОДНОГО готового ролика (уже собранного) во все площадки.
# Ролик должен быть в output/$ID.mp4 (локально или в git).
# Использование: bash publish_one.sh <id> "<caption>" "<yt_title>"
set -o pipefail
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
ID="${1:?need id}"; CAP="${2:-Check the room before you relax. Comment PRIVACY for the app.}"; YTTITLE="${3:-Hidden camera check #shorts}"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
export CURL_CA=/root/.ccr/ca-bundle.crt
CA=/root/.ccr/ca-bundle.crt
log(){ echo "[publish $(date -u +%H:%M:%S)] $*"; }
STATUS=""

# файл может отсутствовать локально (контейнер пересоздан) — достаём из git
if [ ! -s "output/$ID.mp4" ]; then
  cd "$REPO"; git fetch -q origin tappio.app 2>/dev/null
  git checkout origin/tappio.app -- "tappio-app/factory/output/$ID.mp4" 2>/dev/null
  git checkout origin/tappio.app -- "tappio-app/factory/output/${ID}_cover.jpg" 2>/dev/null
  git checkout origin/tappio.app -- "tappio-app/factory/scripts/$ID.json" 2>/dev/null
  cd "$FACT"
fi
[ -s "output/$ID.mp4" ] || { log "NO FILE output/$ID.mp4 — не могу опубликовать"; echo "PUBLISH_FAIL $ID no_file"; exit 2; }

# 1) КОММИТ + PUSH (для git-raw доставки на VPS; может быть уже запушен — ok)
cd "$REPO"
git add "tappio-app/factory/output/$ID.mp4" "tappio-app/factory/output/${ID}_cover.jpg" "tappio-app/factory/scripts/$ID.json" 2>/dev/null
git commit -q -m "auto: ролик $ID" 2>/dev/null || true
for i in 1 2 3 4; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done
log "pushed"
cd "$FACT"

# ЗАЩИТА ОТ ДУБЛЕЙ
YT_DONE=$(python3 -c "import json,os;d=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {};print(d.get('$ID',{}).get('yt_id','') or '')" 2>/dev/null)
TT_DONE=$(python3 -c "import json,os;d=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {};print(d.get('$ID',{}).get('tt_id','') or '')" 2>/dev/null)

# 2) TikTok
if [ -n "$TT_DONE" ]; then STATUS="$STATUS TikTok:already"; log "TikTok уже ($TT_DONE)"
elif timeout 240 python3 vps/hooppy_post_api.py "${HOOPPY_TT_PAGE_TAPPIO:-2350868}" "output/$ID.mp4" "$CAP" > work/${ID}_tt.log 2>&1; then
  TTID=$(grep -oE '"id"[: ]+"?[0-9]+' work/${ID}_tt.log | grep -oE '[0-9]+' | head -1)
  if [ -n "$TTID" ]; then STATUS="$STATUS TikTok:submitted"; log "TikTok submitted"
    python3 -c "import json,os;p='posted_reels.json';d=json.load(open(p)) if os.path.exists(p) else {};e=d.get('$ID',{});e['tt_id']='$TTID';e.setdefault('app','$ID'.replace('g','',1).split('_')[0]);d['$ID']=e;json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)" 2>/dev/null
  else STATUS="$STATUS TikTok:?"; fi
else STATUS="$STATUS TikTok:FAIL"; log "TikTok fail"; fi

# 3) YouTube
if [ -n "$YT_DONE" ]; then
  STATUS="$STATUS YouTube:already(shorts/$YT_DONE)"; log "YouTube уже ($YT_DONE)"
elif timeout 400 python3 vps/yt_upload.py TAPPIO_YT_CLIENT_ID TAPPIO_YT_CLIENT_SECRET TAPPIO_YT_REFRESH_TOKEN "output/$ID.mp4" "$YTTITLE" "$CAP" "hidden camera,airbnb,privacy,spy camera,travel safety" "output/${ID}_cover.jpg" > work/${ID}_yt.log 2>&1; then
  YT=$(grep -oE 'shorts/[A-Za-z0-9_-]+' work/${ID}_yt.log | head -1)
  if [ -n "$YT" ]; then STATUS="$STATUS YouTube:$YT"; log "YouTube $YT"
    grep -q "thumb set OK" work/${ID}_yt.log || python3 -c "import json,os;p='analysis/pending_thumbs.json';os.makedirs('analysis',exist_ok=True);l=json.load(open(p)) if os.path.exists(p) else [];l=sorted(set(l+['$ID']));json.dump(l,open(p,'w'))" 2>/dev/null
    YID=$(echo "$YT" | sed 's#shorts/##')
    python3 - "$ID" "$YID" <<'PY' 2>/dev/null
import json,sys,os
reg="posted_reels.json"; d={}
if os.path.exists(reg):
    try: d=json.load(open(reg))
    except Exception: d={}
rid,yid=sys.argv[1],sys.argv[2]
e=d.get(rid,{}); e["yt_id"]=yid; e.setdefault("app", rid.replace("g","",1).split("_")[0]); d[rid]=e
json.dump(d,open(reg,"w"),ensure_ascii=False,indent=1)
PY
  else STATUS="$STATUS YouTube:?"; fi
else STATUS="$STATUS YouTube:FAIL"; log "YouTube fail"; fi

# 4) Instagram
IG="IG:FAIL"
if [ -f ig_hold.flag ] || [ -f analysis/ig_hold.flag ]; then
  IG="IG:on_hold"; STATUS="$STATUS $IG"
else
RAW="https://raw.githubusercontent.com/gdeoko/OKO-TEAM/tappio.app/tappio-app/factory/output/$ID.mp4"
RAWCOV="https://raw.githubusercontent.com/gdeoko/OKO-TEAM/tappio.app/tappio-app/factory/output/${ID}_cover.jpg"
vexec(){ local body; body=$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1"); \
  curl -s $([ -f "$CA" ] && echo --cacert "$CA") -m "${2:-120}" -X POST "$OKO_VPS_CTRL_URL/exec" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" -H "Content-Type: application/json" --data-binary "$body" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("stdout",""))' 2>/dev/null; }
ALREADY=$(python3 -c "import json,os;d=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {};print(d.get('$ID',{}).get('ig_code','') or '')" 2>/dev/null)
if [ -n "$ALREADY" ]; then
  IG="IG:already($ALREADY)"; STATUS="$STATUS $IG"
else
IGPROBE=$(vexec "cd /opt/oko-poster && node ig_alive.mjs 2>/dev/null" 70)
if ! echo "$IGPROBE" | grep -q 'ALIVE'; then
  IG="IG:session_expired"; STATUS="$STATUS $IG"
else
DL=0
for att in 1 2 3 4 5 6; do
  DL=$(vexec "curl -s -o /opt/oko-poster/cfg/$ID.mp4 '$RAW'; wc -c < /opt/oko-poster/cfg/$ID.mp4" 200 | tr -d ' \n')
  [ "${DL:-0}" -gt 500000 ] 2>/dev/null && break
  sleep 15
done
if [ "${DL:-0}" -gt 500000 ] 2>/dev/null; then
  COVDL=$(vexec "curl -s -o /opt/oko-poster/cfg/${ID}_cover.jpg '$RAWCOV'; wc -c < /opt/oko-poster/cfg/${ID}_cover.jpg" 60 | tr -d ' \n')
  CAPB64=$(printf '%s' "$CAP" | base64 -w0)
  RES=$(vexec "cd /opt/oko-poster && CAPB64=$CAPB64 IG_TAG=auto IG_COVER=/opt/oko-poster/cfg/${ID}_cover.jpg IG_VIDEO=/opt/oko-poster/cfg/$ID.mp4 timeout 300 node ig_reel_state.mjs 2>&1 | tail -4" 340)
  echo "$RES" | grep -q "SHARED confirmed\|LIKELY_SHARED" && IG="IG:posted" || IG="IG:check($(echo "$RES"|tail -1))"
fi
STATUS="$STATUS $IG"
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
PY
fi
fi
fi
fi

# 5) ОТЧЁТ
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "output/$ID.mp4" 2>/dev/null || echo "?")
CHAT="${TAPPIO_ANALYTICS_CHAT_ID:-1966985736}"
MSG="<b>TAPPIO · публикация ✅</b>%0A🎬 $ID ($DUR c)%0A$STATUS%0A%0A<i>Опубликовано по расписанию.</i>"
curl -s --cacert $CA -m 25 "https://api.telegram.org/bot$TAPPIO_ANALYTICS_BOT_TOKEN/sendMessage" \
  --data-urlencode "chat_id=$CHAT" -d "text=$MSG" -d "parse_mode=HTML" -d "disable_web_page_preview=true" >/dev/null 2>&1 && log "report sent"

# 6) РЕЕСТРЫ + коммит
cd "$REPO"
git add tappio-app/factory/posted_reels.json tappio-app/factory/analysis/pending_thumbs.json 2>/dev/null
git commit -q -m "auto: published $ID" 2>/dev/null || true
for i in 1 2 3; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done

log "DONE $ID | $STATUS"
echo "PUBLISHED $ID |$STATUS"
