#!/usr/bin/env python3
# Fetch background music (under lesson meaning: modern tech / focused / motivating)
# + SFX from Freesound preview endpoint (no OAuth needed for preview-hq-mp3).
import os, json, subprocess, sys
TOKEN = os.environ.get("FREESOUND_API_KEY")
CACERT = "/root/.ccr/ca-bundle.crt"
os.makedirs("sfx", exist_ok=True)

import urllib.parse
def api_get(base, params):
    args=["curl","-sS","-G","--cacert",CACERT,base]
    for k,v in params.items():
        args+=["--data-urlencode",f"{k}={v}"]
    out=subprocess.check_output(args).decode()
    return json.loads(out)

def dl(url, path):
    subprocess.run(["curl","-sS","--cacert",CACERT,"-o",path,url], check=True)
    return os.path.getsize(path)

def search_music(query, dmin=60, dmax=200, n=6):
    return api_get("https://freesound.org/apiv2/search/text/",
      {"query":query,"filter":f"duration:[{dmin} TO {dmax}]","sort":"score",
       "page_size":n,"fields":"id,name,duration,previews,tags","token":TOKEN}).get("results",[])

def search_sfx(query, dmax=6, n=5):
    return api_get("https://freesound.org/apiv2/search/text/",
      {"query":query,"filter":f"duration:[0.1 TO {dmax}]","sort":"score",
       "page_size":n,"fields":"id,name,duration,previews","token":TOKEN}).get("results",[])

# --- music candidates: modern, focused, techy, inspiring (matches an AI/tech lesson) ---
mus_queries=["inspiring corporate technology background","future tech ambient motivational",
             "modern electronic background focus","uplifting tech corporate loop"]
picked=None
for q in mus_queries:
    res=search_music(q)
    for r in res:
        pv=r["previews"].get("preview-hq-mp3")
        if pv:
            sz=dl(pv,"music_cand.mp3")
            if sz>50000:
                picked={"id":r["id"],"name":r["name"],"dur":r["duration"],"q":q}
                os.replace("music_cand.mp3","music.mp3")
                break
    if picked: break
print("MUSIC:", picked)

# --- SFX set (distinct, no repeats within lesson) ---
sfx_map={
 "whoosh":"whoosh transition swipe",
 "pop":"ui pop click bubble",
 "riser":"riser uplifter tension",
 "chime":"success chime notification bright",
 "type":"typewriter key mechanical",
 "impact":"soft impact hit boom",
 "sparkle":"magic sparkle shimmer",
 "click":"ui click tick",
}
got={}
for name,q in sfx_map.items():
    res=search_sfx(q)
    for r in res:
        pv=r["previews"].get("preview-hq-mp3")
        if pv:
            sz=dl(pv,f"sfx/{name}.mp3")
            if sz>3000:
                got[name]={"id":r["id"],"dur":r["duration"]}
                break
print("SFX:", list(got.keys()))
json.dump({"music":picked,"sfx":got}, open("audio_meta.json","w"), ensure_ascii=False, indent=1)
