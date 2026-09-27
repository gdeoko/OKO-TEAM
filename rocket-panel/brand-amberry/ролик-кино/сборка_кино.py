#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Формат 4 «Кадр из кино»: отрезок фильма в вертикали, с заголовком и аутро.

Кадр кино горизонтальный (4:3 или 16:9), лента вертикальная. Жёсткий
кроп в 9:16 отрезает от кадра 4:3 меньше половины ширины - двое в кадре
разваливаются, а качество падает вдвое. Поэтому кадр НЕ РЕЖЕТСЯ: он
кладётся по центру во всю ширину, сверху и снизу остаются поля, а фон -
то же видео, растянутое и размытое.

Это не компромисс, а выигрыш: поля сверху и снизу и есть место под
заголовок и подпись бота, о которых просил владелец.

    python3 сборка_кино.py <отрезок.mp4> <заголовок> [призыв] [выход.mp4]
"""
import os
import re
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
sys.path.insert(0, os.path.join(БРЕНД, "ролик-снятие"))
sys.path.insert(0, os.path.join(БРЕНД, "ролик-сток"))
import карточка as К                                          # noqa: E402
import звук as З                                              # noqa: E402
from сборка_стока import заголовок_png                        # noqa: E402

Ш, В, КАДРЫ = 1080, 1920, 30
ПОЛОСА = 0.235             # доля высоты под заголовок сверху
# ЗАГОЛОВОК НЕ ВИСИТ ВЕСЬ РОЛИК. На сорока шести секундах один и тот же
# текст превращается в водяной знак: глаз перестаёт его видеть уже через
# пять секунд, а место занимает. Он делает свою работу в начале - ловит
# и объясняет, - и уходит.
ЗАГОЛОВОК_В = 0.8          # текст выходит, когда кадр уже показал себя
ЗАГОЛОВОК_ДО = 7.5         # и уходит, отработав
ПРОЯВКА = 0.3
АУТРО = 2.8

# Родной звук фильма уходит почти в ноль: он из 1932 года, шипит и рвёт
# ритм. Оставляем тихо - как присутствие, а не как дорожку.
КИНО_ЗВУК = 0.10


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


def собрать(отрезок, текст, призыв=None, выход=None, семя=None):
    раб = os.path.join(ТУТ, ".работа")
    os.makedirs(раб, exist_ok=True)
    призыв = призыв or К.ПРИЗЫВЫ[0]
    семя = семя or os.path.basename(отрезок)
    выход = выход or os.path.join(ТУТ, "кино-готово.mp4")
    длина = длительность(отрезок)

    # Кадр во всю ширину по центру, фон - он же, растянутый и размытый.
    # Плюс очень медленный наезд: старое кино статично, и без движения
    # камеры вертикаль выглядит как фотография в рамке.
    лента = os.path.join(раб, "лента.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", отрезок, "-filter_complex",
                    f"[0:v]split=3[фон][кадр][зерно];"
                    f"[фон]scale={Ш}:{В}:force_original_aspect_ratio=increase,"
                    f"crop={Ш}:{В},gblur=sigma=42,eq=brightness=-0.12[размыт];"
                    # Кадр 4:3 во всю ширину занимал бы 42 % высоты, и
                    # вертикаль выглядела бы как марка в альбоме. Увеличиваем
                    # на четверть и срезаем бока: кадр берёт половину экрана,
                    # а по краям в старом кино всё равно пусто.
                    f"[кадр]scale={int(Ш*1.25)}:-2,crop={Ш}:ih,"
                    f"zoompan=z='min(1.05\\,1+0.05*on/{int(длина*КАДРЫ)})':d=1:"
                    f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                    f"s={Ш}x{int(Ш*1.25*3/4)}:fps={КАДРЫ}[центр];"
                    f"[зерно]nullsink;"
                    f"[размыт][центр]overlay=0:(H-h)/2:format=auto[вых]",
                    "-map", "[вых]", "-an", "-c:v", "libx264",
                    "-preset", "medium", "-crf", "18", лента], check=True)

    заг = заголовок_png(текст, os.path.join(раб, "заголовок.png"))
    ряд = os.path.join(раб, "ряд")
    К.ряд(ряд, призыв)
    старт_аутро = длина - АУТРО

    ф = ["[0:v]null[кадр]"]
    ф.append(f"[1:v]format=rgba,loop=loop=-1:size=1:start=0,fps={КАДРЫ},"
             f"setpts=N/FRAME_RATE/TB,"
             f"fade=t=in:st={ЗАГОЛОВОК_В}:d={ПРОЯВКА}:alpha=1,"
             f"fade=t=out:st={ЗАГОЛОВОК_ДО:.2f}:d={ПРОЯВКА}:alpha=1[з]")
    # Заголовок в верхней полосе - там пусто, кадр фильма ниже.
    ф.append(f"[кадр][з]overlay=(W-w)/2:{int(В*0.055)}:"
             f"enable='between(t,{ЗАГОЛОВОК_В},{ЗАГОЛОВОК_ДО+ПРОЯВКА:.2f})':"
             f"format=auto:shortest=1[сз]")
    ф.append(f"[2:v]format=rgba,fps={КАДРЫ},tpad=stop_mode=clone:stop_duration=30,"
             f"setpts=PTS-STARTPTS+{старт_аутро:.2f}/TB[карта]")
    ф.append(f"[сз][карта]overlay=0:0:enable='gte(t,{старт_аутро:.2f})':"
             f"format=auto:shortest=1[вых]")

    немой = os.path.join(раб, "немой.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", лента, "-i", заг,
                    "-framerate", str(КАДРЫ), "-i", os.path.join(ряд, "кадр%03d.png"),
                    "-filter_complex", ";".join(ф), "-map", "[вых]", "-an",
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
                        f"[2:a]volume={КИНО_ЗВУК},afade=t=in:st=0:d=0.6,"
                        f"afade=t=out:st={длина-1.2:.2f}:d=1.2[кино];"
                        f"[1:a][кино]amix=inputs=2:duration=first:normalize=0[а]",
                        "-map", "0:v", "-map", "[а]", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", выход], check=True)
    elif дор:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-i", дор, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-shortest", "-movflags", "+faststart", выход], check=True)
    else:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-c", "copy", "-movflags", "+faststart",
                        выход], check=True)

    print("заголовок:", текст, "| призыв:", призыв, "| длина %.1f с" % длина,
          flush=True)
    print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
    return выход


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 2:
        raise SystemExit(__doc__)
    собрать(а[0], а[1], а[2] if len(а) > 2 else None,
            а[3] if len(а) > 3 else None)
