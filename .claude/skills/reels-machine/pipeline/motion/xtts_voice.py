# -*- coding: utf-8 -*-
"""Голос ролика — XTTS-v2 (локальный, бесплатный, клон тембра по референсу),
фолбэк edge-tts. Мужской бренд-голос через референс ref_male.wav.

XTTS-v2 ставится в отдельный venv (см. INTEGRATIONS): torch==2.4.1, coqui-tts==0.25.3
(coqpit-config, transformers 4.46) — так обходятся конфликты torchcodec/coqpit.
Путь к python venv задаётся XTTS_PY (по умолч. ищет ./xtts-venv/bin/python).

CLI:
  XTTS_PY=/path/to/xtts-venv/bin/python \
  python3 xtts_voice.py "текст" out.wav [ref_male.wav] [ru]
Питон:
  from xtts_voice import say
  say("Привет", "out.wav", ref="ref_male.wav")
"""
import os, sys, subprocess, shutil, asyncio

def _find_xtts_py():
    p=os.environ.get("XTTS_PY")
    if p and os.path.exists(p): return p
    for c in ["xtts-venv/bin/python","./xtts-venv/bin/python",
              os.path.expanduser("~/xtts-venv/bin/python")]:
        if os.path.exists(c): return c
    return None

_GEN = (
 "import os,sys;os.environ['COQUI_TOS_AGREED']='1'\n"
 "from TTS.api import TTS\n"
 "txt,out,ref,lang=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]\n"
 "t=TTS('tts_models/multilingual/multi-dataset/xtts_v2',progress_bar=False)\n"
 "t.tts_to_file(text=txt,speaker_wav=ref,language=lang,file_path=out)\n"
 "print('XTTS_OK',out)\n")

def xtts(text, out, ref="ref_male.wav", lang="ru"):
    py=_find_xtts_py()
    if not py or not os.path.exists(ref): return False
    try:
        r=subprocess.run([py,"-c",_GEN,text,out,ref,lang],
                         capture_output=True,timeout=600,
                         env={**os.environ,"COQUI_TOS_AGREED":"1"})
        return b"XTTS_OK" in r.stdout and os.path.exists(out) and os.path.getsize(out)>2000
    except Exception:
        return False

def edge_fallback(text, out, voice="ru-RU-DmitryNeural", rate="+6%"):
    import edge_tts
    tmp=out if out.endswith(".mp3") else out+".mp3"
    async def go():
        await edge_tts.Communicate(text,voice,rate=rate).save(tmp)
    asyncio.run(go())
    if tmp!=out:
        subprocess.run(["ffmpeg","-y","-i",tmp,"-ar","24000","-ac","1",out],
                       capture_output=True)
    return os.path.exists(out)

def say(text, out, ref="ref_male.wav", lang="ru"):
    """XTTS-v2 если доступен, иначе edge-tts (мужской Dmitry)."""
    if xtts(text,out,ref,lang):
        return {"engine":"xtts_v2","out":out}
    edge_fallback(text,out)
    return {"engine":"edge_tts_fallback","out":out}

if __name__=="__main__":
    text=sys.argv[1] if len(sys.argv)>1 else "Студия V.CODE в Ставрополе."
    out=sys.argv[2] if len(sys.argv)>2 else "voice.wav"
    ref=sys.argv[3] if len(sys.argv)>3 else "ref_male.wav"
    lang=sys.argv[4] if len(sys.argv)>4 else "ru"
    print(say(text,out,ref,lang))
