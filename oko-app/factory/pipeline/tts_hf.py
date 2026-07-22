#!/usr/bin/env python3
# tts_hf.py <vo_dir_with_script_src.json> [speaker]
# Озвучка сегментов через Qwen3-TTS (HF PRO), русский, единый бренд-голос.
# Заменяет edge-tts. Читает <vo>/script_src.json {s1..sN}, пишет <vo>/s1..sN.mp3.
# Голос: env VOICE_SPEAKER или argv[2] или дефолт. Ретраи; при полном отказе HF — код !=0.
import os,sys,json,shutil,subprocess,time
VO=sys.argv[1] if len(sys.argv)>1 else "vo"
SPEAKER=(sys.argv[2] if len(sys.argv)>2 else os.environ.get("VOICE_SPEAKER","Dylan"))
INSTRUCT=os.environ.get("VOICE_INSTRUCT","Уверенный энергичный мужской голос, реклама техники, чётко и по-деловому, без лишних пауз")
MODEL=os.environ.get("VOICE_MODEL_SIZE","1.7B")
SPACE=os.environ.get("VOICE_SPACE","Qwen/Qwen3-TTS")
tok=os.environ.get("HF_TOKEN")
from gradio_client import Client
seg=json.load(open(os.path.join(VO,"script_src.json")))
keys=[k for k in seg.keys() if k.startswith("s")]
keys.sort(key=lambda k:int(k[1:]))
c=Client(SPACE, token=tok)
def gen(txt):
    for att in range(4):
        try:
            r=c.predict(text=txt, language="Russian", speaker=SPEAKER, instruct=INSTRUCT,
                        model_size=MODEL, api_name="/generate_custom_voice")
            p=r[0] if isinstance(r,(list,tuple)) else r
            if p and os.path.exists(p): return p
        except Exception as e:
            sys.stderr.write(f"[tts_hf] retry {att} {str(e)[:120]}\n"); time.sleep(3+att*3)
    return None
ok=0
for k in keys:
    wav=gen(seg[k])
    if not wav: sys.stderr.write(f"[tts_hf] FAIL {k}\n"); continue
    out=os.path.join(VO,f"{k}.mp3")
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",wav,"-ar","24000","-b:a","160k",out])
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",out],capture_output=True,text=True).stdout.strip()
    print(f"{k} {SPEAKER} {d}s"); ok+=1
print(f"TTS_HF_DONE {ok}/{len(keys)} speaker={SPEAKER}")
sys.exit(0 if ok==len(keys) else 2)
