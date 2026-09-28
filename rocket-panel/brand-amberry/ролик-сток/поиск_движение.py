#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Подбор кадров под Формат 3: ДВИЖЕНИЕ, а не обстановка.

Первая проба искала по месту («пляж», «бассейн») и приносила открытки:
закат, волны, следы на песке. Ленту держит не место, а человек и то,
что он делает - поэтому запросы теперь про движение и подачу.

Сток порнографии не содержит вовсе, и это не ограничение, а удобство:
всё, что здесь найдётся, по правилам площадок проходит без вопросов, а
смысл ролику даёт заголовок про бота поверх кадра.

    python3 поиск_движение.py [сколько]
"""
import json
import os
import subprocess
import sys
import urllib.parse

ТУТ = os.path.dirname(os.path.abspath(__file__))

# Запросы про ТЕЛО В ДВИЖЕНИИ. Танец, замедление, вода, волосы, походка -
# то, на чём лента останавливается.
ЗАПРОСЫ = [
    # Тело в движении: танец, замедление, вода, волосы, походка.
    "woman dancing bikini", "sensual dance woman", "woman dancing slow motion",
    "bikini model posing", "woman body slow motion", "woman hair slow motion",
    "woman walking pool slow motion", "woman swimwear fashion",
    "woman lingerie dance", "woman stretching body", "girl dancing summer",
    "woman splashing water slow motion",
    # Сцена и обстановка. Добавлено 28.09.2026: на одних «танцах» пул
    # упирался в десяток клипов и ролики начинали повторяться. Эти запросы
    # берут ту же эстетику, но через место - спальня, отель, душ, зеркало,
    # красный свет. Замер по Pexels: 19 запросов дают 1 776 вертикальных
    # клипов 5-40 секунд, и это только три страницы выдачи из многих.
    "sensual woman", "lingerie", "boudoir", "woman dancing bedroom",
    "silk robe", "bikini pool", "woman shower", "seductive look",
    "woman bed morning", "hotel room woman", "wet hair woman",
    "woman stockings", "slow dance woman", "woman red light",
    "woman mirror lingerie", "woman silhouette window",
    "woman getting dressed", "woman heels close up", "woman lips close up",
]
# Отсекаем до скачивания: дети, семья, мужчина главным героем, свадьбы.
МИМО = ("child", "kid", "baby", "family", "wedding", "senior", "elderly",
        "grandma", "old-woman", "man-", "-man", "boy")


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


def искать(запрос, страница=1, попыток=4):
    """Поиск по Pexels. 429 - подождать и повторить, а не считать пустотой.

    У бесплатного ключа есть часовой потолок запросов, и при его
    исчерпании Pexels отвечает JSON-ом `{"status":429,...}` - без поля
    `videos`. Прежний код брал `.get("videos", [])` и получал пустой
    список: в логе выходило «кандидатов: 0», как будто по тридцати одному
    запросу в стоке нет ни одного ролика. Это тот же промах, что был с
    квотой у модели: ошибку нельзя молча превращать в «ничего не нашлось»,
    иначе сбор данных тихо останавливается и никто этого не замечает.
    """
    import time
    адрес = "https://api.pexels.com/videos/search?" + urllib.parse.urlencode({
        "query": запрос, "orientation": "portrait", "size": "large",
        "per_page": 80, "page": страница})
    for заход in range(попыток):
        р = subprocess.run(["curl", "-s", "-m", "60", адрес,
                            "-H", "Authorization: " + ключ()],
                           capture_output=True, timeout=90)
        тело = р.stdout.decode("utf-8", "replace")
        if not тело.lstrip().startswith("{"):
            raise RuntimeError("Pexels ответил не json: " + тело[:120])
        ответ = json.loads(тело)
        if "videos" in ответ:
            return ответ["videos"]
        if ответ.get("status") == 429 or "Throttle" in str(ответ.get("code", "")):
            пауза = 60 * (заход + 1)
            print("  Pexels: потолок запросов, ждём %d с" % пауза, flush=True)
            time.sleep(пауза)
            continue
        raise RuntimeError("Pexels: " + тело[:160])
    raise RuntimeError("Pexels: потолок запросов не отпустил")


def годится(в):
    строка = (в.get("url") or "").lower()
    if any(с in строка for с in МИМО):
        return False
    # Короче пяти секунд не хватит на заголовок, длиннее сорока незачем:
    # из длинного всё равно берём кусок.
    return 5 <= (в.get("duration") or 0) <= 40


def лучший(в):
    годные = [ф for ф in в.get("video_files", [])
              if (ф.get("height") or 0) >= 1920 and ф.get("link")]
    return max(годные, key=lambda ф: ф["width"] * ф["height"]) if годные else None


def собрать(сколько=12, папка="кандидаты"):
    видно, кандидаты = set(), []
    for з in ЗАПРОСЫ:
        try:
            найдено = искать(з)
        except Exception as e:
            print("запрос «%s»: %s" % (з, e), flush=True)
            continue
        for в in найдено:
            if в["id"] in видно or not годится(в):
                continue
            ф = лучший(в)
            if not ф:
                continue
            видно.add(в["id"])
            кандидаты.append({"id": в["id"], "запрос": з,
                              "секунд": в.get("duration"), "ш": ф["width"],
                              "в": ф["height"], "url": ф["link"],
                              "автор": (в.get("user") or {}).get("name", ""),
                              "страница": в.get("url", "")})
    print("кандидатов: %d" % len(кандидаты), flush=True)

    # По ТРИ на запрос, иначе вся подборка приедет из одной съёмки. Было
    # два при двенадцати запросах; с тридцатью одним запросом потолок
    # поднят - пул нужен большой, чтобы ролики не повторялись месяцами.
    кандидаты.sort(key=lambda к: -(к["ш"] * к["в"]))
    выбор, занято = [], {}
    for к in кандидаты:
        if занято.get(к["запрос"], 0) >= 3:
            continue
        занято[к["запрос"]] = занято.get(к["запрос"], 0) + 1
        выбор.append(к)
        if len(выбор) >= сколько:
            break

    путь_папки = os.path.join(ТУТ, папка)
    os.makedirs(путь_папки, exist_ok=True)
    итог = []
    for i, к in enumerate(выбор, 1):
        п = os.path.join(путь_папки, "дв-%02d-%d.mp4" % (i, к["id"]))
        subprocess.run(["curl", "-sL", "-m", "300", "-o", п, к["url"]], check=True)
        к["файл"] = п
        итог.append(к)
        print("%2d. %dx%d %2sс  %-32s %s" % (i, к["ш"], к["в"], к["секунд"],
                                             к["запрос"], os.path.basename(п)),
              flush=True)
    with open(os.path.join(путь_папки, "список.json"), "w", encoding="utf-8") as ф_:
        json.dump(итог, ф_, ensure_ascii=False, indent=1)
    return итог


if __name__ == "__main__":
    собрать(int(sys.argv[1]) if len(sys.argv) > 1 else 12)
