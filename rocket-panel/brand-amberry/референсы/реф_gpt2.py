# -*- coding: utf-8 -*-
"""Идеальный референс нашей модели в другом ракурсе. GPT Image 2.

Слово владельца 28.09.2026: «Apimodels у тебя же есть. Оттуда нужно
сделать референс идеальный на gpt2 в другом ракурсе нашу модель».

Зачем это нужно именно сейчас. Модель на карте теряет фотореализм:
на исходном кадре Ники кожа настоящая, с порами, а на её же выводе
кожа пластиковая. Один-единственный вход вдобавок снят ночью, в пол
роста и анфас, поэтому у карты нет никаких сведений о том, как эта
девушка выглядит сбоку - и на ракурсах «раком», «на коленях», «лёжа»
она их выдумывает, отсюда и уехавшее лицо, и подменённый фон.

Второй ракурс в студийном свете эти сведения даёт.

Опорный кадр уходит ссылкой (`image_url`), а не описанием: словами
конкретного человека не задать, и без опоры выйдет просто блондинка.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import am                                                 # noqa: E402

ОПОРА = os.environ["OPORA"]
КУДА = os.environ.get("KUDA", "ника-реф-бок.png")

ПРОМПТ = (
    "Photorealistic studio photograph of the SAME woman as in the "
    "reference image. Identity must be preserved exactly: the same "
    "face, the same long straight warm ash-blonde hair swept back, "
    "the same sun-tanned skin tone, the same slim athletic build "
    "and the same proportions. Keep her eyebrow shape, the shape of "
    "her eyes and eyelids, her straight narrow nose, her full lips "
    "and her jawline exactly as they are in the reference. She must "
    "be instantly recognisable as the same person, not a lookalike.\n\n"

    "THE ONE THING THAT CHANGES IS THE CAMERA ANGLE. In the reference "
    "she faces the camera straight on. Here she is photographed in a "
    "THREE-QUARTER VIEW: her body is turned about forty-five degrees "
    "to her left, her shoulders and hips follow that turn, and she "
    "looks back over towards the lens so that her face is seen at a "
    "three-quarter angle with the far cheek and the line of her jaw "
    "and neck clearly readable. The turn of the torso, the curve of "
    "the spine, the side of the waist, the hip and the shoulder "
    "blade are all clearly visible. Full-length framing, head to "
    "feet, standing upright, weight on one leg, arms relaxed.\n\n"

    "LIGHT AND ROOM. A clean professional photo studio with a plain "
    "light grey seamless paper backdrop. Bright, even, soft daylight-"
    "balanced lighting at about 5500K: a large softbox as key light "
    "in front and slightly to one side, a second softbox as fill on "
    "the opposite side, and a soft rim light separating her from the "
    "background. No deep shadows, no dark corners, no moody contrast, "
    "nothing hidden. Every contour of her face and body is clearly "
    "lit and clearly visible.\n\n"

    "CLOTHING. The same same cream knit sweater and light grey soft "
    "trousers as in the reference photo. The knit keeps its visible "
    "stitch texture and folds naturally with the turn of her torso.\n\n"

    "SKIN AND TEXTURE - THIS IS THE MOST IMPORTANT PART. Her skin "
    "must look like REAL HUMAN SKIN photographed with a professional "
    "camera, not like rendered or airbrushed skin. Visible skin "
    "pores across the face, the shoulders and the chest. Fine "
    "peach-fuzz vellum hair catching the rim light along the jawline "
    "and the forearms. Subtle natural variation in skin tone, faint "
    "warmth over the cheeks, slightly translucent skin over the "
    "collarbones with the faintest vein showing through. Individual "
    "separated hair strands with flyaways, not solid painted locks. "
    "Eyelashes as separate individual lashes. Natural lip texture "
    "with fine vertical lines. Absolutely no plastic-smooth skin, no "
    "waxy or mannequin look, no heavy digital retouching, no "
    "airbrushing, no beauty filter, no illustrated or painted "
    "quality, no CGI, no 3D render.\n\n"

    "CAMERA. Shot on a full-frame camera with an 85mm prime lens at "
    "f/4, ISO 100, sharp critical focus on her eyes with the whole "
    "figure within the depth of field. Natural neutral colour, "
    "accurate white balance, full tonal range, fine natural film "
    "grain. This is a plain, honest, extremely sharp reference "
    "photograph made to show exactly what this person looks like "
    "from this angle - a casting reference, not a stylised editorial "
    "shot.")

тело = {"model": "gpt-image-2", "prompt": ПРОМПТ,
        "aspect_ratio": "2:3", "resolution": "2k",
        "image_url": ОПОРА}
print(f"промпт {len(ПРОМПТ)} знаков, опора {ОПОРА}")
о = am.зов("/images/generations", тело)
print(json.dumps(о, ensure_ascii=False)[:1200])
d = о.get("data") or {}
tid = d.get("taskId") or d.get("task_id") or о.get("taskId") or о.get("id")
if not tid:
    sys.exit("нет task_id - смотри ответ выше")
print("задача", tid)
итог, сек = am.дождаться(tid)
print(f"{сек:.0f}с:", json.dumps(итог, ensure_ascii=False)[:1500])
