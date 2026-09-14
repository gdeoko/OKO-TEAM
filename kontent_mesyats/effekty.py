# -*- coding: utf-8 -*-
"""Действие в кадре, подобранное под сцену, а не наугад.

Первая версия раздавала эффекты по хешу ключа, и на крышу с телескопом прилетел
сноп сварочных искр. Кадр от этого не стал насыщенным, он стал бессмысленным.
Поэтому у каждого эффекта есть среда, в которой он возможен, и выбор идёт только
среди подходящих.

Среды:
    цех     - внутри производственного помещения, есть станок и обработка
    двор    - открытая территория, техника, погрузка, проезд
    ночь    - тёмное время, длинная выдержка, огни
    воздух  - атмосфера без техники: пыль, пар, свет, дождь
    тихое   - документ, предмет, стол: движение есть, но оно негромкое
Универсальные эффекты помечены средой «воздух»: они подходят почти везде.
"""
import hashlib

# (среда, текст)
ЭФФЕКТЫ = [
    ("цех",
     "Two speeds in one frame: a fan of welding sparks, the near ones frozen at 1/2000 as hard white hot points, "
     "the far ones stretched into curved streaks bending to the floor and fading red. The arc is the only key, a "
     "6000 K point, and haze turns it into a visible cone."),
    ("цех",
     "The instant of impact frozen at 1/4000: a ring of scale and oil mist blasts outward as thousands of separate "
     "specks, dense at the source and thinning to a halo a metre out, while vented steam to one side is motion "
     "stretched into soft streaks."),
    ("цех",
     "A jet of incandescent particles opens from a narrow root into a nine hundred millimetre plume: leading "
     "particles frozen as dots at 1/3200, trailing ones stretched into comet streaks that fork where they hit the "
     "floor. Beyond two metres, black."),
    ("цех",
     "Shot at 1/6 of a second: everything moving has dissolved into a continuous smeared band four hundred "
     "millimetres across the frame, while the steel structure, the control panel and a person standing still at the "
     "far end stay perfectly sharp. The contrast between the liquid band and the rigid frame is the whole picture."),
    ("цех",
     "A load is lifted and the frame catches the movement: the load swings a fraction, its shadow races across the "
     "floor, the chains blur at 1/15 while the subject stays frozen sharp, and fine debris shaken loose falls "
     "through the key beam."),
    ("двор",
     "A panning frame at 1/40: the moving subject is held sharp from its leading edge back, its tail already "
     "melting into the pan, while posts and lamps behind it drag into clean horizontal streaks that carry the "
     "speed. Spray off the tyres stretches into sixty millimetre comma shaped tails."),
    ("двор",
     "Rain drives across the near plane, drops streaking as short amber lines through every source, water sheeting "
     "off the canopy edge, wet concrete turning into a mirror that doubles the whole scene upside down, and one "
     "hard 3200 K source raking low so every drop has an edge."),
    ("ночь",
     "Twenty two seconds on a locked tripod: the vehicles that crossed the frame are gone and only their light "
     "survives, an amber beacon arc curving into the depth and two headlight ribbons bending around the corner, "
     "while every fixed structure stays razor sharp. Wet ground doubles every trail."),
    ("ночь",
     "A long exposure lets the sky turn: fine star trails arc a few degrees around the pole, the lights below "
     "twinkle and pulse through the night air, and everything built stays perfectly still and sharp against that "
     "slow movement."),
    ("воздух",
     "Steam vents from a valve at the frame edge and rolls across the middle plane, backlit into a solid amber wall "
     "of light, the subject cutting a dark silhouette through it with a bright rim along one side and the far "
     "structure dissolving completely."),
    ("воздух",
     "Dust hangs thick in a hard shaft crossing the frame diagonally, each particle separately lit, the beam solid "
     "enough to read as an object with deep black either side. Something moves through the beam and drags a slow "
     "smear while the lit edge nearest camera stays sharp."),
    ("воздух",
     "Heat shimmer distorts the air above a hot surface in the mid plane, the background rippling through it, an "
     "amber glow radiating from the source and blooming into the lens as a soft horizontal streak, fine grit "
     "turning slowly in the rising air."),
    ("воздух",
     "Mixed uncorrected colour temperatures meet on one surface: 2000 K sodium from one side, 5600 K daylight from "
     "the other, the line between them running right through the subject, dust turning in both and each throwing "
     "its own coloured shadow."),
    ("воздух",
     "A slow drift of fine particles crosses the frame from one side, each one caught by the key and separately "
     "lit, the nearest ones out of focus into soft amber discs, the farthest sharp against the black, so the air "
     "between camera and subject becomes visible."),
    ("тихое",
     "Dust motes drift through the one hard shaft of light falling across the object, each one separately lit and "
     "slowly turning, the air around the subject visible while the object itself stays perfectly still and sharp "
     "to the edge of the frame."),
    ("тихое",
     "A draught lifts one corner of the paper and holds it mid movement, the lifted edge catching the key and "
     "throwing a soft curved shadow across what is printed beneath, everything else pinned flat and razor sharp."),
    ("тихое",
     "The key light is moving: a hard edged shadow of something outside the frame travels across the object and "
     "has been caught halfway, half the surface in warm amber light and half already fallen into graphite, the "
     "line between them cutting diagonally across the subject."),
    ("тихое",
     "Condensation and a ring of moisture spread slowly on the surface beside the object, the near droplets frozen "
     "as bright amber beads at f/2, the far edge of the surface dissolving out of focus, one wisp of steam rising "
     "and bending in the light."),
]

