#!/usr/bin/env python3
# tts_edge.py <vo_dir_with_script_src.json> [voice]
# Студийная русская озвучка: edge-tts (Azure ru-RU-DmitryNeural, бесплатно/безлимит/без ключа)
# + ПОЛНАЯ авто-простановка ударений RUAccent turbo3.1 на КАЖДОЕ слово (Azure чтит знак U+0301)
# + доменный словарь-override + STT-верификация слов (Whisper, best-effort).
# Цель: НУЛЬ ошибок в ударениях/словах. Пер-сегментно (s1.mp3 ...) под караоке.
# Темп: EDGE_TEMPO (по умолч. 1.5x). Голос: VOICE_EDGE / argv[2].
import os, sys, json, subprocess, re
def _ensure(mod, pkg):
    try: __import__(mod)
    except Exception: subprocess.run([sys.executable, "-m", "pip", "install", "-q", pkg])
_ensure("edge_tts", "edge-tts")
VO = sys.argv[1] if len(sys.argv) > 1 else "vo"
VOICE = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("VOICE_EDGE", "ru-RU-DmitryNeural"))
RATE = os.environ.get("EDGE_RATE", "+0%")
TEMPO = os.environ.get("EDGE_TEMPO", "1.5")

# --- ПОЛНАЯ авто-простановка ударений (RUAccent) ---
# Даниэль: ошибка в ударении = ролик мимо. Ставим ударение на ВСЕ слова, не только домен.
_accent = None
if os.environ.get("VOICE_NOACCENT", "") != "1":
    try:
        os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
        _ensure("ruaccent", "ruaccent")
        from ruaccent import RUAccent
        # доменные override'ы (если RUAccent когда-то ошибётся — фиксируем тут навсегда)
        _DOMAIN = {}
        try:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from ru_stress_dict import STRESS as _DOMAIN  # {слово: "сло+во"}
        except Exception:
            _DOMAIN = {}
        _accent = RUAccent()
        _size = os.environ.get("RUACCENT_MODEL", "turbo3.1")
        try:
            _accent.load(omograph_model_size=_size, use_dictionary=True, custom_dict=_DOMAIN)
        except Exception:
            _accent.load(omograph_model_size="turbo3", use_dictionary=True, custom_dict=_DOMAIN)
    except Exception as e:
        sys.stderr.write(f"[tts_edge] RUAccent недоступен, без авто-ударений: {str(e)[:120]}\n")

def accentuate(t):
    if not _accent: return t
    try:
        # RUAccent помечает ударную как '+гласная' -> ставим U+0301 после гласной (Azure чтит)
        return re.sub(r'\+([аеёиоуыэюяАЕЁИОУЫЭЮЯ])', lambda m: m.group(1) + '́', _accent.process_all(t))
    except Exception:
        return t

# --- STT-верификация (best-effort): распознаём VO и сверяем слова со сценарием ---
_stt = None
if os.environ.get("VOICE_VERIFY", "0") == "1":  # опц. STT-проверка слов (медленно; ударения гарантирует RUAccent)
    try:
        _ensure("faster_whisper", "faster-whisper")
        from faster_whisper import WhisperModel
        _stt = WhisperModel(os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
    except Exception as e:
        sys.stderr.write(f"[tts_edge] STT-верификация off: {str(e)[:100]}\n")

def _norm(s):
    return re.sub(r'[^а-яёa-z0-9 ]', ' ', s.lower().replace('́', '')).split()

def verify(mp3, intended):
    if not _stt: return None
    try:
        segs, _ = _stt.transcribe(mp3, language="ru", beam_size=1)
        heard = " ".join(s.text for s in segs)
        wi, wh = set(_norm(intended)), set(_norm(heard))
        # игнорируем короткие служебные
        miss = [w for w in _norm(intended) if len(w) > 3 and w not in wh]
        return (len(miss), miss[:6], heard.strip()[:120])
    except Exception:
        return None

seg = json.load(open(os.path.join(VO, "script_src.json")))
keys = sorted([k for k in seg if k.startswith("s")], key=lambda k: int(k[1:]))
ok = 0
for k in keys:
    txt = (seg[k] or "").strip()
    if not txt:
        sys.stderr.write(f"[tts_edge] пустой сегмент {k}\n"); continue
    raw = os.path.join(VO, f"_{k}.mp3"); out = os.path.join(VO, f"{k}.mp3")
    tf = os.path.join(VO, f"_{k}.txt"); open(tf, "w", encoding="utf-8").write(accentuate(txt))
    cmd = [sys.executable, "-m", "edge_tts", "--voice", VOICE, "--file", tf, "--write-media", raw]
    if RATE and RATE != "+0%": cmd += ["--rate", RATE]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180); os.remove(tf)
    if not os.path.exists(raw) or os.path.getsize(raw) < 1000:
        sys.stderr.write(f"[tts_edge] FAIL {k}: {(r.stderr or r.stdout)[-180:]}\n"); continue
    af = f"atempo={TEMPO},silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", "24000", "-b:a", "160k", "-af", af, out]); os.remove(raw)
    if not os.path.exists(out) or os.path.getsize(out) < 1000:
        sys.stderr.write(f"[tts_edge] ffmpeg FAIL {k}\n"); continue
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
    v = verify(out, txt)
    vtag = ""
    if v is not None:
        vtag = f" verify:{v[0]}miss" + (f" {v[1]}" if v[0] else " OK")
    print(f"{k} {VOICE} {d}s{vtag}"); ok += 1
print(f"TTS_EDGE_DONE {ok}/{len(keys)} voice={VOICE} tempo={TEMPO} accent={'on' if _accent else 'off'} verify={'on' if _stt else 'off'}")
sys.exit(0 if ok == len(keys) else 2)
