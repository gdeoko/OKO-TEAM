#!/usr/bin/env python3
"""Fetch unique dark-cinematic music per reel from Freesound preview-hq-mp3."""
import json, os, subprocess, urllib.parse, time

FACTORY="/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
MUS=os.path.join(FACTORY,"music"); os.makedirs(MUS,exist_ok=True)
KEY="F0SqbAnWWe8UutfcRvKyBjufhEdIO48fZ0ktt8Fq"
CACERT="/root/.ccr/ca-bundle.crt"

QUERIES={
 "v1":"warm cinematic ambient piano",
 "v2":"dark moody cinematic tension",
 "v3":"clean corporate ambient uplifting",
 "v4":"cinematic inspiring build energy",
 "v5":"calm soft ambient meditation",
 "v6":"dark noir cinematic suspense",
 "v7":"driving cinematic pulse energetic",
}

USED=set()
def search(q):
    url=(f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}"
         f"&filter=duration:%5B25%20TO%20120%5D&token={KEY}"
         f"&fields=id,name,previews&page_size=8&sort=score")
    r=subprocess.run(["curl","-s","--cacert",CACERT,url],capture_output=True,text=True,timeout=40)
    try: return json.loads(r.stdout).get("results",[])
    except: return []

def dl(url,path):
    subprocess.run(["curl","-sL","--cacert",CACERT,"-o",path,url],timeout=90)
    return os.path.exists(path) and os.path.getsize(path)>50000

man={}
for rid,q in QUERIES.items():
    got=None
    for res in search(q):
        sid=str(res["id"])
        if sid in USED: continue
        url=res.get("previews",{}).get("preview-hq-mp3")
        if not url: continue
        path=os.path.join(MUS,f"{rid}.mp3")
        if dl(url,path):
            USED.add(sid); got={"id":sid,"name":res["name"],"path":path}
            print(f"{rid}: {sid} {res['name'][:40]}")
            break
    if not got: print(f"{rid}: FAILED")
    man[rid]=got
    time.sleep(0.3)
json.dump(man,open(os.path.join(FACTORY,"music_manifest.json"),"w"),ensure_ascii=False,indent=1)
print("music done")
