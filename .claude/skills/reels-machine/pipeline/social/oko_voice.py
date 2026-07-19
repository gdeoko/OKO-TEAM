#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKO Voice — БЕСПЛАТНЫЙ безлимитный клон голоса (ротатор HF-спейсов).
Перебирает лучшие бесплатные движки по порядку (A первым) и берёт тот, у кого
осталась дневная GPU-квота. Итог: идеальное качество + практический безлимит, 0 ₽.

Использование:
    pip install -r requirements.txt
    python oko_voice.py "Текст" out.wav                # авто-ротация движков
    python oko_voice.py "Текст" out.wav --ref reference/daniel_ref_28s.wav
    python oko_voice.py "Текст" out.wav --engine voxcpm # только один движок

Движки (по приоритету качества):
    omnivoice  k2-fsa/OmniVoice          — выбор «A»
    voxcpm     openbmb/VoxCPM-Demo       — живой/эмоциональный
    qwen3      Qwen/Qwen3-TTS            — Qwen, x-vector клон (без транскрипта)
    megatts3   mrfakename/MegaTTS3-Voice-Cloning
"""
import os, sys, shutil, argparse

REF_DEFAULT = os.path.join(os.path.dirname(__file__), "reference", "daniel_ref_15s.wav")

def _du(text):
    return max(8.0, round(len(text.split()) * 0.55 + 2, 1))

# ---- адаптеры движков: (client, text, ref, lang) -> локальный путь к аудио ----
def _omnivoice(c, text, ref, lang, hf):
    from gradio_client import handle_file
    r = c.predict(text=text, lang="Russian" if lang == "ru" else "English",
                  ref_aud=handle_file(ref), ref_text="", instruct="",
                  ns=64, gs=2.0, dn=True, sp=1.0, du=_du(text), pp=True, po=True,
                  api_name="/_clone_fn")
    return r[0] if isinstance(r, (list, tuple)) else r

def _voxcpm(c, text, ref, lang, hf):
    from gradio_client import handle_file
    r = c.predict(text_input=text, control_instruction="",
                  reference_wav_path_input=handle_file(ref),
                  use_prompt_text=False, prompt_text_input="",
                  cfg_value_input=2.0, do_normalize=True, denoise=False,
                  api_name="/generate")
    return r[0] if isinstance(r, (list, tuple)) else r

def _qwen3(c, text, ref, lang, hf):
    from gradio_client import handle_file
    r = c.predict(ref_audio=handle_file(ref), ref_text="", target_text=text,
                  language="Russian" if lang == "ru" else "English",
                  use_xvector_only=True, model_size="1.7B",
                  api_name="/generate_voice_clone")
    return r[0] if isinstance(r, (list, tuple)) else r

def _megatts3(c, text, ref, lang, hf):
    from gradio_client import handle_file
    r = c.predict(inp_audio=handle_file(ref), inp_text=text,
                  infer_timestep=32, p_w=1.4, t_w=3.0, api_name="/generate_speech")
    return r[0] if isinstance(r, (list, tuple)) else r

ENGINES = [
    ("omnivoice", "k2-fsa/OmniVoice",                 _omnivoice),
    ("voxcpm",    "openbmb/VoxCPM-Demo",              _voxcpm),
    ("qwen3",     "Qwen/Qwen3-TTS",                   _qwen3),
    ("megatts3",  "mrfakename/MegaTTS3-Voice-Cloning", _megatts3),
]

def _synth_one(text, ref, lang, only):
    """Один короткий фрагмент через ротатор движков. Возвращает (path, engine)."""
    from gradio_client import Client
    hf = os.environ.get("HF_TOKEN")
    last = None
    for name, space, fn in ENGINES:
        if only and name != only:
            continue
        try:
            print(f"[oko-voice] пробую {name} ({space}) ...", flush=True)
            c = Client(space, token=hf, verbose=False)
            path = fn(c, text, ref, lang, hf)
            if path and os.path.exists(path):
                return path, name
        except Exception as e:
            msg = str(e)
            tag = "КВОТА" if ("quota" in msg.lower() or "ZeroGPU" in msg) else "ошибка"
            print(f"[oko-voice] {name}: {tag} — {msg[:110]}", flush=True)
            last = e
    raise RuntimeError(f"движки недоступны: {last}")

def _chunks(text, max_words=14):
    """Режем на фрагменты по границам предложений (демо-спейсы обрезают длину)."""
    import re
    parts = re.split(r'(?<=[.!?…])\s+', text.strip())
    out, buf = [], ""
    for p in parts:
        if len((buf + " " + p).split()) <= max_words:
            buf = (buf + " " + p).strip()
        else:
            if buf:
                out.append(buf)
            # если само предложение длинное — режем по запятым
            if len(p.split()) > max_words:
                sub, b2 = re.split(r'(?<=[,;:])\s+', p), ""
                for s in sub:
                    if len((b2 + " " + s).split()) <= max_words:
                        b2 = (b2 + " " + s).strip()
                    else:
                        if b2: out.append(b2)
                        b2 = s
                buf = b2
            else:
                buf = p
    if buf:
        out.append(buf)
    return [c for c in out if c.strip()]

def _ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def _concat(wavs, out, gap=0.25):
    """Склейка фрагментов в один wav (24к моно) с паузами между ними."""
    import subprocess, tempfile
    ff = _ffmpeg()
    norm = []
    for i, w in enumerate(wavs):
        n = out + f".part{i}.wav"
        subprocess.run([ff, "-y", "-i", w, "-ac", "1", "-ar", "24000", n],
                       capture_output=True)
        norm.append(n)
    sil = out + ".sil.wav"
    subprocess.run([ff, "-y", "-f", "lavfi", "-i",
                    f"anullsrc=r=24000:cl=mono", "-t", str(gap), sil],
                   capture_output=True)
    listf = out + ".list.txt"
    with open(listf, "w") as f:
        for i, n in enumerate(norm):
            f.write(f"file '{os.path.abspath(n)}'\n")
            if i != len(norm) - 1:
                f.write(f"file '{os.path.abspath(sil)}'\n")
    subprocess.run([ff, "-y", "-f", "concat", "-safe", "0", "-i", listf,
                    "-ac", "1", "-ar", "24000", out], capture_output=True)
    for n in norm + [sil, listf]:
        try: os.remove(n)
        except OSError: pass
    return out

def synth(text, out="out.wav", ref=REF_DEFAULT, lang="ru", only=None, max_words=14):
    """Озвучка ЛЮБОЙ длины: режем на фрагменты, каждый — через ротатор, склеиваем."""
    chunks = _chunks(text, max_words)
    if len(chunks) <= 1:
        path, eng = _synth_one(text, ref, lang, only)
        shutil.copy(path, out)
        print(f"[oko-voice] ГОТОВО ({eng}) -> {out}", flush=True)
        return out, eng
    print(f"[oko-voice] текст длинный -> {len(chunks)} фрагмент(ов)", flush=True)
    wavs, engines = [], set()
    for i, ch in enumerate(chunks):
        print(f"[oko-voice] фрагмент {i+1}/{len(chunks)}: {ch[:40]}...", flush=True)
        p, eng = _synth_one(ch, ref, lang, only)
        wavs.append(p); engines.add(eng)
    _concat(wavs, out)
    print(f"[oko-voice] ГОТОВО ({'+'.join(engines)}, {len(chunks)} фр.) -> {out}", flush=True)
    return out, "+".join(engines)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text"); ap.add_argument("out", nargs="?", default="out.wav")
    ap.add_argument("--ref", default=REF_DEFAULT)
    ap.add_argument("--lang", default="ru")
    ap.add_argument("--engine", default=None, help="omnivoice|voxcpm|qwen3|megatts3")
    a = ap.parse_args()
    synth(a.text, a.out, a.ref, a.lang, a.engine)

if __name__ == "__main__":
    main()
