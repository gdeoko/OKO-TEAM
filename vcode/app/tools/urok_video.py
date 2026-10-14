# -*- coding: utf-8 -*-
"""Ролик урока: сценарий, голос Владимира, кадры, субтитры, сборка.

Из урока получается вертикальный ролик 1080x1920 на 35-50 секунд: тот же
материал, что в приложении, только смотреть можно в ленте. Голос, клон
Владимира (OmniVoice, бесплатно), кадры, APIMODELS в фирменном стиле,
субтитры по словам, сборка ffmpeg.

    python3 tools/urok_video.py b1-l1 --env /путь/к/secrets.env
    python3 tools/urok_video.py --все --env ...     # все уроки по очереди

Что куда: готовый mp4 уходит админским каналом в приложение
(`api/index.php?r=admin/upload`) и привязывается к уроку полем `video`.
Кадры генерируются на сервере OKO (там ключ APIMODELS), сюда приходят по
ссылке напрямую с раздачи сервиса.
"""
from __future__ import annotations

import argparse
import base64
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

КОРЕНЬ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(КОРЕНЬ, "tools"))
ШИРИНА, ВЫСОТА = 1080, 1920
ЛОГО = os.path.join(КОРЕНЬ, "public_html", "assets", "img", "logo.png")
ШРИФТ = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

СТИЛЬ_КАДРА = (
    " Vertical 9:16 cinematic frame in the house style of the video school brand "
    "V.LIONOFF: pitch black #08090C, electric violet #7C5CFF and cyan #22D3EE as the only "
    "accent colours, practical neon light sources, heavy volumetric haze, strong rim light "
    "on every object, deep blacks, crisp micro contrast, photographic realism, 8K, ultra "
    "sharp, 85mm lens look, shallow depth of field. NEGATIVE: no text, no letters, no "
    "captions, no watermark, no logos, no human faces, no cartoon, no plastic 3d render, "
    "no stock cliches, no clutter, no oversaturation."
)


# ─────────────────────────── сценарий ───────────────────────────

def первая_фраза(текст: str) -> str:
    части = re.split(r"(?<=[.!?])\s+", (текст or "").strip())
    return части[0] if части else ""


def сценарий(урок: dict) -> list:
    """Сегменты ролика: заход, три-четыре мысли, вывод. Текст и кадр у каждого."""
    слайды = урок.get("slides") or []
    шаги = [{
        "текст": "%s. %s" % (урок["title"].rstrip("."), урок.get("summary", "").rstrip(".")),
        "кадр": слайды[0].get("title", урок["title"]) if слайды else урок["title"],
    }]
    for s in слайды[1:5]:
        мысль = первая_фраза(s.get("text", "")) or (s.get("list") or [""])[0]
        if not мысль:
            continue
        шаги.append({"текст": "%s. %s" % (s.get("title", "").rstrip("."), мысль),
                     "кадр": s.get("title", "")})
    шаги.append({"текст": "Полный урок с конспектом, тестом и практикой, в приложении "
                          "V.LIONOFF. Ссылка в описании.",
                 "кадр": "a phone in a dark studio showing a glowing app interface"})
    return шаги


def промпт_кадра(подсказка: str, урок: dict) -> str:
    return ("A single cinematic vertical frame for a short educational video about making "
            "video content for business. The frame illustrates the idea: \"%s\" (lesson: "
            "\"%s\"). Show it through real objects and light, not through symbols: a camera "
            "or a phone on a tripod, lights, a table with props, a laptop with an abstract "
            "glowing timeline, hands at work seen from behind or cropped at the wrist."
            % (подсказка, урок["title"])) + СТИЛЬ_КАДРА


# ─────────────────────────── кадры ───────────────────────────

def мост(команда: str, окружение: dict, ждать: int = 120) -> str:
    тело = json.dumps({"cmd": команда})
    р = subprocess.run(["curl", "-s", "--cacert", "/root/.ccr/ca-bundle.crt", "-m", str(ждать),
                        "-X", "POST", окружение["OKO_POSTER_URL"],
                        "-H", "Authorization: Bearer " + окружение["OKO_POSTER_TOKEN"],
                        "-H", "Content-Type: application/json", "--data-binary", тело],
                       capture_output=True, text=True)
    try:
        return json.loads(р.stdout).get("stdout", "")
    except Exception:
        return ""


