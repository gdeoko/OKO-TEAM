#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V.CODE — КАНОНИЧНЫЙ голос всех роликов (зафиксировано Даниэлем 18.07.2026).
Движок: OmniVoice (k2-fsa) zero-shot клон Владимира. Бесплатно, безлимитно.

ЗАБЛОКИРОВАНО (менять только по прямой просьбе Даниэля):
  референс = reference/vladimir_ref_30s.wav | ns=48 | СКОРОСТЬ=1.2x (Даниэль 28.07: было 1.8, стало 1.2 —
  живее, без тараторья; пунктуация в тексте = логические паузы)
  + авто-обрезка стартового призвука И хвостовой галлюцинации (никаких «мягко»).

  python vcode_voice.py "Текст ролика" out.mp3
  from vcode_voice import synth;  synth("текст", "out.mp3")
"""
import os, sys, shutil, subprocess, tempfile, argparse, re
HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = "k2-fsa/OmniVoice"
REF_30 = os.path.join(HERE, "reference", "vladimir_ref_30s.wav")
NS = 48; GS = 2.0; SPEED = 1.2   # Даниэль 28.07: 1.8→1.2, живой темп с паузами по пунктуации
MASTER = "highpass=f=80,loudnorm=I=-14.5:TP=-1.2"
# du = целевая длительность для OmniVoice. Раньше была завышена (0.55/слово+2) → модель
# ДОБИВАЛА лишнее время ГАЛЛЮЦИНАЦИЕЙ-ФИЛЛЕРОМ в конце («мягко мягко...»). Теперь ближе к
# естественной речи; хвостовую галлюцинацию всё равно срезаем _bounds по ASR.
def _du(text, k=1.0): return max(6.0, round(max(1, len(text.split())) * 0.40 * k + 1.2, 1))
def _omnivoice(text, ref, out_wav, du=None):
    from gradio_client import Client, handle_file
    c = Client(SPACE, token=os.environ.get("HF_TOKEN"), verbose=False)
    r = c.predict(text=text, lang="Russian", ref_aud=handle_file(ref), ref_text="",
        instruct="", ns=NS, gs=GS, dn=True, sp=1.0, du=du if du else _du(text), pp=True, po=True,
        api_name="/_clone_fn")
    shutil.copy(r[0] if isinstance(r,(list,tuple)) else r, out_wav)
def _norm(w): return re.sub(r"[^а-яёa-z0-9]", "", w.lower())
def _asr_words(wav):
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(wav, vad_filter=True, word_timestamps=True)
    return [w for s in segs for w in (s.words or [])]
def _halluc(words, text):
    """True, если OmniVoice вставил лишнее (филлер вроде «мягко»): чужие слова, которых нет
    в сценарии, повторяются или их слишком много относительно сценария."""
    from collections import Counter
    sw = set(_norm(x) for x in text.split() if _norm(x))
    foreign = [_norm(w.word) for w in words if _norm(w.word) and _norm(w.word) not in sw]
    c = Counter(foreign)
    if any(v >= 3 for v in c.values()): return True                 # чужое слово-повтор = филлер
    if len(words) and len(foreign) > 0.30 * len(words): return True # слишком много лишнего
    return False
def _bounds(wav, text, words=None):
    """Границы полезной речи (start, end). Режет и стартовый призвук, и ХВОСТОВУЮ
    галлюцинацию OmniVoice (повтор слов вроде «мягко»). end = конец последнего слова,
    реально совпавшего с концом сценария; всё, что модель добила после — отбрасываем."""
    try:
        if words is None: words = _asr_words(wav)
        if not words: return 0.0, None
        sw = [ _norm(x) for x in text.split() ]
        # --- start ---
        if _norm(words[0].word) == sw[0]:
            st = max(0.0, words[0].start - 0.05)
        elif len(words) > 1:
            st = max(0.0, words[1].start - 0.05)
        else:
            st = max(0.0, words[0].end)
        # --- end: последнее вхождение последнего слова сценария (кон. хвоста хука) ---
        tail = [w for w in sw if w][-3:]                       # 3 последних слова сценария
        en = None
        wl = [_norm(w.word) for w in words]
        for i in range(len(words) - 1, -1, -1):
            if tail and wl[i] == tail[-1]:
                en = words[i].end + 0.12; break
        # если не нашли последнее слово, но распознали хвостовую болтологию длиннее сценария —
        # обрезаем по числу слов сценария (страховка от филлера)
        if en is None and len(words) > len(sw) + 1:
            en = words[len(sw)-1].end + 0.12
        return st, en
    except Exception as e:
        sys.stderr.write(f"[bounds fallback: {e}]\n"); return 1.3, None

def word_timings(audio):
    """[{w,t,d}] по финальному аудио (для караоке и привязки анимаций)."""
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(audio, vad_filter=True, word_timestamps=True)
    out=[]
    for sg in segs:
        for w in (sg.words or []):
            ww=w.word.strip()
            if ww: out.append({"w":ww,"t":round(w.start,3),"d":round(w.end-w.start,3)})
    return out

def _synth_one(text, out_wav, ref):
    """Одно короткое предложение: OmniVoice + анти-филлер-ретрай + обрезка границ. БЕЗ atempo/мастера."""
    words=None
    with tempfile.TemporaryDirectory() as td:
        raw=os.path.join(td,"raw.wav")
        for k in (1.0, 0.82):
            _omnivoice(text, ref, raw, du=_du(text, k))
            words=_asr_words(raw)
            if not _halluc(words, text): break
            sys.stderr.write(f"[synth: филлер в '{text[:30]}...', ретрай du×{k}]\n")
        st, en = _bounds(raw, text, words)
        seg=["-ss",f"{st:.3f}"]+(["-t",f"{max(0.4,en-st):.3f}"] if en else [])
        subprocess.run(["ffmpeg","-y","-v","error",*seg,"-i",raw,"-c:a","pcm_s16le",out_wav],check=True)
    return out_wav

def _sentences(text):
    import re as _r
    parts=_r.split(r'(?<=[.!?])\s+', text.strip())
    return [p.strip() for p in parts if p.strip()]

def synth(text, out_mp3, ref=REF_30, speed=SPEED, json_out=None, gap=0.26):
    """ПО ПРЕДЛОЖЕНИЯМ (короткие = чистые, БЕЗ «мягко») + склейка с паузами по пунктуации.
    Длинный текст одним куском OmniVoice портит (вставляет филлер на паузах, рушит длину) —
    поэтому режем на предложения, синтезим каждое отдельно, склеиваем с тишиной."""
    text=" ".join(text.split())
    sents=_sentences(text)
    with tempfile.TemporaryDirectory() as td:
        wavs=[]
        sil=os.path.join(td,"sil.wav")
        subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{gap}","-i","anullsrc=r=24000:cl=mono",sil],check=True)
        for i,s in enumerate(sents):
            w=os.path.join(td,f"s{i}.wav"); _synth_one(s, w, ref)
            wavs.append(w)
        # конкат: предложение + пауза
        lst=os.path.join(td,"list.txt")
        with open(lst,"w") as f:
            for i,w in enumerate(wavs):
                f.write(f"file '{w}'\n")
                if i < len(wavs)-1: f.write(f"file '{sil}'\n")
        joined=os.path.join(td,"joined.wav")
        subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy",joined],check=True)
        af=f"atempo={speed},{MASTER}" if speed and abs(speed-1.0)>1e-3 else MASTER
        subprocess.run(["ffmpeg","-y","-v","error","-i",joined,"-af",af,"-b:a","192k",out_mp3],check=True)
    if json_out:
        import json as _j
        _j.dump(word_timings(out_mp3), open(json_out,"w"), ensure_ascii=False)
    return out_mp3
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text", nargs="?"); ap.add_argument("out")
    ap.add_argument("--stdin", action="store_true"); ap.add_argument("--ref", default=REF_30)
    ap.add_argument("--speed", type=float, default=SPEED)
    ap.add_argument("--json", dest="json_out", default=None, help="Куда сохранить словные тайминги {w,t,d}"); a = ap.parse_args()
    txt = sys.stdin.read() if a.stdin else a.text
    if not txt or not txt.strip(): sys.exit("нет текста")
    synth(txt, a.out, ref=a.ref, speed=a.speed, json_out=a.json_out)
    print(f"[vcode_voice] готово -> {a.out} (ref={os.path.basename(a.ref)}, {a.speed}x)")
if __name__ == "__main__": main()
