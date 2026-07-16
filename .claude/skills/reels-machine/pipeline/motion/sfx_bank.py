# -*- coding: utf-8 -*- банк разнообразных SFX по смыслу (Freesound).
# python3 sfx_bank.py <outdir>  → outdir/sfx/<cat><n>.mp3, по 2-3 звука в категории.
# В конфиге SFX чередовать: whoosh1/whoosh2/whoosh3 на РАЗНЫХ переходах, impact на цифрах, ding на CTA.
import os, sys, json, subprocess, urllib.parse

CA=os.environ.get("CA_BUNDLE","/root/.ccr/ca-bundle.crt")
KEY=os.environ.get("FREESOUND_API_KEY","")

# категория -> поисковый запрос (осмысленные, чистые, короткие, не «дешёвые»)
CATS={
 "impact":  "impact hit",
 "ding":    "notification ding",
 "whoosh":  "whoosh transition",
 "pop":     "pop click",
 "riser":   "riser tension",
 "cash":    "cash coins",
 "swoosh":  "swoosh motion",
}
PER=3   # звуков на категорию

def curl_json(url):
    return json.loads(subprocess.run(["curl","-s","--max-time","40","--cacert",CA,url],
                                     capture_output=True,timeout=60).stdout or "{}")

def fetch(cat, q, outdir, per=PER):
    p={"query":q,"filter":"duration:[0.1 TO 4.0]","fields":"previews,duration",
       "page_size":str(per*4),"sort":"score","token":KEY}
    url="https://freesound.org/apiv2/search/text/?"+urllib.parse.urlencode(p)
    d=curl_json(url); res=d.get("results",[]); got=0
    for r in res:
        if got>=per: break
        prev=r.get("previews",{}).get("preview-hq-mp3")
        if not prev: continue
        raw=f"{outdir}/sfx/_{cat}_raw.mp3"; out=f"{outdir}/sfx/{cat}{got+1}.mp3"
        subprocess.run(["curl","-sL","--max-time","60","--cacert",CA,"-o",raw,prev],timeout=90)
        if not os.path.exists(raw) or os.path.getsize(raw)<800: continue
        # нормализуем громкость + короткий fade на хвосте (без обрыва/щелчка)
        rc=subprocess.run(["ffmpeg","-y","-v","error","-i",raw,"-af",
                        "dynaudnorm=f=200:g=8,areverse,afade=t=in:d=0.04,areverse",
                        "-ar","44100",out],capture_output=True)
        if os.path.exists(out) and os.path.getsize(out)>800: got+=1
    try: os.remove(f"{outdir}/sfx/_{cat}_raw.mp3")
    except Exception: pass
    print(f"{cat}: {got}")
    return got

def main():
    outdir=sys.argv[1] if len(sys.argv)>1 else "."
    os.makedirs(f"{outdir}/sfx",exist_ok=True)
    if not KEY: print("NO FREESOUND_API_KEY"); return
    total=0
    for cat,q in CATS.items(): total+=fetch(cat,q,outdir)
    print("SFX bank ready:",total,"sounds ->",f"{outdir}/sfx/")

if __name__=="__main__": main()