def кадры(шаги: list, слаг: str, урок: dict, окружение: dict, папка: str) -> list:
    """Сгенерировать кадры на сервере и скачать их сюда по ссылке раздачи."""
    задания = [{"файл": "%s_%d.png" % (слаг, i), "размер": "9:16", "ячейка": "2K high",
                "промпт": промпт_кадра(ш["кадр"], урок)} for i, ш in enumerate(шаги)]
    имя = "/opt/oko-agents/data_runtime/vcode/tasks_%s.json" % слаг
    лог = "/tmp/vcode_video_%s.log" % слаг
    б64 = base64.b64encode(json.dumps(задания, ensure_ascii=False).encode()).decode()
    мост("echo '%s' | base64 -d > %s" % (б64, имя), окружение)
    мост("cd /opt/oko-agents && (setsid nohup .venv/bin/python data_runtime/vcode/gen.py %s "
         "> %s 2>&1 < /dev/null &); sleep 2; echo запущено" % (имя, лог), окружение)
    ссылки = {}
    for _ in range(90):
        time.sleep(20)
        вывод = мост("cat %s" % лог, окружение)
        for строка in вывод.splitlines():
            м = re.match(r"(\S+\.png)\s+(\{.*\})", строка)
            if not м:
                continue
            try:
                ответ = json.loads(м.group(2))
            except Exception:
                continue
            if ответ.get("ок") and ответ.get("url"):
                ссылки[м.group(1)] = ответ["url"]
        if len(ссылки) >= len(задания):
            break
    пути = []
    for з in задания:
        url = ссылки.get(з["файл"])
        путь = os.path.join(папка, з["файл"])
        if not url:
            print("  кадр не вышел: %s" % з["файл"])
            пути.append("")
            continue
        subprocess.run(["curl", "-sS", "-L", "-m", "300", "-A", "Mozilla/5.0",
                        "-o", путь, url], check=True)
        пути.append(путь)
    return пути


# ─────────────────────────── голос и субтитры ───────────────────────────

def озвучить(текст: str, куда_wav: str, озв) -> None:
    временные = []
    части = []
    for i, кусок in enumerate(озв.кусками(текст)):
        w = куда_wav.replace(".wav", "_%d.wav" % i)
        озв.сказать(кусок, w)
        временные.append(w)
        чистый = озв.обрезать_призвук(w, кусок)
        if чистый != w:
            временные.append(чистый)
        части.append(чистый)
    if len(части) == 1:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", части[0],
                        "-ar", "48000", "-ac", "2", куда_wav], check=True)
    else:
        список = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
        for п in части:
            список.write("file '%s'\n" % os.path.abspath(п))
        список.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", список.name, "-ar", "48000", "-ac", "2", куда_wav], check=True)
        os.unlink(список.name)
    for п in временные:
        if os.path.exists(п) and п != куда_wav:
            os.unlink(п)


def длительность(файл: str) -> float:
    р = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", файл], capture_output=True, text=True)
    return float(р.stdout.strip() or 0)


