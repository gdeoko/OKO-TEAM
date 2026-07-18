#!/usr/bin/env python3
# МЕТАНОЙА · БЕСПЛАТНАЯ озвучка голосом Екатерины (клон) — Higgs Audio v3 через HF ZeroGPU.
# НЕ Higgsfield (платно). usage: python3 tts_free.py "<текст>" out.mp3 [speed=1.0]
# Требует: HF_TOKEN в окружении, gradio_client, faster-whisper (для проверки), ffmpeg.
import sys, os, shutil, subprocess, tempfile
from gradio_client import Client, handle_file

HERE=os.path.dirname(os.path.abspath(__file__))
VOICE=os.path.join(os.path.dirname(HERE),"voice")
REF=os.path.join(VOICE,"ekat_ref.mp3")
REF_TXT=open(os.path.join(VOICE,"ekat_ref_text.txt")).read().strip()
STUDIO="highpass=f=75,equalizer=f=3500:t=q:w=1.5:g=1.5,treble=g=1.5:f=9000,loudnorm=I=-14:TP=-1.2:LRA=10"

def gen_higgs(text):
    c=Client("patriotyk/higgs-audio-v3-tts")
    out=c.predict(text=text, reference_audio=handle_file(REF), reference_text=REF_TXT,
                  temperature=0.7, top_p=0.95, top_k=50, max_new_tokens=2048, seed=-1, api_name="/synthesize")
    return out[0] if isinstance(out,(list,tuple)) else out

def gen_omni(text):  # запасной движок
    c=Client("k2-fsa/OmniVoice")
    out=c.predict(text=text, lang="Russian", ref_aud=handle_file(REF), ref_text=REF_TXT,
                  instruct="", ns=32, gs=2.0, dn=True, sp=1.0, du=0, pp=True, po=True, api_name="/_clone_fn")
    return out[0] if isinstance(out,(list,tuple)) else out

def main():
    text=sys.argv[1]; outp=sys.argv[2]; speed=float(sys.argv[3]) if len(sys.argv)>3 else 1.0
    raw=None
    for fn in (gen_higgs, gen_omni):
        try: raw=fn(text); break
        except Exception as e: sys.stderr.write(f"{fn.__name__} fail: {e}\n")
    if not raw: raise SystemExit("все бесплатные движки недоступны")
    af=STUDIO + (f",atempo={speed},loudnorm=I=-14:TP=-1.2" if abs(speed-1.0)>0.01 else "")
    subprocess.run(["ffmpeg","-v","error","-y","-i",raw,"-af",af,"-ar","44100","-b:a","192k",outp],check=True)
    print("OK", outp, subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",outp],capture_output=True,text=True).stdout.strip())

if __name__=="__main__": main()
