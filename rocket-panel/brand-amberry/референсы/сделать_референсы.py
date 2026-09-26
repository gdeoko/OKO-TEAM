#!/usr/bin/env python3
"""Референсы для роликов: наша модель В ОДЕЖДЕ, разные кадры.

Это ВХОДНОЕ фото формата «реальный показ генерации»: в ролике его
прикладывают в бота и жмут кнопку. Поэтому оно обязано быть таким, каким
человек приложит своё - обычный кадр одетой девушки, а не студийная
обложка.

Три правила, из которых всё остальное следует.

ЛИЦО ТО ЖЕ, ЧТО НА АККАУНТЕ. Ролик снимается от лица персонажа, и
девушка на входном кадре должна быть той же, что на аватарке, иначе
лента читается как склад чужих картинок. Описание лица берётся из
`персонажи/сделать_аватарки.py` и не переписывается здесь: разойдутся -
разойдутся и лица.

КАДР ПОЯСНОЙ ИЛИ В РОСТ. Аватарка портретная, тут наоборот: боту нужно
тело, иначе раздевать нечего и показывать нечего.

ВСЁ ОСТАЛЬНОЕ РАЗНОЕ. Ракурс, поза, одежда, свет, обстановка и фигура -
у каждого кадра свои. Один и тот же вход в десяти роликах подряд виден
сразу, и лента перестаёт читаться как живая.

    export APIMODELS_KEY=...
    python3 сделать_референсы.py ника            все кадры одного лица
    python3 сделать_референсы.py ника 2          один кадр по номеру
    python3 сделать_референсы.py забрать ника 2 <taskId>   добрать оборванное
"""
import json
import os
import subprocess
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(ТУТ), "персонажи"))

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "doubao-seedream-5-0-pro")

# Лица берём из паспорта аватарок - там канон, утверждённый владельцем.
from сделать_аватарки import ПЕРСОНАЖИ                        # noqa: E402

# Общая часть: камера обычного телефона, а не студия. Входное фото в
# ролике должно выглядеть тем, чем оно притворяется, - снимком, который
# человек нашёл у себя в галерее.
ОБЩЕЕ = (
    "Ultra-realistic vertical photograph shot on a modern flagship "
    "smartphone camera, 4:5 portrait framing, casual everyday photo - the "
    "kind of picture a person actually has in their phone gallery, not a "
    "studio editorial. Natural imperfect composition, slight handheld "
    "feel, honest colors. "
    "The full body or at least the figure from mid-thigh up is clearly "
    "visible inside the frame, head to at least the hips, nothing cropped "
    "awkwardly, the subject standing or sitting naturally with relaxed "
    "posture and visible silhouette. "
    "Photo-real skin with pores and fine texture, natural subsurface "
    "scattering, no plastic airbrushing, no waxy sheen, no beauty filter. "
    "Sharp focus on the subject, mild natural depth of field, clean "
    "exposure, no motion blur on the face. "
    "Quality: 8K, ultra sharp, true-to-life color, no banding, no noise. "
    "Strictly no text, no letters, no watermarks, no logos, no borders, no "
    "collage, no additional people, no extra limbs, no extra fingers, no "
    "deformed hands, no nudity, no lingerie, no swimwear, no see-through "
    "fabric, no visible cleavage line, fully and modestly dressed."
)

