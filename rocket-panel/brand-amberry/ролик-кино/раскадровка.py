#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обзорная раскадровка фильма: три взгляда вместо перемотки.

Полтора часа кино просматриваются тремя картинками: шаг 30 секунд по
всему фильму, потом участок крупнее с шагом 5, потом точный с шагом 2.
Каждый кадр подписан своей секундой - с листа сразу видно, куда резать.

    python3 раскадровка.py <фильм.mp4> [шаг_сек] [от] [до]
"""
import os
import subprocess
import sys
import tempfile

КОЛОНОК = 8
ШИРИНА = 300


def ffmpeg():
    for п in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.exists(п):
            return п
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def длительность(в):
    import re
    п = subprocess.run([ffmpeg(), "-hide_banner", "-i", в],
                       capture_output=True, text=True)
    м = re.search(r"Duration: (\d+):(\d+):([\d.]+)", п.stderr)
    ч, мин, с = м.groups()
    return int(ч)*3600 + int(мин)*60 + float(с)


def листы(фильм, шаг=30, от=0, до=None, на_листе=56, выход=None):
    from PIL import Image, ImageDraw
    до = до if до is not None else длительность(фильм)
    выход = выход or os.path.join(os.path.dirname(os.path.abspath(фильм)),
                                  ".раскадровка")
    os.makedirs(выход, exist_ok=True)
    точки = [от + i*шаг for i in range(int((до-от)//шаг) + 1)]
    врем = tempfile.mkdtemp()
    кадры = []
    for i, т in enumerate(точки):
        п = os.path.join(врем, "к%04d.png" % i)
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-nostdin", "-ss", "%.2f" % т, "-i", фильм,
                        "-frames:v", "1", "-vf", "scale=%d:-2" % ШИРИНА, п],
                       capture_output=True)
        if os.path.exists(п):
            кадры.append((т, п))
    сделано = []
    for н in range(0, len(кадры), на_листе):
        часть = кадры[н:н+на_листе]
        ш, в = Image.open(часть[0][1]).size
        строк = (len(часть) + КОЛОНОК - 1) // КОЛОНОК
        лист = Image.new("RGB", (КОЛОНОК*ш, строк*(в+20)), (16, 16, 18))
        рис = ImageDraw.Draw(лист)
        for i, (т, п) in enumerate(часть):
            x, y = (i % КОЛОНОК)*ш, (i // КОЛОНОК)*(в+20)
            лист.paste(Image.open(п), (x, y))
            рис.text((x+6, y+в+4), "%d:%02d" % (int(т)//60, int(т) % 60),
                     fill=(210, 210, 215))
        имя = os.path.join(выход, "%s-шаг%d-%02d.jpg" % (
            os.path.splitext(os.path.basename(фильм))[0][:28], шаг, н//на_листе+1))
        лист.save(имя, quality=84)
        сделано.append(имя)
    for _, п in кадры:
        os.remove(п)
    os.rmdir(врем)
    print("\n".join(сделано), flush=True)
    return сделано


if __name__ == "__main__":
    а = sys.argv[1:]
    if not а:
        raise SystemExit(__doc__)
    листы(а[0], int(а[1]) if len(а) > 1 else 30,
          float(а[2]) if len(а) > 2 else 0,
          float(а[3]) if len(а) > 3 else None)
