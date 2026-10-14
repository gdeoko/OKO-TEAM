# -*- coding: utf-8 -*-
"""Озвучка конспектов уроков голосом Владимира (OmniVoice, бесплатно).

Берёт конспект урока из content/*.json, читает его клоном голоса и кладёт mp3
в public_html/assets/audio/. Поле `audio` урока проставляется само.

Темп здесь обычный, 1.15: в роликах канон 1.8 (`vcode/daily/voice_omnivoice`),
но лекцию на такой скорости слушать нельзя. Файл роликов не трогаем.

    python3 tools/ozvuchka.py                 # все бесплатные уроки
    python3 tools/ozvuchka.py b1-l1 b1-l2     # только названные
"""
from __future__ import annotations

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

КОРЕНЬ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ГОЛОС = os.path.join(КОРЕНЬ, "..", "daily", "voice_omnivoice", "reference",
                     "vladimir_ref_30s.wav")
КУДА = os.path.join(КОРЕНЬ, "public_html", "assets", "audio")
SPACE = "k2-fsa/OmniVoice"
NS, GS, ТЕМП = 48, 2.0, 1.15
МАСТЕР = "highpass=f=80,loudnorm=I=-15:TP=-1.2"


def текст_конспекта(урок: dict) -> str:
    """Конспект в речь: заголовки и маркеры убираем, остальное читаем."""
    строки = []
    for сырая in (урок.get("notes") or "").split("\n"):
        т = сырая.strip()
        if not т:
            continue
        т = re.sub(r"^#+\s*", "", т)
        т = re.sub(r"^[-•]\s*", "", т)
        т = т.replace("**", "")
        строки.append(т)
    текст = " ".join(строки)
    текст = re.sub(r"\s+", " ", текст).strip()
    return "%s. %s" % (урок.get("title", ""), текст)


def кусками(текст: str, предел: int = 220):
    """Режем по предложениям короткими кусками.

    Предел маленький нарочно: на длинном тексте OmniVoice сам делит его внутри
    и на каждом своём стыке вставляет лишнее слово («мягко»), которое слышно в
    середине записи и обрезкой начала не лечится. Короткий кусок модель читает
    одним куском, а стартовый призвук снимает `обрезать_призвук`.
    """
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


def _норм(слово: str) -> str:
    return re.sub(r"[^а-яёa-z0-9]", "", слово.lower())


def обрезать_призвук(wav: str, текст: str) -> str:
    """OmniVoice начинает кусок лишним словом («мягко», «стиль»).

    Канон роликов режет его по словам whisper, здесь то же самое: без обрезки
    в конспекте каждые несколько фраз звучит чужое слово. Возвращает путь к
    тому, что класть в монтаж: обрезанный файл или исходный, если резать нечего.
    """
    try:
        from faster_whisper import WhisperModel
        м = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
        куски, _ = м.transcribe(wav, language="ru", vad_filter=True, word_timestamps=True)
        слова = [w for к in куски for w in (к.words or [])]
        if not слова:
            return wav
        if _норм(слова[0].word) == _норм(текст.split()[0]):
            сдвиг = max(0.0, слова[0].start - 0.05)
        elif len(слова) > 1:
            сдвиг = max(0.0, слова[1].start - 0.05)
        else:
            сдвиг = max(0.0, слова[0].end)
    except Exception as e:
        print("  призвук режем вслепую (%s)" % type(e).__name__)
        сдвиг = 1.3
    if сдвиг <= 0.02:
        return wav
    чистый = wav[:-4] + "_cut.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "%.2f" % сдвиг,
                    "-i", wav, чистый], check=True)
    return чистый


def собрать(куски_wav: list, куда_mp3: str) -> None:
    список = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    for п in куски_wav:
        список.write("file '%s'\n" % os.path.abspath(п))
    список.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", список.name, "-filter:a",
                    "atempo=%s,%s" % (ТЕМП, МАСТЕР), "-b:a", "128k", куда_mp3], check=True)
    os.unlink(список.name)


def подхватить_ключ(аргументы: list) -> list:
    """`--env файл`: взять HF_TOKEN из файла окружения, не светя его в команде.

    Без токена HuggingFace даёт анонимную квоту ZeroGPU, которой хватает на
    ноль секунд: озвучка молча не идёт.
    """
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
    сделано = 0
    for файл in sorted(glob.glob(os.path.join(КОРЕНЬ, "content", "creator-*.json"))
                       + glob.glob(os.path.join(КОРЕНЬ, "content", "ai-*.json"))):
        данные = json.load(open(файл, encoding="utf-8"))
        менялось = False
        for блок in данные.get("blocks", []):
            for урок in блок.get("lessons", []):
                слаг = урок.get("slug", "")
                if нужны and слаг not in нужны:
                    continue
                if not нужны and not урок.get("free"):
                    continue
                имя = "%s.mp3" % слаг
                путь = os.path.join(КУДА, имя)
                if os.path.exists(путь) and os.path.getsize(путь) > 20000:
                    урок["audio"] = "assets/audio/" + имя
                    менялось = True
                    continue
                текст = текст_конспекта(урок)
                print("озвучка %s: %d знаков" % (слаг, len(текст)), flush=True)
                части, мусор = [], []
                try:
                    for i, кусок in enumerate(кусками(текст)):
                        w = os.path.join(tempfile.gettempdir(), "%s_%d.wav" % (слаг, i))
                        сказать(кусок, w)
                        мусор.append(w)
                        чистый = обрезать_призвук(w, кусок)
                        if чистый != w:
                            мусор.append(чистый)
                        части.append(чистый)
                    собрать(части, путь)
                except Exception as e:
                    print("  не вышло: %r" % e)
                    continue
                finally:
                    for ф in мусор:
                        if os.path.exists(ф):
                            os.unlink(ф)
                урок["audio"] = "assets/audio/" + имя
                менялось = True
                сделано += 1
                print("  готово: %s, %d КБ" % (имя, os.path.getsize(путь) // 1024))
        if менялось:
            json.dump(данные, open(файл, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
    print("озвучено уроков:", сделано)
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
