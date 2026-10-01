#!/usr/bin/env python3
"""Аватарки пяти персонажей AMBERRY для соцсетей: 1:1, стиль бренда.

Под каждого персонажа своя пачка аккаунтов (Instagram, TikTok, YouTube),
и аватарка у них общая - это лицо аккаунта. Поэтому кадр ПОРТРЕТНЫЙ,
по плечи: аватарка видна кружком в 40 пикселей, тело в ней не читается
вовсе, а модерация площадок к откровенному в аватарке придирается
первой. Тело покажут ролики, аватарка должна цеплять лицом.

Пять разных типажей нарочно. Пять аккаунтов с одинаковыми блондинками
читаются как одна сетка ботов и улетают в бан пачкой; разные девушки в
одном фирменном свете читаются как пять разных блогеров.

Ника - та же, что в боте: её лицо уже стоит на заставке и на всех
экранах, и менять его нельзя. Остальные четыре новые.

Свет, фон и цвет одинаковые у всех: неоновый розовый #FF0A8C и
фиолетовый #7A2BFF на чёрном #07060A. Это и есть узнаваемость бренда.

    python3 сделать_аватарки.py ника        одна, проверить стиль
    python3 сделать_аватарки.py все         все пять
"""
import json
import os
import subprocess
import sys
import time

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
# doubao-seedream-5-0-pro - основная: держит фирменный свет и типажи.
# Иногда задача зависает у сервиса в processing на четверть часа без
# ошибки; тогда AMBERRY_IMG_MODEL=gpt-image-2.5-sunburst даёт тот же
# кадр другим поставщиком, не дожидаясь, пока очередь рассосётся.
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "doubao-seedream-5-0-pro")
ТУТ = os.path.dirname(os.path.abspath(__file__))

# Общая часть промпта: свет, фон, камера, качество. Одна на всех, чтобы
# пять аватарок читались одной семьёй, а не случайным набором.
ОБЩЕЕ = (
    "Ultra-realistic commercial beauty portrait photograph, square 1:1 "
    "composition designed as a social media profile picture. "
    "TIGHT head-and-shoulders crop: the head fills the frame generously, "
    "the face occupies roughly 55 percent of the frame height, top of the "
    "hair near the upper edge, cropped just below the collarbones. The "
    "subject is centered, turned three quarters toward camera, looking "
    "directly into the lens with a confident, slightly playful expression, "
    "lips softly parted in a subtle knowing smile. "
    "Lighting: the FACE is lit by a soft neutral beauty light that keeps "
    "the natural skin tone completely readable - warm, sun-kissed, never "
    "washed in color. The brand neon works as EDGE light only: a hot pink "
    "(#FF0A8C) rim from behind the left shoulder traces the cheek, jaw and "
    "hair edge; a violet (#7A2BFF) rim from behind the right separates the "
    "silhouette from the darkness. Background is pitch black (#07060A) with "
    "vertical neon tubes glowing far behind, heavily defocused into soft "
    "pink and violet bokeh, never competing with the face. Faint volumetric "
    "haze catches the beams. Tiny specular highlights on the lower lip, the "
    "inner eye corners and the collarbones. "
    "Camera and optics: full frame mirrorless with an 85mm f/1.4 portrait "
    "lens wide open, razor sharp focus on the iris, creamy shallow depth of "
    "field, no distortion, flattering perspective. "
    "Skin rendering: flawless but real - visible pores, fine peach fuzz "
    "along the jaw, natural subsurface scattering, a light dewy sheen on "
    "the cheekbones, absolutely no plastic airbrushed look, no waxy skin, "
    "no orange or magenta skin cast. "
    "Styling: evening glam makeup - precise winged eyeliner, long fluttery "
    "lashes, sculpted brows, glossy lips, soft shimmer on the eyelids and "
    "cheekbones. Hair is voluminous and glossy, individual strands catching "
    "the rim light against the dark background. "
    "Wardrobe: a magenta satin top with a THIN STRAP CLEARLY VISIBLE over "
    "the shoulder, so the shoulder never reads as bare - tasteful, modest, "
    "suitable for a public profile picture on Instagram, TikTok and YouTube. "
    "Quality: 8K, ultra sharp, commercial magazine cover grade retouching, "
    "rich blacks, vibrant but controlled neon color grading, cinematic "
    "contrast, no banding, no noise. "
    "Strictly no text, no letters, no watermarks, no logos, no borders, no "
    "frames, no collage, no additional people, no hands in frame, no extra "
    "fingers, no jewelry clutter, no busy background, no nudity, no "
    "cleavage visible in frame."
)

