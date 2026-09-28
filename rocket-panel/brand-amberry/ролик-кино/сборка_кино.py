#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Формат 4 «Кадр из кино»: отрезок фильма в рамке бренда.

Компоновка (решение владельца 27.09.2026): аутро больше не в конце, оно
РАЗЛОЖЕНО ПО КРАЯМ и висит весь ролик.

    верх    заголовок бренда, «первое фото бесплатно», ник со значком
    центр   кадр фильма 16:9
    низ     слева знак с названием AMBERRY, справа девушка из заставки
            бота, БЕЗ ФОНА, двигается как в заставке

Почему так лучше прежнего: аутро в конце видит только тот, кто досмотрел,
а рамка работает с первой секунды. И кадр фильма при этом не режется -
16:9 ложится в середину целиком, поля заняты делом.

    python3 сборка_кино.py <отрезок.mp4> [призыв] [выход.mp4]
"""
import os
import re
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
sys.path.insert(0, os.path.join(БРЕНД, "ролик-снятие"))
import звук as З                                              # noqa: E402

Ш, В, КАДРЫ = 1080, 1920, 30
ВЕРХ_PNG = os.path.join(БРЕНД, "рамка", "верх.png")
ЛОГО_PNG = os.path.join(БРЕНД, "рамка", "лого.png")

ЦЕНТР_Y = 516             # где стоит кадр фильма
КАДР_В = Ш * 9 // 16      # 16:9 во всю ширину - столько он занимает по высоте
ЛОГО_Ш, ЛОГО_В = 620, 565 # знак с названием, один в нижней полосе

# ВЫРЕЗАННОЙ ДЕВУШКИ С ЗАСТАВКИ В РОЛИКЕ БОЛЬШЕ НЕТ. Решение владельца
# 28.09.2026: она стояла только здесь, в 4 формате, и снята совсем - ни
# тут, ни в аутро других форматов, ни на последнем слайде карусели.
# Нижняя полоса осталась за одним знаком, поэтому он встал по центру и
# вырос: раньше его ширину резала занятая ею половина листа.

# МУЗЫКА ПОЧТИ В НОЛЬ. Правка владельца: 5-10 % мощности. В нарезке из
# кино работает картинка, а музыка только держит ритм ленты - на прежних
# -19 LUFS она спорила с кадром.
МУЗЫКА_ГРОМКОСТЬ = 0.08
КИНО_ЗВУК = 0.10          # родной звук фильма: 1932 год, шипит


def ffmpeg():
    for п in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.exists(п):
            return п
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def длительность(в):
    п = subprocess.run([ffmpeg(), "-hide_banner", "-i", в],
                       capture_output=True, text=True)
    м = re.search(r"Duration: (\d+):(\d+):([\d.]+)", п.stderr)
    ч, мин, с = м.groups()
    return int(ч)*3600 + int(мин)*60 + float(с)


def есть_звук(в):
    п = subprocess.run([ffmpeg(), "-hide_banner", "-i", в],
                       capture_output=True, text=True)
    return "Audio:" in п.stderr


def раскладка_низа():
    """Знак один в нижней полосе: по центру ширины и по центру полосы."""
    лш = ЛОГО_Ш
    лв = round(лш * ЛОГО_В / ЛОГО_Ш)
    полоса = В - (ЦЕНТР_Y + КАДР_В)
    лx = (Ш - лш) // 2
    лy = ЦЕНТР_Y + КАДР_В + (полоса - лв) // 2
    return лx, лш, max(лy, ЦЕНТР_Y + КАДР_В + 12)


def собрать(отрезок, выход=None, семя=None):
    раб = os.path.join(ТУТ, ".работа")
    os.makedirs(раб, exist_ok=True)
    семя = семя or os.path.basename(отрезок)
    выход = выход or os.path.join(ТУТ, "кино-готово.mp4")
    длина = длительность(отрезок)
    лx, лш, лy = раскладка_низа()

    ф = [
        # Фон: тот же кадр, растянутый и размытый, чтобы края не были пустыми.
        f"[0:v]split=2[фон][кадр];"
        f"[фон]scale={Ш}:{В}:force_original_aspect_ratio=increase,"
        f"crop={Ш}:{В},gblur=sigma=46,eq=brightness=-0.34:saturation=0.75[размыт]",
        # Центр: кадр фильма приводится к 16:9 и кладётся во всю ширину.
        # Фильм 4:3, и верх с низом кадра в нём почти всегда пустые.
        f"[кадр]crop=iw:iw*9/16,scale={Ш}:-2,fps={КАДРЫ}[центр]",
        f"[размыт][центр]overlay=0:{ЦЕНТР_Y}:format=auto[с_кадром]",
        # Низ: знак и название. В заставке они вплавлены в неон и
        # вырезкой не спасаются - поэтому рисуются отдельным слоем.
        f"[1:v]scale={лш}:-1[лого]",
        f"[с_кадром][лого]overlay={лx}:{лy}:format=auto:shortest=1[с_лого]",
        # Верх: полоса бренда.
        f"[2:v]scale={Ш}:-1,fps={КАДРЫ}[верх]",
        f"[с_лого][верх]overlay=0:30:format=auto:shortest=1[вых]",
    ]

    немой = os.path.join(раб, "немой.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", отрезок,
                    "-loop", "1", "-i", ЛОГО_PNG,
                    "-loop", "1", "-i", ВЕРХ_PNG,
                    "-filter_complex", ";".join(ф), "-map", "[вых]", "-an",
                    "-t", "%.3f" % длина,
                    "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                    "-pix_fmt", "yuv420p", немой], check=True)

    дор = None
    try:
        дор = З.дорожка(семя, длина, [], ffmpeg(), os.path.join(раб, "звук.m4a"))
    except Exception as e:
        print("музыка не собралась (%s)" % e, flush=True)

    if дор and есть_звук(отрезок):
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-i", дор, "-i", отрезок,
                        "-filter_complex",
                        f"[1:a]volume={МУЗЫКА_ГРОМКОСТЬ}[муз];"
                        f"[2:a]volume={КИНО_ЗВУК},afade=t=in:st=0:d=0.6,"
                        f"afade=t=out:st={длина-1.2:.2f}:d=1.2[кино];"
                        f"[муз][кино]amix=inputs=2:duration=first:normalize=0[а]",
                        "-map", "0:v", "-map", "[а]", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", выход], check=True)
    elif дор:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-i", дор, "-filter_complex",
                        f"[1:a]volume={МУЗЫКА_ГРОМКОСТЬ}[а]",
                        "-map", "0:v", "-map", "[а]", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", выход], check=True)
    else:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-c", "copy", "-movflags", "+faststart",
                        выход], check=True)

    print("готово:", выход, os.path.getsize(выход), "байт, %.1f с" % длина,
          flush=True)
    return выход


if __name__ == "__main__":
    а = sys.argv[1:]
    if not а:
        raise SystemExit(__doc__)
    собрать(а[0], а[1] if len(а) > 1 else None)
