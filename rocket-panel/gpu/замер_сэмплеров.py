#!/usr/bin/env python3
"""Сравнение сэмплеров по ВРЕМЕНИ на одной и той же карте.

Сэмплер меняет время сильнее, чем кажется. `dpmpp_sde` — стохастический:
на каждом шаге он подмешивает шум и делает лишнюю работу, и четыре его
шага стоят дороже четырёх шагов `euler_ancestral`. На карте Hyperstack
разница была 5,6 против 3,2 минуты — то есть ролик укладывался в
обещанные клиенту пять минут или не укладывался, в зависимости от
одной строки настройки.

Качество этот скрипт НЕ оценивает: ролики складываются рядом, выбирает
владелец глазами.
"""
import json
import time
import urllib.request

ПАНЕЛЬ = "http://127.0.0.1:8090"
ПРОМПТ = ("A beautiful young woman with long wavy auburn hair stands in a "
          "warmly lit bedroom, soft golden window light from the left, she "
          "slowly turns her head toward the camera and smiles, her hair "
          "moves naturally with the motion, subtle breathing, shallow depth "
          "of field, 85mm lens, cinematic color grading, photorealistic skin "
          "texture with visible pores, natural anatomy, stable facial "
          "features, smooth continuous motion")
ОТРИЦАНИЕ = ("blurry, distorted face, extra limbs, deformed hands, morphing, "
             "flickering, warped anatomy, duplicate person, watermark, text")


def послать(путь, данные=None, таймаут=60):
    тело = json.dumps(данные).encode() if данные is not None else None
    зпр = urllib.request.Request(ПАНЕЛЬ + путь, data=тело,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(зпр, timeout=таймаут) as о:
        return json.load(о)


def прогон(метка, секунд, шагов, сэмплер, планировщик, зерно):
    заказ = {"mode": "video", "prompt": ПРОМПТ, "neg": ОТРИЦАНИЕ,
             "secs": секунд, "size": "vert", "seed": зерно,
             "сэмплер": сэмплер, "планировщик": планировщик, "шагов": шагов}
    начало = time.time()
    try:
        о = послать("/api/gen", заказ)
    except Exception as e:
        print("  %-26s заказ не прошёл: %s" % (метка, str(e)[:90]), flush=True)
        return
    jid = о.get("job")
    if not jid:
        print("  %-26s отказ: %s" % (метка, json.dumps(о, ensure_ascii=False)[:120]),
              flush=True)
        return
    while True:
        time.sleep(5)
        try:
            с = послать("/api/job/" + jid, таймаут=30)
        except Exception:
            continue
        if с.get("state") == "ok":
            п = time.time() - начало
            print("  %-26s %5.1f мин   %s"
                  % (метка, п / 60, ", ".join(с.get("files") or [])), flush=True)
            return
        if с.get("state") in ("err", "error"):
            print("  %-26s ОШИБКА: %s" % (метка, str(с.get("error"))[:140]),
                  flush=True)
            return
        if time.time() - начало > 2700:
            print("  %-26s не дождалась за 45 минут" % метка, flush=True)
            return


# Одно зерно на все прогоны: сравниваем сэмплеры, а не случайность.
ЗЕРНО = 424242
опыты = [
    ("5 с, 4 шага, euler_anc", 5, 4, "euler_ancestral", "beta"),
    ("5 с, 4 шага, uni_pc", 5, 4, "uni_pc", "simple"),
    ("5 с, 4 шага, dpmpp_sde", 5, 4, "dpmpp_sde", "beta"),
    ("10 с, 4 шага, euler_anc", 10, 4, "euler_ancestral", "beta"),
]

print("=" * 70, flush=True)
print("СЭМПЛЕР -> ВРЕМЯ, одна карта, одно зерно", flush=True)
for метка, сек, шаг, сэм, пл in опыты:
    прогон(метка, сек, шаг, сэм, пл, ЗЕРНО)
print("=" * 70, flush=True)
