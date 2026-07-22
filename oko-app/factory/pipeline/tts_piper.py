#!/usr/bin/env python3
# tts_piper.py <vo_dir_with_script_src.json> [voice]
# Студийная русская озвучка через Piper TTS (локально, быстро, БЕЗЛИМИТ, лицензия MIT — коммерч. ок).
# Голоса: ru_RU-ruslan-medium (студийный, дефолт), ru_RU-dmitri-medium, ru_RU-denis-medium, ru_RU-irina-medium.
# Голос: env VOICE_PIPER или argv[2] (ruslan|dmitri|denis|irina). Модель качается один раз в models/piper/.
import os,sys,json,subprocess
# self-bootstrap deps (свежий контейнер каждой сессии — ставим, если нет)
def _ensure(mod,pkg):
    try: __import__(mod)
    except Exception: subprocess.run([sys.executable,"-m","pip","install","-q",pkg])
_ensure("piper","piper-tts"); _ensure("ruaccent","ruaccent")
VO=sys.argv[1] if len(sys.argv)>1 else "vo"
VOICE=(sys.argv[2] if len(sys.argv)>2 else os.environ.get("VOICE_PIPER","ruslan"))
ROOT=os.environ.get("FACTORY_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MDIR=os.path.join(ROOT,"models","piper"); os.makedirs(MDIR,exist_ok=True)
name=f"ru_RU-{VOICE}-medium"
onnx=os.path.join(MDIR,name+".onnx"); cfg=onnx+".json"
BASE=f"https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/{VOICE}/medium/{name}"
for path,url in [(onnx,BASE+".onnx"),(cfg,BASE+".onnx.json")]:
    if not os.path.exists(path) or os.path.getsize(path)<1000:
        subprocess.run(["curl","-s","-L","-m","150","-o",path,url])
seg=json.load(open(os.path.join(VO,"script_src.json")))
keys=sorted([k for k in seg if k.startswith("s")], key=lambda k:int(k[1:]))
# RUAccent: авто-ударения + ё (Даниэль 22.07: Ruslan хорош, но были ошибки в ударениях).
# '+гласная' -> 'гласная'+U+0301 (espeak-ng RU уважает знак ударения).
import re
_accent=None
if os.environ.get("VOICE_NOACCENT","")!="1":
    try:
        from ruaccent import RUAccent
        _accent=RUAccent(); _accent.load(omograph_model_size=os.environ.get("RUACCENT_MODEL","tiny"), use_dictionary=True)
    except Exception as e:
        sys.stderr.write(f"[tts_piper] RUAccent недоступен, без авто-ударений: {str(e)[:120]}\n")
def stress(t):
    if not _accent: return t
    try: return re.sub(r'\+([аеёиоуыэюяАЕЁИОУЫЭЮЯ])', lambda m:m.group(1)+'́', _accent.process_all(t))
    except Exception: return t
ok=0
for k in keys:
    wav=os.path.join(VO,f"_{k}.wav")
    r=subprocess.run(["python3","-m","piper","-m",onnx,"-f",wav], input=stress(seg[k]), capture_output=True, text=True)
    if not os.path.exists(wav) or os.path.getsize(wav)<1000:
        sys.stderr.write(f"[tts_piper] FAIL {k}: {r.stderr[-160:]}\n"); continue
    out=os.path.join(VO,f"{k}.mp3")
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",wav,"-ar","24000","-b:a","160k",out]); os.remove(wav)
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",out],capture_output=True,text=True).stdout.strip()
    print(f"{k} {VOICE} {d}s"); ok+=1
print(f"TTS_PIPER_DONE {ok}/{len(keys)} voice={VOICE}")
sys.exit(0 if ok==len(keys) else 2)
