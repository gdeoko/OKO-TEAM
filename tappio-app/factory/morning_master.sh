#!/usr/bin/env bash
# УТРЕННИЙ МАСТЕР TAPPIO — одна сессия в 07:00 МСК делает ВСЁ:
# 1) Анализ конкурентов (10 миллионников с транскриптами/раскадровками)
# 2) Сборка ВСЕХ роликов на день (без публикации)
# 3) Выдаёт today_schedule.json — расписание публикаций (сессия создаёт send_later)
#
# Публикации запрограммированы на 10:00, 12:00, 14:00... МСК (каждые 2ч).
# После сборки — тишина весь день, только запланированные публикации.
#
# Использование: bash morning_master.sh
set -o pipefail
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
export CURL_CA=/root/.ccr/ca-bundle.crt
CA=/root/.ccr/ca-bundle.crt
log(){ echo "[morning $(date -u +%H:%M:%S)] $*"; }

# ── ПОДГОТОВКА ──
cd "$REPO" && git checkout -q tappio.app 2>/dev/null && git pull -q origin tappio.app 2>/dev/null; cd "$FACT"
bash setup_env.sh > work/_setup.log 2>&1
grep -q "ENV READY" work/_setup.log || { echo "ENV_NOT_READY"; tail -3 work/_setup.log; exit 1; }

# здоровье
bash health.sh > work/_health.log 2>&1 || true; echo "[health] $(tail -1 work/_health.log)"
# обложки YouTube (самозаживление)
THUMBS=$(python3 retry_thumbs.py 2>/dev/null | tail -1); [ -n "$THUMBS" ] && echo "[thumbs] $THUMBS"

# квота
REMAIN=$(python3 quota.py check 2>/dev/null || echo 0)
QUOTA=$(python3 -c "from quota import quota_for; from datetime import date; print(quota_for(date.today()))" 2>/dev/null || echo 5)
if [ "${REMAIN:-0}" -le 0 ] 2>/dev/null; then echo "QUOTA_DONE ($(python3 quota.py status))"; exit 0; fi
log "квота=$QUOTA осталось=$REMAIN — собираю $REMAIN роликов"

# ── 1) АНАЛИЗ КОНКУРЕНТОВ (10 миллионников, глубокий) ──
log "АНАЛИЗ конкурентов..."
# чистка очереди от уже опубликованных
python3 - <<'PY' 2>/dev/null
import json,os,glob
posted=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {}
pub=set(k for k,e in posted.items() if e.get('yt_id') or e.get('tt_id') or e.get('ig_code'))
for f in glob.glob('scripts/queue/*.json'):
    if os.path.basename(f)[:-5] in pub: os.remove(f)
PY
# дозаливка очереди
python3 gen_scripts.py topup $((REMAIN + 4)) >/dev/null 2>&1 || true

# определяем приложения для сегодняшних роликов (ротация spy->brain->tape)
APPS=$(python3 - "$REMAIN" <<'PY' 2>/dev/null
import glob,os,json,sys
N=int(sys.argv[1])
order=['spy','brain','tape']
posted=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {}
pub=set(k for k,e in posted.items() if e.get('yt_id') or e.get('tt_id') or e.get('ig_code'))
files=sorted(f for f in glob.glob('scripts/queue/*.json') if os.path.basename(f)[:-5] not in pub)
apps=set()
for f in files[:N]:
    b=os.path.basename(f)
    for a in order:
        if b.startswith('g'+a): apps.add(a); break
print(' '.join(apps or order[:1]))
PY
)
# глубокий анализ по каждому приложению (транскрипты + раскадровки)
for APP in $APPS; do
  log "recon_deep $APP..."
  timeout 300 python3 recon_deep.py "$APP" "morning_$(date +%F)_$APP" 10 2>&1 | tail -1 || true
  # обычный recon -> документ в бота + latest_<app>.json для генератора
  timeout 120 python3 recon.py "$APP" 2>&1 | tail -1 || true
done

# ── 2) СБОРКА ВСЕХ РОЛИКОВ ──
log "СБОРКА $REMAIN роликов..."
BUILT_IDS=""
BUILT_N=0
LAST_APP=""

