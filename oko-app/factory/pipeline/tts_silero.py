#!/usr/bin/env python3
# tts_silero.py <vo_dir_with_script_src.json> [speaker]
# Нативная русская озвучка через Silero v4_ru (локально, стабильно, БЕЗ ошибок в словах:
# put_accent+put_yo сами ставят ударения и ё). Заменяет edge-tts/Qwen. Голос: env VOICE_SPEAKER
# или argv[2] (aidar|eugene — мужские; baya|kseniya|xenia — женские). Дефолт eugene.
# Модель качается один раз в <FACTORY_ROOT>/models/v4_ru.pt (curl, models.silero.ai).
import os,sys,json,subprocess
VO=sys.argv[1] if len(sys.argv)>1 else "vo"
SPEAKER=(sys.argv[2] if len(sys.argv)>2 else os.environ.get("VOICE_SPEAKER","eugene"))
RATE=int(os.environ.get("VOICE_RATE","48000"))
ROOT=os.environ.get("FACTORY_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS=os.path.join(ROOT,"models"); os.makedirs(MODELS,exist_ok=True)
MP=os.path.join(MODELS,"v4_ru.pt")
if not os.path.exists(MP) or os.path.getsize(MP)<1_000_000:
    subprocess.run(["curl","-s","-L","-m","180","-o",MP,"https://models.silero.ai/models/tts/ru/v4_ru.pt"])
import torch, torchaudio
torch.set_num_threads(int(os.environ.get("VOICE_THREADS","4")))
model=torch.package.PackageImporter(MP).load_pickle("tts_models","model")
model.to(torch.device('cpu'))
seg=json.load(open(os.path.join(VO,"script_src.json")))
keys=sorted([k for k in seg if k.startswith("s")], key=lambda k:int(k[1:]))
ok=0
for k in keys:
    txt=seg[k]
    try:
        a=model.apply_tts(text=txt, speaker=SPEAKER, sample_rate=RATE, put_accent=True, put_yo=True)
        wav=os.path.join(VO,f"_{k}.wav"); torchaudio.save(wav, a.unsqueeze(0), RATE)
        out=os.path.join(VO,f"{k}.mp3")
        subprocess.run(["ffmpeg","-y","-loglevel","error","-i",wav,"-ar","24000","-b:a","160k",out]); os.remove(wav)
        d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",out],capture_output=True,text=True).stdout.strip()
        print(f"{k} {SPEAKER} {d}s"); ok+=1
    except Exception as e:
        sys.stderr.write(f"[tts_silero] FAIL {k}: {str(e)[:160]}\n")
print(f"TTS_SILERO_DONE {ok}/{len(keys)} speaker={SPEAKER}")
sys.exit(0 if ok==len(keys) else 2)
