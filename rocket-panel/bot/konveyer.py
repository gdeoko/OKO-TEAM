# -*- coding: utf-8 -*-
"""Конвейер кнопки: поза с эталона, анатомия моделью, лицо клиентки.

Три шага, и каждый отвечает ровно за своё. Разделение придумано не из
красоты: когда один проход делал всё сразу, кадр терял то позу, то
лицо, то анатомию, и спорили между собой текст кнопки, референс лица и
общие блоки промпта.

  1. ОСНОВА   LUSTIFY (SDXL) с ControlNet глубины по карте эталона и
              лорой анатомии. Отсюда поза кнопки, ракурс, комната и
              детальные органы. Кадр принимается приёмкой и при браке
              пересчитывается с другим зерном.
  2. ЛИЦО     FLUX.2 Klein двумя референсами: [лицо клиентки, основа].
              Из нескольких попыток берётся лучшая по узнаваемости.
  3. СБОРКА   с кадра Klein берётся ТОЛЬКО голова, всё остальное - те же
              пиксели основы. Вне маски кадр не меняется вовсе, поэтому
              анатомия и комната не могут поехать.

КАРТЫ ГЛУБИНЫ ЛЕЖАТ ФАЙЛАМИ (`bot/гайды/<кнопка>.jpg`), а не считаются
на лету: препроцессор стоит отдельного вызова на каждый кадр, а эталоны
не меняются. Порог отсечения фона у каждой карты подбирался по силуэту
человека, и это важно: фиксированный порог срезал на `un_close` торс и
голову, ControlNet читал это как «сверху пусто», и модель не рисовала
голову вовсе - шесть кругов перегенерации уходили в никуда.

ПОЧЕМУ ОПИСАНИЕ КОМНАТЫ ИДЁТ ПЕРВОЙ ФРАЗОЙ. В хвосте промпта модель его
почти не слышит: пять разных комнат давали расхождение кадров 11-40 из
255, то есть один и тот же угол. После переноса в начало стало 58-78.
"""
import json
import os
import uuid

import cv2
import numpy as np

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
ГАЙДЫ = os.path.join(ЗДЕСЬ, "гайды")

ОСНОВА_МОДЕЛЬ = "civitai:573152@1094291"      # LUSTIFY! v8, SDXL
ЛИЦО_МОДЕЛЬ = "runware:400@2"                 # FLUX.2 Klein 9B
ГЛУБИНА = "runware:3@1"
ЛОРА_АНАТОМИЯ = "civitai:276856@311992"       # Anus/Vulva Helper XL
ЛОРА_КОЖА = "civitai:580857@707763"           # Realistic Skin Texture XL

ШАГИ = 50
CFG = 7.5
ВЕС_ГАЙДА = 0.5
ГАЙД_ДО_ШАГА = 22
# Сколько зёрен пробуем, прежде чем отдать лучшее. Шесть кругов это
# около двух минут в худшем случае, а на деле девять кнопок из
# одиннадцати проходят приёмку с первого.
ПОПЫТОК = 4
ЗЁРНА = (11, 202, 777, 4242, 909, 31337)
# Три попытки лица, и это замерено, а не выбрано на глаз. Пять дали на
# трудных кнопках прибавку 0.004: упор не в лотерею по зерну, а в размер
# головы в кадре. На `ph_side` и `ff_close` лицо занимает меньше
# процента кадра, и сколько ни пробуй, выше 0.63-0.68 оно не поднимется.
# Две лишние попытки стоили бы по сорок секунд на кнопку ни за что.
ЗЁРНА_ЛИЦА = (101, 404, 909)


def попыток_лица(доля_лица):
    return len(ЗЁРНА_ЛИЦА)

# Комната у каждой кнопки своя: иначе лента клиентки выйдет одинаковой.
# Свет ВСЕГДА спереди - контровой уводит лицо в силуэт, и менять нечего.
КОМНАТЫ = {
    "un_close": "a plain bedroom floor with a soft rug, warm lamp light from the front",
    "un_full": "a bright living room with a grey sofa and a tall window in front of her",
    "un_back": "a real bedroom with a wide unmade bed behind her, daylight from the front",
    "un_three": "a bedroom with a wooden floor and a bed, soft warm light from the front",
    "un_sit": "a light bedroom with a bed and a window in front of her",
    "un_lie": "a bed with rumpled white linen, soft daylight from the front",
    "ph_close": "a bed with white sheets, warm bedside lamp light from the front",
    "ph_side": "a bedroom with a wooden floor and a rug, soft front light",
    "ph_above": "a bed with rumpled linen, warm light from the front",
    "ph_below": "a plain bedroom with a mirror and a lamp, soft front light",
    "ph_push": "a bedroom with a wooden floor, a chair and a window in front of her",
    "mf_near": "a bedroom with a wide bed and warm lamp light from the front",
    "mf_behind": "a bedroom with a bed and daylight from a window in front",
    "mf_face": "a bedroom with white linen and soft warm front light",
    "mf_pov": "a bedroom with a bed and a lamp, soft light from the front",
    "ff_near": "a bedroom with a wide bed and soft daylight from the front",
    "ff_face": "a bedroom with rumpled linen and warm front light",
    "ff_close": "a bedroom with a bed and a window in front of them",
    "ff_behind": "a bedroom with a bed and soft warm light from the front",
    "ff_pov": "a bedroom with white sheets and daylight from the front",
}