# Кадры. У каждого свои: обстановка, свет, одежда, поза, ракурс и
# ФИГУРА - владелец просил показывать разные телосложения так же, как их
# показывает сам бот на старте.
КАДРЫ = [
    {
        "имя": "улица-вечер",
        "фигура": "slim athletic build with a small bust and narrow hips, "
                  "long legs, flat stomach",
        "сцена": (
            "Standing on a city street in the evening, warm shop windows and "
            "blurred car lights behind her, wearing high-waisted straight "
            "blue jeans and a fitted plain white long-sleeve top tucked in, "
            "a small shoulder bag, white sneakers. Three-quarter angle, "
            "weight on one leg, one hand adjusting her hair, looking into "
            "the camera with a calm half-smile. Soft mixed street lighting, "
            "warm highlights on the hair."),
    },
    {
        "имя": "зал-зеркало",
        "фигура": "toned hourglass figure with a full bust and rounded hips, "
                  "defined waist",
        "сцена": (
            "A mirror selfie in a modern gym, bright even ceiling light, "
            "grey equipment softly out of focus behind her, wearing a black "
            "high-neck sports top with full coverage and matching black "
            "high-waisted leggings, hair in a high ponytail. She holds the "
            "phone at chest height, hip pushed slightly to one side, "
            "confident direct gaze. Reflection is clean, the phone partially "
            "covers nothing of the face."),
    },
    {
        "имя": "балкон-утро",
        "фигура": "petite slender frame, delicate shoulders, small bust, "
                  "slim hips",
        "сцена": (
            "Morning on an apartment balcony, soft overcast daylight, green "
            "plants and a white railing, city rooftops far behind. She wears "
            "a light beige midi sundress with thin straps over a visible "
            "white tank top underneath, barefoot, holding a mug of coffee. "
            "Seated sideways on a chair, turned toward the camera, relaxed "
            "warm expression, hair loose and slightly messy from sleep."),
    },
    {
        "имя": "клуб-неон",
        "фигура": "curvy full figure with generous bust and wide rounded "
                  "hips, soft feminine proportions",
        "сцена": (
            "Inside a dim nightclub corridor, magenta and violet neon strips "
            "along the wall, deep shadows, faint haze in the air. She wears "
            "a knee-length black knitted dress with long sleeves and a high "
            "neckline, hugging the figure but fully covering, and heeled "
            "ankle boots. Leaning one shoulder against the wall, hip out, "
            "chin slightly down, looking up into the lens. Hot pink rim "
            "light traces her silhouette."),
    },
    {
        "имя": "кухня-день",
        "фигура": "average natural build, medium bust, softly rounded hips, "
                  "realistic everyday proportions",
        "сцена": (
            "In a bright modern kitchen at midday, large window with sheer "
            "curtains diffusing the light, wooden counter and a few plants. "
            "She wears loose grey sweatpants and an oversized cream knit "
            "sweater, hair tied in a loose bun, no makeup look. Standing "
            "half-turned, one hand on the counter, laughing lightly at the "
            "camera. Clean daylight, gentle shadows."),
    },
    {
        "имя": "лифт-селфи",
        "фигура": "tall slim figure with long limbs, small bust, straight "
                  "narrow hips",
        "сцена": (
            "A full-height mirror selfie in a mirrored elevator, cool "
            "overhead light, brushed metal panel with buttons at the side. "
            "She wears a fitted black turtleneck tucked into a grey pleated "
            "midi skirt and opaque black tights, a coat over one arm. Phone "
            "held at waist level, one hip forward, head slightly tilted, "
            "neutral confident look. The whole body from shoes to hair is "
            "inside the frame."),
    },
]


def зов(аргументы):
    """Запрос к APIMODELS через curl: в облачной сессии urllib молча
    висит на прокси, curl отвечает сразу (та же грабля, что с Supabase)."""
    р = subprocess.run(
        ["curl", "-s", "-m", "90", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=120)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-200:])
    о = json.loads(р.stdout or b"{}")
    if о.get("code") not in (200, None):
        raise RuntimeError("APIMODELS: %s" % str(о)[:300])
    return о.get("data") or {}


def забрать(лицо, номер, задача):
    """Дождаться готовой задачи и положить файл. Оборванный запуск - не
    повод платить второй раз: задача досчитывается на той стороне."""
    было = ""
    for _ in range(180):
        время = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (время.get("state") or "").lower()
        if сост != было:
            print("  ...", сост or "(без состояния)", flush=True)
            было = сост
        ссылки = время.get("resultUrls") or []
        if ссылки:
            путь = os.path.join(ТУТ, "%s-%d-%s.jpg"
                                % (лицо, номер, КАДРЫ[номер]["имя"]))
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь, ссылки[0]],
                           check=True, timeout=200)
            print("  готово:", путь, os.path.getsize(путь), "байт", flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  отказ:", str(время)[:300])
            return None
        time.sleep(5)
    print("  не дождались, задача", задача)
    return None


def сделать(лицо, номер):
    к = КАДРЫ[номер]
    промпт = " ".join([ОБЩЕЕ, ПЕРСОНАЖИ[лицо],
                       "Her body: " + к["фигура"] + ".", к["сцена"]])
    print("%s кадр %d (%s): промпт %d знаков"
          % (лицо, номер, к["имя"], len(промпт)), flush=True)
    тело = json.dumps({"model": МОДЕЛЬ, "prompt": промпт,
                       "aspect_ratio": "4:5", "resolution": "2K"})
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", тело])
    задача = д.get("taskId")
    if not задача:
        print("  не приняли задачу:", str(д)[:300])
        return None
    print("  задача", задача, flush=True)
    return забрать(лицо, номер, задача)


def главное(арг):
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    if арг and арг[0] == "забрать":
        _, лицо, номер, задача = арг
        return забрать(лицо, int(номер), задача)
    лицо = (арг[0] if арг else "ника").lower()
    if лицо not in ПЕРСОНАЖИ:
        raise SystemExit("лица %s нет: %s" % (лицо, ", ".join(ПЕРСОНАЖИ)))
    номера = [int(арг[1])] if len(арг) > 1 else range(len(КАДРЫ))
    for н in номера:
        сделать(лицо, н)


if __name__ == "__main__":
    главное(sys.argv[1:])
