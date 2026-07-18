#!/usr/bin/env python3
"""
OKO Voice PRO v2 — студийный клон голоса (XTTS-v2), БЕЗ «подводности/телефона»,
скорость 1.5x. Бесплатно, локально, безлимит (ни API, ни ключей, ни оплаты).

Что чиним по сравнению с v1 (жалоба «не студийно, помехи, как под водой/по телефону»):
  ПРИЧИНА подводности/телефона в v1:
    (1) afftdn (FFT-шумодав) на чистом XTTS-выходе → «musical noise»/подводность;
    (2) референс 22050 + отсутствие «воздуха» → энергия обрывалась на ~8 кГц
        (это и есть «телефонная» полоса). Замер: v1 band_edge=7910 Гц, E>8к=0.01%.
  РЕШЕНИЕ v2 (замер: band_edge=10348 Гц, E>8к=0.19% — в ~19 раз больше «воздуха»):
    (1) Референс НАТИВНЫЕ 24000 Гц (oko_ref_pro_24k.wav), собран из самого чистого
        голосового владельца МИНИМАЛЬНО: highpass=60 + loudnorm, БЕЗ лоупасса/шумодава,
        полная полоса до ~10.8 кГц (потолок задаёт сам opus-исходник Telegram ~9-11 кГц).
    (2) XTTS генерит на НАТИВНЫХ 24000 Гц, НЕ роняем до 22050.
    (3) Мастеринг БЕЗ afftdn и БЕЗ денойза вообще (XTTS-выход уже чистый, шум-фон ~-48дБ;
        arnndn/RNNoise на TTS ЛОМАЕТ речь — проверено whisper: «чистый звук»→«чтодамок»).
        Цепочка: highpass=60 → лёгкий деэссер → presence +1.5дБ@4.5к (антидот телефонности)
        → high-shelf +2дБ@8к («воздух») → loudnorm I=-16:TP=-1.5. Без реверба/эксайтера/лоупасса.
    (4) СКОРОСТЬ atempo=1.5 в самом конце (сохраняет высоту → без «чипмунка»).
  Разборчивость на 1.5x проверена whisper — текст полный, без каши.

Тон (--tone): clean (дефолт) | warm (тёплее, +тело low-mid) | bright (ещё воздушнее) | low (−1 полутон)
Скорость (--speed): 1.5 по умолчанию (требование владельца). 1.0 = натуральный темп.

Использование:
  python3 oko_voice_pro.py --textfile script.txt --out vo.wav              # 1.5x, clean
  python3 oko_voice_pro.py --text "Привет, это ОКО." --speed 1.0 --out vo.wav
  python3 oko_voice_pro.py --ref my_ref_24k.wav --tone warm --out vo.wav
Сеть только curl --cacert (модели XTTS/whisper уже в кэше).
Премиум-путь (Higgsfield) — см. SKILL.md; для РУССКОГО НЕ рекомендован (ByteDance Seed
Audio коверкает произношение). Локальный XTTS v2 — дефолт и лучший вариант для RU.
"""
import argparse, os, re, subprocess, sys, json, difflib
os.environ["COQUI_TOS_AGREED"] = "1"
import numpy as np, soundfile as sf
import torch, torchaudio

# --- грабля torchcodec: подменяем загрузчик на soundfile ДО import TTS ---
def _sf_load(path, *a, **k):
    d, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(d.T.copy()), sr
torchaudio.load = _sf_load

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REF = os.path.normpath(os.path.join(HERE, "../../../..", "oko-app/brand/voice/oko_ref_pro_24k.wav"))
SR = 24000  # XTTS-v2 native — НЕ ронять

# Победивший конфиг XTTS (A/B: sim 0.93+, 0 мамблов, натуральный темп)
GEN = dict(temperature=0.3, repetition_penalty=10.0, top_k=30, top_p=0.75,
           length_penalty=1.0, speed=1.0, split_sentences=False)

# Мастеринг-хвост БЕЗ денойза/лоупасса. {sp} = atempo (скорость). Частоты в Гц (абсолютные).
def master_chain(tone, speed):
    tail = f"loudnorm=I=-16:TP=-1.5:LRA=9,atempo={speed:.3f}"
    chains = {
        "clean": ("highpass=f=60,deesser=i=0.35:f=0.5:m=0.5,"
                  "equalizer=f=4500:t=q:w=1.2:g=1.5,highshelf=f=8000:g=2,"),
        "warm":  ("highpass=f=60,equalizer=f=180:t=q:w=1.0:g=2.5,deesser=i=0.4:f=0.5:m=0.5,"
                  "equalizer=f=4500:t=q:w=1.2:g=1.0,highshelf=f=8000:g=1.5,"),
        "bright":("highpass=f=60,deesser=i=0.3:f=0.5:m=0.5,"
                  "equalizer=f=5000:t=q:w=1.2:g=2.5,highshelf=f=8000:g=3,"),
        "low":   ("highpass=f=60,rubberband=pitch=0.943874:pitchq=quality:transients=smooth,"
                  "deesser=i=0.35:f=0.5:m=0.5,equalizer=f=4500:t=q:w=1.2:g=1.5,highshelf=f=8000:g=2,"),
    }
    return chains.get(tone, chains["clean"]) + tail

