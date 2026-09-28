#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собрать `etalony.npz` из папок ЭТАЛОНЫ. Запускать НА карте.

ЗАЧЕМ. `сходство.проверить()` молча возвращает None, когда файла с
векторами нет, и приёмка теряет целую проверку - «кадр далёк от
принятого». Именно это и случилось на карте 53161920: npz искался по
пути со старой машины Hyperstack (`/home/ubuntu/etalony.npz`), а дом на
Vast - `/root`. Проверка была выключена, и никто об этом не узнал:
ошибки нет, просто одним заслоном меньше.

КАРТА «КНОПКА - ЭТАЛОН» НЕ СОХРАНИЛАСЬ, и восстанавливается она
однозначно по названию. Файлы эталонов названы теми же словами, что
кнопки в каталоге: кнопка «Мастурбация крупно» - файл
`интим/01_мастурбация_крупно.png`. Сверяем по нормализованному
названию, а не по порядку в папке: порядок сменится при первой же
правке, а название кнопки держит владелец.

Что не нашлось - печатается списком. Молча пропускать нельзя: кнопка
без эталона остаётся без проверки сходства, и это надо видеть.

    python3 эталоны_собрать.py                    собрать и записать
    python3 эталоны_собрать.py --только-карта     показать, что нашлось
"""
import json
import os
import re
import subprocess
import sys

ДОМ = os.environ.get("ROCKET_HOME", "/root")
ЭТАЛОНЫ = os.path.join(ДОМ, "ЭТАЛОНЫ")
NPZ = os.environ.get("AMBERRY_ETALONS_NPZ", os.path.join(ДОМ, "etalony.npz"))
БОТ = os.environ.get("AMBERRY_BOT_DIR", "/opt/amberry/rocket-panel/bot")


def ровно(с):
    """Название к сравнимому виду: без регистра, цифр-префикса и знаков."""
    с = re.sub(r"^\d+[_\s-]*", "", str(с or "").strip().lower())
    с = с.replace("ё", "е")
    return re.sub(r"[^a-zа-я0-9]+", "_", с).strip("_")


def кнопки():
    sys.path.insert(0, БОТ)
    import catalog

    def обойти(узлы):
        for у in узлы:
            for с in (getattr(у, "scenes", None) or []):
                yield с
            for с in обойти(getattr(у, "дети", None) or []):
                yield с
    return {с.key: с.title for с in обойти(catalog.РАЗДЕЛЫ)}


def файлы():
    найдено = {}
    for корень, _, имена in os.walk(ЭТАЛОНЫ):
        for и in имена:
            if и.lower().endswith((".png", ".jpg", ".jpeg")):
                найдено.setdefault(ровно(os.path.splitext(и)[0]),
                                   os.path.join(корень, и))
    return найдено


def карта():
    э, к = файлы(), кнопки()
    вышло, без = {}, []
    for ключ, назв in к.items():
        п = э.get(ровно(назв))
        if п:
            вышло[ключ] = п
        else:
            без.append("%s (%s)" % (ключ, назв))
    return вышло, без


if __name__ == "__main__":
    в, без = карта()
    print("эталонов нашлось: %d" % len(в))
    for ключ, п in sorted(в.items()):
        print("  %-14s %s" % (ключ, os.path.basename(п)))
    if без:
        print("БЕЗ ЭТАЛОНА (проверка сходства им не работает): %d" % len(без))
        for с in sorted(без):
            print("  " + с)
    if "--только-карта" in sys.argv:
        raise SystemExit
    п = os.path.join(ДОМ, "эталоны.json")
    json.dump(в, open(п, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    здесь = os.path.dirname(os.path.abspath(__file__))
    subprocess.run([sys.executable, os.path.join(здесь, "сходство.py"), п],
                   check=True, env={**os.environ, "AMBERRY_ETALONS_NPZ": NPZ})
    print("готово:", NPZ, os.path.getsize(NPZ), "байт")