# Пять персонажей. У каждого - только то, чем он отличается: лицо,
# волосы, глаза, характер взгляда. Остальное берётся из `ОБЩЕЕ`.
ПЕРСОНАЖИ = {
    "ника": (
        "A stunning 24 year old Slavic woman with long, perfectly straight, "
        "sleek WARM ASH BLONDE hair - a natural dark-rooted blonde with "
        "golden beige tones, NOT white platinum - brushed smoothly back "
        "from the forehead with a soft side part, falling flat and glossy "
        "past the shoulders. Large grey-blue eyes with a cool clear gaze, "
        "heavy dark winged eyeliner and thick lashes. A soft rounded "
        "feminine face shape with gently full cheeks, high but smooth "
        "cheekbones, a small straight nose, naturally full lips with a "
        "glossy nude-pink finish, a delicate jawline. Her skin is "
        "sun-kissed golden tan, warm and healthy, with an athletic "
        "swimmer's neck and shoulders. Her expression is self assured and "
        "slightly teasing, the look of someone who knows exactly how good "
        "she looks."
    ),
    "ева": (
        "A captivating 23 year old woman with long copper red hair, "
        "naturally wavy and voluminous, individual strands glowing amber "
        "and hot pink where the neon hits them. Bright jade green eyes "
        "with golden flecks, framed by soft reddish lashes. Fair "
        "porcelain skin with a delicate scattering of freckles across the "
        "bridge of the nose and cheekbones, kept visible and natural. "
        "Soft heart shaped face, a small upturned nose, full rosy lips, "
        "a warm open expression with mischief in the smile."
    ),
    "юки": (
        "A gorgeous 24 year old East Asian woman with long, perfectly "
        "straight, glossy jet black hair with a blunt cut and soft "
        "curtain bangs framing the face, the hair reflecting the pink "
        "neon like silk. Deep dark brown almond eyes with a calm, "
        "hypnotic gaze, precise graphic eyeliner extending the outer "
        "corners. Flawless fair skin with a cool undertone, delicate "
        "features, a small refined nose, full glossy lips in a soft coral "
        "tone, elegant slender neck. Her expression is serene, mysterious "
        "and quietly confident."
    ),
    # Mira и Saya сняты владельцем 01.10.2026, на их места встали Maria и
    # Julia. У этих двоих лицо уже зафиксировано листом ракурсов, поэтому
    # лист уходит референсом (см. `лист`), а текст ниже только напоминает
    # модели, кого держать: без листа выйдет похожая, но другая женщина.
    "мария": (
        "A beautiful 19 year old woman with long warm chestnut hair in soft "
        "natural waves, coppery highlights catching the neon, parted in the "
        "middle. Green-hazel eyes with a calm direct gaze, thick even brows, "
        "a light scattering of freckles kept visible. Fair skin with a faint "
        "natural warmth - light, never bronzed. A narrow face with high "
        "cheekbones, a straight nose, medium-full lips. Her expression is "
        "soft and quiet, friendly without challenge."
    ),
    "юлия": (
        "A beautiful 20 year old woman with long thick dark brown hair, "
        "almost brunette, in loose waves with the front strands swept back "
        "and pinned. Light brown eyes with a green cast, bright and lively, "
        "freckles across the cheekbones kept visible. Fair even skin, a "
        "narrow face, full lips, a warm easy half-smile. Her expression is "
        "light and open, the look of someone laughing a second ago."
    ),
}


def зов(аргументы):
    """Запрос к APIMODELS через curl.

    Не через urllib: в облачной сессии исходящее идёт через прокси, и
    urllib на нём молча висит минутами (тот же случай, что с Supabase -
    в памяти проекта об этом отдельная строка). curl отвечает за
    доли секунды.
    """
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=210)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-200:])
    о = json.loads(р.stdout or b"{}")
    if о.get("code") not in (200, None):
        raise RuntimeError("APIMODELS: %s" % str(о)[:300])
    # Всё содержательное лежит внутри `data`, а не на верхнем уровне:
    # taskId, состояние (`state`, НЕ `status`) и ссылки `resultUrls`.
    return о.get("data") or {}


