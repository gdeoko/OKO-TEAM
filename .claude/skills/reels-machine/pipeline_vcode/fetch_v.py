#!/usr/bin/env python3
"""Fetch unique Pexels portrait clips: 1 per query, 2 per segment (~12/reel). Dedup by id."""
import json, os, subprocess, time, urllib.parse, sys

FACTORY = "/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
CLIPS = os.path.join(FACTORY,"clips"); os.makedirs(CLIPS,exist_ok=True)
KEY = "GSGojmsYwaqlGQBbsmtAVv0BsyLl2q9H1k8LbZf35rMnJLAJO4pHpqO9"

# preload used ids from prior successful downloads + registry
USED=set()

def search(q, per=10):
    url=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&per_page={per}&orientation=portrait&size=medium"
    r=subprocess.run(["curl","-s","-H",f"Authorization: {KEY}",url],capture_output=True,text=True,timeout=30)
    try: return json.loads(r.stdout).get("videos",[])
    except: return []

def best(v):
    b=None
    for f in v.get("video_files",[]):
        w,h=f.get("width",0),f.get("height",0)
        if h>w and h>=1000:
            if b is None or abs(h-1920)<abs(b.get("height",0)-1920): b=f
    if not b:
        for f in v.get("video_files",[]):
            if f.get("height",0)>=720: b=f; break
    return b

def dl(url,path):
    subprocess.run(["curl","-sL","-o",path,url],timeout=90)
    return os.path.exists(path) and os.path.getsize(path)>20000

def one_clip(query, out):
    for v in search(query):
        vid=str(v["id"])
        if vid in USED: continue
        bf=best(v)
        if not bf: continue
        if dl(bf["link"],out):
            USED.add(vid)
            return {"path":out,"id":vid,"w":bf.get("width"),"h":bf.get("height")}
    return None

def main():
    only=sys.argv[1] if len(sys.argv)>1 else None
    sc=json.load(open(os.path.join(FACTORY,"scenarios_v.json")))
    mpath=os.path.join(FACTORY,"clips_v_manifest.json")
    man=json.load(open(mpath)) if os.path.exists(mpath) else {}
    # reload used ids
    for r in man.values():
        for segclips in r.values():
            for c in segclips: USED.add(c["id"])
    for rid in sorted(sc):
        if only and rid!=only: continue
        reel=sc[rid]; print(f"\n=== {rid} clips ===")
        rclips={}; idx=0
        for s in reel["segments"]:
            got=[]
            for q in s["q"]:
                out=os.path.join(CLIPS,f"{rid}_c{idx:02d}.mp4")
                c=one_clip(q,out)
                if not c:
                    # broaden
                    c=one_clip(q.split()[0]+" cinematic",out)
                if c:
                    got.append(c); idx+=1
                    print(f"  {s['id']} <- {c['id']} ({c['w']}x{c['h']}) [{q}]")
                time.sleep(0.25)
            if not got:
                out=os.path.join(CLIPS,f"{rid}_c{idx:02d}.mp4")
                c=one_clip("cinematic bokeh",out)
                if c: got.append(c); idx+=1
            rclips[s["id"]]=got
        man[rid]=rclips
        json.dump(man,open(mpath,"w"),ensure_ascii=False,indent=1)
        print(f"  total {sum(len(v) for v in rclips.values())} clips")
    print("\nclips done. total ids:",len(USED))

main()
