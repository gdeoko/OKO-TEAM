#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Цветной фильм или чёрно-белый - по самому файлу, а не по метке.

Метки цвета в archive.org почти нигде нет, а нам цвет теперь в приоритет
(правка владельца 27.09.2026). Проверяем по кадрам: у чёрно-белой ленты
насыщенность лежит у нуля, у цветной - заметно выше. Порог 12 по шкале
0-255 отделяет уверенно: вираж и пожелтевшая плёнка дают 3-8, цвет - 25+.

Качаем только НАЧАЛО файла: цвет - свойство всей ленты, ради него тянуть
полтора гигабайта незачем. Если начала не хватило (индекс mp4 лежит в
конце, `moov atom not found`) - фильм помечается «?» и проверяется уже
при полной закачке.

    python3 проверить_цвет.py <id> [<id> ...]
"""
import json
import os
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

КУСОК = 26 * 1024 * 1024      # начала хватает на несколько минут кино


def ffmpeg():
    for п in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.exists(п):
            return п
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def лучший_файл(ид):
    """Самая ходовая копия: h.264-производная, иначе любой mp4."""
    а = "https://archive.org/metadata/" + ид
    м = json.loads(urllib.request.urlopen(а, timeout=60).read())
    файлы = [ф for ф in м.get("files", [])
             if ф.get("name", "").lower().endswith((".mp4", ".m4v"))]
    if not файлы:
        return None, 0
    def вес(ф):
        имя = ф["name"].lower()
        return (0 if "512kb" in имя or "h.264" in ф.get("format", "").lower()
                else 1, -int(ф.get("size", 0) or 0))
    ф = sorted(файлы, key=вес)[0]
    return ф["name"], int(ф.get("size", 0) or 0)


def насыщенность(путь, кадров=14):
    """Средняя насыщенность по кадрам из начала файла."""
    import numpy as np
    from PIL import Image
    врем = tempfile.mkdtemp()
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-nostdin", "-i", путь, "-vf", "fps=1/8,scale=160:-2",
                    "-frames:v", str(кадров),
                    os.path.join(врем, "к%03d.png")],
                   capture_output=True)
    сняли = sorted(os.listdir(врем))
    if not сняли:
        return None
    з = []
    for имя in сняли:
        a = np.asarray(Image.open(os.path.join(врем, имя)).convert("RGB"),
                       dtype=np.float32)
        з.append(float((a.max(2) - a.min(2)).mean()))
    for имя in сняли:
        os.remove(os.path.join(врем, имя))
    os.rmdir(врем)
    return sum(з) / len(з)


def проверить(ид):
    имя, размер = лучший_файл(ид)
    if not имя:
        return ид, "нет mp4", None
    url = "https://archive.org/download/%s/%s" % (ид, urllib.parse.quote(имя))
    кусок = os.path.join(tempfile.gettempdir(), "проба-" + ид[:40] + ".mp4")
    subprocess.run(["curl", "-sL", "-r", "0-%d" % КУСОК, "-o", кусок, url],
                   check=False)
    з = насыщенность(кусок) if os.path.exists(кусок) else None
    if os.path.exists(кусок):
        os.remove(кусок)
    if з is None:
        return ид, "?", размер
    return ид, ("ЦВЕТ" if з >= 12 else "ч/б") + " %.1f" % з, размер


if __name__ == "__main__":
    import urllib.parse
    for ид in sys.argv[1:]:
        и, вывод, размер = проверить(ид)
        print("%-46s %-12s %s" % (и[:46], вывод,
              ("%.0f МБ" % (размер/1048576)) if размер else ""), flush=True)