# Кого модель теряет, если не назвать первым. Проверено кадрами: на
# `mf_near` женщины не было вовсе, в кадре оставался один мужчина.
ПЕРЕДНИЙ_ПЛАН = {
    "mf_near": ("A naked woman is SITTING ASTRIDE the man, facing the "
                "camera, her whole body upright in the FOREGROUND filling "
                "the centre of the picture, her breasts and her face "
                "plainly visible above him. "),
}

ГОЛАЯ = (" She is COMPLETELY NAKED: no top, no bra, no underwear, nothing "
         "on her body.")
ХВОСТ_СОЛО = (" She is alone, the only person in the picture, exactly two "
              "arms and two legs, all of them hers. Her whole head and her "
              "face are INSIDE the frame, nothing of her head is cut off by "
              "the edge. Razor sharp focus, visible skin pores, natural "
              "light on her face.")
ХВОСТ_ПАРА = (" THERE ARE TWO PEOPLE IN THIS PICTURE, BOTH FULLY VISIBLE: "
              "two separate human beings, two heads, four arms and four "
              "legs in total. Neither of them is missing or hidden. "
              "Photorealistic, razor sharp focus, visible skin pores.")
НЕГ_ОБЩИЙ = ("neon, neon tubes, black studio, stage, outdoors, street, "
             "garden, grass, deformed, extra limbs, extra legs, extra arms, "
             "fused limbs, merged bodies, cropped head, face out of frame, "
             "blurry, soft focus, doll anatomy, plastic skin, text, "
             "watermark")
НЕГ_ОДЕЖДА = "clothed, dressed, shirt, top, bra, underwear, panties, "
НЕГ_СОЛО = "second person, man, male, penis, partner, "
НЕГ_ПАРА = "third person, extra person, only one person, lonely figure, "

ЛИЦО_ТЕКСТ = (
    "Take the person ONLY from the FIRST image: her face, her eyes, her "
    "nose, her mouth, her eyebrows, her skin tone, her hair colour and her "
    "hair. The SECOND image is the scene, not a person: keep its exact "
    "pose, body, anatomy, nudity, camera angle, framing, room and lighting "
    "unchanged. Do not blend two women. Photorealistic, sharp, visible "
    "skin pores.")
ЛИЦО_НЕГАТИВ = ("blended face, two women, different pose, changed body, "
                "clothing, extra limbs, deformed, blurry")

_эт_промпты = None


def эталонный_промпт(ключ):
    """Текст, которым был сделан принятый эталон этой кнопки.

    Тексты в каталоге бота короче эталонных на 300-1300 знаков: при
    переносе с них сняли обстановку, свет и внешность, и общие блоки
    стали спорить с постановкой.
    """
    global _эт_промпты
    if _эт_промпты is None:
        try:
            _эт_промпты = json.load(open(
                os.path.join(ЗДЕСЬ, "эталонные_промпты.json"),
                encoding="utf-8"))
        except Exception:                                   # noqa: BLE001
            _эт_промпты = {}
    з = _эт_промпты.get(короткий(ключ)) or {}
    return з.get("промпт")


def короткий(ключ):
    """Ключ кнопки без приставки режима: pr_mf_near -> mf_near."""
    к = str(ключ or "")
    for п in ("pr_", "pf_", "ac_"):
        if к.startswith(п):
            к = к[len(п):]
            break
    return "ph_" + к[3:] if к.startswith("ac_") else к


def пара(ключ):
    return короткий(ключ)[:3] in ("mf_", "ff_")


def одетая(ключ, текст):
    """Одежда бывает ЧАСТЬЮ постановки: «в юбке», «в футболке».

    Жёсткое «completely naked» спорило с текстом кнопки, и приёмка потом
    ругалась на одежду, которую сама кнопка и требует.
    """
    return "WEARING" in (текст or "").upper()


def есть_гайд(ключ):
    return os.path.exists(os.path.join(ГАЙДЫ, короткий(ключ) + ".jpg"))


def гайд(ключ, ш, в):
    п = os.path.join(ГАЙДЫ, короткий(ключ) + ".jpg")
    к = cv2.imread(п, cv2.IMREAD_GRAYSCALE)
    if к is None:
        return None
    return cv2.cvtColor(cv2.resize(к, (ш, в)), cv2.COLOR_GRAY2BGR)