def субтитры(аудио: str, куда_ass: str, модель) -> None:
    """Караоке по словам: читают без звука, значит слова должны быть на экране."""
    куски, _ = модель.transcribe(аудио, language="ru", vad_filter=True, word_timestamps=True)
    слова = [w for к in куски for w in (к.words or [])]
    строки = []
    буфер, начало = [], None
    for w in слова:
        if начало is None:
            начало = w.start
        буфер.append(w.word.strip())
        если_длинно = len(" ".join(буфер)) > 22
        if если_длинно or w is слова[-1]:
            строки.append((начало, w.end, " ".join(буфер).strip()))
            буфер, начало = [], None

    def время(t):
        ч = int(t // 3600); м = int((t % 3600) // 60); с = t % 60
        return "%d:%02d:%05.2f" % (ч, м, с)

    голова = ("[Script Info]\nScriptType: v4.00+\nPlayResX: %d\nPlayResY: %d\n\n"
              "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, "
              "BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, "
              "MarginV, Encoding\n"
              "Style: Low,DejaVu Sans,74,&H00FFFFFF,&H00120A08,&H96000000,-1,1,5,2,2,60,60,320,1\n\n"
              "[Events]\nFormat: Layer, Start, End, Style, Text\n" % (ШИРИНА, ВЫСОТА))
    тело = "".join("Dialogue: 0,%s,%s,Low,%s\n" % (время(a), время(b), т.replace("\n", " "))
                   for a, b, т in строки)
    open(куда_ass, "w", encoding="utf-8").write(голова + тело)


# ─────────────────────────── сборка ───────────────────────────

def собрать(кадры_файлы: list, длины: list, аудио: str, ass: str, куда: str) -> None:
    части = []
    временные = []
    for i, (кадр, длина) in enumerate(zip(кадры_файлы, длины)):
        кусок = os.path.join(tempfile.gettempdir(), "vseg_%d.mp4" % i)
        кадры_всего = max(2, int(длина * 30))
        масштаб = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
                   "zoompan=z='min(zoom+0.0008,1.12)':d=%d:s=%dx%d:fps=30"
                   % (ШИРИНА, ВЫСОТА, ШИРИНА, ВЫСОТА, кадры_всего, ШИРИНА, ВЫСОТА))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", кадр,
                        "-t", "%.2f" % длина, "-vf", масштаб, "-r", "30",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", кусок], check=True)
        части.append(кусок)
        временные.append(кусок)
    список = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    for п in части:
        список.write("file '%s'\n" % os.path.abspath(п))
    список.close()
    немой = os.path.join(tempfile.gettempdir(), "vmute.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", список.name, "-c", "copy", немой], check=True)
    фильтр = ("[0:v]subtitles=%s[s];[1:v]scale=120:-1[lg];[s][lg]overlay=W-w-40:60:format=auto"
              % ass.replace(":", "\\:"))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", немой, "-i", ЛОГО,
                    "-i", аудио, "-filter_complex", фильтр, "-map", "2:a",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", "-shortest", куда], check=True)
    os.unlink(список.name)
    for п in временные + [немой]:
        if os.path.exists(п):
            os.unlink(п)


# ─────────────────────────── отдача в приложение ───────────────────────────

def отправить(файл: str, имя: str, окружение: dict) -> str:
    адрес = окружение.get("VLIONOFF_URL", "https://okoteam.top/vlionoff/")
    тело = json.dumps({"name": имя, "dir": "uroki",
                       "data": base64.b64encode(open(файл, "rb").read()).decode()})
    временный = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    временный.write(тело); временный.close()
    р = subprocess.run(["curl", "-sS", "--cacert", "/root/.ccr/ca-bundle.crt", "-m", "600",
                        "-X", "POST", адрес + "api/index.php?r=admin/upload",
                        "-H", "Content-Type: application/json",
                        "-H", "X-VCODE-ADMIN: " + окружение.get("VLIONOFF_ADMIN", ""),
                        "--data-binary", "@" + временный.name],
                       capture_output=True, text=True)
    os.unlink(временный.name)
    try:
        ответ = json.loads(р.stdout)
    except Exception:
        print("  загрузка не разобралась:", р.stdout[:200])
        return ""
    if not ответ.get("ok"):
        print("  загрузка отказала:", ответ)
        return ""
    return ответ["path"]


def привязать(слаг: str, путь: str, окружение: dict) -> None:
    адрес = окружение.get("VLIONOFF_URL", "https://okoteam.top/vlionoff/")
    subprocess.run(["curl", "-sS", "--cacert", "/root/.ccr/ca-bundle.crt", "-m", "60",
                    "-X", "POST", адрес + "api/index.php?r=admin/lesson/media",
                    "-H", "Content-Type: application/json",
                    "-H", "X-VCODE-ADMIN: " + окружение.get("VLIONOFF_ADMIN", ""),
                    "--data-binary", json.dumps({"slug": слаг, "field": "video",
                                                 "path": путь})],
                   capture_output=True, text=True)


# ─────────────────────────── ход работы ───────────────────────────

