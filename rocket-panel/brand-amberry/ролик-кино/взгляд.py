#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Второе сито жилы: кадр смотрит модель, а не счётчик пикселей.

Маска кожи отбирает ЛЮБУЮ тёплую картинку: песок, штукатурку, деревянные
стены, лица в гриме. По первой сотне лент видно, куда она ведёт - наверх
всплыли фильмы нудистских лагерей 1960-63 годов, где кожи действительно
много, но это нагота, а она нам запрещена.

Поэтому кадры, прошедшие маску, смотрит модель и отвечает по каждому:
молодая ли женщина, одета ли, есть ли в кадре чувственность. Фильм
получает не «сколько кожи», а «сколько кадров ГОДНЫХ».

Лист собирается с номерами ячеек, и модель отвечает номерами: так она
видит весь фильм разом и сравнивает кадры между собой, а не судит каждый
поодиночке.

    python3 взгляд.py <ид> [<ид> ...]
"""
import base64
import io
import json
import os
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
КЭШ = os.path.join(ТУТ, ".миниатюры")
ОТВЕТЫ = os.path.join(ТУТ, ".взгляд")

ЗАДАЧА = """На картинке сетка кадров из старого фильма, ячейки пронумерованы.
Это отбор материала для рекламного ролика. Оцени КАЖДУЮ ячейку и верни JSON.

Для каждой ячейки поля:
  "n" - номер ячейки
  "жен" - есть ли в кадре женщина крупно или в полный рост (true/false)
  "молодая" - выглядит ли она моложе 35 (true/false)
  "одета" - true, если тело прикрыто (одежда, бельё, купальник);
            false, если грудь или ягодицы открыты
  "чувств" - есть ли чувственность: поза, бельё, купальник, объятие,
             постель, танец, ванна (true/false)

Верни ТОЛЬКО JSON вида {"ячейки":[{...},...]}, без пояснений."""


def лист(кадры, кол=5, ш=320, в=180):
    """Сетка с номерами ячеек. Возвращает картинку и порядок кадров."""
    from PIL import Image, ImageDraw
    строк = (len(кадры) + кол - 1) // кол
    л = Image.new("RGB", (кол*ш, строк*(в+22)), (12, 12, 14))
    рис = ImageDraw.Draw(л)
    for i, (путь, номер) in enumerate(кадры):
        try:
            к = Image.open(путь).convert("RGB").resize((ш, в))
        except Exception:
            continue
        x, y = (i % кол)*ш, (i // кол)*(в+22)
        л.paste(к, (x, y))
        рис.rectangle([x, y, x+34, y+20], fill=(0, 0, 0))
        рис.text((x+7, y+5), str(i+1), fill=(255, 255, 255))
    return л


def спросить(картинка, ключ=None, модель=None):
    база = os.environ.get("GEMINI_BASE_URL", "").rstrip("/")
    ключ = ключ or os.environ.get("GEMINI_KEY_FREE") or os.environ.get("GEMINI_API_KEY")
    модель = модель or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
    буфер = io.BytesIO()
    картинка.save(буфер, format="JPEG", quality=82)
    # ЗАЩИТА МОДЕЛИ РЕЖЕТ ИМЕННО ТО, ЧТО НАМ НУЖНО. Лист с бельём она
    # закрывает целиком и отвечает пустотой - так ушли и бурлеск, и
    # нудистские ленты. Задача у нас разметочная: назвать, что в кадре, а
    # не создать его. Поэтому пороги ставим на «только явное», и нагота
    # по-прежнему отсекается - но уже нашим правилом, а не молчанием.
    пороги = [{"category": к, "threshold": "BLOCK_ONLY_HIGH"} for к in (
        "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT",
        "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH")]
    тело = {"safetySettings": пороги, "contents": [{"parts": [
        {"text": ЗАДАЧА},
        {"inline_data": {"mime_type": "image/jpeg",
                         "data": base64.b64encode(буфер.getvalue()).decode()}},
    ]}]}
    url = "%s/v1beta/models/%s:generateContent?key=%s" % (база, модель, ключ)
    п = subprocess.run(["curl", "-s", "-m", "180", url,
                        "-H", "Content-Type: application/json",
                        "--data-binary", "@-"],
                       input=json.dumps(тело), capture_output=True, text=True)
    try:
        о = json.loads(п.stdout)
        т = о["candidates"][0]["content"]["parts"][-1]["text"]
    except Exception:
        return None
    т = т.strip().strip("`")
    if т.startswith("json"):
        т = т[4:]
    н, к = т.find("{"), т.rfind("}")
    try:
        return json.loads(т[н:к+1])
    except Exception:
        return None


def годные(ответ):
    """Кадр годен: молодая женщина, одетая, с чувственностью."""
    if not ответ:
        return []
    и = []
    for я in ответ.get("ячейки", []):
        if я.get("жен") and я.get("молодая") and я.get("одета") and я.get("чувств"):
            и.append(int(я.get("n", 0)))
    return [n for n in и if n > 0]


def оценить(ид, сколько=25):
    папка = os.path.join(КЭШ, ид)
    if not os.path.isdir(папка):
        return None
    ф = sorted(f for f in os.listdir(папка) if f.endswith(".jpg"))
    if not ф:
        return None
    шаг = max(1, len(ф) // сколько)
    кадры = [(os.path.join(папка, x), int(x.split(".")[0])) for x in ф[::шаг]][:сколько]
    ответ = спросить(лист(кадры))
    номера = годные(ответ)
    os.makedirs(ОТВЕТЫ, exist_ok=True)
    # ПУСТОЙ ОТВЕТ - НЕ НОЛЬ ГОДНЫХ. Модель либо не ответила, либо лист
    # срезала защита - так было с нудистскими лентами и с бурлеском. Это
    # разные вещи: ноль означает «посмотрели и не нашли», отказ означает
    # «не смотрели». Путать их нельзя: во втором случае лента не оценена.
    итог = {"ид": ид, "кадров": len(кадры), "годных": len(номера),
            "отказ": ответ is None,
            "секунды": [кадры[n-1][1] for n in номера if n <= len(кадры)],
            "ответ": ответ}
    with open(os.path.join(ОТВЕТЫ, ид + ".json"), "w", encoding="utf-8") as о:
        json.dump(итог, о, ensure_ascii=False, indent=1)
    return итог


if __name__ == "__main__":
    for ид in sys.argv[1:]:
        и = оценить(ид)
        if not и:
            print("%-42s нет миниатюр" % ид[:42], flush=True)
        elif и["отказ"]:
            print("%-42s ОТКАЗ модели (лист срезан защитой)" % ид[:42], flush=True)
        else:
            print("%-42s годных %d из %d" % (ид[:42], и["годных"], и["кадров"]),
                  flush=True)