for SEQ in $(seq 1 $REMAIN); do
  # выбрать следующий из очереди (ротация приложений)
  NEXT=$(python3 -c "
import glob,os,json
order=['spy','brain','tape']
last=open('.last_app').read().strip() if os.path.exists('.last_app') else '$LAST_APP'
posted=json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {}
pub=set(k for k,e in posted.items() if e.get('yt_id') or e.get('tt_id') or e.get('ig_code'))
files=sorted(f for f in glob.glob('scripts/queue/*.json') if os.path.basename(f)[:-5] not in pub)
byapp={}
for f in files:
    b=os.path.basename(f)
    for a in order:
        if b.startswith('g'+a): byapp.setdefault(a,[]).append(f); break
start=(order.index(last)+1)%3 if last in order else 0
pick=''
for i in range(3):
    a=order[(start+i)%3]
    if byapp.get(a): pick=byapp[a][0]; break
if not pick and files: pick=files[0]
print(pick)
" 2>/dev/null)

  [ -z "$NEXT" ] && { log "ОЧЕРЕДЬ ПУСТА на шаге $SEQ"; break; }
  ID=$(basename "$NEXT" .json)
  cp "$NEXT" "scripts/$ID.json"
  APP=$(python3 -c "import json;print(json.load(open('scripts/$ID.json')).get('app','spy'))" 2>/dev/null)

  # разведка под ролик + полировка
  timeout 200 python3 recon.py "$APP" brief "$ID" 2>&1 | tail -1 || true
  python3 script_polish.py "scripts/$ID.json" 2>&1 | tail -1 || true

  # СБОРКА
  log "BUILD $SEQ/$REMAIN: $ID ($APP)"
  if timeout 1200 bash make_reel4.sh "$ID" > "work/${ID}_auto.log" 2>&1; then
    DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "output/$ID.mp4" 2>/dev/null || echo 0)
    DUR_INT=$(printf '%.0f' "$DUR" 2>/dev/null || echo 0)
    if [ "$DUR_INT" -gt 47 ] 2>/dev/null; then
      log "TOO_LONG ${DUR}s — пропуск $ID"; continue
    fi
    # QC
    QCLINE=$(python3 qc.py "$ID" 2>/dev/null | tail -1); log "$QCLINE"
    # обложка
    ffmpeg -y -i "output/$ID.mp4" -vf "select=eq(n\,0)" -vframes 1 -q:v 2 "output/${ID}_cover.jpg" 2>/dev/null
    BUILT_IDS="$BUILT_IDS $ID"
    BUILT_N=$((BUILT_N + 1))
    LAST_APP=$(echo "$ID" | sed -E 's/^g?(spy|brain|tape).*/\1/')
    echo "$LAST_APP" > .last_app 2>/dev/null
    # убрать из очереди
    rm -f "$NEXT" 2>/dev/null
    log "BUILT $ID (${DUR}s) — $BUILT_N/$REMAIN done"
  else
    log "BUILD FAILED $ID"; tail -3 "work/${ID}_auto.log"
  fi
done

# коммит всех собранных роликов РАЗОМ
if [ $BUILT_N -gt 0 ]; then
  cd "$REPO"
  for BID in $BUILT_IDS; do
    git add "tappio-app/factory/output/$BID.mp4" "tappio-app/factory/output/${BID}_cover.jpg" "tappio-app/factory/scripts/$BID.json" 2>/dev/null
  done
  git add -A tappio-app/factory/scripts/queue/ 2>/dev/null
  git add .claude/skills/oko-content-factory/reference/USED_FOOTAGE.md 2>/dev/null
  git commit -q -m "morning: собраны $BUILT_N роликов ($BUILT_IDS)" 2>/dev/null || true
  for i in 1 2 3 4; do git push -q origin tappio.app 2>&1 && break || sleep $((2**i)); done
  log "pushed all built reels"
  cd "$FACT"
fi

# ── 3) РАСПИСАНИЕ ПУБЛИКАЦИЙ ──
# первый пост в 10:00 МСК (07:00 UTC), далее каждые 2 часа
python3 - $BUILT_N $BUILT_IDS <<'PYEND' 2>/dev/null
import json, sys, os
from datetime import datetime, timedelta

n = int(sys.argv[1])
ids = sys.argv[2:2+n]
schedule = []
# 10:00 МСК = 07:00 UTC, +2ч каждый
base_h = 7  # UTC
today = datetime.utcnow().strftime("%Y-%m-%d")

for i, rid in enumerate(ids):
    h = base_h + i * 2
    pub_at = f"{today}T{h:02d}:00:00Z"
    # загрузить caption и yt_title из скрипта
    cap = "Check the room before you relax."
    yt = "Hidden camera check #shorts"
    try:
        d = json.load(open(f"scripts/{rid}.json"))
        cap = d.get("caption") or (d.get("cta",{}).get("text","") if isinstance(d.get("cta"),dict) else cap)
        yt = d.get("yt_title", yt)
    except Exception:
        pass
    schedule.append({"id": rid, "caption": cap[:200], "yt_title": yt[:80], "publish_at_utc": pub_at, "slot": i+1})

json.dump(schedule, open("today_schedule.json", "w"), ensure_ascii=False, indent=1)
print(f"SCHEDULE: {len(schedule)} роликов, с {base_h}:00 UTC каждые 2ч")
for s in schedule:
    print(f"  {s['slot']}. {s['id']} -> {s['publish_at_utc']}")
PYEND

log "MORNING DONE: собрано $BUILT_N роликов, расписание в today_schedule.json"
echo "MORNING_DONE built=$BUILT_N ids=$BUILT_IDS"
