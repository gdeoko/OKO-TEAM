#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Движение снятия: из кадра делает ролик НА НАШЕЙ КАРТЕ.

Платные видеомодели здесь не нужны: карта на Vast оплачена круглосуточно
и простаивает между заданиями бота, поэтому ролик формата стоит ровно
ноль. Панель та же, что обслуживает бота, и тот же путь, которым
`../экраны/оживить_экраны.sh` оживляет обложки разделов.

    export ROCKET_GPU_URL=... ROCKET_GPU_USER=... ROCKET_GPU_PASS=...
    python3 движение.py вход-ника-бассейн-день.jpg [выход.mp4] [номер сцены]

АДРЕС ПАНЕЛИ МЕНЯЕТСЯ. Она висит на быстром туннеле Cloudflare, и он
берёт новое имя при каждом перезапуске. Если панель не отвечает - адрес
смотреть на сервере бота в `/etc/amberry.env`, а не чинить этот файл.

ЧТО ПРОСИМ У МОДЕЛИ. Верхнюю вещь снимают через голову, под ней остаётся
купальник, камера стоит намертво. Слова про наготу в запросе НЕ
употребляются вовсе - ни в просьбе, ни в отрицании как намёк: модель
достраивает то, о чём ей говорят. Купальник назван прямо и не один раз,
потому что именно он должен остаться в кадре.
"""
import os
import sys
import time

import requests

ТУТ = os.path.dirname(os.path.abspath(__file__))
БАЗА = os.environ.get("ROCKET_GPU_URL", "").rstrip("/")
ВХОД = (os.environ.get("ROCKET_GPU_USER", ""), os.environ.get("ROCKET_GPU_PASS", ""))

ДВИЖЕНИЕ = (
    "The woman takes the hem of her loose outer top with both hands and "
    "pulls it upward and off over her head in one smooth natural motion, "
    "then lets the garment drop out of frame and lowers her arms. "
    "Underneath she is wearing her swimsuit, which stays fully in place on "
    "her body the whole time and is never moved, lifted or adjusted. "
    "She keeps standing in exactly the same spot, facing the camera, with "
    "the same calm expression; her hair falls back into place and moves "
    "softly. The background stays exactly as it is, only faint natural "
    "movement of light and air. "
    "Camera locked off on a tripod, no zoom, no pan, no shake. "
    "Photorealistic, stable facial features, correct anatomy, smooth "
    "continuous motion, consistent lighting."
)

НЕГАТИВ = (
    "camera movement, zoom, pan, shake, walking, changing pose, turning "
    "away, second person, extra limbs, extra fingers, deformed hands, "
    "warped anatomy, morphing body, melting fabric, face distortion, "
    "changing face, changing hair color, flickering, duplicate person, "
    "text, letters, watermark, logo, blurry, low quality, swimsuit "
    "removed, swimsuit strap pulled, undressing further, exposed chest, "
    "bare chest, topless, nudity"
)


def _проверь():
    if not БАЗА or not ВХОД[0]:
        raise SystemExit("нет ROCKET_GPU_URL / USER / PASS — "
                         "адрес панели живёт на сервере бота, /etc/amberry.env")


def залить(кадр):
    with open(кадр, "rb") as ф:
        о = requests.post(БАЗА + "/api/upload", auth=ВХОД,
                          files={"file": (os.path.basename(кадр), ф, "image/jpeg")},
                          timeout=180)
    о.raise_for_status()
    имя = (о.json() or {}).get("name")
    if not имя:
        raise SystemExit("кадр не залился: " + о.text[:200])
    return имя


def заказать(имя, секунд=5, зерно=202609):
    тело = {"mode": "video", "secs": секунд, "size": "vert", "seed": зерно,
            "images": [имя], "сэмплер": "euler_ancestral",
            "планировщик": "beta", "prompt": ДВИЖЕНИЕ, "neg": НЕГАТИВ}
    о = requests.post(БАЗА + "/api/gen", auth=ВХОД, json=тело, timeout=180)
    о.raise_for_status()
    задание = (о.json() or {}).get("job")
    if not задание:
        raise SystemExit("задание не создалось: " + о.text[:200])
    return задание


def ждать(задание, минут=25):
    """Туннель иногда отдаёт пустоту — это повод спросить ещё раз, а не упасть."""
    было = ""
    до = time.time() + минут * 60
    while time.time() < до:
        time.sleep(10)
        try:
            о = requests.get("%s/api/job/%s" % (БАЗА, задание), auth=ВХОД, timeout=40)
            д = о.json()
        except Exception:
            continue
        сост = (д.get("state") or "")
        if сост != было:
            print("  ...", сост or "(пусто)", flush=True)
            было = сост
        if сост == "ok":
            файлы = д.get("files") or []
            if файлы:
                return файлы[0]
            raise SystemExit("карта сказала ok, но файла нет")
        if сост in ("err", "error"):
            raise SystemExit("ошибка карты: " + str(д)[:300])
    raise SystemExit("не дождались задания " + задание)


def забрать(файл, выход):
    о = requests.get("%s/file/%s" % (БАЗА, файл), auth=ВХОД, timeout=300)
    о.raise_for_status()
    with open(выход, "wb") as ф:
        ф.write(о.content)
    return выход


def снять(кадр, выход=None, секунд=5, зерно=202609):
    _проверь()
    выход = выход or os.path.join(ТУТ, "движение.mp4")
    print("заливаю кадр:", os.path.basename(кадр), flush=True)
    имя = залить(кадр)
    задание = заказать(имя, секунд, зерно)
    print("задание", задание, flush=True)
    файл = ждать(задание)
    забрать(файл, выход)
    print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
    return выход


if __name__ == "__main__":
    арг = sys.argv[1:]
    if not арг:
        raise SystemExit(__doc__)
    снять(арг[0], арг[1] if len(арг) > 1 else None,
          int(арг[2]) if len(арг) > 2 else 5)
