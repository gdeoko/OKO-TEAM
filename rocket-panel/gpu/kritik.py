#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Критик кадра: смотрит фото и говорит текстом, что на нём не так.

## Зачем

Владелец 30.09.2026: «ты сама по фото плохо видишь дефекты, нужна модель,
которая точно скажет что на ней не так текстом». Он прав, и это видно по
переписке: я показывала кадр как удачный, а он находил на нём сросшиеся
пальцы, вросшие в тело руки, растительность и лишних людей. Каждый раз
он видел, а я нет.

Числа этого не закрывают. Резкость, шум и расхождение позы отвечают на
вопрос «насколько», а владелец спрашивает «ЧТО не так», и отвечает на
него словами. Значит и проверка должна отвечать словами.

## Почему именно эта модель

Обычная зрячая модель на кадре 18+ отвечает отказом, и это не осторожность
настройки, а её обучение: ни Qwen2.5-VL, ни InternVL, ни Gemma на таком
кадре не скажут ничего. Поэтому берётся `Huihui-Qwen3-VL-8B-abliterated` -
та же Qwen3-VL, у которой снят слой отказа. Она описывает что видит, не
оценивая допустимость.

Модель НЕ рисует и к генерации отношения не имеет. Её работа - смотреть
готовый кадр и перечислять дефекты, как это делает человек на приёмке.

## Как проверяется, что критик не врёт

Единственная честная проверка - его собственные вердикты владельца.
`python3 kritik.py --проверка` прогоняет критика по кадрам, которые
владелец уже забраковал СВОИМИ СЛОВАМИ («пальцы и писька срослись», «на
руке волос», «под писькой нету попы, очка, дырки», «руки вросли в
письку»), и печатает рядом, что нашёл критик. Совпало - критику можно
верить. Не совпало - он не годится, и это надо сказать прямо, а не
подгонять вопрос под ответ.

    python3 kritik.py <кадр.png>                   разбор одного кадра
    python3 kritik.py <кадр.png> --зоны            плюс разбор по зонам тела
    python3 kritik.py <кадр.png> --реф <реф.jpg>   лицо сверяется с референсом
    python3 kritik.py --проверка                   сверка с вердиктами владельца

## Три поломки, найденные на первом живом прогоне (30.09.2026, un_close)

1. ЗАЦИКЛИВАНИЕ. Зона «пах» выдала «Missing skin texture» двадцать раз
   подряд и оборвалась на лимите. Без штрафа за повтор жадная выборка
   (`do_sample=False`) застревает в одной строке. Теперь
   `repetition_penalty` и запрет повторять пятёрки слов, плюс чистка
   одинаковых пунктов после модели и потолок в восемь пунктов.

2. ЗОНЫ ДОЛЯМИ КАДРА. Рамка «кисти рук» (0.02-0.98 по ширине, 0.38-0.80
   по высоте) на кадре с разведёнными ногами легла на пах, и критик
   описал органы вместо рук. А там, где рук в кадре нет вовсе, он их
   выдумал: «кисти срослись с бёдрами». Теперь зоны строятся по скелету
   (mediapipe, 33 точки) и по найденному лицу (RetinaFace). Узел,
   которого не видно (видимость ниже 0.5), зоной не становится: в отчёт
   идёт «не в кадре», и модель про него не спрашивают вовсе.

3. ЛИЦО БЕЗ РЕФЕРЕНСА. Зона «лицо» ответила «нет дефектов», а владелец
   на двух кропах показал, что лицо ДРУГОЕ: круглее, другой нос и разрез
   глаз. Модель смотрела лицо результата в одиночку, и нарисованное чисто
   чужое лицо дефектом не выглядит. Теперь при референсе она получает
   ОБА лица рядом и первой строкой отвечает, тот же ли это человек.

Из другого кода:

    import kritik
    kritik.разобрать("/путь/кадр.png")       текст с перечнем дефектов
