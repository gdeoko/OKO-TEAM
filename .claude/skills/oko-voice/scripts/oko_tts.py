#!/usr/bin/env python3
"""
OKO canonical TTS — БЕСПЛАТНО, локально, без кредитов.
Голос бренда OKO: Silero v4_ru, speaker "eugene" (утверждён Даниэлем).
Премиум/клонирование: XTTS-v2 (Coqui) — тот же скрипт, engine=xtts.

Использование (озвучка роликов Академии, голосовых ИИ-агента, VPS):
  python3 oko_tts.py --text "Привет, это ОКО." --out out.wav
  python3 oko_tts.py --engine silero --voice eugene --textfile script.txt --out vo.wav
  python3 oko_tts.py --engine xtts --ref voice_ref.wav --text "..." --out vo.wav

Silero:
  - модель v4_ru (~40МБ) качается один раз в ~/.cache/oko-voice/v4_ru.pt
  - speakers: eugene(муж, БРЕНД), aidar(муж), kseniya/xenia/baya(жен)
  - держит ударения (put_accent); ручные ударения — символ '+' перед гласной
  - лимит ~1000 символов/вызов → длинный текст бьём по предложениям
XTTS-v2:
  - engine=xtts, качество ближе к ElevenLabs, умеет клонировать голос по --ref (6-20с wav)
  - тоже бесплатно/локально (модель ~1.8ГБ, качается через coqui-tts)

Сеть только через curl с cacert (urllib ходит мимо прокси).
"""
import argparse, os, re, subprocess, sys, wave

CACHE = os.path.expanduser("~/.cache/oko-voice")
SILERO_URL = "https://models.silero.ai/models/tts/ru/v4_ru.pt"
SILERO_PT = os.path.join(CACHE, "v4_ru.pt")
CACERT = "/root/.ccr/ca-bundle.crt"
BRAND_VOICE = "eugene"   # утверждённый голос OKO
SR = 48000

def ensure_silero():
    os.makedirs(CACHE, exist_ok=True)
    if not os.path.exists(SILERO_PT) or os.path.getsize(SILERO_PT) < 1_000_000:
        cur = ["curl", "-sSL", "-o", SILERO_PT, SILERO_URL]
        if os.path.exists(CACERT):
            cur[1:1] = ["--cacert", CACERT]
        subprocess.run(cur, check=True)
    return SILERO_PT

def split_sentences(text, limit=900):
    # split into <=limit chunks on sentence boundaries
    parts = re.split(r'(?<=[.!?…])\s+', text.strip())
    out, buf = [], ""
    for p in parts:
        if len(buf) + len(p) + 1 <= limit:
            buf = (buf + " " + p).strip()
        else:
            if buf: out.append(buf)
            buf = p
            while len(buf) > limit:  # hard-split very long
                out.append(buf[:limit]); buf = buf[limit:]
    if buf: out.append(buf)
    return out

def synth_silero(text, voice, out_wav):
    import torch, numpy as np
    torch.set_num_threads(max(2, (os.cpu_count() or 4) - 1))
    imp = torch.package.PackageImporter(ensure_silero())
    model = imp.load_pickle("tts_models", "model")
    model.to(torch.device("cpu"))
    if voice not in getattr(model, "speakers", [voice]):
        print(f"[warn] voice '{voice}' not in {model.speakers}; using {BRAND_VOICE}", file=sys.stderr)
        voice = BRAND_VOICE
    chunks = split_sentences(text)
    audio = []
    for c in chunks:
        try:
            a = model.apply_tts(text=c, speaker=voice, sample_rate=SR, put_accent=True, put_yo=True)
            audio.append(a.numpy())
            audio.append(np.zeros(int(SR*0.18), dtype=a.numpy().dtype))  # tiny gap
        except Exception as e:
            print(f"[warn] chunk failed ({e}); skipping", file=sys.stderr)
    arr = np.concatenate(audio) if audio else np.zeros(SR, dtype="float32")
    arr = (np.clip(arr, -1, 1) * 32767).astype("int16")
    with wave.open(out_wav, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(arr.tobytes())
    return len(arr) / SR

def synth_xtts(text, ref, out_wav, language="ru"):
    from TTS.api import TTS as CoquiTTS
    tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False)
    kw = dict(text=text, language=language, file_path=out_wav)
    if ref and os.path.exists(ref):
        kw["speaker_wav"] = ref
    else:
        # built-in studio speakers; "Damien Black"(male), "Daisy Studious"(female) etc.
        kw["speaker"] = os.environ.get("OKO_XTTS_SPEAKER", "Damien Black")
    tts.tts_to_file(**kw)
    import wave as _w
    with _w.open(out_wav) as f: return f.getnframes()/f.getframerate()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default=os.environ.get("OKO_TTS_ENGINE", "silero"), choices=["silero", "xtts"])
    ap.add_argument("--voice", default=os.environ.get("OKO_TTS_VOICE", BRAND_VOICE))
    ap.add_argument("--ref", default=None, help="XTTS reference wav (voice clone)")
    ap.add_argument("--text", default=None)
    ap.add_argument("--textfile", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mp3", action="store_true", help="also write .mp3 next to .out")
    a = ap.parse_args()
    text = a.text if a.text is not None else open(a.textfile, encoding="utf-8").read()
    if a.engine == "silero":
        dur = synth_silero(text, a.voice, a.out)
    else:
        dur = synth_xtts(text, a.ref, a.out)
    print(f"[ok] {a.engine} -> {a.out} ({dur:.1f}s)")
    if a.mp3:
        mp3 = os.path.splitext(a.out)[0] + ".mp3"
        subprocess.run(["ffmpeg","-y","-i",a.out,"-af","loudnorm=I=-16:TP=-1.5","-c:a","libmp3lame","-b:a","160k",mp3],
                       capture_output=True)
        print(f"[ok] mp3 -> {mp3}")

if __name__ == "__main__":
    main()