def norm(s):
    return [re.sub(r'[^0-9a-zа-яё]', '', w.lower()) for w in s.split()
            if re.sub(r'[^0-9a-zа-яё]', '', w.lower())]

def split_sentences(text):
    parts = re.split(r'(?<=[.!?…])\s+', text.strip())
    return [p.strip() for p in parts if p.strip()]

_wh = None
def wh_words(path):
    global _wh
    if _wh is None:
        from faster_whisper import WhisperModel
        _wh = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _wh.transcribe(path, language="ru", beam_size=5,
                             word_timestamps=True, vad_filter=False)
    out = []
    for s in segs:
        for w in (s.words or []):
            out.append((w.start, w.end, re.sub(r'[^0-9a-zа-яё]', '', w.word.lower().strip())))
    return out

def tail_trim(path, script, pad_start=0.06, pad_end=0.18, fade=0.06, mumble_gap=0.35):
    """Режем аудио по началу/концу речи + отрезаем ТОЛЬКО галлюцинации-хвосты."""
    d, sr = sf.read(path)
    if d.ndim > 1: d = d.mean(1)
    words = wh_words(path)
    if not words:
        return d.astype("float32"), len(d)/sr, 0.0, 0
    hyp = [w[2] for w in words]; ref = norm(script); ref_set = set(ref)
    sm = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    trailing = 0
    if blocks:
        last = blocks[-1]; li = last.b + last.size - 1
        end_idx = li; j = li + 1
        while j < len(words):
            gap = words[j][0] - words[j - 1][1]
            if gap > mumble_gap or words[j][2] not in ref_set: break
            end_idx = j; j += 1
        end_t = words[end_idx][1]; trailing = len(words) - 1 - end_idx
    else:
        end_t = words[-1][1]
    start_t = max(0.0, words[0][0] - pad_start)
    end_t = min(len(d)/sr, end_t + pad_end)
    seg = d[int(start_t*sr):int(end_t*sr)].astype("float32").copy()
    nf = int(fade*sr); ns = int(0.02*sr)
    if len(seg) > nf: seg[-nf:] *= np.linspace(1, 0, nf)
    if len(seg) > ns: seg[:ns] *= np.linspace(0, 1, ns)
    return seg, len(seg)/sr, sm.ratio(), trailing

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text"); ap.add_argument("--textfile")
    ap.add_argument("--ref", default=DEFAULT_REF)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tone", default="clean", choices=["clean", "warm", "bright", "low"])
    ap.add_argument("--speed", type=float, default=1.5, help="atempo в конце (владелец: 1.5)")
    ap.add_argument("--gap", type=float, default=0.22, help="пауза между предложениями, с (до ускорения)")
    ap.add_argument("--retries", type=int, default=2, help="лучший из N по интеллигибельности")
    ap.add_argument("--no-mp3", action="store_true")
    a = ap.parse_args()
    text = a.text if a.text else open(a.textfile, encoding="utf-8").read()
    ref = a.ref if os.path.exists(a.ref) else None
    if not ref:
        print(f"[err] ref not found: {a.ref}", file=sys.stderr); sys.exit(1)
    if not (0.5 <= a.speed <= 2.0):
        print("[err] --speed 0.5..2.0 (atempo single-stage)", file=sys.stderr); sys.exit(1)

    torch.set_num_threads(max(2, (os.cpu_count() or 6) - 1))
    from TTS.api import TTS
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False)

    sents = split_sentences(text)
    work = os.path.splitext(a.out)[0] + "_seg"; os.makedirs(work, exist_ok=True)
    parts, report = [], []
    for i, sent in enumerate(sents):
        best = None
        for att in range(1, a.retries + 1):
            fp = f"{work}/s{i}_a{att}.wav"
            tts.tts_to_file(text=sent, language="ru", speaker_wav=[ref], file_path=fp, **GEN)
            seg, dur, sim, tr = tail_trim(fp, sent)
            key = sim - 0.04 * tr
            cand = (key, seg, dur, sim, tr)
            if best is None or cand[0] > best[0]: best = cand
            if sim >= 0.9 and tr == 0: break
        _, seg, dur, sim, tr = best
        parts.append(seg); parts.append(np.zeros(int(SR*a.gap), dtype="float32"))
        report.append({"i": i, "dur": round(dur, 2), "sim": round(sim, 3), "trail_cut": tr})
        print(f"s{i}: dur={dur:.2f} sim={sim:.3f} trail_cut={tr}", flush=True)

    nat = np.concatenate(parts).astype("float32")
    nat_path = os.path.splitext(a.out)[0] + "_nat.wav"
    sf.write(nat_path, nat, SR)
    af = master_chain(a.tone, a.speed)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", nat_path,
                    "-af", af, "-ar", str(SR), "-ac", "1", a.out], check=True)
    print(f"[ok] {a.out} (tone={a.tone} speed={a.speed} sr={SR})")
    if not a.no_mp3:
        mp3 = os.path.splitext(a.out)[0] + ".mp3"
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", a.out,
                        "-c:a", "libmp3lame", "-b:a", "192k", mp3], check=True)
        print(f"[ok] {mp3}")
    json.dump({"tone": a.tone, "speed": a.speed, "sr": SR, "segments": report},
              open(os.path.splitext(a.out)[0] + "_qc.json", "w"), ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
