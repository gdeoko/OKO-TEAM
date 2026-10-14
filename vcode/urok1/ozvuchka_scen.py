# -*- coding: utf-8 -*-
"""Озвучка урока ПО СЦЕНАМ: голос Владимира, длительность и таймкоды слов.

На каждую сцену получается свой wav и запись в `golos.json`:
длительность и список слов со временем. По этим таймкодам Remotion ставит
анимацию ровно на слово, а не на глаз.

    python3 ozvuchka_scen.py --env /путь/oko.env [s01 s02 ...]
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
ГОЛОС = os.path.join(КОРЕНЬ, "..", "daily", "voice_omnivoice", "reference",
                     "vladimir_ref_30s.wav")
КУДА = os.path.join(КОРЕНЬ, "golos")
SPACE = "k2-fsa/OmniVoice"
NS, GS, ТЕМП = 48, 2.0, 1.12
МАСТЕР = "highpass=f=80,loudnorm=I=-16:TP=-1.5"
_модель = None


def кусками(текст: str, предел: int = 220):
    куски, текущий = [], ""
    for часть in re.split(r"(?<=[.!?])\s+", текст):
        if len(текущий) + len(часть) > предел and текущий:
            куски.append(текущий.strip())
            текущий = ""
        текущий += часть + " "
    if текущий.strip():
        куски.append(текущий.strip())
    return куски


def сказать(текст: str, куда_wav: str) -> None:
    from gradio_client import Client, handle_file
    c = Client(SPACE, token=os.environ.get("HF_TOKEN"), verbose=False)
    длительность = max(8.0, round(len(текст.split()) * 0.55 + 2, 1))
    r = c.predict(text=текст, lang="Russian", ref_aud=handle_file(ГОЛОС), ref_text="",
                  instruct="", ns=NS, gs=GS, dn=True, sp=1.0, du=длительность,
                  pp=True, po=True, api_name="/_clone_fn")
    shutil.copy(r[0] if isinstance(r, (list, tuple)) else r, куда_wav)


def модель():
    global _модель
    if _модель is None:
        from faster_whisper import WhisperModel
        _модель = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    return _модель


def _норм(с: str) -> str:
    return re.sub(r"[^а-яёa-z0-9]", "", с.lower())


def слова_файла(wav: str) -> list:
    куски, _ = модель().transcribe(wav, language="ru", vad_filter=False,
                                   word_timestamps=True)
    return [{"слово": w.word.strip(), "старт": round(w.start, 3), "конец": round(w.end, 3)}
            for к in куски for w in (к.words or [])]


def обрезать_призвук(wav: str, текст: str) -> str:
    """OmniVoice начинает кусок лишним словом. Режем по словам whisper."""
    try:
        слова = слова_файла(wav)
        if not слова:
            return wav
        if _норм(слова[0]["слово"]) == _норм(текст.split()[0]):
            сдвиг = max(0.0, слова[0]["старт"] - 0.05)
        elif len(слова) > 1:
            сдвиг = max(0.0, слова[1]["старт"] - 0.05)
        else:
            сдвиг = max(0.0, слова[0]["конец"])
    except Exception as e:
        print("  призвук режем вслепую (%s)" % type(e).__name__, flush=True)
        сдвиг = 1.3
    if сдвиг <= 0.02:
        return wav
    чистый = wav[:-4] + "_cut.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "%.2f" % сдвиг,
                    "-i", wav, чистый], check=True)
    return чистый


def собрать(части: list, куда: str) -> None:
    список = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    for п in части:
        список.write("file '%s'\n" % os.path.abspath(п))
    список.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", список.name, "-filter:a",
                    "atempo=%s,%s" % (ТЕМП, МАСТЕР), "-ar", "48000", куда], check=True)
    os.unlink(список.name)


def длина(путь: str) -> float:
    из = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=nw=1:nk=1", путь], capture_output=True, text=True)
    return round(float(из.stdout.strip() or 0), 3)


def подхватить_ключ(аргументы: list) -> list:
    if "--env" not in аргументы:
        return аргументы
    i = аргументы.index("--env")
    путь = аргументы[i + 1] if len(аргументы) > i + 1 else ""
    try:
        for строка in open(путь, encoding="utf-8"):
            if строка.startswith("HF_TOKEN="):
                os.environ["HF_TOKEN"] = строка.split("=", 1)[1].strip().strip("\"'")
                break
    except OSError as e:
        print("файл окружения не прочитался: %s" % e)
    return аргументы[:i] + аргументы[i + 2:]


def главное() -> int:
    нужны = set(подхватить_ключ(sys.argv[1:]))
    os.makedirs(КУДА, exist_ok=True)
    сцены = json.load(open(os.path.join(КОРЕНЬ, "scenario.json"), encoding="utf-8"))["сцены"]
    свод_путь = os.path.join(КУДА, "golos.json")
    свод = {}
    if os.path.exists(свод_путь):
        свод = json.load(open(свод_путь, encoding="utf-8"))
    for с in сцены:
        ид = с["id"]
        if нужны and ид not in нужны:
            continue
        путь = os.path.join(КУДА, ид + ".wav")
        if os.path.exists(путь) and os.path.getsize(путь) > 30000 and ид in свод:
            print(ид, "уже озвучена", flush=True)
            continue
        текст = с["текст"]
        print("== %s: %d знаков" % (ид, len(текст)), flush=True)
        части, мусор = [], []
        try:
            for i, кусок in enumerate(кусками(текст)):
                w = os.path.join(tempfile.gettempdir(), "%s_%d.wav" % (ид, i))
                сказать(кусок, w)
                мусор.append(w)
                чистый = обрезать_призвук(w, кусок)
                if чистый != w:
                    мусор.append(чистый)
                части.append(чистый)
            собрать(части, путь)
        except Exception as e:
            print("  не вышло: %r" % e, flush=True)
            continue
        finally:
            for ф in мусор:
                if os.path.exists(ф):
                    os.unlink(ф)
        свод[ид] = {"длительность": длина(путь), "слова": слова_файла(путь)}
        json.dump(свод, open(свод_путь, "w", encoding="utf-8"), ensure_ascii=False)
        print("  готово: %.1f с, слов %d" % (свод[ид]["длительность"],
                                             len(свод[ид]["слова"])), flush=True)
    всего = sum(v["длительность"] for v in свод.values())
    print("озвучено сцен %d, всего %.1f с (%.1f мин)" % (len(свод), всего, всего / 60))
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
