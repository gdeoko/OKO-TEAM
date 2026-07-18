#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKO SPEAK — надёжный пайплайн озвучки брендовым голосом (клон Даниэля) на движке
OmniVoice (HF Space k2-fsa/OmniVoice), zero-shot клон по референсу. Бесплатно/безлимит.

Решает две болячки OmniVoice:
  1) БЛИД референса в начало  -> передаём ref_text (транскрипт референса, кэшируется).
  2) ОБРЕЗАНИЕ слов в конце   -> корректный расчёт du + QA-ретраи (whisper) с ростом du.

Пайплайн:
  текст -> сегменты(<=~12с речи) -> для каждого: generate(du,ns=60,ref_text)
        -> whisper QA (покрытие>=0.8 и целое последнее слово) -> ретрай с бОльшим du
        -> склейка (паузы 0.25с) -> мастеринг (highpass60 + loudnorm I=-16) -> wav/mp3
  Возвращает тайминги сегментов (json) для караоке.

CLI:
  python3 oko_speak.py --textfile s.txt --out vo.wav [--ref reference/daniel_ref_30s.wav] [--speed 1.0]
  python3 oko_speak.py --text "Привет" --out vo.wav --mp3

Окружение (сеть/сертификаты):
  source <(base64 -d secrets.env.b64); export SSL_CERT_FILE=$(python3 -m certifi)
  cat /root/.ccr/ca-bundle.crt >> $(python3 -m certifi)   # если TLS ругается
