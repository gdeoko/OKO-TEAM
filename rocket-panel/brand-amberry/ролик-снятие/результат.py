#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Референс 3: РЕЗУЛЬТАТ. Его делает наша карта промптом самого бота.

Это третий кадр формата 2 и единственный, который APIMODELS не сделает.
Берётся он не выдуманным текстом, а тем самым, по которому бот
обслуживает клиента: `catalog.py`, раздел «Раздеть → Соло →
Раздевание», ракурс `un_full` - в полный рост, прямо в камеру, тот же,
что у наших входных кадров. Поэтому ролик показывает буквально работу
бота, а не её пересказ.

    export ROCKET_GPU_URL=... ROCKET_GPU_USER=... ROCKET_GPU_PASS=...
    python3 результат.py вход-ника-бассейн-день-купальник.jpg [ракурс]

НАРУЖУ ЭТОТ КАДР НЕ УХОДИТ. Он лежит как `результат-*.jpg`, эта маска в
`.gitignore`, и в готовом ролике он существует только под мутью. Резким
его не видит никто.
"""
import os
import sys
import time

import requests

ТУТ = os.path.dirname(os.path.abspath(__file__))
БОТ = os.path.join(os.path.dirname(os.path.dirname(ТУТ)), "bot")
sys.path.insert(0, БОТ)

БАЗА = os.environ.get("ROCKET_GPU_URL", "").rstrip("/")
ВХОД = (os.environ.get("ROCKET_GPU_USER", ""), os.environ.get("ROCKET_GPU_PASS", ""))


def сцена(ракурс="un_full"):
    """Та же сцена, что видит клиент в боте. Своего текста не пишем."""
    import catalog
    узел = [у for у in catalog.УЗЛЫ if у.key == "un_here"][0]
    нашлись = [с for с in узел.scenes if с.key == ракурс]
    if not нашлись:
        raise SystemExit("нет ракурса %s; есть: %s"
                         % (ракурс, ", ".join(с.key for с in узел.scenes)))
    return нашлись[0]


# ДОПОЛНЕНИЕ К ПРОМПТУ БОТА - ТОЛЬКО ПРО КАДР, НЕ ПРО СОДЕРЖАНИЕ.
# Сам текст бота не трогаем: он и есть то, что получает клиент. Но у
# бота кадр строится под клиентское фото, а нам этот снимок идти третьим
# отрезком одного непрерывного ролика - значит место, свет и крупность
# обязаны совпасть с предыдущими двумя. Первая проба этого не сказала, и
# низ кадра приехал тёмным: под мутью это читалось как смена сцены.
КАДР = (
    " Keep the framing, the place and the light of the supplied photograph "
    "exactly as they are: the same sunlit outdoor pool behind her, the same "
    "pale stone tiles under her feet filling the lower part of the frame, "
    "the same bright midday daylight and the same colours. The camera stays "
    "where it was, level and straight-on, at the same distance, and she "
    "stays in the same spot and the same scale within the vertical frame. "
    "Nothing in the background changes, nothing goes dark."
)


# СНИМАЕМ ТОЛЬКО ВЕРХ. Последний кадр ролика - это то, к чему модель
# ведёт движение, и если на нём нет вообще ничего, она снимает всё разом
# и низ пропадает где-то по дороге, сам собой. С низом на месте
# последовательность читается: одежда, купальник, снятый лифчик.
#
# Запреты бота на нижнюю часть купальника при этом надо СНЯТЬ: они
# написаны под полную наготу и стирают ровно то, что мы оставляем.
ТОЛЬКО_ВЕРХ = (
    " She is topless: her chest is bare. Her black bikini bottoms stay "
    "exactly where they are, fully in place on her hips, untouched and "
    "unchanged, and they are clearly visible in the photo."
)
НИЗ_ОСТАВИТЬ = ("bikini bottom", "bikini bottoms", "swim bottoms",
                "panties", "knickers", "thong")


def снять(кадр, ракурс="un_full", выход=None, зерно=202609, только_верх=True):
    if not БАЗА or not ВХОД[0]:
        raise SystemExit("нет ROCKET_GPU_URL / USER / PASS")
    с = сцена(ракурс)
    выход = выход or os.path.join(
        ТУТ, "результат-" + os.path.basename(кадр).replace("вход-", ""))

    with open(кадр, "rb") as ф:
        о = requests.post(БАЗА + "/api/upload", auth=ВХОД,
                          files={"file": (os.path.basename(кадр), ф, "image/jpeg")},
                          timeout=180)
    о.raise_for_status()
    имя = (о.json() or {}).get("name")
    if not имя:
        raise SystemExit("кадр не залился: " + о.text[:200])

    промпт = с.prompt + КАДР + (ТОЛЬКО_ВЕРХ if только_верх else "")
    негатив = с.negative
    if только_верх:
        for вещь in НИЗ_ОСТАВИТЬ:
            негатив = негатив.replace(вещь + ", ", "").replace(", " + вещь, "")
    тело = {"mode": "photo", "size": "vert", "seed": зерно,
            "images": [имя], "image": имя,
            "prompt": промпт, "neg": негатив,
            "steps": 8, "cfg": 2.0, "denoise": 1.0}
    о = requests.post(БАЗА + "/api/gen", auth=ВХОД, json=тело, timeout=180)
    о.raise_for_status()
    задание = (о.json() or {}).get("job")
    if not задание:
        raise SystemExit("задание не создалось: " + о.text[:200])
    print("задание", задание, "ракурс", ракурс, с.title, flush=True)

    было = ""
    до = time.time() + 20 * 60
    while time.time() < до:
        time.sleep(8)
        try:
            д = requests.get("%s/api/job/%s" % (БАЗА, задание),
                             auth=ВХОД, timeout=40).json()
        except Exception:
            continue                       # туннель иногда отдаёт пустоту
        сост = д.get("state") or ""
        if сост != было:
            print("  ...", сост or "(пусто)", flush=True)
            было = сост
        if сост == "ok":
            файлы = д.get("files") or []
            if not файлы:
                raise SystemExit("ok, но файла нет")
            о = requests.get("%s/file/%s" % (БАЗА, файлы[0]), auth=ВХОД, timeout=300)
            о.raise_for_status()
            with open(выход, "wb") as ф:
                ф.write(о.content)
            print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
            return выход
        if сост in ("err", "error"):
            raise SystemExit("ошибка карты: " + str(д)[:300])
    raise SystemExit("не дождались задания " + задание)


if __name__ == "__main__":
    а = sys.argv[1:]
    if not а:
        raise SystemExit(__doc__)
    снять(а[0], а[1] if len(а) > 1 else "un_full")
