# -*- coding: utf-8 -*-
"""Единый голос роликов OKO/V.CODE — бесплатно, с правильными ударениями (ruaccent),
студийным звуком (без «подводности») и клоном тембра по референсу.

Цепочка движков (по качеству, с автозапасом — никогда не остаётся без голоса):
  1) Higgs Audio v3 (patriotyk/higgs-audio-v3-tts) на HF ZeroGPU — лучшее качество,
     бесплатно, но суточный лимит ZeroGPU (~25 мин/сут free) — на 1 ролик/день хватает.
  2) XTTS-v2 локальный (xtts-venv) — БЕЗЛИМИТНЫЙ, бесплатный, клон по референсу.
  3) edge-tts (ru-RU) — крайний фолбэк, всегда доступен.
Везде: ruaccent проставляет ударения; на выходе — студийный мастер (пресенс-EQ+воздух).

CLI: python3 voice_engine.py "текст" out.wav [ref.wav] [--tempo 1.4] [--engine auto|higgs|xtts|edge]
API: from voice_engine import say; say("текст","out.wav",ref="voices/ref_ekaterina.wav",tempo=1.0)
"""
import os, sys, re, json, subprocess, shutil, asyncio

HERE=os.path.dirname(os.path.abspath(__file__))
PIPE=os.path.dirname(HERE)
CA=os.environ.get("CA_BUNDLE","/root/.ccr/ca-bundle.crt")
if os.path.exists(CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE",CA); os.environ.setdefault("SSL_CERT_FILE",CA)
HIGGS_SPACE="patriotyk/higgs-audio-v3-tts"
VOW="аеёиоуыэюяАЕЁИОУЫЭЮЯ"

# ---------- ударения (ruaccent) ----------
_ACC=None
def stress(text, accent_char=True):
    """Ставит ударения: '+гласная' -> 'гласная'+U+0301 (accent_char) или оставляет '+'."""
    global _ACC
    try:
        if _ACC is None:
            from ruaccent import RUAccent
            _ACC=RUAccent()
            try: _ACC.load(omograph_model_size='turbo3', use_dictionary=True, tiny_mode=False)
            except Exception: _ACC.load(omograph_model_size='turbo', use_dictionary=True)
        t=_ACC.process_all(text)
        if accent_char:
            t=re.sub(r'\+(['+VOW+r'])', lambda m:m.group(1)+'́', t)
        return t
    except Exception as e:
        sys.stderr.write("ruaccent skip: "+str(e)[:120]+"\n"); return text

# ---------- студийный мастер (убирает «подводность») ----------
def studio_master(inp, outp, tempo=1.0):
    af=("highpass=f=85,equalizer=f=250:t=q:w=1.0:g=-2,"
        "equalizer=f=3500:t=q:w=1.4:g=4,equalizer=f=6000:t=q:w=1.6:g=3,"
        "highshelf=f=9000:g=3,afftdn=nf=-28,dynaudnorm=f=200:g=6,"
        "loudnorm=I=-15:TP=-1.3:LRA=10")
    if abs(tempo-1.0)>1e-3: af=f"atempo={tempo:.3f},"+af
    subprocess.run(["ffmpeg","-y","-v","error","-i",inp,"-af",af,"-ar","44100","-ac","1",outp],
                   capture_output=True)
    return os.path.exists(outp) and os.path.getsize(outp)>2000

# ---------- 1) Higgs Audio v3 (ZeroGPU) ----------
def higgs(text_stressed, ref, out_raw, ref_text=""):
    try:
        from gradio_client import Client, handle_file
        tok=os.environ.get("HF_TOKEN")
        sslv=CA if os.path.exists(CA) else True
        c=Client(HIGGS_SPACE, token=tok, ssl_verify=sslv, verbose=False)
        if not ref_text:
            try: ref_text=str(c.predict(reference_audio=handle_file(ref), api_name="/transcribe"))
            except Exception: ref_text=""
        out=c.predict(text=text_stressed, reference_audio=handle_file(ref), reference_text=ref_text,
                      temperature=0.7, top_p=0.95, top_k=50, max_new_tokens=2048, seed=-1,
                      api_name="/synthesize")
        p=out["path"] if isinstance(out,dict) else out
        if p and os.path.exists(p):
            shutil.copy(p,out_raw); return os.path.getsize(out_raw)>2000
    except Exception as e:
        sys.stderr.write("[higgs] "+str(e)[:180]+"\n")
    return False

# ---------- 2) XTTS-v2 локальный ----------
def _xtts_py():
    p=os.environ.get("XTTS_PY")
    if p and os.path.exists(p): return p
    for c in ["xtts-venv/bin/python", os.path.join(os.getcwd(),"xtts-venv/bin/python"),
              os.path.expanduser("~/xtts-venv/bin/python")]:
        if os.path.exists(c): return c
    return None
_XG=("import os,sys;os.environ['COQUI_TOS_AGREED']='1'\n"
     "from TTS.api import TTS\n"
     "txt,out,ref=sys.argv[1],sys.argv[2],sys.argv[3]\n"
     "t=TTS('tts_models/multilingual/multi-dataset/xtts_v2',progress_bar=False)\n"
     "t.tts_to_file(text=txt,speaker_wav=ref,language='ru',file_path=out,temperature=0.65)\n"
     "print('XTTS_OK')\n")
def xtts(text_stressed, ref, out_raw):
    py=_xtts_py()
    if not py or not os.path.exists(ref): return False
    try:
        r=subprocess.run([py,"-c",_XG,text_stressed,out_raw,ref],capture_output=True,timeout=900,
                         env={**os.environ,"COQUI_TOS_AGREED":"1"})
        return b"XTTS_OK" in r.stdout and os.path.exists(out_raw) and os.path.getsize(out_raw)>2000
    except Exception: return False

# ---------- 3) edge-tts ----------
def edge(text_plain, out_raw, voice="ru-RU-SvetlanaNeural"):
    try:
        import edge_tts
        async def go(): await edge_tts.Communicate(text_plain,voice).save(out_raw)
        asyncio.run(go()); return os.path.exists(out_raw) and os.path.getsize(out_raw)>2000
    except Exception: return False

def _resolve_ref(ref):
    if os.path.isabs(ref) and os.path.exists(ref): return ref
    for base in [os.getcwd(), PIPE, HERE]:
        c=os.path.join(base,ref)
        if os.path.exists(c): return c
    return ref

def say(text, out, ref="voices/ref_ekaterina.wav", tempo=1.0, engine="auto", ref_text=""):
    ref=_resolve_ref(ref)
    # '+' перед ударной гласной (формат Higgs/F5/Silero). U+0301 ломает XTTS-токенизатор
    # («китайский») — поэтому НЕ используем accent_char.
    st=stress(text, accent_char=False)
    raw=out+".raw.wav"
    used=None
    order=(["higgs","xtts","edge"] if engine=="auto" else [engine])
    for eng in order:
        ok=False
        if eng=="higgs": ok=higgs(st, ref, raw, ref_text)
        elif eng=="xtts": ok=xtts(st, ref, raw)
        elif eng=="edge": ok=edge(text, raw)  # edge сам ставит ударения из своего словаря
        if ok: used=eng; break
    if not used: return {"engine":"FAIL","out":out,"text_used":st}
    studio_master(raw, out, tempo)
    try: os.remove(raw)
    except Exception: pass
    return {"engine":used,"out":out,"text_used":st}

if __name__=="__main__":
    args=[a for a in sys.argv[1:] if not a.startswith("--")]
    tempo=1.0; engine="auto"
    if "--tempo" in sys.argv: tempo=float(sys.argv[sys.argv.index("--tempo")+1])
    if "--engine" in sys.argv: engine=sys.argv[sys.argv.index("--engine")+1]
    text=args[0] if len(args)>0 else "Приве́т! Э́то мой го́лос."
    out=args[1] if len(args)>1 else "voice.wav"
    ref=args[2] if len(args)>2 else "voices/ref_ekaterina.wav"
    print(json.dumps(say(text,out,ref,tempo,engine),ensure_ascii=False))