def лист(имя):
    """Лист ракурсов лица как data-URI, или пусто.

    У лиц, заведённых по готовым снимкам (Maria, Julia), внешность уже
    зафиксирована листом, и описанием её не повторить: выйдет похожая, но
    другая женщина, а аватарка и кадры ролика должны быть одним человеком.
    У нарисованных с нуля (Nika, Eva, Yuki) листа в этот момент может не
    быть - тогда работает только текст, как раньше.
    """
    import base64
    п = os.path.join(ТУТ, имя, "%s-ракурсы.jpg" % имя)
    if not os.path.exists(п):
        return ""
    with open(п, "rb") as ф:
        return "data:image/jpeg;base64," + base64.b64encode(ф.read()).decode()


def сделать(имя):
    промпт = ОБЩЕЕ + " " + ПЕРСОНАЖИ[имя]
    реф = лист(имя)
    if реф:
        промпт += (" IDENTITY: the attached reference file is a character "
                   "sheet of this exact woman seen from several angles. "
                   "Build her face from it and keep it identical - same "
                   "features, same hair colour, same eyes. Never show the "
                   "sheet itself, never show a grid or several copies of "
                   "her: exactly ONE woman in the finished portrait.")
    print("%s: промпт %d знаков%s, отправляю..." % (
        имя, len(промпт), ", лист ракурсов референсом" if реф else ""), flush=True)
    тело = {"model": МОДЕЛЬ, "prompt": промпт,
            "aspect_ratio": "1:1", "resolution": "2K"}
    if реф:
        тело["image"] = [реф]
        тело["image_urls"] = [реф]
    # Тело уходит ФАЙЛОМ, а не аргументом: лист ракурсов в base64 весит под
    # мегабайт, и `curl -d <строка>` падает с «Argument list too long».
    врем = "/tmp/amberry-ava-%s.json" % имя
    with open(врем, "w") as ф:
        json.dump(тело, ф)
    try:
        д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", "@" + врем])
    finally:
        os.remove(врем)
    задача = д.get("taskId")
    if not задача:
        print("  не приняли задачу:", str(д)[:300])
        return None
    print("  задача", задача, flush=True)
    было = ""
    for _ in range(144):                     # до 12 минут; обычно 40 секунд,
        # но одна из пяти задач висела в processing почти пять - лучше
        # подождать, чем считать её потерянной и генерировать заново
        time.sleep(5)
        с = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (с.get("state") or "").lower()
        if сост != было:                     # молчание не отличить от зависшего
            print("  ...", сост or "(без состояния)", flush=True)
            было = сост
        if сост in ("completed", "succeeded", "success"):
            ссылки = с.get("resultUrls") or []
            if not ссылки:
                print("  готово, но без картинки:", str(с)[:300])
                return None
            путь = os.path.join(ТУТ, "аватар-%s.jpg" % имя)
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь, ссылки[0]],
                           check=True, timeout=200)
            print("  готово: %s (%.0f КБ, %s кредита)" % (
                путь, os.path.getsize(путь) / 1024, с.get("credits")), flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  отказ:", с.get("failMsg") or str(с)[:300])
            return None
    print("  не дождались за 5 минут")
    return None


def забрать(имя, задача):
    """Дождаться и скачать УЖЕ СОЗДАННУЮ задачу по её номеру.

    Генерация идёт на стороне APIMODELS и переживает смерть нашего
    процесса, а деньги за неё уже списаны. Поэтому оборвавшийся запуск
    не повод платить второй раз: номер задачи есть в логе, картинку
    забираем этой командой.
    """
    for _ in range(144):
        с = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (с.get("state") or "").lower()
        print("  ...", сост, flush=True)
        if сост in ("completed", "succeeded", "success"):
            ссылки = с.get("resultUrls") or []
            путь = os.path.join(ТУТ, "аватар-%s.jpg" % имя)
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь, ссылки[0]],
                           check=True, timeout=200)
            print("  готово:", путь, flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  отказ:", с.get("failMsg"))
            return None
        time.sleep(5)
    return None


if __name__ == "__main__":
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    что = sys.argv[1:] or ["ника"]
    if len(что) == 3 and что[0] == "забрать":
        raise SystemExit(0 if забрать(что[1], что[2]) else 1)
    кого = list(ПЕРСОНАЖИ) if что == ["все"] else что
    for имя in кого:
        if имя not in ПЕРСОНАЖИ:
            print("нет такого персонажа:", имя, "| есть:", ", ".join(ПЕРСОНАЖИ))
            continue
        сделать(имя)
