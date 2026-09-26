#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Две версии из ОДНОЙ генерации: для соцсетей и для телеграма.

    python3 сборка_одного.py <лицо> <ролик.mp4> <момент> [призыв]

Генерация одна и та же, монтаж разный:

    соцсети   муть с указанной секунды + кнопки бота + карточка
    телеграм  без мути, только карточка в конце - кнопка на бота
              вешается на сам пост

МОМЕНТ - секунда, к которой кадр обязан быть закрыт. Разгон мути кладётся
ПЕРЕД ней, иначе ровно эти доли секунды покажут то, ради чего всё и
затевалось.
"""
import os
import re
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ТУТ)
import карточка as К                                          # noqa: E402

Ш, В, КАДРЫ = 1080, 1920, 30
РАЗГОН, ДЕРЖАТЬ = 0.5, 0.15
КНОПКИ = ["Раздеть", "Соло"]
ВСПЫШКА, ПРОЯВКА = 0.32, 0.22


def ffmpeg():
    for п in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.exists(п):
            return п
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def длительность(в):
    п = subprocess.run([ffmpeg(), "-hide_banner", "-i", в], capture_output=True, text=True)
    м = re.search(r"Duration: (\d+):(\d+):([\d.]+)", п.stderr)
    ч, мин, с = м.groups()
    return int(ч)*3600 + int(мин)*60 + float(с)


def ровно(вход, выход):
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", вход,
                    "-vf", f"scale={Ш}:{В}:force_original_aspect_ratio=increase,"
                           f"crop={Ш}:{В},fps={КАДРЫ},format=yuv420p",
                    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                    выход], check=True)
    return выход


def расставить(окно):
    доля = окно / len(КНОПКИ)
    return [{"текст": т, "вход": round(i*доля + доля*0.12, 2),
             "нажатие": round(i*доля + доля*0.45, 2),
             "уход": round(i*доля + доля*0.80, 2)} for i, т in enumerate(КНОПКИ)]


def собрать(лицо, клип, момент=None, призыв=None, с_мутью=True, выход=None):
    раб = os.path.join(ТУТ, ".работа")
    os.makedirs(раб, exist_ok=True)
    призыв = призыв or К.ПРИЗЫВЫ[0]
    лента = ровно(клип, os.path.join(раб, "лента-одна.mp4"))
    полная = длительность(лента)
    момент = float(момент) if момент else полная * 0.6
    выход = выход or os.path.join(
        ТУТ, "%s-%s.mp4" % ("соцсети" if с_мутью else "телеграм", лицо))

    ряд = os.path.join(раб, "ряд")
    К.ряд(ряд, призыв)
    # Карточка выходит после закрытия кадра, а в телеграме - к концу.
    старт = (момент + ДЕРЖАТЬ) if с_мутью else max(0.5, полная - 2.6)
    кнопки = расставить(max(1.2, (момент - РАЗГОН - 0.2) if с_мутью else полная - 3.0))
    пути = {}
    for i, к in enumerate(кнопки):
        for сост in ("", "нажата"):
            п = os.path.join(раб, "к%d%s.png" % (i, сост or "0"))
            К.кнопка(п, к["текст"], сост)
            пути[(i, сост)] = п

    входы = ["-i", лента, "-framerate", str(КАДРЫ), "-i", os.path.join(ряд, "кадр%03d.png")]
    for i, _ in enumerate(кнопки):
        входы += ["-i", пути[(i, "")], "-i", пути[(i, "нажата")]]

    ф = []
    if с_мутью:
        сигма = max(34, Ш // 11)
        т = f"{max(0.0, момент - РАЗГОН):.3f}"
        доля = f"min(1,max(0,(T-{т})/{РАЗГОН}))"
        ф += ["[0:v]split=2[чист][грязь]",
              f"[грязь]gblur=sigma={сигма}:steps=4[муть]",
              f"[чист][муть]blend=all_expr='A*(1-{доля})+B*{доля}'[кадр]"]
        пред = "кадр"
    else:
        ф.append("[0:v]null[кадр]")
        пред = "кадр"

    for i, к in enumerate(кнопки):
        об, наж = 2 + i*2, 3 + i*2
        y = int(В * (0.60 + i * 0.085))
        for имя, поток, нач, кон in (
                ("об%d" % i, об, к["вход"], к["нажатие"]),
                ("наж%d" % i, наж, к["нажатие"], к["нажатие"] + ВСПЫШКА),
                ("пос%d" % i, об, к["нажатие"] + ВСПЫШКА, к["уход"])):
            if кон <= нач:
                continue
            ф.append(f"[{поток}:v]format=rgba,loop=loop=-1:size=1:start=0,"
                     f"fps={КАДРЫ},setpts=N/FRAME_RATE/TB,"
                     f"fade=t=in:st={нач:.2f}:d={ПРОЯВКА}:alpha=1,"
                     f"fade=t=out:st={max(нач, кон-ПРОЯВКА):.2f}:d={ПРОЯВКА}:alpha=1[{имя}]")
            ф.append(f"[{пред}][{имя}]overlay=(W-w)/2:{y}:"
                     f"enable='between(t,{нач:.2f},{кон:.2f})':format=auto:shortest=1[н{имя}]")
            пред = "н" + имя

    ф.append(f"[1:v]format=rgba,fps={КАДРЫ},tpad=stop_mode=clone:stop_duration=30,"
             f"setpts=PTS-STARTPTS+{старт:.3f}/TB[карта]")
    ф.append(f"[{пред}][карта]overlay=0:0:enable='gte(t,{старт:.3f})':"
             f"format=auto:shortest=1[вых]")

    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error"] + входы + [
        "-filter_complex", ";".join(ф), "-map", "[вых]", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", выход], check=True)
    print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
    return выход


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 3:
        raise SystemExit(__doc__)
    лицо, клип, момент = а[0], а[1], а[2]
    призыв = а[3] if len(а) > 3 else None
    собрать(лицо, клип, момент, призыв, с_мутью=True)
    собрать(лицо, клип, момент, призыв, с_мутью=False)
