#!/usr/bin/env python3
import os,sys,json,glob,base64,subprocess,datetime
BASE="/opt/oko-poster"; Q=BASE+"/queue"; DONE=BASE+"/published"; LOG=BASE+"/logs/factory.log"
os.makedirs(DONE,exist_ok=True); os.makedirs(os.path.dirname(LOG),exist_ok=True)
# ---- 2 packs (batches): A = main accounts, B = second accounts. Each reel posts to ONE pack only. ----
BATCHES={
 "A":{"yt":"cfg/yt_creds.env","tt":"2350915","ig":"cfg/ig_diesel_profile","igname":"cargo"},
 "B":{"yt":"cfg/ytnew_b.env", "tt":"2363201","ig":"cfg/ig_kitay_profile","igname":"kitay"},
}
def log(*a):
    m="[%s] %s"%(datetime.datetime.now().isoformat(timespec='seconds')," ".join(str(x) for x in a))
    print(m); open(LOG,"a").write(m+"\n")
def run(cmd,env=None,to=400):
    e=dict(os.environ); e.update(env or {})
    try: r=subprocess.run(cmd,shell=True,capture_output=True,text=True,env=e,timeout=to); return r.returncode,r.stdout,r.stderr
    except subprocess.TimeoutExpired: return 124,"","timeout"
def save(m,p): json.dump(m,open(p,"w",encoding="utf-8"),ensure_ascii=False)
def channel_of(cf):
    try:
        for l in open(cf):
            if l.startswith("YT_CHANNEL_ID="): return l.strip().split("=",1)[1]
    except: pass
    return ""
items=sorted([d for d in glob.glob(Q+"/*") if os.path.isdir(d) and os.path.exists(d+"/reel.mp4") and os.path.exists(d+"/meta.json")])
if not items: log("QUEUE EMPTY"); sys.exit(0)
it=items[0]; nn=os.path.basename(it); mp=it+"/meta.json"
meta=json.load(open(mp,encoding="utf-8")); done=meta.setdefault("_done",{}); meta.setdefault("_ig_attempts",0)
batch=str(meta.get("batch","A")).upper()
if batch not in BATCHES: batch="A"
B=BATCHES[batch]
video=it+"/reel.mp4"; title=meta["title"]; ytd=meta["yt_desc"]; cap=meta["caption"]
capb64=base64.b64encode(cap.encode()).decode()
log("PUBLISHING",nn,"| batch",batch,"|",title[:40])
open(it+"/ytdesc","w",encoding="utf-8").write(ytd)
# --- YouTube (this batch's channel) ---
ytcf=BASE+"/"+B["yt"]
if not done.get("youtube"):
    if os.path.exists(ytcf) and channel_of(ytcf):
        rc,so,se=run(f"cd {BASE} && YT_CREDS_FILE={ytcf} python3 yt_upload.py {video} {json.dumps(title)} {it}/ytdesc")
        yid=next((l.split()[1] for l in (so or "").splitlines() if l.startswith("VIDEO_ID")),"")
        if yid: done["youtube"]="https://youtube.com/shorts/"+yid; save(meta,mp)
        log("  YT(%s):"%batch, done.get("youtube","FAIL"))
    else:
        done["youtube"]="SKIP_NO_CREDS"; save(meta,mp); log("  YT(%s): skip (no creds/channel)"%batch)
else: log("  YT(%s):(done)"%batch)
# --- TikTok (this batch's page) ---
if not done.get("tiktok"):
    pid=B["tt"]
    rc,so,se=run(f"cd {BASE} && CAPB64={capb64} python3 hooppy_post_api.py {pid} {video} ''",to=220)
    if 'post:' in (so or ''): done["tiktok"]=(so or '').strip()[-70:]; save(meta,mp)
    log("  TikTok(%s):"%pid, "OK" if done.get("tiktok") else "FAIL "+((se or so) or "")[-80:])
else: log("  TikTok:(done)")
# --- Instagram (this batch's account) ---
prof=BASE+"/"+B["ig"]
if not done.get("instagram"):
    meta["_ig_attempts"]+=1; save(meta,mp)
    if os.path.isdir(prof):
        rc,so,se=run(f"cd {BASE} && CAPB64={capb64} IG_VIDEO={video} IG_PROFILE={prof} PLAYWRIGHT_BROWSERS_PATH={BASE}/pw-browsers node ig_reel_post.mjs")
        if rc==0 and "SHARED_CONFIRMED" in (so or ""): done["instagram"]="SHARED"; save(meta,mp)
        log("  IG(%s):"%B["igname"], done.get("instagram","FAIL try#%s"%meta["_ig_attempts"]))
    else:
        log("  IG(%s): no profile, attempt#%s"%(B["igname"],meta["_ig_attempts"]))
else: log("  IG:(done)")
ig_ok = done.get("instagram") or meta["_ig_attempts"]>=3
yt_ok = done.get("youtube")  # includes SKIP
if yt_ok and ig_ok:
    os.rename(it,DONE+"/"+nn); log("DONE",nn,"batch",batch,"-> published/")
else: log("PARTIAL",nn,"batch",batch)
