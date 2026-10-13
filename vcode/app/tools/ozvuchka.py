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


def кусками(текст: str, предел: int = 600):
    """OmniVoice давится длинным текстом: режем по предложениям."""
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


def собрать(куски_wav: list, куда_mp3: str) -> None:
    список = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    for п in куски_wav:
        список.write("file '%s'\n" % os.path.abspath(п))
    список.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", список.name, "-filter:a",
                    "atempo=%s,%s" % (ТЕМП, МАСТЕР), "-b:a", "128k", куда_mp3], check=True)
    os.unlink(список.name)


def главное() -> int:
    нужны = set(sys.argv[1:])
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
                временные = []
                try:
                    for i, кусок in enumerate(кусками(текст)):
                        w = os.path.join(tempfile.gettempdir(), "%s_%d.wav" % (слаг, i))
                        сказать(кусок, w)
                        временные.append(w)
                    собрать(временные, путь)
                except Exception as e:
                    print("  не вышло: %r" % e)
                    continue
                finally:
                    for w in временные:
                        if os.path.exists(w):
                            os.unlink(w)
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
