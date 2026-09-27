#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проба Pixabay: ищем и качаем кадры под Формат 3.

Pixabay отдаёт видео по своей лицензии: можно брать в коммерческий
контент без подписи автора и без отчислений. Это и делает его основой
третьего формата - красивый кадр, на который ложится заголовок про
бота, без наших генераций и без карты.

ВЕРТИКАЛЬ РЕДКА. Сток снят для экрана, а не для ленты: вертикальных
роликов в выдаче единицы. Поэтому берём и горизонтальные, но помечаем -
им нужен кроп по центру, и кадр, где человек стоит с краю, кроп убьёт.

    python3 проба_pixabay.py [сколько]
"""
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

ТУТ = os.path.dirname(os.path.abspath(__file__))


def ключ():
    к = os.environ.get("PIXABAY_API_KEY", "")
    if к:
        return к
    import base64
    сек = "/home/user/OKO-TEAM/secrets.env.b64"
    for стр in base64.b64decode(open(сек, "rb").read()).decode("utf-8", "replace").splitlines():
        if стр.startswith("PIXABAY_API_KEY="):
            return стр.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


# Запросы подобраны под смысл бота: красиво, лето, купальник - и ни
# одного слова, по которому сток отдаёт откровенное. Площадкам к такому
# кадру не придраться, а заголовок поверх делает из него наш ролик.
ЗАПРОСЫ = [
    "bikini beach woman", "swimsuit pool woman", "woman swimming pool",
    "beach woman summer", "woman sunbathing", "pool party woman",
    "woman walking beach", "summer vacation woman", "woman jacuzzi",
    "woman beach sunset", "fitness woman gym", "woman yacht sea",
]

# ДВА СИТА, И ОБА ОБЯЗАТЕЛЬНЫ.
#
# Первая проба 27.09.2026 отобрала по одному признаку «вертикальный» -
# и в десятке оказались водопад, боксёр на ринге, тёмный силуэт и
# девушка с оскорбительным жестом. Вертикальность это форма кадра, а не
# его содержание.
#
# НУЖНО: в тегах обязана быть и героиня, и обстановка. Один тег «woman»
# приносит спортзал и офис, один тег «pool» - пустую воду без людей.
КТО = ("woman", "women", "girl", "model", "female", "lady")
ГДЕ = ("bikini", "swimsuit", "swimwear", "beach", "pool", "sea", "ocean",
       "summer", "holiday", "resort", "yacht", "jacuzzi", "sunbath")

# НЕ НУЖНО: дети и семья - по закону и по здравому смыслу; спорт с
# контактом, животные, еда, свадьбы - не наша лента; пейзаж без людей.
МИМО = ("child", "kid", "baby", "boy", "family", "food", "drink", "animal",
        "dog", "cat", "wedding", "old", "senior", "fight", "boxing", "box",
        "waterfall", "landscape", "nature", "forest", "mountain", "street",
        "city", "office", "angry", "upset", "finger", "gesture", "protest")


def искать(запрос, страница=1):
    """Ходим ТОЛЬКО curl'ом.

    urllib из этой среды получает от Pixabay 403 на каждый запрос, а
    curl с тем же ключом и тем же адресом отвечает двумя сотнями: дело
    в выходе наружу, а не в ключе. То же правило записано в памяти
    проекта про Node fetch - мимо прокси запросы не ходят."""
    адрес = "https://pixabay.com/api/videos/?" + urllib.parse.urlencode({
        "key": ключ(), "q": запрос, "per_page": 50, "page": страница,
        "safesearch": "false", "order": "popular", "video_type": "film"})
    р = subprocess.run(["curl", "-s", "-m", "60", адрес],
                       capture_output=True, timeout=90)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-160:])
    тело = р.stdout.decode("utf-8", "replace")
    if not тело.lstrip().startswith("{"):
        raise RuntimeError("Pixabay ответил не json: " + тело[:120])
    return json.loads(тело).get("hits", [])


def годится(х):
    теги = [т_.strip() for т_ in (х.get("tags") or "").lower().split(",")]
    строка = " ".join(теги)
    if any(с in строка for с in МИМО):
        return False
    if not any(к in строка for к in КТО):
        return False
    if not any(г in строка for г in ГДЕ):
        return False
    д = х.get("duration") or 0
    return 6 <= д <= 60


def лучший_файл(х):
    """Берём самый крупный из тех, что есть: кадр потом режется в
    вертикаль, и запас по ширине - это запас по качеству."""
    сорт = sorted(х["videos"].items(),
                  key=lambda п: (п[1].get("width", 0) * п[1].get("height", 0)),
                  reverse=True)
    for имя, в in сорт:
        if в.get("url"):
            return имя, в
    return None, None


def собрать(сколько=10):
    видно, кандидаты = set(), []
    for з in ЗАПРОСЫ:
        try:
            найдено = искать(з)
        except Exception as e:
            print("запрос «%s» не прошёл: %s" % (з, e), flush=True)
            continue
        for х in найдено:
            if х["id"] in видно or not годится(х):
                continue
            видно.add(х["id"])
            имя, в = лучший_файл(х)
            if not в:
                continue
            вертикаль = в["height"] > в["width"]
            кандидаты.append({
                "id": х["id"], "запрос": з, "теги": х.get("tags", ""),
                "секунд": х.get("duration"), "ш": в["width"], "в": в["height"],
                "вертикаль": вертикаль, "url": в["url"],
                "автор": х.get("user", ""), "страница": х.get("pageURL", ""),
                "качество": имя,
            })
    print("нашлось годных: %d, из них вертикальных: %d"
          % (len(кандидаты), sum(1 for к in кандидаты if к["вертикаль"])), flush=True)

    # Вертикальные вперёд, дальше горизонтальные - но только те, из
    # которых кроп по центру даёт полноценные 1080x1920. У кадра 3840x2160
    # центральная вертикаль это 1215x2160, запас есть; у 1920x1080 - всего
    # 608x1080, и ролик поедет в мыло.
    кандидаты = [к for к in кандидаты if к["вертикаль"] or к["в"] >= 1440]
    кандидаты.sort(key=lambda к: (not к["вертикаль"], -(к["ш"] * к["в"])))
    выбор = кандидаты[:сколько]

    папка = os.path.join(ТУТ, "кадры")
    os.makedirs(папка, exist_ok=True)
    итог = []
    for i, к in enumerate(выбор, 1):
        путь = os.path.join(папка, "сток-%02d-%d.mp4" % (i, к["id"]))
        subprocess.run(["curl", "-sL", "-m", "300", "-o", путь, к["url"]], check=True)
        к["файл"] = путь
        к["байт"] = os.path.getsize(путь)
        итог.append(к)
        print("%2d. %s %dx%d %sс %s | %s"
              % (i, "ВЕРТИКАЛЬ" if к["вертикаль"] else "горизонт",
                 к["ш"], к["в"], к["секунд"], к["теги"][:44],
                 os.path.basename(путь)), flush=True)

    with open(os.path.join(папка, "список.json"), "w", encoding="utf-8") as ф:
        json.dump(итог, ф, ensure_ascii=False, indent=1)
    return итог


if __name__ == "__main__":
    собрать(int(sys.argv[1]) if len(sys.argv) > 1 else 10)
