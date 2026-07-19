#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKO Voice PRO — озвучка голосом Даниэля НА ВЫСШЕМ УРОВНЕ, одной командой.
Полный конвейер: словарь ударений → клон (движок A / OmniVoice, с фолбэком) →
resemble-enhance (студийная чистота+живость) → мастеринг (пресенс, громкость,
скорость 1.7x, 44.1 кГц hi-fi).

Быстрый старт:
    pip install -r requirements.txt
    export HF_TOKEN=hf_xxx            # аккаунт с HF PRO = безлимит движка A
    python oko_voice_pro.py "Любой сценарий..." out.mp3

Опции:
    --ref reference/daniel_ref_28s.wav   # референс голоса (по умолчанию 28с)
    --speed 1.7                          # скорость речи (1.0 = обычная)
    --no-enhance                         # без resemble-enhance (быстрее, чуть проще звук)
    --engine omnivoice|voxcpm|qwen3|megatts3   # форсировать один движок

Ударения: правятся ТОЛЬКО для слов из stress_dict.txt (ОКО→О́КО и т.д.) — остальной
текст не трогаем (так русский звучит естественнее, чем при полной авто-расстановке).
Добавляй сложные слова в stress_dict.txt.
"""
import os, re, sys, shutil, subprocess, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import oko_voice  # ротатор движков (клон)

REF_DEFAULT = os.path.join(HERE, "reference", "daniel_ref_28s.wav")
DICT_PATH = os.path.join(HERE, "stress_dict.txt")

def _ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def load_dict(path=DICT_PATH):
    d = {}
    if os.path.exists(path):
        for ln in open(path, encoding="utf-8"):
            ln = ln.strip()
            if not ln or ln.startswith("#") or "=" not in ln:
                continue
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip()
    return d

def apply_stress(text, d):
    """Помечаем ударение только для слов из словаря (по границам слова)."""
    for k, v in sorted(d.items(), key=lambda x: -len(x[0])):
        text = re.sub(r'(?<!\w)' + re.escape(k) + r'(?!\w)', v, text)
    return text

def enhance(inp, outp, solver="RK4", nfe=128, tau=0.5):
    """Студийный энхансер resemble-enhance (HF, бесплатно, нужна GPU-квота)."""
    from gradio_client import Client, handle_file
    tok = os.environ.get("HF_TOKEN")
    c = Client("ResembleAI/resemble-enhance", token=tok, verbose=False)
    r = c.predict(path=handle_file(inp), solver=solver, nfe=nfe, tau=tau,
                  denoising=True, api_name="/partial")
    enh = r[1] if isinstance(r, (list, tuple)) and len(r) > 1 else (r[0] if isinstance(r, (list, tuple)) else r)
    shutil.copy(enh, outp)
    return outp

def master(inp, out, speed=1.7):
    """Мастеринг: скорость, пресенс, громкость вещателя, 44.1 кГц."""
    ff = _ffmpeg()
    af = (f"atempo={speed},highpass=f=60,treble=g=2:f=8000,"
          f"loudnorm=I=-15:TP=-1.5:LRA=10")
    codec = ["-codec:a", "libmp3lame", "-q:a", "0"] if out.lower().endswith(".mp3") else []
    subprocess.run([ff, "-y", "-i", inp, "-af", af, "-ar", "44100", "-ac", "1",
                    *codec, out], capture_output=True)
    return out

def produce(text, out="out.mp3", ref=REF_DEFAULT, speed=1.7, do_enhance=True, engine=None):
    d = load_dict()
    marked = apply_stress(text, d)
    if marked != text:
        print(f"[pro] ударения: {', '.join(d.keys())}", flush=True)
    raw = out + ".raw.wav"
    print("[pro] 1/3 синтез голоса (движок A / фолбэк)...", flush=True)
    oko_voice.synth(marked, raw, ref, lang="ru", only=engine)
    src = raw
    if do_enhance:
        print("[pro] 2/3 resemble-enhance (студийная чистота)...", flush=True)
        try:
            src = enhance(raw, out + ".enh.wav")
        except Exception as e:
            print(f"[pro] enhance пропущен ({str(e)[:80]}) — беру сырой", flush=True)
            src = raw
    print(f"[pro] 3/3 мастеринг (скорость {speed}, 44.1кГц)...", flush=True)
    master(src, out, speed)
    # чистим временные
    for f in (raw, out + ".enh.wav"):
        try: os.remove(f)
        except OSError: pass
    print(f"[pro] ГОТОВО -> {out}", flush=True)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text"); ap.add_argument("out", nargs="?", default="out.mp3")
    ap.add_argument("--ref", default=REF_DEFAULT)
    ap.add_argument("--speed", type=float, default=1.7)
    ap.add_argument("--no-enhance", action="store_true")
    ap.add_argument("--engine", default=None)
    a = ap.parse_args()
    produce(a.text, a.out, a.ref, a.speed, not a.no_enhance, a.engine)

if __name__ == "__main__":
    main()
