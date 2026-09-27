#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Формат 4 «Своя FYP»: входной кадр, снятый КАК НА ТЕЛЕФОН.

Отличие от остальных форматов принципиальное и идёт от разбора восьми
живых примеров (27.09.2026): там ценность не в красоте кадра, а в том,
что он ЛЮБИТЕЛЬСКИЙ. Кривая рамка, комната как есть, свет из окна,
телефон в руке - это читается как живой человек, и потому залетает.
Ровный студийный кадр на том же месте читается как реклама, и лента
его пролистывает.

Побочная выгода: «телефонный» вид прячет артефакты генерации. То, с чем
мы боролись бы как с браком в формате 1 - зерно, шевеление, неидеальный
свет - здесь работает на достоверность.

Раздевания в этом формате НЕТ вовсе. Это чистый охват: девушка просто
двигается в кадре, одежда обычная. Продажу делает аутро.

    export APIMODELS_KEY=...
    python3 кадр_fyp.py ника 0
"""
import json
import os
import random
import subprocess
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
sys.path.insert(0, os.path.join(БРЕНД, "персонажи"))

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "doubao-seedream-5-0-pro")

from сделать_аватарки import ПЕРСОНАЖИ                        # noqa: E402

# Камера - телефон в руке, а не штатив. Каждое слово тут снимает одну
# «красивость», которую модель добавила бы сама.
ОБЩЕЕ = (
    "Vertical 9:16 photo that looks like an ordinary phone snapshot posted "
    "to social media by the person herself. This is NOT a studio photograph, "
    "NOT an advertisement, NOT a fashion editorial. "
    "Shot on a modern smartphone front or rear camera, handheld, so the "
    "framing is slightly off-centre and the horizon is a degree or two off "
    "level. Ordinary available light from a window or a ceiling lamp, with "
    "the uneven shadows real rooms have. Mild digital noise in the darker "
    "areas, the way phone sensors behave indoors. "
    "She is visible from head to mid-thigh or head to knee, filling most of "
    "the frame, close to the camera. "
    "Her expression is relaxed and unposed, as if she is mid-movement rather "
    "than holding a pose for a photographer. "
    "Photo-real skin with pores, small imperfections and real texture: no "
    "airbrushing, no beauty filter, no glossy retouch. Natural everyday "
    "makeup. Hair worn down, slightly imperfect. "
    "The room behind her is a real lived-in space with ordinary objects, not "
    "a clean set. "
    "Strictly no text, no letters, no watermarks, no logos, no borders, no "
    "collage, no additional people, no extra limbs, no extra fingers, no "
    "deformed hands, no nudity, no underwear, no lingerie, no see-through "
    "fabric, nothing revealing."
)

# Одежда обычная: топ, шорты, платье, спортивное. Ничего снимать не будут.
ОДЕЖДА = [
    "a plain fitted cropped tank top and high-waisted soft grey joggers",
    "a simple ribbed white crop top and light blue denim shorts",
    "a plain black sports bra top and matching black leggings",
    "a short everyday summer dress in one plain colour",
    "an oversized plain t-shirt worn over simple shorts",
    "a plain knit crop top and a short pleated skirt",
]

# Сцены прямо из разбора примеров владельца: комната, зеркало,
# примерочная, ванная, балкон, машина.
СЦЕНЫ = [
    {"имя": "комната-зеркало",
     "сцена": ("Standing in her own bedroom in front of a large mirror, "
               "filming her reflection with the phone held in one hand. An "
               "unmade bed, clothes on a chair and a window with daylight "
               "behind her.")},
    {"имя": "примерочная",
     "сцена": ("Standing in a clothing shop fitting room, filming herself in "
               "the mirror with the phone in one hand. A curtain, a bench "
               "and a few hangers with clothes behind her, flat ceiling "
               "light overhead.")},
    {"имя": "кухня-утро",
     "сцена": ("Standing in a small ordinary kitchen in the morning, the "
               "phone propped up on the counter. Mugs, a kettle and a window "
               "with soft daylight behind her.")},
    {"имя": "ванная",
     "сцена": ("Standing in a small home bathroom in front of the mirror, "
               "filming herself with the phone in one hand. Tiles, a towel "
               "on a hook and a warm ceiling light.")},
    {"имя": "балкон-вечер",
     "сцена": ("Standing on the balcony of an apartment in the late "
               "afternoon, the city visible behind her, warm low sun on one "
               "side of her face. The phone is held up in front of her.")},
    {"имя": "машина",
     "сцена": ("Sitting in the driver seat of a parked car, filming herself "
               "with the phone held up. Daylight through the windscreen, an "
               "ordinary car interior behind her.")},
]


def зов(аргументы):
    р = subprocess.run(
        ["curl", "-s", "-m", "90", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=120)
    о = json.loads(р.stdout or b"{}")
    if о.get("code") not in (200, None):
        raise RuntimeError("APIMODELS: %s" % str(о)[:300])
    return о.get("data") or {}


def сделать(лицо, номер, выход=None, семя=None):
    с = СЦЕНЫ[номер % len(СЦЕНЫ)]
    сл = random.Random(str(семя or (лицо + с["имя"])))
    одежда = сл.choice(ОДЕЖДА)
    выход = выход or os.path.join(ТУТ, "вход-%s-%s.jpg" % (лицо, с["имя"]))

    промпт = " ".join([ОБЩЕЕ, ПЕРСОНАЖИ[лицо], с["сцена"],
                       "She is wearing " + одежда + "."])
    print("%s / %s: %s, промпт %d знаков"
          % (лицо, с["имя"], одежда.split(" and ")[0][:34], len(промпт)), flush=True)
    тело = json.dumps({"model": МОДЕЛЬ, "prompt": промпт,
                       "aspect_ratio": "9:16", "resolution": "2K"})
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", тело])
    задача = д.get("taskId")
    if not задача:
        print("  не приняли:", str(д)[:200], flush=True)
        return None

    было = ""
    for _ in range(180):
        д = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (д.get("state") or "").lower()
        if сост != было:
            print("  ...", сост or "(пусто)", flush=True)
            было = сост
        ссылки = д.get("resultUrls") or []
        if ссылки:
            subprocess.run(["curl", "-s", "-m", "180", "-o", выход, ссылки[0]],
                           check=True, timeout=200)
            print("  готово:", выход, os.path.getsize(выход), "байт", flush=True)
            return выход
        if сост in ("failed", "error"):
            print("  отказ:", str(д)[:200], flush=True)
            return None
        time.sleep(5)
    return None


if __name__ == "__main__":
    а = sys.argv[1:]
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    сделать((а[0] if а else "ника").lower(), int(а[1]) if len(а) > 1 else 0)
