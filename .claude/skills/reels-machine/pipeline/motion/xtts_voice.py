# -*- coding: utf-8 -*-
"""Голос ролика — XTTS-v2 (локальный, бесплатный, клон тембра по референсу).
Ключевое: РАССТАНОВКА УДАРЕНИЙ через ruaccent (чтобы XTTS не путал ударения)
+ СТУДИЙНЫЙ МАСТЕР звука (пресенс-EQ + нормализация, убирает эффект «под водой»).
Фолбэк — edge-tts (ru-RU) если venv/модель недоступны.

Установка venv (см. INTEGRATIONS): torch==2.4.1 + coqui-tts==0.25.3 + ruaccent.
Путь к python venv — XTTS_PY (по умолч. ищет ./xtts-venv/bin/python).

CLI:
  python3 xtts_voice.py "текст" out.wav [ref.wav] [ru] [--stress accent|plus|none] [--raw]
Питон:
  from xtts_voice import say
  say("Привет", "out.wav", ref="voices/ref_ekaterina.wav")
"""
import os, sys, subprocess, asyncio, json

HERE=os.path.dirname(os.path.abspath(__file__))
PIPE=os.path.dirname(HERE)  # .../pipeline

def _find_xtts_py():
    p=os.environ.get("XTTS_PY")
    if p and os.path.exists(p): return p
    for c in ["xtts-venv/bin/python", os.path.join(os.getcwd(),"xtts-venv/bin/python"),
              os.path.join(PIPE,"..","..","..","..","xtts-venv","bin","python"),
              os.path.expanduser("~/xtts-venv/bin/python")]:
        if os.path.exists(c): return c
    return None

# --- снипет, исполняемый ВНУТРИ venv: ударения (ruaccent) -> XTTS синтез ---
_GEN = r'''
import os,sys,re,json
os.environ['COQUI_TOS_AGREED']='1'
txt,out,ref,lang,stress = sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],sys.argv[5]

def accentize(t):
    try:
        from ruaccent import RUAccent
        a=RUAccent()
        try: a.load(omograph_model_size='turbo3', use_dictionary=True, tiny_mode=False)
        except Exception: a.load(omograph_model_size='turbo', use_dictionary=True)
        return a.process_all(t)   # ставит '+' ПЕРЕД ударной гласной
    except Exception as e:
        sys.stderr.write('RUACCENT_SKIP '+str(e)[:120]+'\n'); return t

VOW='аеёиоуыэюяАЕЁИОУЫЭЮЯ'
if stress!='none':
    txt=accentize(txt)
    if stress=='accent':
        # '+гласная' -> 'гласная' + U+0301 (комбинируемое ударение ПОСЛЕ гласной)
        txt=re.sub(r'\+(['+VOW+r'])', lambda m: m.group(1)+'́', txt)
    # stress=='plus' -> оставляем '+' как есть (некоторые сборки XTTS так читают)
    else:
        pass

from TTS.api import TTS
t=TTS('tts_models/multilingual/multi-dataset/xtts_v2', progress_bar=False)
t.tts_to_file(text=txt, speaker_wav=ref, language=lang, file_path=out,
              temperature=0.65, length_penalty=1.0, repetition_penalty=2.5,
              top_k=50, top_p=0.85, speed=1.0)
print('XTTS_OK', out)
sys.stderr.write('TEXT_USED::'+txt+'\n')
'''

def _studio_master(inp, outp, tempo=1.0):
    """Убирает «подводность»: пресенс-EQ 3–6кГц, воздух сверху, чистка низов, нормализация."""
    af=("highpass=f=85,"
        "equalizer=f=250:t=q:w=1.0:g=-2,"      # убрать бубнёж
        "equalizer=f=3500:t=q:w=1.4:g=4,"      # пресенс (разборчивость)
        "equalizer=f=6000:t=q:w=1.6:g=3,"      # артикуляция
        "highshelf=f=9000:g=3,"                # воздух
        "afftdn=nf=-28,"                        # мягкий шумодав
        "dynaudnorm=f=200:g=6,"
        "loudnorm=I=-15:TP=-1.3:LRA=10")
    if abs(tempo-1.0)>1e-3:
        af=f"atempo={tempo:.3f},"+af
    r=subprocess.run(["ffmpeg","-y","-v","error","-i",inp,"-af",af,"-ar","44100","-ac","1",outp],
                     capture_output=True)
    return os.path.exists(outp) and os.path.getsize(outp)>2000

def xtts(text, out, ref, lang="ru", stress="accent", raw=None):
    py=_find_xtts_py()
    if not py or not os.path.exists(ref): return (False, "")
    tmp=(raw or out)+".xtts_raw.wav"
    try:
        r=subprocess.run([py,"-c",_GEN,text,tmp,ref,lang,stress],
                         capture_output=True,timeout=900,
                         env={**os.environ,"COQUI_TOS_AGREED":"1"})
        used=""
        for line in r.stderr.decode("utf-8","replace").splitlines():
            if line.startswith("TEXT_USED::"): used=line[len("TEXT_USED::"):]
        ok=b"XTTS_OK" in r.stdout and os.path.exists(tmp) and os.path.getsize(tmp)>2000
        if not ok:
            sys.stderr.write(r.stderr.decode("utf-8","replace")[-400:]); return (False, used)
        return (tmp, used)
    except Exception as e:
        sys.stderr.write("xtts err "+str(e)[:160]+"\n"); return (False, "")

def edge_fallback(text, out, voice="ru-RU-DmitryNeural", rate="+0%"):
    import edge_tts
    tmp=out+".edge.mp3"
    async def go(): await edge_tts.Communicate(text,voice,rate=rate).save(tmp)
    asyncio.run(go())
    return tmp if os.path.exists(tmp) else None

def say(text, out, ref="voices/ref_male.wav", lang="ru", stress="accent", tempo=1.0):
    """XTTS-v2 (клон+ударения+студмастер) -> ffmpeg-мастер. Иначе edge-tts."""
    if not os.path.isabs(ref):
        for base in [os.getcwd(), PIPE, HERE]:
            cand=os.path.join(base,ref)
            if os.path.exists(cand): ref=cand; break
    tmp,used=xtts(text,out,ref,lang,stress)
    if tmp:
        _studio_master(tmp,out,tempo)
        try: os.remove(tmp)
        except Exception: pass
        return {"engine":"xtts_v2","out":out,"text_used":used}
    et=edge_fallback(text,out)
    if et:
        _studio_master(et,out,tempo)
        try: os.remove(et)
        except Exception: pass
        return {"engine":"edge_tts_fallback","out":out,"text_used":text}
    return {"engine":"FAIL","out":out}

if __name__=="__main__":
    a=[x for x in sys.argv[1:] if not x.startswith("--")]
    stress="accent"
    if "--stress" in sys.argv:
        i=sys.argv.index("--stress"); stress=sys.argv[i+1] if i+1<len(sys.argv) else "accent"
    tempo=1.0
    if "--tempo" in sys.argv:
        i=sys.argv.index("--tempo"); tempo=float(sys.argv[i+1])
    text=a[0] if len(a)>0 else "Студия V.CODE. За́мок на горе́ и замо́к на двери́."
    out=a[1] if len(a)>1 else "voice.wav"
    ref=a[2] if len(a)>2 else "voices/ref_male.wav"
    lang=a[3] if len(a)>3 else "ru"
    print(json.dumps(say(text,out,ref,lang,stress,tempo),ensure_ascii=False))
