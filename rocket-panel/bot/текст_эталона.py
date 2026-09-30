# -*- coding: utf-8 -*-
"""Текст принятого эталона кнопки, пересказанный под клиента.

## Зачем

Замер 30.09.2026 на «Крупном плане» с Юки, одни и те же зёрна:

    наш собранный промпт     поза 0.27   кожа в разводах, спальня, руки не там
    текст эталона как есть   поза 0.23   Юки стала блондинкой, лицо 0.20
    текст эталона, своё      поза 0.13   лицо 0.44, кожа чище всех прошлых

Эталон владелец принял глазами, и его текст держит позу, ракурс и руки
лучше нашего собранного. Но он писался под Нику: «her light-blonde
hair», «petite young body with a small almost flat chest». Слова про
внешность у Qwen сильнее референса - темноволосая клиентка выходила
блондинкой. Поэтому внешность вычёркивается и заменяется словами «как на
снимке», а сцена, поза и свет остаются эталонными.

Только одиночные кнопки. У пар в эталонах порядок людей «блондинка
первая», а у заказа свой порядок снимков (см. catalog.полы), и
пересказ там надо сверять кадрами, а не заменой слов.
"""
import os
import re
import sys

_ТУЛЗЫ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools")
if _ТУЛЗЫ not in sys.path:
    sys.path.insert(0, _ТУЛЗЫ)

СВОЯ_ВНЕШНОСТЬ = ("her own hair exactly as in the reference photo - the same colour, "
                  "length and fringe - her own skin tone, and her own body and "
                  "breast size exactly as in the reference photo")

# Порядок важен: сперва длинные обороты, потом остатки.
_ЗАМЕНЫ = [
    (r"her light-blonde hair,\s*her petite young body with a small almost flat chest",
     СВОЯ_ВНЕШНОСТЬ),
    (r"her light-blonde hair,\s*her petite young body", СВОЯ_ВНЕШНОСТЬ),
    (r"her light-blonde hair", "her own hair exactly as in the reference photo"),
    (r"\blight-blonde\b", ""),
    (r"\bthe blonde\b", "the woman"),
    (r"\bThe blonde\b", "The woman"),
    # ВОЗРАСТ. Эталоны писались словами «petite young body, almost flat
    # chest», и на героине 20 лет «Крупный план» вышел с лицом заметно
    # моложе референса. Ни одного слова, которое модель может прочитать
    # как юность, в тексте не остаётся; грудь и сложение - как на снимке.
    (r"\b(small )?almost flat chest", "her own breast size as in the reference photo"),
    (r"\bpetite young\b", "adult"),
    (r"\byoung\b", "adult"),
    (r"\bpetite\b", ""),
]

ВЗРОСЛАЯ = ("She is an adult woman in her twenties with a mature adult face "
            "and a fully developed adult body.")

_КЭШ = {}

# КНОПКИ БЕЗ ПРИНЯТОГО ЭТАЛОНА. Их собранный текст - полторы страницы
# общих правил, и строка позы тонет в нём: на прогоне 30.09.2026 шесть
# кнопок (на коленях, снизу, сверху, опираясь, от первого лица, общий
# план) нарисовали одну и ту же позу «лёжа, руки за головой». Здесь
# текст сложен так же, как у принятых эталонов: сперва план и поза
# словами, которые нельзя прочитать двояко, потом кто она, потом тело
# одним куском, потом место. Место то же, что у эталонов.
_ОБЩЕЕ = ("This is the woman from the reference photo: her face unchanged, "
          + СВОЯ_ВНЕШНОСТЬ + ". Her whole face is inside the frame. She is "
          "completely nude. ONE single continuous body: one head on her own neck, "
          "one torso, two arms growing from her own shoulders, two legs growing "
          "from her own hips - two hands and two feet in all, every one traceable "
          "back along its own limb. Only one person in the frame. Black studio set "
          "with hot pink neon tubes glowing on the wall behind her, glossy black "
          "floor, soft white light from the front.")
