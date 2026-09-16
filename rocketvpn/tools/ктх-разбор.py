#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Разбор несжатых KTX2 igloo.inc: данные текстур наружу, в числа и картинки.

ЗАЧЕМ. Половина механики igloo лежит не в коде, а в ТЕКСТУРАХ ДАННЫХ.
Ход камеры по всей ленте у них запечён в scroll-datatexture; тело фигуры
из частиц - в объёмной текстуре volumes/peachesbody_64; сетка загрузки -
в triangles_tiling и numbers. Читать код, не прочитав эти файлы, значит
разбирать половину.

ЧТО УМЕЕТ. KTX2 бывает двух родов. Одни сжаты BasisLZ и без транскодера
не читаются - их пропускаем. Другие лежат сырыми пикселями под Zstd
(vkFormat 37 = RGBA8, 97 = RGBA16F), и вот их мы распаковываем целиком.

ВЫДАЁТ.
  · <имя>.npy      - массив пикселей как есть
  · <имя>.png      - предпросмотр (для объёмных - сетка срезов)
  · <имя>.txt      - что внутри: размеры, диапазоны по каналам, гистограмма

Запуск: python3 tools/ктх-разбор.py /tmp/игло/файлы /tmp/игло/разбор
"""
import io
import os
import struct
import sys

import numpy as np
import zstandard

МАГИЯ = b"\xabKTX 20\xbb\r\n\x1a\n"

# Только те форматы, которые лежат сырыми пикселями. Остальное - Basis,
# и без их транскодера оно не читается.
ФОРМАТЫ = {
    37: ("RGBA8", 4, np.uint8),
    97: ("RGBA16F", 8, np.float16),
    106: ("RGBA32F", 16, np.float32),
    100: ("R32F", 4, np.float32),
}
СХЕМЫ = {0: "нет", 1: "BasisLZ", 2: "Zstd", 3: "ZLIB"}


def читать(путь):
    d = open(путь, "rb").read()
    if d[:12] != МАГИЯ:
        return None
    (vk, tsz, w, h, глуб, слоёв, граней, уровней, схема) = struct.unpack("<9I", d[12:48])
    # Индексы: dfd, kvd, sgd - по два поля каждый, потом индекс уровней.
    (dfdСмещ, dfdДлина, kvdСмещ, kvdДлина) = struct.unpack("<4I", d[48:64])
    (sgdСмещ, sgdДлина) = struct.unpack("<QQ", d[64:80])
    уровни = []
    п = 80
    for _ in range(max(1, уровней)):
        (смещ, сжат, разжат) = struct.unpack("<QQQ", d[п:п + 24])
        уровни.append((смещ, сжат, разжат))
        п += 24
    return dict(vk=vk, w=w, h=h, глуб=глуб, слоёв=слоёв, граней=граней,
                уровней=уровней, схема=схема, уровни=уровни, сырое=d,
                kvd=d[kvdСмещ:kvdСмещ + kvdДлина] if kvdДлина else b"")


def распаковать(инфо):
    смещ, сжат, разжат = инфо["уровни"][0]
    кусок = инфо["сырое"][смещ:смещ + сжат]
    if инфо["схема"] == 2:
        кусок = zstandard.ZstdDecompressor().decompress(кусок, max_output_size=разжат * 2 + 1024)
    elif инфо["схема"] == 3:
        import zlib
        кусок = zlib.decompress(кусок)
    elif инфо["схема"] != 0:
        return None
    return кусок


def в_картинку(мас):
    """Массив -> RGB uint8 для предпросмотра, с растяжкой по диапазону."""
    м = мас.astype(np.float32)
    if м.ndim == 3 and м.shape[2] >= 3:
        м = м[:, :, :3]
    elif м.ndim == 3:
        м = np.repeat(м[:, :, :1], 3, axis=2)
    else:
        м = np.repeat(м[:, :, None], 3, axis=2)
    низ, верх = float(np.nanmin(м)), float(np.nanmax(м))
    if верх - низ < 1e-9:
        верх = низ + 1
    return np.clip((м - низ) / (верх - низ) * 255, 0, 255).astype(np.uint8)


def сохранить_png(путь, rgb):
    try:
        from PIL import Image
        Image.fromarray(rgb).save(путь)
        return True
    except Exception:
        return False


def разобрать(путь, куда):
    инфо = читать(путь)
    имя = os.path.relpath(путь).replace("/", "_").replace(".ktx2", "")
    if инфо is None:
        return имя + ": не KTX2"
    ф = ФОРМАТЫ.get(инфо["vk"])
    шапка = (f"{путь}\n  {инфо['w']}x{инфо['h']}"
             + (f"x{инфо['глуб']}" if инфо["глуб"] else "")
             + f"  vkFormat={инфо['vk']}  сжатие={СХЕМЫ.get(инфо['схема'], инфо['схема'])}"
             + f"  уровней={инфо['уровней']}\n")
    if not ф:
        return шапка + "  формат не сырой (Basis), пропущено\n"
    имяФ, байт, тип = ф
    данные = распаковать(инфо)
    if данные is None:
        return шапка + "  распаковать нечем\n"
    глуб = max(1, инфо["глуб"])
    нужно = инфо["w"] * инфо["h"] * глуб * байт
    if len(данные) < нужно:
        return шапка + f"  данных {len(данные)} вместо {нужно}\n"
    каналов = байт // np.dtype(тип).itemsize
    мас = np.frombuffer(данные[:нужно], dtype=тип)
    мас = мас.reshape(глуб, инфо["h"], инфо["w"], каналов) if глуб > 1 else \
        мас.reshape(инфо["h"], инфо["w"], каналов)

    os.makedirs(куда, exist_ok=True)
    np.save(os.path.join(куда, имя + ".npy"), мас)

    отчёт = шапка + f"  формат {имяФ}, каналов {каналов}, форма {мас.shape}\n"
    for к in range(каналов):
        сл = мас[..., к].astype(np.float32)
        отчёт += (f"  канал {к}: мин {np.nanmin(сл):.4f}  макс {np.nanmax(сл):.4f}"
                  f"  среднее {np.nanmean(сл):.4f}  нулей {int((сл == 0).sum())}\n")

    if глуб > 1:
        # Объёмная текстура: раскладываем срезы сеткой.
        стр = int(np.ceil(np.sqrt(глуб)))
        полотно = np.zeros((стр * инфо["h"], стр * инфо["w"], 3), np.uint8)
        for z in range(глуб):
            r, c = divmod(z, стр)
            полотно[r * инфо["h"]:(r + 1) * инфо["h"], c * инфо["w"]:(c + 1) * инфо["w"]] = в_картинку(мас[z])
        сохранить_png(os.path.join(куда, имя + "-срезы.png"), полотно)
        # Сколько вокселей непусто: это и есть «плотность» фигуры.
        занято = float((мас[..., 0].astype(np.float32) > 8).mean())
        отчёт += f"  занятых вокселей по первому каналу (>8): {занято * 100:.2f}%\n"
    else:
        сохранить_png(os.path.join(куда, имя + ".png"), в_картинку(мас))

    if инфо["kvd"]:
        текст = инфо["kvd"].decode("utf-8", "replace")
        видимое = "".join(c if 32 <= ord(c) < 127 or c == "\n" else " " for c in текст)
        отчёт += "  метки: " + " ".join(видимое.split())[:400] + "\n"
    return отчёт


def главная():
    корень = sys.argv[1] if len(sys.argv) > 1 else "/tmp/игло/файлы"
    куда = sys.argv[2] if len(sys.argv) > 2 else "/tmp/игло/разбор"
    строки = []
    for путь, _, файлы in os.walk(корень):
        for ф in sorted(файлы):
            if ф.endswith(".ktx2"):
                строки.append(разобрать(os.path.join(путь, ф), куда))
    os.makedirs(куда, exist_ok=True)
    отчёт = "\n".join(строки)
    with io.open(os.path.join(куда, "текстуры.txt"), "w", encoding="utf-8") as ф:
        ф.write(отчёт)
    print(отчёт)


if __name__ == "__main__":
    главная()
