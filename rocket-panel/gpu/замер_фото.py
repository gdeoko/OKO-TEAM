#!/usr/bin/env python3
"""Замер ФОТО через ту же ручку, что дёргает бот.

Владелец назвал порог прямо: «генерация картинок должна быть до минуты
в идеальном качестве». Здесь и проверяется — на пустой карте (первый
заказ дня, со чтением сборки с диска) и на тёплой (обычный случай).
"""
import json
import time
import urllib.request

ПАНЕЛЬ = "http://127.0.0.1:8090"
ПРОМПТ = ("A beautiful young woman with long wavy auburn hair standing in a "
          "warmly lit bedroom, soft golden window light from the left, "
          "looking at the camera, photorealistic skin texture with visible "
          "pores and fine detail, natural anatomy, correct hands, 85mm lens, "
          "shallow depth of field, cinematic color grading, sharp focus on "
          "the eyes, professional photography")
ОТРИЦАНИЕ = ("blurry, distorted face, extra limbs, deformed hands, extra "
             "fingers, warped anatomy, plastic skin, watermark, text, "
             "duplicate person")


def послать(путь, данные=None, таймаут=60):
    тело = json.dumps(данные).encode() if данные is not None else None
    зпр = urllib.request.Request(ПАНЕЛЬ + путь, data=тело,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(зпр, timeout=таймаут) as о:
        return json.load(о)


def прогон(метка, зерно):
    заказ = {"mode": "photo", "prompt": ПРОМПТ, "neg": ОТРИЦАНИЕ,
             "size": "vert", "seed": зерно, "denoise": 1.0}
    начало = time.time()
    try:
        о = послать("/api/gen", заказ)
    except Exception as e:
        print("  %-18s заказ не прошёл: %s" % (метка, str(e)[:100]), flush=True)
        return
    jid = о.get("job")
    if not jid:
        print("  %-18s отказ: %s" % (метка, json.dumps(о, ensure_ascii=False)[:140]),
              flush=True)
        return
    while True:
        time.sleep(2)
        try:
            с = послать("/api/job/" + jid, таймаут=30)
        except Exception:
            continue
        if с.get("state") == "ok":
            п = time.time() - начало
            print("  %-18s %5.1f сек   %s"
                  % (метка, п, ", ".join(с.get("files") or [])), flush=True)
            return
        if с.get("state") in ("err", "error"):
            print("  %-18s ОШИБКА: %s" % (метка, str(с.get("error"))[:160]),
                  flush=True)
            return
        if time.time() - начало > 900:
            print("  %-18s не дождалась за 15 минут" % метка, flush=True)
            return


print("=" * 60, flush=True)
print("ФОТО: порог владельца — до минуты", flush=True)
# Первый прогон холодный: ComfyUI читает 28 ГБ сборки для фото с диска.
# Это цена ПЕРВОГО заказа после подъёма карты, а не обычного.
прогон("1-й (холодный)", 515151)
for н in range(2, 5):
    прогон("%d-й (тёплый)" % н, 515150 + н)
print("=" * 60, flush=True)
