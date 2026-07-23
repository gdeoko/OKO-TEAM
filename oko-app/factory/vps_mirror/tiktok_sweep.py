#!/usr/bin/env python3
# tiktok_sweep.py — самолечение: до-публикует TikTok для роликов, у которых YouTube есть,
# а TikTok упал (флаки-окна Hooppy на слоте). Только ролики из post_direct (_done.youtube есть),
# чтобы НЕ трогать старые. Обновляет _done.tiktok при успехе (защита от дублей).
import os,json,glob,subprocess,base64,re
BAT_TT={"A":"2365299","B":"2363201"}
os.environ["HOOPPY_API_TOKEN"]=os.environ.get("HOOPPY_API_TOKEN","").replace("export ","").strip()
swept=fail=0
for d in sorted(glob.glob("/opt/oko-poster/published/*")):
    mp=d+"/meta.json"
    if not (os.path.exists(mp) and os.path.exists(d+"/reel.mp4")): continue
    m=json.load(open(mp)); done=m.get("_done",{})
    if not done.get("youtube") or done.get("tiktok"): continue
    tt=BAT_TT.get(str(m.get("batch","A")).upper())
    if not tt: continue
    env=dict(os.environ, CAPB64=base64.b64encode(m.get("caption","").encode()).decode())
    try:
        r=subprocess.run(["python3","/opt/oko-poster/hooppy_post_api.py",tt,d+"/reel.mp4",""],
                         capture_output=True,text=True,timeout=250,env=env)
    except Exception as e:
        print("SWEEP-ERR",os.path.basename(d),str(e)[:80]); fail+=1; continue
    if "post:" in (r.stdout or ""):
        mm=re.search(r'"id":\s*(\d+)', r.stdout); done["tiktok"]=mm.group(1) if mm else "ok"
        m["_done"]=done; json.dump(m,open(mp,"w"),ensure_ascii=False)
        print("SWEEP-OK",os.path.basename(d),done["tiktok"]); swept+=1
    else:
        print("SWEEP-FAIL",os.path.basename(d),((r.stdout or "")+ (r.stderr or ""))[-90:]); fail+=1
print(f"TIKTOK_SWEEP_DONE swept={swept} fail={fail}")
