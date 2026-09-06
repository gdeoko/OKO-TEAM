# -*- coding: utf-8 -*-
# Уникальная музыка + SFX на каждый ролик через Freesound. Глобальный дедуп по id. Ноль повторов.
import os, json, subprocess, urllib.parse, sys
KEY=os.environ["FREESOUND_API_KEY"]; CA="/root/.ccr/ca-bundle.crt"
BASE="/home/user/OKO-TEAM/oko-app/factory/audio2"
# музыка-настроение и SFX по плану (у каждого ролика свои)
PLAN={
 "R1":{"music":["warm uplifting cinematic","hopeful emotional build"],
       "sfx":["atv engine start rumble","car keys jingle","truck ramp metal thud","dawn ambience"]},
 "R2":{"music":["driving energetic electronic","tense news underscore"],
       "sfx":["news whoosh transition","rubber stamp hit","keyboard typing fast","digital beep alert"]},
 "R3":{"music":["confident clean corporate","calm focused underscore"],
       "sfx":["checkmark click ui","paper page rustle","soft success ding","pen writing"]},
 "R4":{"music":["bold driving cinematic","epic building tension"],
       "sfx":["mechanical click ratchet","odometer roll counter","metal clack assemble","engine rev low"]},
 "R5":{"music":["warm hopeful uplifting acoustic","positive corporate motivational"],
       "sfx":["soft ui click confirm","positive chime bell","whoosh short clean","handshake soft"]},
}
def search(q, dmin, dmax, n=8):
    flt=f"duration:[{dmin} TO {dmax}]"
    u="https://freesound.org/apiv2/search/text/?"+urllib.parse.urlencode(
        {"query":q,"token":KEY,"filter":flt,"fields":"id,name,duration,previews","page_size":n,"sort":"score"})
    r=subprocess.run(["curl","-s","--max-time","30","--cacert",CA,u],capture_output=True,text=True)
    try: return json.loads(r.stdout).get("results",[])
    except Exception: return []
def dl(url,dst):
    subprocess.run(["curl","-s","--max-time","90","--cacert",CA,"-o",dst,url],check=False)
    return os.path.exists(dst) and os.path.getsize(dst)>3000
used=set(); manifest={}
for reel,cfg in PLAN.items():
    d=f"{BASE}/{reel}"; os.makedirs(d,exist_ok=True); got={"music":None,"sfx":[]}
    # music: one unique track 30-150s
    for q in cfg["music"]:
        done=False
        for s in search(q,30,150,8):
            if s["id"] in used: continue
            prev=(s.get("previews") or {}).get("preview-hq-mp3")
            if prev and dl(prev,f"{d}/music.mp3"):
                used.add(s["id"]); got["music"]={"id":s["id"],"q":q,"name":s["name"]}; done=True; break
        if done: break
    # sfx: 4 unique short 0.2-6s
    for i,q in enumerate(cfg["sfx"]):
        done=False
        for s in search(q,0.2,6,10):
            if s["id"] in used: continue
            prev=(s.get("previews") or {}).get("preview-hq-mp3")
            if prev and dl(prev,f"{d}/sfx_{i+1}.mp3"):
                used.add(s["id"]); got["sfx"].append({"id":s["id"],"q":q,"n":i+1}); done=True; break
        if not done: got["sfx"].append({"q":q,"MISS":True})
    manifest[reel]=got
    print(reel,"music",bool(got["music"]),"sfx",sum(1 for x in got["sfx"] if not x.get("MISS")),"/",len(cfg["sfx"]),flush=True)
json.dump(manifest,open(f"{BASE}/manifest.json","w"),ensure_ascii=False,indent=1)
print("AUDIO_DONE unique",len(used))
