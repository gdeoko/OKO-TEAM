#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Поиск жилы: где в общественном достоянии лежит МНОГО нужных сцен.

Задача владельца: не один отрезок, а источник, из которого формат 4 можно
кормить месяцами, и каждый раз разным.

**Ключ ко всему - миниатюры archive.org.** У каждого видео там уже лежит
папка `<ид>.thumbs/` с 60-95 кадрами по всему фильму, и в имени файла
стоит НОМЕР КАДРА, то есть время. Это готовая раскадровка, которую не
надо ни качать, ни резать: восемьдесят картинок по 10 КБ вместо
полуторагигабайтного фильма. Полтысячи лент просматриваются за час, а не
за неделю.

Дальше два сита:

1. **Кожа в кадре** (здесь, локально, мгновенно). Маска по YCrCb плюс
   проверка на серость: чёрно-белый кадр даёт ложное срабатывание -
   песок, штукатурка и лица в гриме лежат в том же диапазоне.
2. **Взгляд** - модель или человек смотрит только на то, что прошло
   первое сито. Из тридцати тысяч кадров до глаз доходит полсотни.

Фильм оценивается не лучшим кадром, а ЧИСЛОМ горячих кадров: одна удачная
сцена - это один ролик, а нам нужна жила.

    python3 золотая_жила.py [от_года] [до_года] [сколько_лент]
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ТУТ = os.path.dirname(os.path.abspath(__file__))
КЭШ = os.path.join(ТУТ, ".миниатюры")
ПОИСК = "https://archive.org/advancedsearch.php"

# Порог доли кожи в кадре. 0.10 - это заметно больше одного лица:
# открытые плечи, живот, ноги.
ПОРОГ_КОЖИ = 0.10
# Ниже этой насыщенности кадр считается чёрно-белым и в счёт не идёт:
# у серого кадра маска кожи срабатывает на чём угодно.
ПОРОГ_ЦВЕТА = 14


def кандидаты(от=1955, до=1985, сколько=300):
    """Полнометражные фильмы в общественном достоянии за годы."""
    q = ('collection:(feature_films) AND licenseurl:(*publicdomain*) '
         'AND date:[%d TO %d]' % (от, до))
    п = urllib.parse.urlencode({"q": q, "rows": сколько, "output": "json"})
    п += ("&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year"
          "&fl%5B%5D=downloads&sort%5B%5D=downloads+desc")
    д = json.loads(urllib.request.urlopen(ПОИСК + "?" + п, timeout=90).read())
    return д["response"]["docs"]


def миниатюры(ид):
    """Имена кадров-миниатюр и их номера. Номер кадра = место в фильме."""
    try:
        м = json.loads(urllib.request.urlopen(
            "https://archive.org/metadata/" + ид, timeout=60).read())
    except Exception:
        return []
    из = []
    for ф in м.get("files", []):
        имя = ф.get("name", "")
        if ".thumbs/" in имя and имя.lower().endswith((".jpg", ".jpeg")):
            хвост = имя.rsplit("_", 1)[-1].split(".")[0]
            из.append((имя, int(хвост) if хвост.isdigit() else 0))
    return sorted(из, key=lambda x: x[1])


