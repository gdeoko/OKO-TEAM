# -*- coding: utf-8 -*-
"""Основа кадра: на чём вообще стоит картинка.

Правило владельца от 27.08.2026: «не всегда референс равно фон визуала».
Фотография площадки нужна там, где предмет разговора и есть площадка. Кадру про
счёт, про деталь, про идею или про рынок настоящий двор не нужен: ему нужен свой
мир. Когда фон один и тот же у полусотни кадров, лента читается как конвейер,
даже если внутри каждого кадра всё сделано хорошо.

Каждая основа отвечает на три вопроса: прикладывать ли фотографии объекта, из
чего сделан фон и как в этом мире оказывается предмет кадра.
"""
import hashlib

# Ключ основы, текст для промпта, нужна ли привязка к фотографиям площадки.
ОСНОВЫ = {
    "площадка": (
        "This frame is documentary: it is made on the real territory and the attached photographs govern every "
        "surface in it.", True),
    "студия": (
        "This frame is a studio shot, not a location shot: the subject stands alone on a seamless graphite #14171C "
        "sweep that falls off to near black at the edges, lit as a product, with a single hard key and a narrow "
        "amber rim, its own contact shadow pooling under it and a faint reflection in the floor. Nothing of the "
        "territory appears: no building, no yard, no sky.", False),
    "вырезка": (
        "This frame is a composite: the subject is cut out along a precise silhouette and set into a made ground "
        "rather than a photographed place, a deep graphite field with an amber #E8A400 gradient behind it and a "
        "fine grain over everything. The cutout keeps a hard edge, a thin light rim and its own drop shadow onto "
        "the ground, so it reads as an object placed there by hand.", False),
    "сетка": (
        "This frame is built on a constructed graphic environment: a receding perspective grid of thin amber "
        "#E8A400 hairlines over ink black, fading into haze at the horizon, with a few floating graphite planes "
        "catching light. The subject stands inside that space on a plane of its own and casts a real shadow onto "
        "it. Nothing photographic is behind it.", False),
    "предмет": (
        "This frame is a still life shot close: the object itself fills the frame on a plain worn surface, lit by "
        "one raking source so its material, edge wear and print are readable, everything beyond it dissolving into "
        "shallow depth. The place is irrelevant here and is not shown.", False),
    "диорама": (
        "This frame is a scale model world: a small physical diorama of the situation built and photographed on a "
        "dark table, with real depth of field, real dust and a visible base edge, so the viewer sees a made object "
        "rather than a rendered scene.", False),
    "метафора": (
        "This frame is a single strong metaphor staged for the camera: one constructed object that carries the "
        "whole idea, isolated in a dark space with volumetric light behind it, no explanatory context around it "
        "and no view of the territory.", False),
}

# У рубрик разная природа. Там, где разговор про саму площадку, фотография
# обязательна. Там, где про деньги, документы, отрасль и рынок, площадка в кадре
# только мешает: она превращает мысль в рекламу помещения.
РУБРИКА_ОСНОВЫ = {
    "Цифры цеха":            ("площадка", "площадка", "сетка", "предмет"),
    "Цифры отрасли":         ("сетка", "диорама", "вырезка", "площадка"),
    "Деньги цеха":           ("предмет", "площадка", "студия", "метафора"),
    "Цена киловатта":        ("предмет", "площадка", "сетка", "студия"),
    "Цена ошибки":           ("площадка", "метафора", "предмет", "площадка"),
    "За что дают":           ("предмет", "вырезка", "площадка", "сетка"),
    "Как выбирать":          ("площадка", "площадка", "предмет", "диорама"),
    "Не снесут":             ("площадка", "диорама", "метафора", "сетка"),
    "Сто производств":       ("площадка", "площадка", "вырезка", "диорама"),
    "Кто стоит у станка":    ("площадка", "площадка", "студия", "метафора"),
    "Кадры цеха":            ("площадка", "площадка", "студия", "вырезка"),
    "Сколько отсюда ехать":  ("площадка", "площадка", "сетка", "диорама"),
    "Стройка будущего":      ("площадка", "площадка", "диорама", "вырезка"),
    "Промышленный город":    ("площадка", "диорама", "сетка", "метафора"),
    "Площадки мира":         ("сетка", "диорама", "вырезка", "метафора"),
    "Отрасль":               ("сетка", "вырезка", "площадка", "студия"),
    "Рынок":                 ("сетка", "метафора", "предмет", "площадка"),
    "Воронка":               ("площадка", "предмет", "метафора", "студия"),
    "Событие":               ("площадка", "площадка", "метафора", "студия"),
}

ПО_УМОЛЧАНИЮ = ("площадка", "площадка", "студия", "вырезка", "сетка", "предмет",
                "метафора", "диорама")


def _ровно(строка, соль=0):
    ч = hashlib.md5(f"{соль}:{строка}".encode()).digest()
    return int.from_bytes(ч[:4], "big")


def основа(ключ, рубрика=""):
    """Возвращает (текст основы, нужны ли фотографии площадки).

    Внутри одной серии основа общая: слайды карусели обязаны стоять в одном мире.
    """
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    набор = РУБРИКА_ОСНОВЫ.get(рубрика) or ПО_УМОЛЧАНИЮ
    имя = набор[_ровно(осн, 21) % len(набор)]
    текст, с_фото = ОСНОВЫ[имя]
    return имя, текст, с_фото