def читать_окружение(путь: str) -> dict:
    о = {}
    try:
        for строка in open(путь, encoding="utf-8"):
            if "=" in строка and not строка.startswith("#"):
                k, _, v = строка.partition("=")
                о[k.strip()] = v.strip().strip("'\"")
    except OSError as e:
        print("файл окружения не прочитался:", e)
    return о


def уроки_из_контента(нужные: set) -> list:
    итог = []
    for файл in sorted(glob.glob(os.path.join(КОРЕНЬ, "content", "*.json"))):
        if os.path.basename(файл) == "posts.json":
            continue
        данные = json.load(open(файл, encoding="utf-8"))
        for блок in данные.get("blocks", []):
            for урок in блок.get("lessons", []):
                if not нужные or урок.get("slug") in нужные:
                    итог.append((файл, урок))
    return итог


def главное() -> int:
    разбор = argparse.ArgumentParser()
    разбор.add_argument("slugs", nargs="*")
    разбор.add_argument("--env", default="")
    разбор.add_argument("--все", action="store_true")
    разбор.add_argument("--папка", default=os.path.join(tempfile.gettempdir(), "vlionoff_video"))
    арг = разбор.parse_args()
    окружение = читать_окружение(арг.env) if арг.env else {}
    окружение.setdefault("OKO_POSTER_URL", os.environ.get("OKO_POSTER_URL", ""))
    окружение.setdefault("OKO_POSTER_TOKEN", os.environ.get("OKO_POSTER_TOKEN", ""))
    # Пароль панели в репозиторий не кладём: он приезжает окружением.
    окружение.setdefault("VLIONOFF_ADMIN", os.environ.get("VLIONOFF_ADMIN", ""))
    if окружение.get("HF_TOKEN"):
        os.environ["HF_TOKEN"] = окружение["HF_TOKEN"]
    os.makedirs(арг.папка, exist_ok=True)

    import importlib.util
    спец = importlib.util.spec_from_file_location(
        "ozv", os.path.join(КОРЕНЬ, "tools", "ozvuchka.py"))
    озв = importlib.util.module_from_spec(спец)
    спец.loader.exec_module(озв)
    from faster_whisper import WhisperModel
    модель = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)

    список = уроки_из_контента(set(арг.slugs))
    if not арг.все and not арг.slugs:
        список = список[:1]
    for файл, урок in список:
        слаг = урок["slug"]
        готовый = os.path.join(арг.папка, "%s.mp4" % слаг)
        print("== ролик урока %s" % слаг, flush=True)
        шаги = сценарий(урок)
        print("  сегментов: %d" % len(шаги))
        картинки = кадры(шаги, слаг, урок, окружение, арг.папка)
        if any(not к for к in картинки):
            print("  не хватило кадров, пропуск")
            continue
        голоса, длины = [], []
        for i, ш in enumerate(шаги):
            w = os.path.join(арг.папка, "%s_%d.wav" % (слаг, i))
            if not os.path.exists(w):
                озвучить(ш["текст"], w, озв)
            голоса.append(w)
            длины.append(max(2.0, длительность(w) / 1.15 + 0.35))
        общий = os.path.join(арг.папка, "%s_voice.wav" % слаг)
        список_ф = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
        for п in голоса:
            список_ф.write("file '%s'\n" % os.path.abspath(п))
        список_ф.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", список_ф.name, "-filter:a",
                        "atempo=1.15,highpass=f=80,loudnorm=I=-15:TP=-1.2",
                        общий], check=True)
        os.unlink(список_ф.name)
        ass = os.path.join(арг.папка, "%s.ass" % слаг)
        субтитры(общий, ass, модель)
        собрать(картинки, длины, общий, ass, готовый)
        print("  собран: %s, %.1f с, %d КБ"
              % (готовый, длительность(готовый), os.path.getsize(готовый) // 1024))
        путь = отправить(готовый, "%s.mp4" % слаг, окружение)
        if путь:
            привязать(слаг, путь, окружение)
            print("  в приложении: %s" % путь)
            данные = json.load(open(файл, encoding="utf-8"))
            for блок in данные.get("blocks", []):
                for u in блок.get("lessons", []):
                    if u.get("slug") == слаг:
                        u["video"] = путь
            json.dump(данные, open(файл, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
