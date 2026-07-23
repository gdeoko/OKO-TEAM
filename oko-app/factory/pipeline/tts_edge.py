#!/usr/bin/env python3
# tts_edge.py <vo_dir_with_script_src.json> [voice]
# Студийная русская озвучка через edge-tts (нейросеть Azure, БЕСПЛАТНО, БЕЗ ЛИМИТА, без ключа).
# Бренд-голос по ТЗ: ru-RU-DmitryNeural (мужской, студийный, правильные ударения, без призвуков/шума).
# Голос: env VOICE_EDGE или argv[2]. Темп: env EDGE_RATE (напр. "+8%"), по умолчанию "+0%".
# Пер-сегментно (s1.mp3, s2.mp3 ...) — под караоке-субтитры, как tts_piper.py.
import os,sys,json,subprocess
def _ensure(mod,pkg):
    try: __import__(mod)
    except Exception: subprocess.run([sys.executable,"-m","pip","install","-q",pkg])
_ensure("edge_tts","edge-tts")
VO=sys.argv[1] if len(sys.argv)>1 else "vo"
VOICE=(sys.argv[2] if len(sys.argv)>2 else os.environ.get("VOICE_EDGE","ru-RU-DmitryNeural"))
RATE=os.environ.get("EDGE_RATE","+0%")   # темп синтеза оставляем натуральным
TEMPO=os.environ.get("EDGE_TEMPO","1.5") # финальное ускорение (Даниэль 23.07: «скорость 1.5х»)
import re
# --- доменные ударения (Азуре чтит знак U+0301). Даниэль: квадроц+И+кл, не квадр+О+цикл. ---
def stress_fix(t):
    # "цикл" -> "ци́кл" (мото/квадро/гидро-цикл + склонения), КРОМЕ "циклон"
    t=re.sub(r'цикл', 'ци́кл', t)
    t=t.replace('ци́клон','циклон')
    return t
seg=json.load(open(os.path.join(VO,"script_src.json")))
keys=sorted([k for k in seg if k.startswith("s")], key=lambda k:int(k[1:]))
ok=0
for k in keys:
    txt=(seg[k] or "").strip()
    if not txt:
        sys.stderr.write(f"[tts_edge] пустой сегмент {k}\n"); continue
    raw=os.path.join(VO,f"_{k}.mp3"); out=os.path.join(VO,f"{k}.mp3")
    tf=os.path.join(VO,f"_{k}.txt"); open(tf,"w",encoding="utf-8").write(stress_fix(txt))
    cmd=[sys.executable,"-m","edge_tts","--voice",VOICE,"--file",tf,"--write-media",raw]
    if RATE and RATE!="+0%": cmd+=["--rate",RATE]
    r=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
    os.remove(tf)
    if not os.path.exists(raw) or os.path.getsize(raw)<1000:
        sys.stderr.write(f"[tts_edge] FAIL {k}: {(r.stderr or r.stdout)[-180:]}\n"); continue
    # нормализуем в 24kHz 160k, ускоряем до TEMPO (1.5х), режем хвостовую тишину
    af=f"atempo={TEMPO},silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB"
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",raw,"-ar","24000","-b:a","160k",
                    "-af",af,out])
    os.remove(raw)
    if not os.path.exists(out) or os.path.getsize(out)<1000:
        sys.stderr.write(f"[tts_edge] ffmpeg FAIL {k}\n"); continue
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",out],capture_output=True,text=True).stdout.strip()
    print(f"{k} {VOICE} {d}s"); ok+=1
print(f"TTS_EDGE_DONE {ok}/{len(keys)} voice={VOICE} rate={RATE} tempo={TEMPO}")
sys.exit(0 if ok==len(keys) else 2)
