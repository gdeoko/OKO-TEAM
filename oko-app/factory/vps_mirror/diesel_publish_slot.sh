#!/bin/bash
# DIESEL слот-публикатор: 1 ролик за слот через post_direct (обход зависающего publish_next).
# Слоты в cron ≥1.5ч друг от друга. Дневной лимит = 2*target_per_batch (рамп). Пачки чередуются.
cd /opt/oko-poster || exit 0
set -a; . cfg/post_creds.env 2>/dev/null; . cfg/secrets.env 2>/dev/null; set +a
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
LOG=logs/diesel_slot.log
# самолечение: до-публикуем TikTok прошлых слотов, где Hooppy отдал пусто
python3 tiktok_sweep.py >> "$LOG" 2>&1 || true
python3 - >> "$LOG" 2>&1 <<'PY'
import json,os,glob,subprocess,datetime
now=datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")
today=datetime.datetime.utcnow().strftime("%Y-%m-%d")
rs=json.load(open("cfg/ramp_state.json"))
if rs.get("date")!=today:
    rs.update(date=today, posted_A=0, posted_B=0); json.dump(rs,open("cfg/ramp_state.json","w"))
tgt=int(rs.get("target_per_batch",5))
posted=int(rs.get("posted_A",0))+int(rs.get("posted_B",0))
if posted>=2*tgt:
    print(now,"slot: дневной лимит",posted,"/",2*tgt); raise SystemExit
q=sorted(d for d in glob.glob("queue/*") if os.path.basename(d).isdigit()
         and os.path.exists(d+"/meta.json") and os.path.exists(d+"/reel.mp4"))
if not q:
    print(now,"slot: очередь пуста"); raise SystemExit
# выбрать элемент пачки, у которой дневной лимит ещё не выбран (чередование)
pick=None; pb=None
for d in q:
    b=str(json.load(open(d+"/meta.json")).get("batch","A")).upper()
    if int(rs.get(f"posted_{b}",0))<tgt: pick=os.path.basename(d); pb=b; break
if not pick:
    print(now,"slot: обе пачки выбрали лимит"); raise SystemExit
r=subprocess.run(["python3","post_direct.py",pick],capture_output=True,text=True,timeout=560)
out=(r.stdout or "").strip().replace("\n"," | ")
print(now,"post_direct",pick,"batch",pb,"::",out[-320:])
if "MOVED" in (r.stdout or ""):
    rs=json.load(open("cfg/ramp_state.json"))
    rs[f"posted_{pb}"]=int(rs.get(f"posted_{pb}",0))+1
    json.dump(rs,open("cfg/ramp_state.json","w"))
    print(now,"ramp++",pb,"->",rs[f"posted_{pb}"])
PY