_НАЧАЛО = "Photorealistic explicit photograph, matte dry skin, correct hands. "
СВОИ = {
    "un_kneel": "FULL-LENGTH SHOT, camera level with her chest. She KNEELS upright "
                "on the floor facing the camera, her knees wide apart, sitting back "
                "on her heels, back straight, both hands resting flat on her own "
                "thighs. Her bare breasts and her bare vulva between her open knees "
                "are both in plain view. Her face is to the lens. ",
    "un_low": "LOW-ANGLE SHOT: the camera is low, just above her knees, tilted up "
              "at her. She STANDS facing the camera, feet apart, both hands on her "
              "own hips. Her bare vulva, belly, breasts and face are all in view, "
              "and she looks down into the lens. ",
    "un_over": "HIGH-ANGLE SHOT: the camera looks DOWN at her from above at about "
               "sixty degrees. She SITS on the floor with her legs bent to one side, "
               "leaning back on one straight arm, one shoulder forward, her face "
               "turned UP to the lens. Her bare breasts and her bare vulva are in "
               "view. ",
    "un_lean": "FRONT VIEW, THREE-QUARTER SHOT from her head to her knees, camera "
               "straight in front of her at chest height. She FACES THE CAMERA "
               "SQUARELY with her back flat against the black wall behind her, "
               "shoulder blades and hips touching it, one foot raised flat against "
               "the wall so that knee comes forward and her thighs open, both arms "
               "down along the wall. Her bare breasts and her bare vulva face the "
               "lens, her eyes to the lens. Not in profile. ",
    "ph_pov": "POINT-OF-VIEW SHOT: the camera is the eyes of someone standing at her "
              "feet and looking down at her. She LIES ON HER BACK on the floor with "
              "her legs spread wide towards the camera, one hand between her thighs "
              "with two fingers on her own vulva, the other hand on her own breast, "
              "looking straight into the lens. No other person and no other hands. ",
    "ph_pull": "WIDE SHOT: the whole of her body and a good part of the studio are "
               "in the frame, camera at hip height. She SITS on the floor leaning "
               "back on one hand, knees up and wide apart, the other hand between "
               "her thighs touching her own vulva. Her face is to the lens. ",
    "ph_mirror": "MIRROR SELFIE: the whole photograph is ONE reflection in a large "
                 "wall mirror - we see only her mirror image, never her real body "
                 "and never two copies of her. She kneels facing the mirror, knees "
                 "apart, one hand between her thighs on her own vulva, the other "
                 "hand resting on her thigh. Her face, her bare breasts and her "
                 "vulva are in view in the reflection. Exactly ONE woman in the "
                 "picture. No phone, no camera visible. ",
    "ph_slow": "CLOSE SHOT from her face down to her hips, 85mm, one large soft "
               "light, camera above her chest looking down along her body. She "
               "LIES ON HER BACK with her knees up and apart, one hand between her "
               "thighs with her fingers on her own vulva, the other hand resting "
               "on her belly. Her bare breasts are in view, eyes half closed "
               "towards the lens. ",
}


def _одиночная(ключ):
    return str(ключ or "").startswith(("un_", "ph_", "ac_"))


def _эталон(ключ):
    import промпты_эталонов as ПЭ
    з = ПЭ.загрузить()
    к = str(ключ or "")
    # Ролик и его фотография - одна кнопка (catalog._ЖЁСТКО_ДЛЯ), и сюда
    # приходит текст ПЕРВОГО прохода ролика, то есть фотографии. Поэтому
    # у ролика берётся эталон его фото, а не его собственный: тот писался
    # под движение.
    if к.startswith("ac_"):
        return з.get("ph_" + к[3:])
    return з.get(к)


def промпт(ключ):
    """Текст эталона под клиента или None, если эталона нет."""
    if not _одиночная(ключ):
        return None
    try:
        з = _эталон(ключ)
    except Exception:                                   # noqa: BLE001
        return None
    if not з or not з.get("промпт"):
        к = str(ключ)
        свой = СВОИ.get(к) or (СВОИ.get("ph_" + к[3:]) if к.startswith("ac_") else None)
        if not свой:
            return None
        з = {"промпт": _НАЧАЛО + свой + _ОБЩЕЕ}
    т = з["промпт"]
    for было, стало in _ЗАМЕНЫ:
        т = re.sub(было, стало, т)
    т = re.sub(r"\s{2,}", " ", т).strip()
    # Сразу после первой фразы (про фотореализм), до описания сцены.
    т = re.sub(r"^([^.]*\.)", r"\1 " + ВЗРОСЛАЯ, т, count=1)
    return т


def негатив(ключ):
    """Негатив из графа эталона. Он там свой, длинный и проверенный."""
    if not _одиночная(ключ):
        return None
    if ключ in _КЭШ:
        return _КЭШ[ключ]
    н = None
    try:
        import промпты_эталонов as ПЭ
        з = _эталон(ключ)
        if not (з and з.get("файл")):
            # Своим текстам - негатив самого проверенного эталона.
            з = _эталон("un_close")
        if з and з.get("файл"):
            г = ПЭ.граф(os.path.join(ПЭ.ЭТАЛОНЫ, з["файл"])) or {}
            for у in г.values():
                if у.get("class_type") == "KSampler":
                    ид = (у.get("inputs", {}).get("negative") or [None])[0]
                    вх = (г.get(str(ид)) or {}).get("inputs", {})
                    н = вх.get("text") or вх.get("prompt")
                    break
    except Exception:                                   # noqa: BLE001
        н = None
    # Татуировки: на «На коленях» у героини без единой татуировки на
    # предплечье появился рисунок. Эталонный негатив их не называл.
    if н and "tattoo" not in н:
        н = н + ", tattoos, tattoo, ink drawings on skin"
    # На «Сверху вниз» в промежности женщины вырос отросток, а на полу
    # валялась сброшенная одежда. Оба запрета называются прямо.
    if н and "discarded clothes" not in н:
        н = н + (", penis, testicles, male genitals on a woman, extra genitals, "
                 "discarded clothes, underwear lying on the floor")
    _КЭШ[ключ] = н
    return н
