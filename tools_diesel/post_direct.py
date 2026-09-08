#!/usr/bin/env python3
# Надёжный прямой постер (обход зависающего publish_next). Usage: post_direct.py <NNN>
import shlex, os,sys,json,base64,subprocess
BASE="/opt/oko-poster"; nn=sys.argv[1]
d=f"{BASE}/queue/{nn}"; mp=f"{d}/meta.json"
m=json.load(open(mp)); done=m.setdefault("_done",{})
batch=str(m.get("batch","A")).upper()
BAT={"A":{"yt":"cfg/yt_creds.env","tt":"cfg/tt_diesel_prof","ig":"browser/ig_dsnew","ign":"diesel_cargo_top"},
     "B":{"yt":"cfg/ytnew_b.env","tt":"","ig":"cfg/ig_kitay_profile","ign":"kitay"}}[batch]
# доступы постинга (Hooppy снят с маршрута 07.09.2026, TikTok идёт браузером)
try:
    for _l in open(f"{BASE}/cfg/post_creds.env"):
        _l=_l.strip()
        if _l and "=" in _l and not _l.startswith("#"): _k,_v=_l.split("=",1); _k=_k.strip(); _k=_k[7:].strip() if _k.startswith("export ") else _k; os.environ.setdefault(_k,_v.strip().strip(chr(34)))
except: pass
def run(cmd,to=200,env=None):
    e=dict(os.environ); e.update(env or {})
    try: r=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=to,env=e,cwd=BASE); return r.stdout+r.stderr
    except subprocess.TimeoutExpired: return "TIMEOUT"
open(f"{d}/ytdesc","w").write(m["yt_desc"])
capb64=base64.b64encode(m["caption"].encode()).decode()
# YouTube
if not done.get("youtube"):
    o=run(f'YT_CREDS_FILE={BAT["yt"]} python3 yt_upload.py {d}/reel.mp4 {shlex.quote(m["title"])} {d}/ytdesc {d}/cover.jpg',120)
    vid=next((l.split()[1] for l in o.splitlines() if l.startswith("VIDEO_ID")),"")
    if vid: done["youtube"]=vid; json.dump(m,open(mp,"w"),ensure_ascii=False); print("YT",batch,vid)
    else: print("YT FAIL",o[-150:])
# TikTok
if not done.get("tiktok") and not BAT["tt"]:
    done["tiktok"]="disabled"; json.dump(m,open(mp,"w"),ensure_ascii=False); print("TT disabled for batch",batch)
if not done.get("tiktok"):
    o=run(f'node tt_upload.mjs {d}/reel.mp4 {BASE}/{BAT["tt"]}',900,{"CAPB64":capb64,"DISPLAY":":99"})
    if "RESULT POSTED" in o: done["tiktok"]="posted"; json.dump(m,open(mp,"w"),ensure_ascii=False); print("TT",batch,"posted")
    else: print("TT FAIL",([l for l in o.splitlines() if l.startswith("RESULT")] or [o[-150:]])[-1])
# Instagram (best-effort; checkpoint/ban -> skip)
if not done.get("instagram"):
    o=run(f'CAPB64={capb64} IG_VIDEO={d}/reel.mp4 IG_COVER={d}/cover.jpg IG_PROFILE={BASE}/{BAT["ig"]} PLAYWRIGHT_BROWSERS_PATH={BASE}/pw-browsers PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node ig_reel_post.mjs',185)
    if "SHARED_CONFIRMED" in o: done["instagram"]="SHARED"; json.dump(m,open(mp,"w"),ensure_ascii=False); print("IG",BAT["ign"],"SHARED")
    else: print("IG",BAT["ign"],"skip/fail",[x for x in o.splitlines() if "RESULT" in x or "checkpoint" in x.lower()][-1:])
# Уходит из очереди только то, что дошло ДО ВСЕХ включённых площадок.
# Раньше хватало одного YouTube: ролик уезжал в published, а в TikTok и
# Instagram не попадал уже никогда, потому что из очереди его убирали.
# При этом счётчик считал его опубликованным, и по отчёту всё было хорошо.
нужны=[п for п in ("youtube","tiktok","instagram")
       if not (п=="tiktok" and not BAT["tt"])]
не_дошло=[п for п in нужны if not done.get(п)]
m["_попыток"]=int(m.get("_попыток",0))+1
json.dump(m,open(mp,"w"),ensure_ascii=False)

if not не_дошло:
    os.makedirs(f"{BASE}/published",exist_ok=True); os.rename(d,f"{BASE}/published/{nn}")
    print("MOVED",nn,"batch",batch,"все площадки")
elif not done.get("youtube"):
    # YouTube не взял, значит не взял никто из ключевых: пробуем в следующий слот
    print("KEPT",nn,"попытка",m["_попыток"],"не дошло:",",".join(не_дошло))
elif m["_попыток"] < 3:
    print("KEPT",nn,"попытка",m["_попыток"],"добираю:",",".join(не_дошло))
else:
    # Три слота подряд площадка не берёт. Держать очередь дальше нельзя: голова
    # очереди блокирует всю пачку. Убираем, но НЕ делаем вид, что всё вышло:
    # список недошедших остаётся в meta.json и печатается в журнал слота.
    m["_не_дошло"]=не_дошло
    json.dump(m,open(mp,"w"),ensure_ascii=False)
    os.makedirs(f"{BASE}/published",exist_ok=True); os.rename(d,f"{BASE}/published/{nn}")
    print("MOVED",nn,"batch",batch,"НО НЕ ДОШЛО:",",".join(не_дошло))