def скачать(ид, кадры, сколько=40):
    """Качаем равномерную выборку миниатюр в кэш."""
    папка = os.path.join(КЭШ, ид)
    os.makedirs(папка, exist_ok=True)
    шаг = max(1, len(кадры) // сколько)
    взять = кадры[::шаг][:сколько]
    def один(пара):
        имя, номер = пара
        цель = os.path.join(папка, "%08d.jpg" % номер)
        if os.path.exists(цель):
            return цель, номер
        url = "https://archive.org/download/%s/%s" % (ид, urllib.parse.quote(имя))
        try:
            with urllib.request.urlopen(url, timeout=60) as о, open(цель, "wb") as ф:
                ф.write(о.read())
        except Exception:
            return None, номер
        return цель, номер
    with ThreadPoolExecutor(max_workers=8) as пул:
        return [(п, н) for п, н in пул.map(один, взять) if п]


def доля_кожи(путь):
    """Сколько кадра занято кожей. Серый кадр отбрасывается сразу."""
    import numpy as np
    from PIL import Image
    try:
        и = Image.open(путь).convert("RGB")
    except Exception:
        return 0.0
    a = np.asarray(и, dtype=np.float32)
    if float((a.max(2) - a.min(2)).mean()) < ПОРОГ_ЦВЕТА:
        return 0.0                              # чёрно-белое - мимо
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    Y = 0.299*R + 0.587*G + 0.114*B
    Cr = (R - Y) * 0.713 + 128
    Cb = (B - Y) * 0.564 + 128
    маска = ((Cr > 135) & (Cr < 180) & (Cb > 85) & (Cb < 135) &
             (Y > 60) & (R > G) & (R > B))
    return float(маска.mean())


def оценить(ид, сколько=40):
    кадры = миниатюры(ид)
    if not кадры:
        return None
    взято = скачать(ид, кадры, сколько)
    if not взято:
        return None
    оценки = [(доля_кожи(п), н) for п, н in взято]
    горячие = [о for о in оценки if о[0] >= ПОРОГ_КОЖИ]
    # В итог кладём НОМЕР КАДРА, а не путь к файлу. Путь живёт только в
    # этом контейнере: кэш миниатюр в историю не идёт, и со следующей
    # сессии он другой. По номеру кадр достаётся заново одной строкой.
    return {
        "ид": ид,
        "кадров": len(оценки),
        "горячих": len(горячие),
        "доля": len(горячие) / len(оценки),
        "лучшие": [[round(д, 4), н] for д, н in sorted(горячие, reverse=True)[:6]],
    }


def кадр(ид, номер):
    """Путь к миниатюре по номеру кадра."""
    return os.path.join(КЭШ, ид, "%08d.jpg" % номер)


def главное(от=1955, до=1985, сколько=120):
    лен = кандидаты(от, до, сколько)
    print("лент в выборке: %d" % len(лен), flush=True)
    итог = []
    for i, д in enumerate(лен, 1):
        о = оценить(д["identifier"])
        if not о:
            continue
        о["название"] = str(д.get("title", ""))[:40]
        о["год"] = д.get("year", "?")
        итог.append(о)
        if о["горячих"] >= 4:
            print("  %-40s %-5s горячих %2d из %2d" % (
                о["ид"][:40], о["год"], о["горячих"], о["кадров"]), flush=True)
        if i % 20 == 0:
            print("  ... просмотрено %d" % i, flush=True)
    итог.sort(key=lambda о: (-о["горячих"], -о["доля"]))
    print("\n== ЖИЛА: где кожи больше всего ==", flush=True)
    for о in итог[:25]:
        print("%-40s %-5s %2d/%2d  %s" % (о["ид"][:40], о["год"], о["горячих"],
              о["кадров"], о["название"]), flush=True)
    with open(os.path.join(ТУТ, "жила.json"), "w", encoding="utf-8") as ф:
        json.dump(итог, ф, ensure_ascii=False, indent=1)
    return итог


if __name__ == "__main__":
    а = [int(x) for x in sys.argv[1:]]
    главное(*(а or [1955, 1985, 120]))


def лист_жилы(итог=None, лент=14, на_ленту=4, выход=None):
    """Одна картинка со всем горячим: по несколько кадров с каждой ленты.

    Второе сито. Маска кожи путает тёплую плёнку с телом - у виражной
    копии полкадра лежит в том же диапазоне. Поэтому машина только
    сортирует, а решает взгляд, и смотреть надо не тридцать тысяч кадров,
    а один лист.
    """
    from PIL import Image, ImageDraw
    if итог is None:
        with open(os.path.join(ТУТ, "жила.json"), encoding="utf-8") as ф:
            итог = json.load(ф)
    ячейки = []
    for о in итог[:лент]:
        for лучший in о["лучшие"][:на_ленту]:
            доля, номер = лучший[0], лучший[1]
            ячейки.append((о["ид"], номер, доля, кадр(о["ид"], номер)))
    if not ячейки:
        return None
    ш, в, кол = 300, 170, на_ленту
    строк = (len(ячейки) + кол - 1) // кол
    лист = Image.new("RGB", (кол*ш, строк*(в+18)), (14, 14, 16))
    рис = ImageDraw.Draw(лист)
    for i, (ид, номер, доля, путь) in enumerate(ячейки):
        try:
            к = Image.open(путь).convert("RGB").resize((ш, в))
        except Exception:
            continue
        x, y = (i % кол)*ш, (i // кол)*(в+18)
        лист.paste(к, (x, y))
        рис.text((x+5, y+в+3), "%s к%d %.0f%%" % (ид[:26], номер, доля*100),
                 fill=(215, 215, 220))
    выход = выход or os.path.join(ТУТ, "жила-лист.jpg")
    лист.save(выход, quality=86)
    print(выход, flush=True)
    return выход
