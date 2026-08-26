# -*- coding: utf-8 -*-
"""Сборка промптов визуала из описания кадра и паспорта бренда.

Одна и та же система на все проекты: постоянная часть (свет, материал, палитра,
типографика, запреты) собирается из паспорта, переменная часть приходит списком
кадров. Так сто кадров проекта читаются одним брендом, а не сотней разных
генераций, и промпт гарантированно укладывается в рабочий предел 10 200 знаков.

    from promt_engine import Бренд, собрать
    промпты = собрать(бренд, кадры)
"""
import json
import re

ПРЕДЕЛ = 10200
МИНИМУМ = 2000

РАЗМЕРЫ = {"1:1": "1080x1080", "4:5": "1080x1350", "9:16": "1080x1920",
           "16:9": "1920x1080", "4:3": "1440x1080", "1.91:1": "1200x630"}


class Бренд:
    def __init__(self, имя, домен, палитра, свет, материал, шрифт, съёмка, референсы=""):
        self.имя = имя
        self.домен = домен
        self.палитра = палитра        # строка с HEX и ролями
        self.свет = свет
        self.материал = материал
        self.шрифт = шрифт
        self.съёмка = съёмка
        self.референсы = референсы

    def система(self):
        части = [self.съёмка, self.свет, self.материал, self.палитра, self.шрифт]
        if self.референсы:
            части.insert(0, self.референсы)
        части.append(
            "Every letter is physically part of the scene, never a floating overlay: engraved into metal and paint "
            "filled, hard-stencilled with slightly ragged edges and visible stencil bridges, or set into the floor "
            "marking; it lies in the plane of its surface, obeys the frame perspective and takes the same light and dust. "
            "The headline stays legible at a three hundred pixel feed preview: maximum contrast, nothing crossing the "
            "characters, no blur, no unplanned line break. An eight percent dead margin on all four sides is kept clear, "
            "and all typography sits inside it. "
            "No drawn interface elements: no call-to-action buttons, button shapes with text, swipe-up arrows, link "
            "chips, cursors, app icons or screen mock-ups; every word lives on a real surface. "
            "Strict restrictions: no text beyond the captions specified here, no subtitles, extra numbers, dimension "
            "callouts, scale bars, street names, addresses, plaques, watermarks or timestamps, no logo beyond the "
            "described mark, no invented words, placeholder or transliterated Latin lettering, emoji, icons or stock "
            "smiling people. No price tags and no currency signs anywhere in the frame. "
            "Every Cyrillic letter, digit, space, punctuation mark and the letter Ё with its two dots is reproduced "
            "exactly as written above, with no autocorrection, re-spacing or glyph substitution. If a letterform cannot "
            "be rendered cleanly, render it larger and simpler, never substitute another alphabet.")
        return " ".join(части)


def воронка(бренд):
    return (f"This closing slide carries the funnel: bolted low on the surface, centred, its centre at seventy nine "
            f"percent down the frame, a wide brushed steel plate with four countersunk screws, engraved and paint "
            f"filled with the {бренд.имя} wordmark taken one to one from the attached logo file"
            + (f", and beneath it, engraved in the accent colour at a quarter of the headline cap height, «{бренд.домен}»"
               if бренд.домен else "")
            + f"; hard-stencilled just below in warm white capitals at one third of the headline cap height, the "
              f"closing line «СОХРАНИТЕ, ЧТОБЫ НЕ ИСКАТЬ».")


def поля_сторис():
    return ("This is a vertical 9:16 story frame, exactly 1080x1920 pixels, built around the platform interface: the "
            "top 250 pixels are covered by progress bars and the account name, the bottom 250 pixels by the reply "
            "field, and 80 pixels along each side are lost under the thumb. Everything meaningful lives inside the "
            "central working window of 920 by 1420 pixels, and the headline sits in the upper part of that window "
            "because the visual centre of a story reads higher than the middle. The headline cap height is at least "
            "four percent of the frame width so it is legible at arm's length in motion, and it never runs longer "
            "than five lines. The poll or question sticker is NOT drawn in this image: the area reserved for it stays "
            "clean and nothing is painted there.")


def собрать(бренд, кадры):
    """кадры: список словарей с ключами ключ, формат, сцена, заголовок, подпись,
    и необязательными номер, всего, вид ('карусель' | 'сторис' | 'пост')."""
    система = бренд.система()
    промпты = {}
    for к in кадры:
        формат = к.get("формат", "1:1")
        размер = РАЗМЕРЫ[формат]
        куски = []
        вид = к.get("вид", "пост")
        if вид == "сторис":
            куски.append(поля_сторис())
            куски.append(f"This is frame {к['номер']} of {к['всего']} in one story series on a single theme, and all "
                         f"{к['всего']} frames obey the same system so they read as one series when tapped through.")
        else:
            куски.append(f"{формат} aspect ratio, exactly {размер} pixels, locked, never cropped or letterboxed.")
            if вид == "карусель":
                куски.append(f"This is slide {к['номер']} of {к['всего']} of one vertical carousel, and every slide "
                             f"obeys the same system so the separately generated frames read as one series.")
        куски.append(f"The scene of this frame is {к['сцена']}.")
        куски.append(f"The headline is deep engraved into a heavy brushed steel plate bolted flat onto the main "
                     f"surface of the scene with four countersunk screws and paint filled, reading exactly, character "
                     f"by character, the Russian line «{к['заголовок']}».")
        if к.get("подпись"):
            куски.append(f"The caption is hard-stencilled below the plate, at one third of the headline cap height, "
                         f"reading exactly «{к['подпись']}».")
        if вид in ("карусель", "сторис"):
            куски.append(f"A small milled steel tag the size of a matchbox is bolted flat near the lower left of the "
                         f"working area, engraved and accent paint filled with the single numeral {к['номер']} and "
                         f"nothing else, marking the position in the series.")
            if к["номер"] == к["всего"]:
                куски.append(воронка(бренд) if вид == "карусель" else
                             f"This is the closing frame of the series, so the {бренд.имя} mark from the attached logo "
                             f"file is engraved once, small, at three percent of the frame width, into a brushed steel "
                             f"plate low inside the working window"
                             + (f" with «{бренд.домен}» beneath." if бренд.домен else "."))
        куски.append(система)
        текст = " ".join(куски)
        промпты[к["ключ"]] = {"формат": формат, "размер": размер, "текст": текст}
    return промпты


def проверить(промпты):
    беды = []
    for k, v in промпты.items():
        n = len(v["текст"])
        if n > ПРЕДЕЛ: беды.append((k, f"длиннее предела: {n}"))
        if n < МИНИМУМ: беды.append((k, f"короче двух тысяч: {n}"))
        if re.search(r"«[^»]*$", v["текст"]): беды.append((k, "незакрытая кавычка"))
    return беды
