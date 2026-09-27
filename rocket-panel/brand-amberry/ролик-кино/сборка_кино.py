#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Формат 4 «Кадр из кино»: отрезок фильма в рамке бренда.

Компоновка (решение владельца 27.09.2026): аутро больше не в конце, оно
РАЗЛОЖЕНО ПО КРАЯМ и висит весь ролик.

    верх    заголовок бренда, «первое фото бесплатно», ник со значком
    центр   кадр фильма 16:9
    низ     девушка из заставки бота, БЕЗ ФОНА, двигается как в заставке

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
НИЗ_КАДРЫ = os.path.join(БРЕНД, "рамка", "без-фона", "и%04d.png")
НИЗ_ЧАСТОТА = 16          # столько кадров в секунду было у заставки

ЦЕНТР_Y = 560             # где стоит кадр фильма
НИЗ_Ш = 1080              # ширина девушки внизу

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


def собрать(отрезок, выход=None, семя=None):
    раб = os.path.join(ТУТ, ".работа")
    os.makedirs(раб, exist_ok=True)
    семя = семя or os.path.basename(отрезок)
    выход = выход or os.path.join(ТУТ, "кино-готово.mp4")
    длина = длительность(отрезок)

    ф = [
        # Фон: тот же кадр, растянутый и размытый, чтобы края не были пустыми.
        f"[0:v]split=2[фон][кадр];"
        f"[фон]scale={Ш}:{В}:force_original_aspect_ratio=increase,"
        f"crop={Ш}:{В},gblur=sigma=46,eq=brightness=-0.18[размыт]",
        # Центр: кадр фильма приводится к 16:9 и кладётся во всю ширину.
        # Фильм 4:3, и верх с низом кадра в нём почти всегда пустые.
        f"[кадр]crop=iw:iw*9/16,scale={Ш}:-2,fps={КАДРЫ}[центр]",
        f"[размыт][центр]overlay=0:{ЦЕНТР_Y}:format=auto[с_кадром]",
        # Низ: девушка из заставки, зациклена на всю длину ролика.
        f"[1:v]scale={НИЗ_Ш}:-2,fps={КАДРЫ}[низ]",
        f"[с_кадром][низ]overlay=(W-w)/2:H-h:format=auto:shortest=1[с_низом]",
        # Верх: полоса бренда.
        f"[2:v]scale={Ш}:-1,fps={КАДРЫ}[верх]",
        f"[с_низом][верх]overlay=0:36:format=auto:shortest=1[вых]",
    ]

    немой = os.path.join(раб, "немой.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", отрезок,
                    # Заставка короче ролика, поэтому кадры идут по кругу.
                    "-stream_loop", "-1", "-framerate", str(НИЗ_ЧАСТОТА),
                    "-i", НИЗ_КАДРЫ,
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
