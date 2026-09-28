#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Фото дня модели: в одежде, в пол роста, лицом в камеру.

ЗАЧЕМ ИМЕННО ТАКОЙ КАДР. Проверять бота на снимке со спины, обрезанном
по бедро, нельзя: перёд ему приходится выдумывать целиком - лицо,
грудь, живот, ноги, - и тогда «не держит лицо» и «не держит фигуру»
ничего не доказывают, держать нечего. Референс обязан показывать то,
что бот должен сохранить.

ПОЛОВИНА РОСТА, А НЕ ПОЛНЫЙ. Правка владельца 28.09.2026. В полный рост
лицо занимает сотню пикселей, и «похоже - не похоже» на таком кадре не
проверить ни глазом, ни машиной. Кадр от середины бедра вверх даёт лицо
вчетверо крупнее и при этом сохраняет грудь, талию и бёдра - всё, что
бот обязан удержать.

ОДЕЖДА ОБЛЕГАЮЩАЯ. Свободное платье прячет фигуру, и тогда претензия
«форму тела не держит» недоказуема: формы не было видно и на входе.
Облегающее показывает грудь, талию и бёдра как есть, и после раздевания
их можно сверить.

Модель дешёвая (правило владельца: фото моделей - на ней, посты и
карусели - на gpt-image-2), лицо приходит референсом.

    python3 референс.py <лицо-url-или-файл> [имя]
"""
import base64
import json
import os
import subprocess
import sys
import time

# Сам инструмент лежит в отслеживаемой папке, а снимки - в `сутки/`,
# которая целиком в .gitignore: фото дня клиентский контент, ему не
# место в истории ветки. Раньше здесь лежало и то и другое, и скрипт
# молча выпадал из репозитория вместе с ними.
ТУТ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "сутки")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = "doubao-seedream-5-0-pro"

ПРОМПТ = (
 "Full-length vertical portrait photograph of the woman from the attached "
 "reference photograph. Keep EXACTLY the same face: same bone structure, "
 "same eyes, same eyebrows, same nose, same lips, same jawline, same long "
 "straight warm ash blonde hair with slightly darker roots, same slim build "
 "with soft natural proportions. She is 24. Do not restyle her, do not age "
 "her, do not change her hair colour or length, do not slim or widen her. "
 "POSE AND FRAMING: a half-length shot. She stands facing the camera "
 "straight on and the frame cuts her at mid thigh, so her head, shoulders, "
 "chest, waist and hips are all inside it and her face is large and clearly "
 "readable, filling roughly a sixth of the frame height. A little empty "
 "space above her head. Weight on one leg, arms relaxed and held slightly "
 "away from her sides so they do not hide her waist, shoulders open, chin "
 "level, looking calmly into the lens. Nothing crosses in front of her, no "
 "furniture cuts her off, both hands fully visible with five fingers each. "
 "CLOTHES: a tight fitting short champagne satin slip dress on thin straps, "
 "cut close to the body so the shape of her chest, her waist and her hips "
 "is plainly visible through it, the fabric following her figure with soft "
 "folds only where it must. The clothing is fully covering and its edges "
 "are obvious against the skin. "
 "PLACE AND LIGHT: a dim luxury hotel suite at night, a floor to ceiling "
 "window behind her with a blurred night city far below, one warm bedside "
 "lamp to the right giving a soft key from the side, a very low cool fill "
 "from the window, deep but not black shadows, glossy dark floor with a soft "
 "reflection. "
 "CAMERA AND QUALITY: shot on a full frame camera with an 85mm lens at f/2.8, "
 "ISO 400, eye level, the whole figure in sharp focus, natural photographic "
 "depth of field with the room behind her softly out of focus. This is a "
 "PHOTOGRAPH, not an illustration: real skin with visible pores, fine "
 "flyaway hairs, natural skin tone variation, subtle specular highlights on "
 "the satin, fine filmic grain. No flat colour fills, no posterisation, no "
 "hard cel-shaded edges, no outlines around the figure, no vector look, no "
 "painterly brush strokes, no airbrushed plastic skin. No text, no "
 "watermark, no logo, no border."
)


def зов(аргументы, ключ):
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, text=True, timeout=210)
    return json.loads(р.stdout or "{}")


def образец(что):
    if что.startswith("http"):
        return что
    with open(что, "rb") as ф:
        return "data:image/jpeg;base64," + base64.b64encode(ф.read()).decode()


def сделать(лицо, имя, ключ):
    о = образец(лицо)
    тело = json.dumps({"model": МОДЕЛЬ, "prompt": ПРОМПТ,
                       "aspect_ratio": "9:16",
                       "image": [о], "image_urls": [о]})
    п = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
         "-H", "Content-Type: application/json", "-X", "POST",
         БАЗА + "/images/generations", "--data-binary", "@-"],
        input=тело, capture_output=True, text=True, timeout=210)
    з = (json.loads(п.stdout or "{}").get("data") or {}).get("taskId")
    if not з:
        raise SystemExit("задачу не приняли: %s" % п.stdout[:300])
    print("задача", з, flush=True)
    for _ in range(150):
        р = зов([БАЗА + "/images/generations?task_id=" + з], ключ).get("data", {})
        с = (р.get("state") or "").lower()
        if с in ("success", "succeeded", "completed"):
            цель = os.path.join(ТУТ, имя)
            subprocess.run(["curl", "-sL", "-o", цель,
                            (р.get("resultUrls") or [""])[0]], check=True)
            print("готово:", цель, os.path.getsize(цель), "байт", flush=True)
            return цель
        if с in ("fail", "failed", "error"):
            raise SystemExit("не вышло: %s" % str(р)[:250])
        time.sleep(4)
    raise SystemExit("не дождались")


if __name__ == "__main__":
    ключ = os.environ.get("APIMODELS_KEY", "")
    if not ключ or len(sys.argv) < 2:
        raise SystemExit(__doc__)
    сделать(sys.argv[1], sys.argv[2] if len(sys.argv) > 2
            else "ника-одета-полный-рост.jpg", ключ)
