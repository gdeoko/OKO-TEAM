#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пересобрать опорные скелеты БЕЗ разметки лица и кистей. НА КАРТЕ.

## Зачем

Опора берётся скелетом openpose, и по умолчанию препроцессор рисует не
только тело, но и кисти рук (вееры из двадцати точек на пальцы) и лицо
(семьдесят точек плотным облаком). При силе опоры 1.8 эта мелочь
впечатывается прямо в кожу, и владелец видел ровно её:

    «белое пятно на паху»   разметка кисти, лежащей у бедра
    «лицо и глаза плывут»   облако точек поверх лица

Разведено опытом 28.09.2026: без опоры пятна нет вовсе, с опорой есть
при любом denoise, а форма пятна повторяет веер пальцев.

Тело в скелете остаётся: позу держит именно оно. Кисти и лицо опора
задавать и не должна - их модель рисует сама, и рисует лучше, когда ей
не мешают.

    python3 позы_пересобрать.py                  все эталоны раздевания
    python3 позы_пересобрать.py 04_в_полный_рост  один
"""
import json
import os
import shutil
import sys
import time
import urllib.request
import uuid

ДОМ = os.environ.get("ROCKET_HOME", "/root")
COMFY = os.environ.get("ROCKET_COMFY", "http://127.0.0.1:8188")
ЭТАЛОНЫ = os.path.join(ДОМ, "эталоны", "раздевание")
ПОЗЫ = os.path.join(ДОМ, "ПОЗЫ")
ВХОД = os.path.join(ДОМ, "ComfyUI", "input")
ВЫХОД = os.path.join(ДОМ, "ComfyUI", "output")

# Эталон -> ключ кнопки. Имена файлов эталонов человеческие, а опора
# ищется по ключу кнопки, и связать их больше негде.
КЛЮЧИ = {"01_вид_сзади": "un_back", "02_лёжа_на_спине": "un_lie",
         "03_крупный_план": "un_close", "04_в_полный_рост": "un_full",
         "05_раздвинуть_ножки": "un_low", "06_поставить_раком": "un_over",
         "07_вид_снизу": "un_three"}


def граф(имя_входа, разрешение=1024):
    return {
        "1": {"class_type": "LoadImage",
              "inputs": {"image": имя_входа, "upload": "image"}},
        "2": {"class_type": "OpenposePreprocessor",
              "inputs": {"image": ["1", 0],
                         # Тело - да, кисти и лицо - нет. Ради этого всё.
                         "detect_body": "enable",
                         "detect_hand": "disable",
                         "detect_face": "disable",
                         "resolution": разрешение}},
        "3": {"class_type": "SaveImage",
              "inputs": {"images": ["2", 0], "filename_prefix": "poza"}},
    }


def прогнать(г, предел=180):
    ид = str(uuid.uuid4())
    з = urllib.request.Request(
        COMFY + "/prompt",
        data=json.dumps({"prompt": г, "client_id": ид}).encode(),
        headers={"Content-Type": "application/json"})
    try:
        pid = json.load(urllib.request.urlopen(з, timeout=60))["prompt_id"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", "ignore")[:600]) from None
    т = time.time()
    while time.time() - т < предел:
        try:
            h = json.load(urllib.request.urlopen(
                f"{COMFY}/history/{pid}", timeout=30))
        except Exception:                               # noqa: BLE001
            time.sleep(2)
            continue
        if pid in h:
            for узел in h[pid].get("outputs", {}).values():
                for к in узел.get("images", []):
                    return к["filename"]
            return None
        time.sleep(2)
    return None


def главное():
    только = set(sys.argv[1:])
    os.makedirs(ПОЗЫ, exist_ok=True)
    for файл in sorted(os.listdir(ЭТАЛОНЫ)):
        основа = os.path.splitext(файл)[0]
        ключ = КЛЮЧИ.get(основа)
        if not ключ or (только and основа not in только and ключ not in только):
            continue
        # Старый скелет сохраняем рядом: вернуть его надо уметь одной
        # командой, если тело без кистей поведёт позу.
        цель = os.path.join(ПОЗЫ, ключ + ".png")
        if os.path.exists(цель) and not os.path.exists(цель + ".с_кистями"):
            shutil.copy2(цель, цель + ".с_кистями")
        имя_вх = f"эталон_{ключ}.png"
        shutil.copy2(os.path.join(ЭТАЛОНЫ, файл), os.path.join(ВХОД, имя_вх))
        try:
            вышло = прогнать(граф(имя_вх))
        except Exception as e:                          # noqa: BLE001
            print(f"МИМО {ключ:10s} {str(e)[:120]}")
            continue
        if not вышло:
            print(f"МИМО {ключ:10s} препроцессор не отдал кадр")
            continue
        os.replace(os.path.join(ВЫХОД, вышло), цель)
        print(f"ок   {ключ:10s} <- {файл}")


if __name__ == "__main__":
    главное()
