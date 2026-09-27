#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Формат 3: сток плюс заголовок плюс аутро. Готовый к публикации ролик.

Кадр не наш и не с карты: лицензионный сток, поверх него заголовок про
бота. Бота в кадре нет, поэтому здесь НЕТ наложений-кнопок - на чужом
кадре кнопка обещает то, чего кадр не выполняет (решение 27.09.2026).

Что собирается:

    обложка первым кадром  ->  сток с заголовком  ->  аутро с призывом
    музыка с проявлением и затуханием + живой звук стока под ней

    python3 сборка_стока.py <сток.mp4> <заголовок> [призыв] [выход.mp4]
"""
import os
import re
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
sys.path.insert(0, os.path.join(БРЕНД, "ролик-снятие"))
import карточка as К                                          # noqa: E402
import звук as З                                              # noqa: E402

Ш, В, КАДРЫ = 1080, 1920, 30
ОБЛОЖКА = os.path.join(БРЕНД, "обложки", "обложка-формат3.png")

# ЗАГОЛОВОК ВЫХОДИТ НЕ СРАЗУ И НЕ СВЕРХУ. Правка владельца 27.09.2026:
# в первой сборке он стоял на 0,25 с в верхней трети и лёг героине прямо
# на лицо.
#
# Правило завода про первую надпись до 0,5 с никуда не делось, но оно про
# НАШ кадр, где место под текст оставлено съёмкой. На чужом стоке кадр
# случайный, и надпись поверх лица стоит дороже полусекунды форы: зритель
# видит не героиню, а баннер. Поэтому секунда даётся кадру, и только
# потом приходит текст.
ЗАГОЛОВОК_В = 1.0
ПРОЯВКА = 0.32

# По вертикали заголовок идёт по центру кадра: там торс, а лицо выше и
# остаётся открытым. Верхняя треть на вертикальном стоке почти всегда
# занята головой.
ЗАГОЛОВОК_Y = 0.46
АУТРО = 2.6                # карточка с призывом в конце
ЖИВОЙ_ЗВУК = 0.22          # громкость родной дорожки стока под музыкой


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


def заголовок_png(текст, выход, ш=1000, в_=420):
    """Заголовок теми же средствами, что и карточка: неоновая трубка,
    тёмного нет нигде. Отдельного модуля не нужно - вид один на весь
    бренд и живёт в `карточка.py`.

    СТРОКИ БАЛАНСИРУЮТСЯ. Обычный перенос рвёт заголовок как придётся
    («ОСТАЛЬНОЕ В» и отдельно «БОТЕ»), и в кадре это читается как
    случайный текст, а не как надпись. `text-wrap: balance` делит строки
    поровну, а кегль подбирается так, чтобы их было не больше двух.
    """
    слов = len(текст.split())
    знаков = len(текст)
    # Кегль от длины: короткая строка идёт крупно, длинная сбавляет, но
    # не ниже читаемого на телефоне.
    кегль = 150 if знаков <= 14 else (126 if знаков <= 22 else
                                      (108 if знаков <= 30 else 92))
    стиль = К.ОБЩЕЕ if hasattr(К, "ОБЩЕЕ") else ""
    разметка = ("<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\">"
                "<style>%s"
                "html,body{width:%dpx;height:%dpx;background:transparent;"
                "display:flex;align-items:center;justify-content:center}"
                ".з{font-family:B,'Bebas Neue',sans-serif;font-size:%dpx;"
                "line-height:.94;text-align:center;text-transform:uppercase;"
                "text-wrap:balance;max-width:%dpx;"
                "color:#fff;-webkit-text-stroke:4px rgba(255,10,140,.92);"
                "paint-order:stroke fill;"
                "text-shadow:0 0 10px #fff,0 0 30px #FF0A8C,0 0 70px #FF0A8C}"
                "</style></head><body><div class=\"з\">%s</div></body></html>"
                % (стиль, ш, в_, кегль, int(ш * 0.94), текст))
    return К.asyncio.run(К.снять(разметка, выход, ш, в_))


def собрать(сток, текст, призыв=None, выход=None, семя=None, длина=None):
    раб = os.path.join(ТУТ, ".работа")
    os.makedirs(раб, exist_ok=True)
    призыв = призыв or К.ПРИЗЫВЫ[0]
    семя = семя or os.path.basename(сток)
    выход = выход or os.path.join(ТУТ, "сток-готово.mp4")

    исходная = длительность(сток)
    длина = длина or min(12.0, max(7.0, исходная))
    начало = max(0.0, min(1.5, исходная - длина))

    # 1. Лента: кроп в вертикаль, ровная частота, лёгкий наезд.
    #    Наезд на 4 % за ролик - бесплатная динамика: без него сток
    #    читается как фотография, которая шевелится.
    лента = os.path.join(раб, "лента.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-ss", "%.2f" % начало, "-t", "%.2f" % длина, "-i", сток,
                    "-vf", "crop=min(iw\\,ih*9/16):ih,"
                           f"scale={Ш*2}:{В*2},"
                           f"zoompan=z='min(1.04\\,1+0.04*on/({int(длина*КАДРЫ)}))':"
                           f"d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                           f"s={Ш}x{В}:fps={КАДРЫ},"
                           "format=yuv420p",
                    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                    лента], check=True)

    # 2. Наложения: заголовок и карточка аутро.
    заг = заголовок_png(текст, os.path.join(раб, "заголовок.png"))
    ряд = os.path.join(раб, "ряд")
    К.ряд(ряд, призыв)
    старт_аутро = длина - АУТРО

    ф = [f"[0:v]null[кадр]"]
    ф.append(f"[1:v]format=rgba,loop=loop=-1:size=1:start=0,fps={КАДРЫ},"
             f"setpts=N/FRAME_RATE/TB,"
             f"fade=t=in:st={ЗАГОЛОВОК_В}:d={ПРОЯВКА}:alpha=1,"
             f"fade=t=out:st={старт_аутро-0.4:.2f}:d={ПРОЯВКА}:alpha=1[з]")
    ф.append(f"[кадр][з]overlay=(W-w)/2:{int(В*ЗАГОЛОВОК_Y)}:"
             f"enable='between(t,{ЗАГОЛОВОК_В},{старт_аутро-0.1:.2f})':"
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

    # 3. Звук: музыка, под ней живая дорожка стока, если она есть.
    дор = os.path.join(раб, "звук.m4a")
    собрана = None
    try:
        собрана = З.дорожка(семя, длина, [], ffmpeg(), дор)
    except Exception as e:
        print("музыка не собралась (%s)" % e, flush=True)

    живой = есть_звук(сток)
    итог = выход
    if собрана and живой:
        # Живой звук стока приглушён: он даёт присутствие (ветер, вода,
        # шаги), но забивать музыку ему нечем.
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-i", собрана,
                        "-ss", "%.2f" % начало, "-t", "%.2f" % длина, "-i", сток,
                        "-filter_complex",
                        f"[2:a]volume={ЖИВОЙ_ЗВУК},afade=t=in:st=0:d=0.5,"
                        f"afade=t=out:st={длина-1.0:.2f}:d=1.0[жив];"
                        f"[1:a][жив]amix=inputs=2:duration=first:normalize=0[а]",
                        "-map", "0:v", "-map", "[а]", "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest",
                        "-movflags", "+faststart", итог], check=True)
    elif собрана:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-i", собрана, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-shortest", "-movflags", "+faststart", итог], check=True)
    else:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", немой, "-c", "copy", "-movflags", "+faststart",
                        итог], check=True)

    print("заголовок:", текст, "| призыв:", призыв,
          "| живой звук:", "есть" if живой else "нет", flush=True)
    print("готово:", итог, os.path.getsize(итог), "байт", flush=True)
    return итог


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 2:
        raise SystemExit(__doc__)
    собрать(а[0], а[1], а[2] if len(а) > 2 else None,
            а[3] if len(а) > 3 else None)
