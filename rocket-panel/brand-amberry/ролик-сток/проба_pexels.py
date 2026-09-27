#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проба Pexels: кадры под Формат 3, вертикаль сразу.

Отличие от Pixabay, ради которого и заведён этот файл (замер 27.09.2026):

| | Pixabay | Pexels |
|---|---|---|
| вертикальных в выдаче | 3 годных из 28 | тысячи, есть отбор `orientation=portrait` |
| теги | врут: «woman» стоит и на пустом пляже | по делу |
| разрешение | 4K, но чаще горизонт | 4K вертикаль |

Лицензия у обоих одна по сути: бесплатно, в коммерческом контенте, без
подписи автора. Поэтому берём Pexels первым, Pixabay добором.

    python3 проба_pexels.py [сколько]
"""
import json
import os
import subprocess
import sys
import urllib.parse

ТУТ = os.path.dirname(os.path.abspath(__file__))

ЗАПРОСЫ = [
    "bikini woman", "swimsuit model", "woman pool", "beach woman summer",
    "woman sunbathing", "woman swimming", "model beach", "woman resort",
    "summer woman water", "woman jacuzzi",
]
МИМО = ("child", "kid", "baby", "family", "wedding", "man ", "men ")


def ключ():
    к = os.environ.get("PEXELS_API_KEY", "")
    if к:
        return к
    import base64
    for стр in base64.b64decode(
            open("/home/user/OKO-TEAM/secrets.env.b64", "rb").read()
            ).decode("utf-8", "replace").splitlines():
        if стр.startswith("PEXELS_API_KEY="):
            return стр.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def искать(запрос, страница=1):
    """Только curl: urllib из этой среды получает 403 (см. проба_pixabay)."""
    адрес = "https://api.pexels.com/videos/search?" + urllib.parse.urlencode({
        "query": запрос, "orientation": "portrait", "size": "large",
        "per_page": 40, "page": страница})
    р = subprocess.run(["curl", "-s", "-m", "60", адрес,
                        "-H", "Authorization: " + ключ()],
                       capture_output=True, timeout=90)
    тело = р.stdout.decode("utf-8", "replace")
    if not тело.lstrip().startswith("{"):
        raise RuntimeError("Pexels ответил не json: " + тело[:120])
    return json.loads(тело).get("videos", [])


def годится(в):
    # У Pexels нет тегов, зато есть описание в адресе страницы: оно и
    # есть его набор слов. Плюс длина: короче шести секунд не хватит на
    # заголовок, длиннее минуты незачем.
    строка = (в.get("url") or "").lower()
    if any(с in строка for с in МИМО):
        return False
    return 5 <= (в.get("duration") or 0) <= 60


def лучший(в):
    годные = [ф for ф in в.get("video_files", [])
              if (ф.get("height") or 0) >= 1920 and ф.get("link")]
    if не_нужен := not годные:
        return None
    return max(годные, key=lambda ф: (ф["width"] * ф["height"]))


def собрать(сколько=10):
    видно, кандидаты = set(), []
    for з in ЗАПРОСЫ:
        try:
            найдено = искать(з)
        except Exception as e:
            print("запрос «%s» не прошёл: %s" % (з, e), flush=True)
            continue
        for в in найдено:
            if в["id"] in видно or not годится(в):
                continue
            ф = лучший(в)
            if not ф:
                continue
            видно.add(в["id"])
            кандидаты.append({
                "id": в["id"], "запрос": з, "секунд": в.get("duration"),
                "ш": ф["width"], "в": ф["height"], "url": ф["link"],
                "автор": (в.get("user") or {}).get("name", ""),
                "страница": в.get("url", ""),
            })
    print("нашлось годных вертикальных: %d" % len(кандидаты), flush=True)

    # Крупные вперёд, но по одному кадру на запрос в первой пятёрке -
    # иначе вся десятка приедет от одного автора и с одной локации.
    кандидаты.sort(key=lambda к: -(к["ш"] * к["в"]))
    выбор, занято = [], {}
    for к in кандидаты:
        if занято.get(к["запрос"], 0) >= 2:
            continue
        занято[к["запрос"]] = занято.get(к["запрос"], 0) + 1
        выбор.append(к)
        if len(выбор) >= сколько:
            break

    папка = os.path.join(ТУТ, "кадры-pexels")
    os.makedirs(папка, exist_ok=True)
    итог = []
    for i, к in enumerate(выбор, 1):
        путь = os.path.join(папка, "pex-%02d-%d.mp4" % (i, к["id"]))
        subprocess.run(["curl", "-sL", "-m", "300", "-o", путь, к["url"]], check=True)
        к["файл"] = путь
        к["байт"] = os.path.getsize(путь)
        итог.append(к)
        print("%2d. %dx%d %sс  %-22s %s"
              % (i, к["ш"], к["в"], к["секунд"], к["запрос"],
                 os.path.basename(путь)), flush=True)
    with open(os.path.join(папка, "список.json"), "w", encoding="utf-8") as ф_:
        json.dump(итог, ф_, ensure_ascii=False, indent=1)
    return итог


if __name__ == "__main__":
    собрать(int(sys.argv[1]) if len(sys.argv) > 1 else 10)
