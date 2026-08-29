# -*- coding: utf-8 -*-
"""Надпись поверх ролика отдельным слоем.

Почему так, а не вшитым в кадр текстом: Runway перерисовывает картинку каждый
кадр и вшитый заголовок к середине ролика расплывается и тает. Правило
владельца ровно про это: в постах текст пишем внутри промпта, в видео
накладываем сами.

Плашка снизу непрозрачная: она закрывает то место, где исходный текст тает,
и заодно читается на любом кадре. Цвета и шрифты бренда: графит, янтарь,
Oswald на заголовок и Montserrat на строку (у Bebas нет кириллицы).
"""
import subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ШРИФТЫ = "/usr/share/fonts/truetype/oko"
ГРАФИТ = (36, 40, 46)
ЯНТАРЬ = (232, 164, 0)
БЕЛЫЙ = (255, 255, 255)


def слой(заголовок, строка, ш, в, куда):
    сл = Image.new("RGBA", (ш, в), (0, 0, 0, 0))
    d = ImageDraw.Draw(сл)
    верх = int(в * 0.70)
    # Переход от прозрачного к плашке, чтобы граница не резала кадр.
    for y in range(верх - int(в * 0.10), верх):
        доля = (y - (верх - int(в * 0.10))) / (в * 0.10)
        d.line([(0, y), (ш, y)], fill=ГРАФИТ + (int(255 * доля * доля),))
    d.rectangle([0, верх, ш, в], fill=ГРАФИТ + (255,))

    # Bebas Neue кириллицы не знает и рисует квадраты, поэтому узкий гротеск
    # берём Oswald: та же посадка, буквы русские на месте.
    поле = int(ш * 0.05)
    кегль = int(в * 0.115)
    while кегль > 20:
        кг = ImageFont.truetype(f"{ШРИФТЫ}/Oswald-Bold.ttf", кегль)
        if d.textbbox((0, 0), заголовок, font=кг)[2] <= ш - поле * 2:
            break
        кегль -= 2
    мл = ImageFont.truetype(f"{ШРИФТЫ}/Montserrat-SemiBold.ttf", int(в * 0.036))
    y = верх + int(в * 0.055)
    d.line([(поле, y - int(в * 0.028)), (поле + int(ш * 0.055), y - int(в * 0.028))],
           fill=ЯНТАРЬ + (255,), width=max(3, int(в * 0.008)))
    d.text((поле, y), заголовок, font=кг, fill=БЕЛЫЙ + (255,))
    d.text((поле, y + int(в * 0.135)), строка, font=мл, fill=(214, 218, 224, 255))
    сл.save(куда)
    return куда


def наложить(ролик, слой_png, куда):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", ролик, "-i", слой_png,
                    "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
                    "-c:v", "libx264", "-crf", "18", "-preset", "slow",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", куда],
                   check=True)
    return куда


if __name__ == "__main__":
    ролик, заг, стр, куда = sys.argv[1:5]
    subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                    "-show_entries", "stream=width,height", "-of", "csv=p=0", ролик],
                   check=True)
    ш, в = 1280, 720
    наложить(ролик, слой(заг, стр, ш, в, "/tmp/nadpis.png"), куда)
    print("готово", куда)
