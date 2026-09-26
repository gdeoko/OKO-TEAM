#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Движение снятия: из кадра делает ролик НА НАШЕЙ КАРТЕ.

Платные видеомодели здесь не нужны: карта на Vast оплачена круглосуточно
и простаивает между заданиями бота, поэтому ролик формата стоит ровно
ноль. Панель та же, что обслуживает бота, и тот же путь, которым
`../экраны/оживить_экраны.sh` оживляет обложки разделов.

    export ROCKET_GPU_URL=... ROCKET_GPU_USER=... ROCKET_GPU_PASS=...
    python3 движение.py <кадр.jpg> <шаг> [выход.mp4] [секунд]

ТРИ ШАГА - ТРИ ОТДЕЛЬНЫХ ЗАДАНИЯ, каждое со своего кадра:

    одежда    из кадра «одета»      - снимает футболку через голову
    купальник из кадра «в купальнике» - заводит руки к завязке
    результат из кадра «результат»    - движение продолжается под мутью

Одним заданием это не снять: режима «первый кадр в последний» на нашей
сборке нет (снят 22.09.2026, отдавал чужое лицо), а два снимка в одном
задании значат двух ЛЮДЕЙ. Зато у каждого отрезка своя резкая опора, и
качество не доживает до пятой секунды деградации.

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

ШАГИ = {}

ШАГИ["одежда"] = (
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

ШАГИ["купальник"] = (
    "The woman slowly raises both hands and brings them up behind her "
    "neck, to the tie of her swimsuit top, and holds them there as if she "
    "is about to undo it. Her swimsuit stays completely in place on her "
    "body the whole time, untouched and unmoved. "
    "She keeps standing in exactly the same spot, facing the camera, calm "
    "and unhurried; her hair moves softly with the motion of her arms. "
    "The background stays exactly as it is. "
    "Camera locked off on a tripod, no zoom, no pan, no shake. "
    "Photorealistic, stable facial features, correct anatomy, smooth "
    "continuous motion, consistent lighting."
)

# ОДНА ГЕНЕРАЦИЯ НА ВЕСЬ РОЛИК. Решение владельца 26.09.2026, и оно
# отменяет три отрезка.
#
# Три задания с трёх кадров давали три фона, три позы и придуманный
# моделью розовый верх - швы приходилось прятать, и всё равно они были
# видны. Здесь сюжет целиком отдаётся модели одним заданием: один фон,
# одна камера, одна девушка, непрерывное движение от первого кадра до
# последнего. Шва нет не потому, что он спрятан, а потому что его нет.
#
# ПОЧЕМУ РАНЬШЕ НЕ ПОЛУЧАЛОСЬ: в промпте стояло «купальник остаётся на
# месте». Модель честно это исполняла - снимала футболку и замирала,
# продолжения в сюжете не было вовсе. Сборка у нас NSFW и умеет снять
# сцену до конца, ей просто ни разу не дали этого сделать.
#
# Наготу закрывает МОНТАЖ, а не запрет модели: в соцсети уходит версия с
# мутью с нужной секунды, в телеграм-канал - та же генерация без мути.
ШАГИ["всё"] = (
    "One continuous unbroken shot of the same woman in the same place, "
    "the camera locked off on a tripod the whole time, no cut, no jump. "
    "First she stands facing the camera, relaxed, and looks into the lens. "
    "Then she takes the hem of her loose top with both hands, pulls it "
    "upward and off over her head in one smooth motion, and lets it drop "
    "out of frame, so that she is left in her swimsuit. "
    "Then, without pausing, she reaches behind her neck, unties her "
    "swimsuit top, slips it off her shoulders and lets it fall away, and "
    "then slides her swimsuit bottoms down and steps out of them, until "
    "she is standing undressed. "
    "She stays in exactly the same spot the whole time, facing the camera, "
    "with the same calm expression; her hair moves naturally with her "
    "arms. The background never changes. "
    "Camera locked off, no zoom, no pan, no shake. Photorealistic, stable "
    "facial features, correct anatomy, smooth continuous motion, "
    "consistent lighting from the first frame to the last."
)

ШАГИ["результат"] = (
    "She stands in the same spot and keeps living in the frame: she "
    "breathes, her shoulders settle, her long hair stirs and falls, she "
    "shifts her weight slightly from one foot to the other and turns a "
    "few degrees, her hands move slowly and naturally at her sides. "
    "The water and the palm shadows behind her keep moving in the warm "
    "air. Nothing is added and nothing is taken away. "
    "Camera locked off on a tripod, no zoom, no pan, no shake. "
    "Photorealistic, stable facial features, correct anatomy, smooth "
    "continuous motion, consistent lighting."
)

НЕГАТИВ = (
    "camera movement, zoom, pan, shake, walking, changing pose, turning "
    "away, second person, extra limbs, extra fingers, deformed hands, "
    "warped anatomy, morphing body, melting fabric, face distortion, "
    "changing face, changing hair color, flickering, duplicate person, "
    "text, letters, watermark, logo, blurry, low quality"
)

# У шага «всё» свой негатив: общий запрещал ровно то, ради чего задание и
# ставится, и модель останавливалась на первом действии.
НЕГАТИВ_ВСЁ = (
    "cut, jump cut, scene change, changing background, changing location, "
    "changing outfit colour, second person, camera movement, zoom, pan, "
    "shake, walking away, turning away, extra limbs, extra fingers, "
    "deformed hands, warped anatomy, morphing body, face distortion, "
    "changing face, changing hair colour, flickering, duplicate person, "
    "text, letters, watermark, logo, blurry, low quality"
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


def заказать(имя, шаг="одежда", секунд=5, зерно=202609):
    тело = {"mode": "video", "secs": секунд, "size": "vert", "seed": зерно,
            "images": [имя], "сэмплер": "euler_ancestral",
            "планировщик": "beta", "prompt": ШАГИ[шаг],
            "neg": НЕГАТИВ_ВСЁ if шаг == "всё" else НЕГАТИВ}
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


def снять(кадр, шаг="одежда", выход=None, секунд=5, зерно=202609):
    _проверь()
    if шаг not in ШАГИ:
        raise SystemExit("шаг %s неизвестен: %s" % (шаг, ", ".join(ШАГИ)))
    выход = выход or os.path.join(ТУТ, "движение-%s.mp4" % шаг)
    print("заливаю кадр:", os.path.basename(кадр), "шаг", шаг, flush=True)
    имя = залить(кадр)
    задание = заказать(имя, шаг, секунд, зерно)
    print("задание", задание, flush=True)
    файл = ждать(задание)
    забрать(файл, выход)
    print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
    return выход


if __name__ == "__main__":
    арг = sys.argv[1:]
    if not арг:
        raise SystemExit(__doc__)
    снять(арг[0], арг[1] if len(арг) > 1 else "одежда",
          арг[2] if len(арг) > 2 else None,
          int(арг[3]) if len(арг) > 3 else 5)
