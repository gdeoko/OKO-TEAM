#!/usr/bin/env python3
"""Аватарки поддержки: бот @AMBERRYsupport_bot и группа менеджеров.

Обе режутся из обложки экрана поддержки (`экраны/sup.jpg`) — это та же
Ника и та же ягода, что клиент видит в основном боте, поэтому бот
поддержки узнаётся как «свой». Ничего не генерируется: кадр уже есть.

Телеграм обрезает аватар кругом, поэтому всё важное держим в центре,
а подпись — в верхней половине нижнего края, где круг ещё широкий.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ТУТ = os.path.dirname(os.path.abspath(__file__))
ОБЛОЖКА = os.path.join(ТУТ, "..", "экраны", "sup.jpg")
ШРИФТ = os.path.join(ТУТ, "Outfit-Bold.ttf")
РОЗОВЫЙ = (255, 46, 136)
Р = 1024


def неоновая_подпись(холст, текст, y, размер):
    ш = ImageFont.truetype(ШРИФТ, размер)
    слой = Image.new("RGBA", холст.size, (0, 0, 0, 0))
    д = ImageDraw.Draw(слой)
    x0, y0, x1, y1 = д.textbbox((0, 0), текст, font=ш)
    x = (Р - (x1 - x0)) // 2 - x0
    д.text((x, y), текст, font=ш, fill=РОЗОВЫЙ + (255,))
    свечение = слой.filter(ImageFilter.GaussianBlur(14))
    холст.alpha_composite(свечение)
    холст.alpha_composite(свечение)
    д2 = ImageDraw.Draw(холст)
    д2.text((x, y), текст, font=ш, fill=(255, 225, 238, 255))


def затемнить_низ(холст, от):
    град = Image.new("L", (1, Р), 0)
    for yy in range(Р):
        град.putpixel((0, yy), max(0, min(235, int((yy - от) / (Р - от) * 330))) if yy > от else 0)
    чёрный = Image.new("RGBA", (Р, Р), (0, 0, 0, 255))
    чёрный.putalpha(град.resize((Р, Р)))
    холст.alpha_composite(чёрный)


def бот(исх):
    # Лицо и плечи Ники: круг аватара не должен резать ни лба, ни подбородка.
    к = исх.crop((1640, 0, 2360, 720)).resize((Р, Р), Image.LANCZOS).convert("RGBA")
    затемнить_низ(к, 600)
    неоновая_подпись(к, "SUPPORT", 790, 118)
    к.convert("RGB").save(os.path.join(ТУТ, "аватар-бот.jpg"), quality=93)


def группа(исх):
    # Ягода по центру на чёрном: группа — рабочее место менеджеров,
    # ей лицо модели ни к чему, а бренд узнаётся сразу.
    к = исх.crop((450, 140, 1230, 920)).resize((Р, Р), Image.LANCZOS).convert("RGBA")
    затемнить_низ(к, 620)
    неоновая_подпись(к, "SUPPORT TEAM", 790, 84)
    к.convert("RGB").save(os.path.join(ТУТ, "аватар-группа.jpg"), quality=93)


if __name__ == "__main__":
    исх = Image.open(ОБЛОЖКА).convert("RGB")
    бот(исх)
    группа(исх)
    print("готово")