"""
import json
import os
import sys

МОДЕЛЬ = os.environ.get("ROCKET_KRITIK", "/root/models/kritik")
МОДЕЛЬ_ПОЗЫ = os.environ.get("ROCKET_POSE_TASK",
                             "/root/models/pose_landmarker_heavy.task")
ССЫЛКА_ПОЗЫ = ("https://storage.googleapis.com/mediapipe-models/"
               "pose_landmarker/pose_landmarker_heavy/float16/latest/"
               "pose_landmarker_heavy.task")

МОДЕЛЬ_РУК = os.environ.get("ROCKET_HAND_TASK",
                            "/root/models/hand_landmarker.task")
ССЫЛКА_РУК = ("https://storage.googleapis.com/mediapipe-models/"
              "hand_landmarker/hand_landmarker/float16/latest/"
              "hand_landmarker.task")

# Видимость узла скелета, ниже которой считаем, что его в кадре нет.
# На кадре un_close кисти дали 0.01 - рук там нет, а критик их «видел».
ВИДНО_ОТ = 0.5
# Больше пунктов в ответе не бывает осмысленных: дальше идут повторы.
ПУНКТОВ_МАКС = 8

ВОПРОС = (
    "You are a quality inspector for AI-generated photographs. Look at "
    "this image and list EVERY defect you can see. Be specific and "
    "literal about anatomy.\n\n"
    "Check each of these and say what you actually see:\n"
    "1. HANDS: count the fingers on each visible hand. Are any fingers "
    "fused together, merged, missing, duplicated, bent the wrong way, or "
    "growing from the wrong place?\n"
    "2. LIMBS: does every arm and leg connect to a body in a physically "
    "possible way? Are there any limbs that belong to nobody, any extra "
    "or missing limbs, any body parts that merge into each other?\n"
    "3. PEOPLE: exactly how many people are in this frame? Count heads, "
    "hands and feet separately and say whether the counts agree.\n"
    "4. GENITALS: if visible, describe what you see and whether it is "
    "anatomically correct and clearly defined, or blurred, melted, "
    "merged with something else, or missing parts.\n"
    "5. SKIN: any unwanted body hair, stubble, blotches, plastic or wet "
    "glossy look, visible seams where the image was edited?\n"
    "6. ANYTHING ELSE that looks wrong or impossible.\n\n"
    "Answer as a plain numbered list of defects only. If something is "
    "correct, do not mention it. If you see no defect in a category, "
    "skip that category entirely. Do not praise the image. Do not "
    "describe the scene. Only defects.")

ВОПРОСЫ_ЗОН = {
    "пах": (
        "This is a magnified crop of the GENITAL AREA of an AI-generated "
        "photo of a woman. List only real, visible defects of the female "
        "genitals and the skin right around them: melted or blurred "
        "shapes, fused folds, anatomy that is missing or in the wrong "
        "place, male organs, painted-on fluid, plastic or waxy skin, "
        "unnatural dots or grid pattern on the skin. Do not list things "
        "that are simply not visible. At most 6 items, a short plain "
        "numbered list, no repeats. If there is no defect, answer "
        "exactly: НЕТ ДЕФЕКТОВ."),
    "грудь": (
        "This is a magnified crop of the CHEST of an AI-generated photo of "
        "a woman. List only real, visible defects of the breasts, nipples "
        "and chest skin: wrong or mismatched shape, melted nipples, "
        "extra or missing nipples, seams, plastic skin, dots, streaks. "
        "At most 6 items, short numbered list, no repeats. If there is no "
        "defect, answer exactly: НЕТ ДЕФЕКТОВ."),
    "кисть": (
        "This is a magnified crop of ONE HAND of an AI-generated photo. "
        "Count the fingers and list only real, visible defects: fused, "
        "extra or missing fingers, fingers bent the wrong way, the hand "
        "merging into the body or another object, hair on the hand. "
        "At most 6 items, short numbered list, no repeats. If there is no "
        "defect, answer exactly: НЕТ ДЕФЕКТОВ."),
    "лицо": (
        "This is a magnified crop of the FACE of an AI-generated photo. "
        "List only real, visible defects: asymmetric or mismatched eyes, "
        "melted or smeared features, wrong teeth, cracks, plastic skin. "
        "At most 6 items, short numbered list, no repeats. If there is no "
        "defect, answer exactly: НЕТ ДЕФЕКТОВ."),
}

ВОПРОС_ЛИЦО_ПАРА = (
    "IMAGE 1 is the face of a real reference woman. IMAGE 2 is the face "
    "from an AI-generated result that is supposed to be THE SAME woman.\n"
    "First line, exactly one of: ТОТ ЖЕ ЧЕЛОВЕК: ДА / ТОТ ЖЕ ЧЕЛОВЕК: НЕТ / "
    "ТОТ ЖЕ ЧЕЛОВЕК: ПОХОЖЕ.\n"
    "Then a short numbered list of the concrete differences of IMAGE 2 "
    "from IMAGE 1: face shape and width, jaw and chin, nose shape and "
    "width, eye shape and eyelids, eyebrows, lips, fringe and hairline. "
    "Then any visible defects of IMAGE 2 itself (asymmetric eyes, melted "
    "features, plastic skin). At most 8 items, no repeats.")

_МОД = [None, None]
_ПОЗА = [None]
_ЛИЦА = [None]
_РУКИ = [None]


def _поднять():
    """Модель и процессор, один раз на процесс."""
    if _МОД[0] is not None:
        return _МОД
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    проц = AutoProcessor.from_pretrained(МОДЕЛЬ)
    мод = AutoModelForImageTextToText.from_pretrained(
        МОДЕЛЬ, dtype=torch.bfloat16, device_map="cuda:0")
    мод.eval()
    _МОД[0], _МОД[1] = мод, проц
    return _МОД


def _чистить(текст):
    """Снять повторы, которые модель всё же выдала, и лишний хвост.

    Страховка поверх штрафа за повтор: одинаковый пункт второй раз ничего
    не сообщает, а читающий принимает двадцать одинаковых строк за
    двадцать разных бед.
    """
    import re
    было, строки = set(), []
    for с in текст.splitlines():
        ключ = re.sub(r"^\s*\d+[.)]\s*", "", с).strip().lower()
        if ключ and ключ in было:
            continue
        было.add(ключ)
        строки.append(с)
    пунктов, итог = 0, []
    for с in строки:
        if re.match(r"^\s*\d+[.)]", с):
            пунктов += 1
            if пунктов > ПУНКТОВ_МАКС:
                continue
        итог.append(с)
    return "\n".join(итог).strip()


def спросить(путь, вопрос=None, максимум=700):
    """Ответ модели по одному изображению или по списку изображений."""
    import torch
    from PIL import Image
    мод, проц = _поднять()
    пути = путь if isinstance(путь, (list, tuple)) else [путь]
    изо = [Image.open(п).convert("RGB") for п in пути]
    сод = [{"type": "image"} for _ in изо]
    сод.append({"type": "text", "text": вопрос or ВОПРОС})
    текст = проц.apply_chat_template([{"role": "user", "content": сод}],
                                     tokenize=False, add_generation_prompt=True)
    вход = проц(text=[текст], images=изо, return_tensors="pt").to(мод.device)
    with torch.inference_mode():
        # Без выборки: приёмка обязана отвечать одинаково на один кадр.
        # Но жадная выборка без штрафа застревает в одной строке -
        # «Missing skin texture» двадцать раз (прогон 30.09.2026).
        # `no_repeat_ngram_size` здесь НЕЛЬЗЯ: он считает n-граммы вместе с
        # текстом вопроса, и модель не может повторить фразу из задания -
        # вердикт выходил вразрядку «Т О Т  Ж Е  Ч Е Л О В Е К». Повторы
        # держат штраф и `_чистить`.
        вых = мод.generate(**вход, max_new_tokens=максимум, do_sample=False,
                           repetition_penalty=1.15)
    новое = вых[0][вход["input_ids"].shape[1]:]
    return _чистить(проц.decode(новое, skip_special_tokens=True))


# ------------------------------------------------ где на кадре что лежит

def _поза_модель():
    if _ПОЗА[0] is not None:
        return _ПОЗА[0]
    if not os.path.exists(МОДЕЛЬ_ПОЗЫ):
        import urllib.request
        urllib.request.urlretrieve(ССЫЛКА_ПОЗЫ, МОДЕЛЬ_ПОЗЫ)
    from mediapipe.tasks.python import BaseOptions, vision
    опц = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=МОДЕЛЬ_ПОЗЫ),
        running_mode=vision.RunningMode.IMAGE, num_poses=1,
        min_pose_detection_confidence=0.3)
    _ПОЗА[0] = vision.PoseLandmarker.create_from_options(опц)
    return _ПОЗА[0]


def _закрыть_позу():
    for ящик in (_ПОЗА, _РУКИ):
        if ящик[0] is not None:
            try:
                ящик[0].close()
            except Exception:                               # noqa: BLE001
                pass
            ящик[0] = None


import atexit                                               # noqa: E402
atexit.register(_закрыть_позу)


def скелет(путь):
    """Узлы скелета в пикселях: {номер: (x, y, видимость)}. Нет - None."""
    import mediapipe as mp
    от = _поза_модель().detect(mp.Image.create_from_file(путь))
    if not от.pose_landmarks:
        return None
    from PIL import Image
    ш, в = Image.open(путь).size
    return {i: (т.x * ш, т.y * в, т.visibility)
            for i, т in enumerate(от.pose_landmarks[0])}


def _руки_модель():
    if _РУКИ[0] is not None:
        return _РУКИ[0]
    if not os.path.exists(МОДЕЛЬ_РУК):
        import urllib.request
        urllib.request.urlretrieve(ССЫЛКА_РУК, МОДЕЛЬ_РУК)
    from mediapipe.tasks.python import BaseOptions, vision
    опц = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=МОДЕЛЬ_РУК),
        running_mode=vision.RunningMode.IMAGE, num_hands=4,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3)
    _РУКИ[0] = vision.HandLandmarker.create_from_options(опц)
    return _РУКИ[0]


def кисти(путь):
    """Кисти отдельным детектором: [[(x, y), ...21 точка], ...] в пикселях.

    Видимости кисти по скелету верить нельзя. На кадре «показ4», где
    владелец написал «руки вросли в письку», обе руки лежат на паху, а
    скелет дал им видимость 0.01 и 0.03 - и зона кистей выпала ровно там,
    где дефект. Скелет тела ищет руку на конце вытянутой конечности; рука,
    прижатая к телу, для него пропадает. Детектор кистей ищет саму кисть.
    """
    import mediapipe as mp
    from PIL import Image
    ш, в = Image.open(путь).size
    от = _руки_модель().detect(mp.Image.create_from_file(путь))
    return [[(т.x * ш, т.y * в) for т in рука] for рука in (от.hand_landmarks or [])]


def лицо_рамка(путь):
    """Рамка самого крупного лица (RetinaFace). Нет лица - None."""
    import cv2
    import torch
    if _ЛИЦА[0] is None:
        from facexlib.detection import init_detection_model
        _ЛИЦА[0] = init_detection_model("retinaface_resnet50", half=False,
                                        device="cuda")
    к = cv2.imread(путь)
    with torch.no_grad():
        лица = _ЛИЦА[0].detect_faces(к, 0.8)
    if лица is None or len(лица) == 0:
        return None
    л = max(лица, key=lambda x: (x[2] - x[0]) * (x[3] - x[1]))
    return [float(v) for v in л[:4]]


def _рамка(точки, поля, ш, в, мин=96):
    """Прямоугольник вокруг точек с полями, в пределах кадра."""
    xs = [p[0] for p in точки]
    ys = [p[1] for p in точки]
    x0, x1 = min(xs) - поля, max(xs) + поля
    y0, y1 = min(ys) - поля, max(ys) + поля
    if x1 - x0 < мин:
        c = (x0 + x1) / 2
        x0, x1 = c - мин / 2, c + мин / 2
    if y1 - y0 < мин:
        c = (y0 + y1) / 2
        y0, y1 = c - мин / 2, c + мин / 2
    return [max(0, int(x0)), max(0, int(y0)), min(ш, int(x1)), min(в, int(y1))]


def зоны_по_скелету(путь):
    """{зона: рамка} для того, что в кадре есть, и {зона: почему} для нет.

    Рамки строятся от узлов тела, а не от долей кадра. Рост в кадре берётся
    от плеч до бёдер: им мерятся поля, чтобы на крупном и на общем плане
    зона захватывала одинаковую часть тела.
    """
    from PIL import Image
    ш, в = Image.open(путь).size
    т = скелет(путь)
    рамки, нет = {}, {}

    лицо = лицо_рамка(путь)
    if лицо:
        x0, y0, x1, y1 = лицо
        dx, dy = (x1 - x0) * 0.35, (y1 - y0) * 0.35
        рамки["лицо"] = [max(0, int(x0 - dx)), max(0, int(y0 - dy)),
                         min(ш, int(x1 + dx)), min(в, int(y1 + dy))]
    else:
        нет["лицо"] = "лицо не найдено"

    if not т:
        нет["тело"] = "скелет не найден"
        return рамки, нет

    def вид(*k):
        return all(т[i][2] >= ВИДНО_ОТ for i in k)

    плечи = (11, 12)
    бёдра = (23, 24)
    торс = None
    if вид(*плечи) and вид(*бёдра):
        торс = abs((т[23][1] + т[24][1]) / 2 - (т[11][1] + т[12][1]) / 2) or None
    ширина_бёдер = abs(т[23][0] - т[24][0]) if вид(*бёдра) else None
    мера = торс or ширина_бёдер or min(ш, в) * 0.3

    if торс:
        верх = min(т[11][1], т[12][1])
        грудь = [(т[11][0], верх + 0.10 * торс), (т[12][0], верх + 0.10 * торс),
                 (т[11][0], верх + 0.60 * торс), (т[12][0], верх + 0.60 * торс)]
        рамки["грудь"] = _рамка(грудь, 0.18 * мера, ш, в)
    else:
        нет["грудь"] = "плечи или бёдра не видны"

    if вид(*бёдра):
        cx = (т[23][0] + т[24][0]) / 2
        cy = (т[23][1] + т[24][1]) / 2
        половина = max(0.8 * (ширина_бёдер or 0), 0.35 * мера)
        рамки["пах"] = _рамка([(cx - половина, cy - 0.3 * половина),
                               (cx + половина, cy + 1.3 * половина)],
                              0, ш, в)
    else:
        нет["пах"] = "бёдра не видны"

    # Кисти: сначала детектор кистей, скелет - только запасной путь.
    найдено = []
    try:
        найдено = кисти(путь)
    except Exception as e:                                  # noqa: BLE001
        print("детектор кистей не встал:", str(e)[:120], flush=True)
    if найдено:
        for i, рука in enumerate(sorted(найдено, key=lambda р: р[0][0])):
            рамки["кисть %d" % (i + 1)] = _рамка(рука, 0.12 * мера, ш, в)
    else:
        for имя, запястье, пальцы in (("кисть левая", 15, (17, 19, 21)),
                                      ("кисть правая", 16, (18, 20, 22))):
            if т[запястье][2] >= ВИДНО_ОТ:
                точки = [т[запястье][:2]] + [т[k][:2] for k in пальцы]
                рамки[имя] = _рамка(точки, 0.22 * мера, ш, в)
            else:
                нет[имя] = ("не в кадре: детектор кистей не нашёл, "
                            "скелет - видимость %.2f" % т[запястье][2])
    return рамки, нет


def кроп(путь, рамка, куда, длинная=896):
    """Кусок кадра, увеличенный плавно до `длинная` по длинной стороне.

    Раньше увеличение шло «ближайшим соседом», вдвое: на коже это само
    рисует ступеньки и зерно, и критик мог принять их за дефект кадра.
    """
    from PIL import Image
    и = Image.open(путь).convert("RGB").crop(tuple(рамка))
    м = длинная / float(max(и.size))
    if м > 1:
        и = и.resize((int(и.size[0] * м), int(и.size[1] * м)), Image.LANCZOS)
    и.save(куда, quality=95)
    return куда


def чего_нет(нет):
    """Приписка к общему вопросу: каких частей тела в кадре нет.

    Без неё модель на общем вопросе оценивает и отсутствующее: на un_close
    она написала «руки с пятью пальцами по бокам», хотя кистей в кадре нет,
    а скелет это знал (видимость 0.01).
    """
    части = {"кисть левая": "the left hand", "кисть правая": "the right hand",
             "кисти": "the hands",
             "лицо": "the face", "грудь": "the chest", "пах": "the genital area"}
    нету = [части[к] for к in нет if к in части]
    if not нету:
        return ""
    return ("\n\nIMPORTANT: a body pose detector found that these parts are NOT "
            "visible in the inspected image: " + ", ".join(нету) + ". Do not "
            "describe or judge them at all, do not guess about them.")


def разобрать(путь, зоны=False, референс=None):
    """Дефекты кадра словами. С `зоны` - ещё и по зонам тела.

    `референс` - кадр того же человека в одежде: тогда лицо результата
    сверяется с его лицом, а не разглядывается в одиночку.
    """
    if not зоны:
        return {"кадр": спросить(путь)}
    import tempfile
    рамки, нет = зоны_по_скелету(путь)
    итог = {"кадр": спросить(путь, ВОПРОС + чего_нет(нет))}
    with tempfile.TemporaryDirectory() as д:
        for имя, рамка in рамки.items():
            п = кроп(путь, рамка, os.path.join(д, "z_%s.jpg" % len(итог)))
            if имя == "лицо" and референс:
                рр = лицо_рамка(референс)
                if рр:
                    x0, y0, x1, y1 = рр
                    dx, dy = (x1 - x0) * 0.35, (y1 - y0) * 0.35
                    from PIL import Image
                    ш, в = Image.open(референс).size
                    пр = кроп(референс, [max(0, int(x0 - dx)), max(0, int(y0 - dy)),
                                         min(ш, int(x1 + dx)), min(в, int(y1 + dy))],
                              os.path.join(д, "реф_лицо.jpg"))
                    итог["лицо против референса"] = спросить([пр, п],
                                                             ВОПРОС_ЛИЦО_ПАРА, 500)
                    continue
            вопрос = ВОПРОСЫ_ЗОН["кисть" if имя.startswith("кисть") else имя]
            итог[имя] = спросить(п, вопрос, 400)
    for имя, почему in нет.items():
        итог[имя] = "не проверялось: " + почему
    return итог

# ВЕРДИКТЫ ВЛАДЕЛЬЦА - мера правдивости критика.
#
# Слова его собственные, из переписки 30.09.2026. Критик считается
# годным, если на этих кадрах он называет то же самое. Проверять его
# на кадрах, которые никто не смотрел, бессмысленно: сверять будет не с
# чем, и любой ответ сойдёт за правильный.
ВЕРДИКТЫ = [
    ("/srv/amberry/показ/un_close.png",
     "каша, пальцы и писька срослись; на руке волос; под писькой нету "
     "попы, очка, дырки; растительность осталась"),
    ("/srv/amberry/показ4/un_close.png",
     "стало намного хуже, руки вросли в письку"),
    ("/srv/amberry/эталоны/раздевание/03_крупный_план.png",
     "ПРИНЯТ владельцем, дефектов быть не должно"),
]


def проверка():
    """Прогнать критика по кадрам, которые владелец уже оценил сам."""
    for путь, слова in ВЕРДИКТЫ:
        print("=" * 70)
        print("КАДР:", путь)
        print("ВЛАДЕЛЕЦ:", слова)
        if not os.path.exists(путь):
            print("КРИТИК: нет файла")
            continue
        о = разобрать(путь, зоны=True)
        for имя, текст in о.items():
            print("\n--- %s ---" % имя)
            print(текст)
        print()


if __name__ == "__main__":
    if "--проверка" in sys.argv:
        проверка()
    elif len(sys.argv) > 1:
        реф = None
        if "--реф" in sys.argv:
            реф = sys.argv[sys.argv.index("--реф") + 1]
        о = разобрать(sys.argv[1], зоны="--зоны" in sys.argv, референс=реф)
        print(json.dumps(о, ensure_ascii=False, indent=1))
    else:
        sys.exit(__doc__)
