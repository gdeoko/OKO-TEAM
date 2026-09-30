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
]

_КЭШ = {}


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
        return None
    т = з["промпт"]
    for было, стало in _ЗАМЕНЫ:
        т = re.sub(было, стало, т)
    return re.sub(r"\s{2,}", " ", т).strip()


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
    _КЭШ[ключ] = н
    return н