def промпт_основы(ключ, свой_текст=None):
    """Промпт кадра: комната первой фразой, затем постановка кнопки."""
    к = короткий(ключ)
    поза = свой_текст or эталонный_промпт(ключ) or ""
    try:
        import текст_эталона
        поза = текст_эталона.без_фона(поза)
    except Exception:                                       # noqa: BLE001
        pass
    комната = КОМНАТЫ.get(к, "a plain room with soft light from the front")
    хвост = ХВОСТ_ПАРА if пара(ключ) else ХВОСТ_СОЛО
    голая = "" if (пара(ключ) or одетая(ключ, поза)) else ГОЛАЯ
    return ("Explicit photograph taken indoors in " + комната + ". "
            + ПЕРЕДНИЙ_ПЛАН.get(к, "") + поза + голая + хвост)


def негатив_основы(ключ, текст):
    если_пара = пара(ключ)
    н = НЕГ_ПАРА if если_пара else НЕГ_СОЛО
    # Запрет одежды нужен и парным кнопкам: на `ff_close` обе женщины
    # вышли в трусах, хотя эталон требует голых. Прежде он ставился
    # только соло-кнопкам, и парные одевались совершенно законно.
    if not одетая(ключ, текст):
        н = НЕГ_ОДЕЖДА + н
    return н + НЕГ_ОБЩИЙ


def тело_основы(ключ, ш, в, зерно, ури, свой_текст=None, свой_негатив=None):
    """Задача генерации основы для Runware."""
    сырой = свой_текст or эталонный_промпт(ключ) or ""
    т = {"taskType": "imageInference", "taskUUID": str(uuid.uuid4()),
         "model": ОСНОВА_МОДЕЛЬ,
         "positivePrompt": промпт_основы(ключ, свой_текст),
         "negativePrompt": свой_негатив or негатив_основы(ключ, сырой),
         "width": ш, "height": в, "steps": ШАГИ, "CFGScale": CFG,
         "numberResults": 1, "seed": int(зерно),
         "outputType": "URL", "outputFormat": "PNG",
         "lora": [{"model": ЛОРА_АНАТОМИЯ, "weight": 0.7},
                  {"model": ЛОРА_КОЖА, "weight": 0.4}]}
    г = гайд(ключ, ш, в)
    if г is not None:
        т["controlNet"] = [{"model": ГЛУБИНА,
                            "guideImage": ури(cv2.imencode(".png", г)[1]
                                              .tobytes()),
                            "weight": ВЕС_ГАЙДА, "startStep": 1,
                            "endStep": ГАЙД_ДО_ШАГА}]
    return т


def тело_лица(кадр_байты, лицо_ури, ш, в, зерно, ури):
    return {"taskType": "imageInference", "taskUUID": str(uuid.uuid4()),
            "model": ЛИЦО_МОДЕЛЬ, "positivePrompt": ЛИЦО_ТЕКСТ,
            "negativePrompt": ЛИЦО_НЕГАТИВ, "width": ш, "height": в,
            "seed": int(зерно), "numberResults": 1,
            "outputType": "URL", "outputFormat": "PNG",
            "referenceImages": [лицо_ури, ури(кадр_байты)]}


def собрать_голову(основа, новый):
    """Голова с нового кадра, всё остальное - пиксели основы байт в байт.

    Маска строится по НАЙДЕННОМУ лицу, а не по геометрии кадра: эллипс
    по фиксированным долям на половине кнопок садился мимо, срезал лоб и
    подбородок, и в кадре выходила смесь нового лица со старым.
    """
    import priyomka_kadra as ПК
    л = ПК.лицо(основа)
    if л is None:
        return новый
    цх, цу, ш, в, _ = л
    В, Ш = основа.shape[:2]
    if новый.shape[:2] != (В, Ш):
        новый = cv2.resize(новый, (Ш, В))
    центр = (int(цх), int(цу + в * 0.10))
    оси = (int(ш * 1.55), int(в * 1.45))
    м = np.zeros((В, Ш), np.uint8)
    cv2.ellipse(м, центр, оси, 0, 0, 360, 255, -1)
    k = max(31, int(min(оси) * 0.6) | 1)
    м = cv2.GaussianBlur(м, (k, k), 0)
    маска = м.astype(np.float32)[:, :, None] / 255
    ядро = cv2.GaussianBlur(cv2.ellipse(
        np.zeros((В, Ш), np.uint8), центр,
        (int(оси[0] * 1.3), int(оси[1] * 1.3)), 0, 0, 360, 255, -1),
        (61, 61), 0)
    кольцо = (ядро > 30) & (м < 20)
    a, b = основа.astype(np.float32), новый.astype(np.float32)
    if кольцо.sum() > 500:
        # Голова у Klein освещена иначе: без подгонки по кольцу вокруг
        # маски граница видна глазом.
        b = np.clip(b + (a[кольцо].mean(0) - b[кольцо].mean(0)), 0, 255)
    итог = np.clip(a * (1 - маска) + b * маска, 0, 255).astype(np.uint8)
    итог[м == 0] = основа[м == 0]
    return итог