"""
import os, sys, re, json, time, shutil, argparse, subprocess, tempfile, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SPACE = "k2-fsa/OmniVoice"
DEFAULT_REF = os.path.join(HERE, "reference", "daniel_ref_30s.wav")
WPS = 0.5            # секунд на слово (оценка длительности речи, RU ~2 слова/с)
SEG_MAX_SEC = 12.0  # макс. речи на сегмент
QA_COVER_OK = 0.8   # порог покрытия слов
_WMODEL = None

# ---------- утилиты ----------
def sh(args, **k):
    r = subprocess.run(args, capture_output=True, text=True, **k)
    if r.returncode != 0:
        raise RuntimeError("CMD FAIL: " + " ".join(map(str, args[:8])) + "\n" + r.stderr[-1500:])
    return r

def dur_of(path):
    return float(subprocess.check_output(
        ["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0", path]).decode().strip())

def strip_acc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

_NUM = {'0':'ноль','1':'один','2':'два','3':'три','4':'четыре','5':'пять','6':'шесть',
        '7':'семь','8':'восемь','9':'девять','10':'десять','20':'двадцать','100':'сто'}
def norm_word(w):
    w = strip_acc(w).lower()
    w = re.sub(r'[^0-9a-zа-яё]', '', w)
    return _NUM.get(w, w)

def norm_words(text):
    return [x for x in (norm_word(t) for t in text.split()) if x]

# ---------- референс-текст (кэш) ----------
def get_whisper(size="small"):
    global _WMODEL
    if _WMODEL is None:
        from faster_whisper import WhisperModel
        _WMODEL = WhisperModel(size, device="cpu", compute_type="int8")
    return _WMODEL

def transcribe(path):
    segs, _ = get_whisper().transcribe(path, language="ru", beam_size=5,
                                       vad_filter=False, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segs).strip()

def transcribe_words(path):
    segs, _ = get_whisper().transcribe(path, language="ru", beam_size=5, word_timestamps=True,
                                       vad_filter=False, condition_on_previous_text=False)
    out = []
    for s in segs:
        for w in (s.words or []):
            out.append({"w": w.word.strip(), "t": round(w.start, 3), "e": round(w.end, 3)})
    return out

def clean_ru(txt):
    # убрать латиницу-контаминацию из транскрипта референса (about, the, million ...)
    txt = re.sub(r'\b[a-zA-Z]+\b', '', txt)
    return re.sub(r'\s+', ' ', txt).strip()

def ref_text_for(ref):
    cache = os.path.splitext(ref)[0] + ".reftext.txt"
    if os.path.exists(cache):
        return open(cache, encoding="utf-8").read().strip()
    print(f"[ref] транскрибирую референс один раз -> {cache}")
    txt = clean_ru(transcribe(ref))
    open(cache, "w", encoding="utf-8").write(txt)
    return txt

# ---------- сегментация ----------
def split_sentences(text):
    text = re.sub(r'\s+', ' ', text.strip())
    parts = re.split(r'(?<=[\.\!\?…])\s+', text)
    return [p.strip() for p in parts if p.strip()]

def split_long(sent, max_words):
    if len(sent.split()) <= max_words:
        return [sent]
    chunks, cur = [], []
    for piece in re.split(r'(?<=[,;:—])\s+', sent):
        cur.append(piece)
        if len(" ".join(cur).split()) >= max_words:
            chunks.append(" ".join(cur)); cur = []
    if cur:
        chunks.append(" ".join(cur))
    return chunks

def segment_text(text):
    max_words = int(SEG_MAX_SEC / WPS)   # ~24 слов
    segs, cur = [], []
    for sent in split_sentences(text):
        for chunk in split_long(sent, max_words):
            trial = cur + [chunk]
            if cur and len(" ".join(trial).split()) > max_words:
                segs.append(" ".join(cur)); cur = [chunk]
            else:
                cur = trial
    if cur:
        segs.append(" ".join(cur))
    return segs

def est_du(text, attempt=0):
    words = max(1, len(text.split()))
    du = words * WPS + 2.5
    return round(du * (1.0 + 0.28 * attempt), 1)

# ---------- OmniVoice клиент (с ретраем по квоте) ----------
def make_client():
    from gradio_client import Client
    return Client(SPACE, token=os.environ.get("HF_TOKEN"), verbose=False)

def parse_wait(msg):
    m = re.search(r'(\d+):(\d\d):(\d\d)', msg)
    if not m:
        return None
    h, mi, s = map(int, m.groups())
    return h*3600 + mi*60 + s

def omni_generate(client, text, ref, ref_text, du, lang="Russian", ns=60, gs=2.0,
                  quota_wait_cap=1800):
    from gradio_client import handle_file
    from gradio_client.exceptions import AppError
    waited = 0
    while True:
        try:
            r = client.predict(text=text, lang=lang, ref_aud=handle_file(ref), ref_text=ref_text,
                               instruct="", ns=ns, gs=gs, dn=True, sp=1.0, du=du, pp=True, po=True,
                               api_name="/_clone_fn")
            return r[0] if isinstance(r, (list, tuple)) else r
        except AppError as e:
            msg = str(e)
            if "quota" in msg.lower():
                w = parse_wait(msg) or 60
                w = max(30, min(w + 5, 900))
                if waited + w > quota_wait_cap:
                    raise RuntimeError(f"ZeroGPU quota exhausted, waited {waited}s (cap {quota_wait_cap}s). {msg[:160]}")
                print(f"[quota] ZeroGPU исчерпан, жду {w}s (итого {waited+w}s)...", flush=True)
                time.sleep(w); waited += w
                continue
            raise

# ---------- QA ----------
def qa_metric(script_seg, wav):
    """Возвращает (coverage, last_ok, transcript)."""
    sn = norm_words(script_seg)
    tr = transcribe(wav)
    wn = norm_words(tr)
    if not sn:
        return 1.0, True, tr
    import difflib
    sm = difflib.SequenceMatcher(None, sn, wn, autojunk=False)
    matched = sum(b.size for b in sm.get_matching_blocks())
    cover = matched / len(sn)
    last = sn[-1]
    last_ok = last in wn[-3:] if wn else False
    return cover, last_ok, tr

def trim_silence(src, dst):
    # мягкая обрезка тишины по краям (не режем речь)
    sh(["ffmpeg","-y","-i",src,"-af",
        "silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB:"
        "detection=peak,areverse,silenceremove=start_periods=1:start_silence=0.06:"
        "start_threshold=-45dB:detection=peak,areverse", dst])

# ---------- главный проход ----------
def synth(text, out, ref=DEFAULT_REF, speed=1.0, lang="Russian", ns=60, gs=2.0,
          max_attempts=4, gap=0.25, workdir=None, mp3=False, timings_path=None,
          segments=None):
    ref = os.path.abspath(ref)
    rtext = ref_text_for(ref)
    print(f"[ref] ref_text ({len(rtext)} симв.): {rtext[:90]}...")
    segs = segments if segments is not None else segment_text(text)
    print(f"[seg] {len(segs)} сегментов")
    wd = workdir or tempfile.mkdtemp(prefix="okospeak_")
    os.makedirs(wd, exist_ok=True)
    client = make_client()
    seg_files, seg_meta = [], []
    for i, stext in enumerate(segs):
        best = None  # (score, path, cover, last_ok, du, transcript)
        for a in range(max_attempts):
            du = est_du(stext, a)
            raw = os.path.join(wd, f"seg{i:02d}_a{a}.wav")
            try:
                res = omni_generate(client, stext, ref, rtext, du, lang, ns, gs)
            except Exception as e:
                print(f"  [s{i}] попытка {a} ошибка: {str(e)[:120]}")
                continue
            shutil.copy(res, raw)
            cover, last_ok, tr = qa_metric(stext, raw)
            score = cover + (0.2 if last_ok else 0.0)
            print(f"  [s{i}] a{a} du={du} cover={cover:.2f} last_ok={last_ok} dur={dur_of(raw):.1f}s")
            if best is None or score > best[0]:
                best = (score, raw, cover, last_ok, du, tr)
            if cover >= QA_COVER_OK and last_ok:
                break
        if best is None:
            raise RuntimeError(f"Сегмент {i} не удалось сгенерировать (нет успешных попыток).")
        trimmed = os.path.join(wd, f"seg{i:02d}.wav")
        trim_silence(best[1], trimmed)
        d = dur_of(trimmed)
        seg_files.append(trimmed)
        seg_meta.append({"id": f"s{i+1}", "text": segs[i], "cover": round(best[2], 3),
                         "last_ok": best[3], "du": best[4], "dur": round(d, 3)})
        print(f"  [s{i}] ПРИНЯТ cover={best[2]:.2f} last_ok={best[3]} dur={d:.2f}s")

    # склейка с паузами
    concat = os.path.join(wd, "concat.wav")
    filt, inp = [], []
    for k, f in enumerate(seg_files):
        inp += ["-i", f]
    n = len(seg_files)
    # aresample каждый к 24k mono затем concat с тишиной между
    parts = []
    for k in range(n):
        parts.append(f"[{k}:a]aresample=24000,aformat=channel_layouts=mono[a{k}]")
    # silence source
    sil = f"anullsrc=r=24000:cl=mono[sil0]"
    chain = ""
    seq = []
    for k in range(n):
        seq.append(f"[a{k}]")
        if k < n-1:
            seq.append(f"[g{k}]")
    gaps = "".join(f"aevalsrc=0:d={gap}:s=24000[g{k}];" for k in range(n-1))
    fc = ";".join(parts) + ";" + gaps + "".join(seq) + f"concat=n={2*n-1}:v=0:a=1[cat]"
    sh(["ffmpeg","-y",*inp,"-filter_complex",fc,"-map","[cat]","-c:a","pcm_s16le", concat])

    # тайминги сегментов (с учётом пауз, до speed)
    starts = []
    t = 0.0
    for k, m in enumerate(seg_meta):
        starts.append(t)
        t += m["dur"] + (gap if k < n-1 else 0.0)

    # speed (rubberband сохраняет высоту), затем мастеринг
    af = ""
    if abs(speed - 1.0) > 1e-3:
        af += f"rubberband=tempo={speed}:pitch=1.0,"
    af += "highpass=f=60,loudnorm=I=-16:TP=-1.5:LRA=11"
    sh(["ffmpeg","-y","-i",concat,"-af",af,"-ar","48000","-ac","1", out])

    # финальные тайминги (после speed)
    seg_out = []
    for k, m in enumerate(seg_meta):
        st = starts[k] / speed
        dd = m["dur"] / speed
        seg_out.append({"id": m["id"], "start": round(st, 3), "dur": round(dd, 3),
                        "end": round(st + dd, 3), "cover": m["cover"], "last_ok": m["last_ok"],
                        "text": m["text"]})
    total = dur_of(out)
    result = {"total": round(total, 3), "speed": speed, "segments": seg_out}
    if timings_path:
        json.dump(result, open(timings_path, "w"), ensure_ascii=False, indent=2)
    if mp3:
        mp = os.path.splitext(out)[0] + ".mp3"
        sh(["ffmpeg","-y","-i",out,"-b:a","192k",mp])
        result["mp3"] = mp
    print(f"[done] {out}  total={total:.2f}s  segments={n}")
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--textfile"); ap.add_argument("--text")
    ap.add_argument("--out", required=True)
    ap.add_argument("--ref", default=DEFAULT_REF)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--lang", default="Russian")
    ap.add_argument("--ns", type=float, default=60)
    ap.add_argument("--gs", type=float, default=2.0)
    ap.add_argument("--max-attempts", type=int, default=4)
    ap.add_argument("--gap", type=float, default=0.25)
    ap.add_argument("--workdir", default=None)
    ap.add_argument("--timings", default=None)
    ap.add_argument("--mp3", action="store_true")
    a = ap.parse_args()
    if a.textfile:
        text = open(a.textfile, encoding="utf-8").read()
    elif a.text:
        text = a.text
    else:
        sys.exit("нужен --textfile или --text")
    tp = a.timings or (os.path.splitext(a.out)[0] + ".timings.json")
    synth(text, a.out, ref=a.ref, speed=a.speed, lang=a.lang, ns=a.ns, gs=a.gs,
          max_attempts=a.max_attempts, gap=a.gap, workdir=a.workdir, mp3=a.mp3, timings_path=tp)

if __name__ == "__main__":
    main()
