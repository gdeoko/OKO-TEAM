#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V.CODE — КАНОНИЧНЫЙ голос всех роликов (зафиксировано Даниэлем 18.07.2026).
Движок: OmniVoice (k2-fsa) zero-shot клон Владимира. Бесплатно, безлимитно.

ЗАБЛОКИРОВАНО (менять только по прямой просьбе Даниэля):
  референс = reference/vladimir_ref_30s.wav | ns=48 | СКОРОСТЬ=1.8x
  + авто-обрезка стартового призвука OmniVoice.

  python vcode_voice.py "Текст ролика" out.mp3
  from vcode_voice import synth;  synth("текст", "out.mp3")
"""
import os, sys, shutil, subprocess, tempfile, argparse, re
HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = "k2-fsa/OmniVoice"
REF_30 = os.path.join(HERE, "reference", "vladimir_ref_30s.wav")
NS = 48; GS = 2.0; SPEED = 1.8
MASTER = "highpass=f=80,loudnorm=I=-14.5:TP=-1.2"
def _du(text): return max(8.0, round(max(1, len(text.split())) * 0.55 + 2, 1))
def _omnivoice(text, ref, out_wav):
    from gradio_client import Client, handle_file
    c = Client(SPACE, token=os.environ.get("HF_TOKEN"), verbose=False)
    r = c.predict(text=text, lang="Russian", ref_aud=handle_file(ref), ref_text="",
        instruct="", ns=NS, gs=GS, dn=True, sp=1.0, du=_du(text), pp=True, po=True,
        api_name="/_clone_fn")
    shutil.copy(r[0] if isinstance(r,(list,tuple)) else r, out_wav)
def _norm(w): return re.sub(r"[^а-яёa-z0-9]", "", w.lower())
def _lead_trim(wav, text):
    """Стартовый призвук OmniVoice = лишнее первое слово. Если первое распознанное
    слово != первому слову входа — режем до второго слова."""
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel("small", device="cpu", compute_type="int8")
        segs, _ = m.transcribe(wav, vad_filter=True, word_timestamps=True)
        words = [w for s in segs for w in (s.words or [])]
        if not words: return 0.0
        if _norm(words[0].word) == _norm(text.split()[0]):
            return max(0.0, words[0].start - 0.05)
        if len(words) > 1: return max(0.0, words[1].start - 0.05)
        return max(0.0, words[0].end)
    except Exception as e:
        sys.stderr.write(f"[lead_trim fallback ~1.3s: {e}]\n"); return 1.3
def synth(text, out_mp3, ref=REF_30, speed=SPEED):
    text = " ".join(text.split())
    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, "raw.wav")
        _omnivoice(text, ref, raw)
        st = _lead_trim(raw, text)
        af = f"atempo={speed},{MASTER}" if speed and abs(speed-1.0) > 1e-3 else MASTER
        subprocess.run(["ffmpeg","-y","-v","error","-ss",f"{st:.3f}","-i",raw,
                        "-af",af,"-b:a","192k",out_mp3], check=True)
    return out_mp3
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text", nargs="?"); ap.add_argument("out")
    ap.add_argument("--stdin", action="store_true"); ap.add_argument("--ref", default=REF_30)
    ap.add_argument("--speed", type=float, default=SPEED); a = ap.parse_args()
    txt = sys.stdin.read() if a.stdin else a.text
    if not txt or not txt.strip(): sys.exit("нет текста")
    synth(txt, a.out, ref=a.ref, speed=a.speed)
    print(f"[vcode_voice] готово -> {a.out} (ref={os.path.basename(a.ref)}, {a.speed}x)")
if __name__ == "__main__": main()