# Какие среды допустимы рубрике. Пустой список означает любые.
РУБРИКА_СРЕДЫ = {
    "Цифры цеха":           ("цех", "воздух"),
    "Цифры отрасли":        ("тихое", "воздух"),
    "Деньги цеха":          ("тихое",),
    "Цена киловатта":       ("цех", "тихое"),
    "Цена ошибки":          ("цех", "двор"),
    "За что дают":          ("тихое",),
    "Как выбирать":         ("цех", "тихое"),
    "Не снесут":            ("двор", "воздух"),
    "Сто производств":      ("цех", "двор"),
    "Кто стоит у станка":   ("цех",),
    "Кадры цеха":           ("цех",),
    "Сколько отсюда ехать": ("двор", "ночь"),
    "Стройка будущего":     ("двор", "воздух"),
    "Промышленный город":   ("ночь", "двор"),
    "Площадки мира":        ("воздух", "ночь"),
    "Отрасль":              ("тихое", "воздух"),
    "Рынок":                ("тихое", "воздух"),
    "Воронка":              ("тихое",),
    "Событие":              ("ночь", "воздух"),
}


def _ровно(строка, соль=0):
    ч = hashlib.md5(f"{соль}:{строка}".encode()).digest()
    return int.from_bytes(ч[:4], "big")


def эффект(ключ, рубрика="", сцена=""):
    """Действие кадра из числа возможных в этой среде.

    Сцену тоже смотрим: слова про крышу, ночь и небо переводят кадр в ночную
    среду независимо от рубрики, иначе на звёздное небо прилетают искры.
    """
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    среды = РУБРИКА_СРЕДЫ.get(рубрика) or ("цех", "двор", "ночь", "воздух", "тихое")
    низ = (сцена or "").lower()
    if any(с in низ for с in ("roof", "night", "sky", "star", "dark yard")):
        среды = ("ночь", "воздух")
    elif any(с in низ for с in ("invoice", "contract", "paper", "document", "desk", "ledger",
                                "calendar", "notebook", "table", "card", "book")):
        среды = ("тихое",)
    годные = [т for с, т in ЭФФЕКТЫ if с in среды] or [т for _, т in ЭФФЕКТЫ]
    return годные[_ровно(осн, 7) % len(годные)]
