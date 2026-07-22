#!/usr/bin/env python3
# МЕТАНОЙА · БЕСПЛАТНАЯ озвучка голосом Екатерины (клон) — Higgs Audio v3 через HF ZeroGPU.
# НЕ Higgsfield (платно). usage: python3 tts_free.py "<текст>" out.mp3 [speed=1.0]
# Длинный текст РЕЖЕТСЯ на куски по предложениям (Higgs обрезает длинное) и склеивается.
import sys, os, re, shutil, subprocess, tempfile
from gradio_client import Client, handle_file

HERE=os.path.dirname(os.path.abspath(__file__))
VOICE=os.path.join(os.path.dirname(HERE),"voice")
REF=os.path.join(VOICE,"ekat_ref.mp3")
REF_TXT=open(os.path.join(VOICE,"ekat_ref_text.txt")).read().strip()
STUDIO="highpass=f=75,equalizer=f=3500:t=q:w=1.5:g=1.5,treble=g=1.5:f=9000,loudnorm=I=-14:TP=-1.2:LRA=10"
MAXLEN=150  # символов на кусок (Higgs надёжно тянет ~<250)

def chunks(text):
    sents=re.split(r'(?<=[.!?])\s+', text.strip())
    out=[]; cur=""
    for s in sents:
        if len(cur)+len(s)+1<=MAXLEN: cur=(cur+" "+s).strip()
        else:
            if cur: out.append(cur)
            cur=s if len(s)<=MAXLEN else s  # очень длинное одиночное всё равно шлём
    if cur: out.append(cur)
    return out or [text]

def gen_higgs(text):
    c=Client("patriotyk/higgs-audio-v3-tts")
    out=c.predict(text=text, reference_audio=handle_file(REF), reference_text=REF_TXT,
                  temperature=0.7, top_p=0.95, top_k=50, max_new_tokens=2048, seed=-1, api_name="/synthesize")
    return out[0] if isinstance(out,(list,tuple)) else out

def gen_omni(text):
    c=Client("k2-fsa/OmniVoice")
    out=c.predict(text=text, lang="Russian", ref_aud=handle_file(REF), ref_text=REF_TXT,
                  instruct="", ns=32, gs=2.0, dn=True, sp=1.0, du=0, pp=True, po=True, api_name="/_clone_fn")
    return out[0] if isinstance(out,(list,tuple)) else out

def synth(text):
    for fn in (gen_higgs, gen_omni):
        try: return fn(text)
        except Exception as e: sys.stderr.write(f"{fn.__name__} fail: {e}\n")
    raise SystemExit("бесплатные движки недоступны")

def main():
    text=sys.argv[1]; outp=sys.argv[2]; speed=float(sys.argv[3]) if len(sys.argv)>3 else 1.0
    parts=chunks(text)
    tmp=tempfile.mkdtemp()
    wavs=[]
    for i,p in enumerate(parts):
        raw=synth(p)
        w=os.path.join(tmp,f"p{i:02d}.wav")
        # нормализуем в один формат + добавим 180мс паузы в конце куска
        subprocess.run(["ffmpeg","-v","error","-y","-i",raw,"-af","apad=pad_dur=0.18","-ar","44100","-ac","1",w],check=True)
        wavs.append(w)
    lst=os.path.join(tmp,"list.txt"); open(lst,"w").write("".join(f"file '{w}'\n" for w in wavs))
    joined=os.path.join(tmp,"joined.wav")
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",joined],check=True)
    af=STUDIO + (f",atempo={speed},loudnorm=I=-14:TP=-1.2" if abs(speed-1.0)>0.01 else "")
    subprocess.run(["ffmpeg","-v","error","-y","-i",joined,"-af",af,"-ar","44100","-b:a","192k",outp],check=True)
    shutil.rmtree(tmp,ignore_errors=True)
    dur=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",outp],capture_output=True,text=True).stdout.strip()
    print("OK", outp, dur, f"({len(parts)} кусков)")

if __name__=="__main__": main()
