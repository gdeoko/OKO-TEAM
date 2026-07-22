#!/usr/bin/env python3
# Надёжный прямой постер (обход зависающего publish_next). Usage: post_direct.py <NNN>
import os,sys,json,base64,subprocess
BASE="/opt/oko-poster"; nn=sys.argv[1]
d=f"{BASE}/queue/{nn}"; mp=f"{d}/meta.json"
m=json.load(open(mp)); done=m.setdefault("_done",{})
batch=str(m.get("batch","A")).upper()
BAT={"A":{"yt":"cfg/yt_creds.env","tt":"2350915","ig":"cfg/ig_diesel_profile","ign":"cargo"},
     "B":{"yt":"cfg/ytnew_b.env","tt":"2363201","ig":"cfg/ig_kitay_profile","ign":"kitay"}}[batch]
# load hooppy/tiktok creds
try:
    for _l in open(f"{BASE}/cfg/post_creds.env"):
        _l=_l.strip()
        if _l and "=" in _l and not _l.startswith("#"): _k,_v=_l.split("=",1); os.environ.setdefault(_k,_v.strip().strip(chr(34)))
except: pass
def run(cmd,to=200,env=None):
    e=dict(os.environ); e.update(env or {})
    try: r=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=to,env=e,cwd=BASE); return r.stdout+r.stderr
    except subprocess.TimeoutExpired: return "TIMEOUT"
open(f"{d}/ytdesc","w").write(m["yt_desc"])
capb64=base64.b64encode(m["caption"].encode()).decode()
# YouTube
if not done.get("youtube"):
    o=run(f'YT_CREDS_FILE={BAT["yt"]} python3 yt_upload.py {d}/reel.mp4 {json.dumps(m["title"])} {d}/ytdesc {d}/cover.jpg',120)
    vid=next((l.split()[1] for l in o.splitlines() if l.startswith("VIDEO_ID")),"")
    if vid: done["youtube"]=vid; json.dump(m,open(mp,"w"),ensure_ascii=False); print("YT",batch,vid)
    else: print("YT FAIL",o[-150:])
# TikTok
if not done.get("tiktok"):
    o=run(f'python3 hooppy_post_api.py {BAT["tt"]} {d}/reel.mp4 ""',190,{"CAPB64":capb64})
    tid=next((l.split(":")[-1].strip().rstrip("}") for l in o.splitlines() if '"id"' in l),"")
    if "post:" in o: done["tiktok"]=tid or "ok"; json.dump(m,open(mp,"w"),ensure_ascii=False); print("TT",BAT["tt"],tid)
    else: print("TT FAIL",o[-150:])
# Instagram (best-effort; checkpoint/ban -> skip)
if not done.get("instagram"):
    o=run(f'CAPB64={capb64} IG_VIDEO={d}/reel.mp4 IG_COVER={d}/cover.jpg IG_PROFILE={BASE}/{BAT["ig"]} PLAYWRIGHT_BROWSERS_PATH={BASE}/pw-browsers PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node ig_reel_post.mjs',185)
    if "SHARED_CONFIRMED" in o: done["instagram"]="SHARED"; json.dump(m,open(mp,"w"),ensure_ascii=False); print("IG",BAT["ign"],"SHARED")
    else: print("IG",BAT["ign"],"skip/fail",[x for x in o.splitlines() if "RESULT" in x or "checkpoint" in x.lower()][-1:])
# move to published if YT ok
if done.get("youtube"):
    os.makedirs(f"{BASE}/published",exist_ok=True); os.rename(d,f"{BASE}/published/{nn}"); print("MOVED",nn,"batch",batch)
else: print("KEPT",nn)
