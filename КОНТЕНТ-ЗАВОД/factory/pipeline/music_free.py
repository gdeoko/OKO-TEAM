#!/usr/bin/env python3
# МЕТАНОЙА · БЕСПЛАТНАЯ разнообразная музыка под НАСТРОЕНИЕ ролика (Freesound, CC0/CC-BY).
# Разная каждый раз (дедуп по used_music.txt). usage: python3 music_free.py "<mood keywords>" out.m4a <dur_sec> [reel_nn]
# Требует FREESOUND_API_KEY, SSL_CERT_FILE, ffmpeg. Фолбэк — синтез-пад (никогда не падает).
import sys, os, json, subprocess, urllib.request, urllib.parse, tempfile, re
REPO="/home/user/OKO-TEAM"
USED=f"{REPO}/КОНТЕНТ-ЗАВОД/factory/used_music.txt"
CA=os.environ.get("SSL_CERT_FILE","/root/.ccr/ca-bundle.crt")
KEY=os.environ.get("FREESOUND_API_KEY","")

def used_ids():
    try: return set(open(USED).read().split())
    except: return set()

def search(mood, dur):
    q=urllib.parse.quote(mood+" music instrumental")
    lo=max(20,int(dur)); hi=int(dur)+120
    # приоритет: сначала CC0, потом любые
    for lic in ["Creative Commons 0","attribution",""]:
        f=f"duration:[{lo} TO {hi}]"
        if lic: f+=f' license:"{lic}"'
        u=(f"https://freesound.org/apiv2/search/text/?query={q}&filter={urllib.parse.quote(f)}"
           f"&fields=id,name,duration,license,previews&sort=rating_desc&page_size=25&token={KEY}")
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request(u),timeout=30))
            if d.get("results"): return d["results"]
        except Exception as e: sys.stderr.write(f"search fail {e}\n")
    return []

def synth_pad(out, dur):
    pad=(f"aevalsrc=0.16*sin(2*PI*110*t)+0.12*sin(2*PI*165*t)+0.08*sin(2*PI*220*t):s=44100:d={dur},"
         f"tremolo=f=0.15:d=0.3,lowpass=f=900,highpass=f=60,volume=0.6,afade=t=in:st=0:d=2,afade=t=out:st={dur-2.5}:d=2.5")
    subprocess.run(["ffmpeg","-v","error","-y","-filter_complex",pad,"-map","0:a" if False else "[out]" if False else "0:a",
                    "-t",str(dur),out],capture_output=True)  # noop guard
    subprocess.run(["ffmpeg","-v","error","-y","-filter_complex",pad+"[a]","-map","[a]","-c:a","aac","-b:a","160k",out],check=True)

def main():
    mood=sys.argv[1]; out=sys.argv[2]; dur=float(sys.argv[3]) if len(sys.argv)>3 else 40.0
    reel=sys.argv[4] if len(sys.argv)>4 else "x"
    used=used_ids(); tmp=tempfile.mkdtemp()
    for r in search(mood,dur):
        sid=str(r["id"])
        if sid in used: continue
        prev=r.get("previews",{}).get("preview-hq-mp3") or r.get("previews",{}).get("preview-lq-mp3")
        if not prev: continue
        raw=os.path.join(tmp,"m.mp3")
        rc=subprocess.run(["curl","-s","--cacert",CA,"--max-time","60","-o",raw,prev],capture_output=True)
        if not os.path.exists(raw) or os.path.getsize(raw)<10000: continue
        # обрезать/зациклить под длину + нормализация для фона + фейды
        af=f"aloop=loop=-1:size=2e9,atrim=0:{dur},afade=t=in:st=0:d=1.5,afade=t=out:st={dur-2.5}:d=2.5,loudnorm=I=-20:TP=-3,volume=1.0"
        rc=subprocess.run(["ffmpeg","-v","error","-y","-i",raw,"-af",af,"-t",str(dur),"-c:a","aac","-b:a","160k",out],capture_output=True,text=True)
        if os.path.exists(out) and os.path.getsize(out)>10000:
            open(USED,"a").write(sid+"\n")
            print(json.dumps({"src":"freesound","id":sid,"name":r["name"][:50],"license":r["license"]},ensure_ascii=False)); return
    # фолбэк
    synth_pad(out,dur); print(json.dumps({"src":"synth_pad"}))

if __name__=="__main__": main()
