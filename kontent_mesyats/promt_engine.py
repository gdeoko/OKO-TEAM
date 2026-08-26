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

    def система(self, ключ=""):
        части = [self.съёмка, свет(ключ, self.свет) if ключ else self.свет,
                 self.материал, self.палитра, self.шрифт]
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



# Один приём подачи на весь пакет делает ленту одинаковой: двадцать шесть кадров
# с гравированной стальной плитой читаются как один и тот же кадр. Держим набор
# способов, которыми надпись физически живёт в сцене, и раздаём их по кадрам.
ПОДАЧА = [
    ("engraved", "The headline is deep engraved into a heavy brushed steel plate bolted flat onto the main surface "
                 "of the scene with four countersunk screws and paint filled, reading exactly, character by "
                 "character, the Russian line «{}»."),
    ("stencil",  "The headline is hard-stencilled straight onto the concrete wall of the scene in thick industrial "
                 "paint, letters a metre tall with the tooth of the roller and visible stencil bridges, slightly "
                 "worn at the edges, reading exactly, character by character, the Russian line «{}»."),
    ("floor",    "The headline is painted into the floor marking itself, laid along the bay in the same worn safety "
                 "yellow as the walkway lines, seen at a raking angle from standing height so the letters foreshorten "
                 "with the perspective of the floor, reading exactly, character by character, the Russian line «{}»."),
    ("light",    "The headline is thrown across the scene as a hard shaft of projected light through a cut metal "
                 "gobo, the letters falling over wall, pipework and floor and bending where the surface breaks, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("facade",   "The headline stands on the building as individual dimensional letters, brushed metal faces on "
                 "standoffs, each letter throwing its own shadow onto the pale wall behind it, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("chalk",    "The headline is written in white chalk on a large slate shift board hanging in the bay, an honest "
                 "human hand with uneven strokes and chalk dust in the tray below, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("emboss",   "The headline is blind embossed into thick warm white paper lying in the scene, no ink at all, the "
                 "letters readable only by the shadow in their own relief under the raking light, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("board",    "The headline is set in a split flap departure board mounted on the wall, black flaps with warm "
                 "white characters, one flap caught mid turn, reading exactly, character by character, the Russian "
                 "line «{}»."),
    ("tape",     "The headline is laid out in strips of brand coloured adhesive marking tape stuck directly to the "
                 "smooth concrete floor, the strips slightly overlapping at the corners of the letters, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("weld",     "The headline is cut clean through a standing sheet of steel by laser, the letters open holes with "
                 "bright cut walls, the lit space behind reading through them, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("led",      "The headline runs on a warm amber industrial LED matrix panel fixed to the wall of the scene, the "
                 "individual diodes visible at this distance and a faint bloom around the characters, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("crate",    "The headline is stencilled across the side of a plywood shipping crate standing in the scene, ink "
                 "sunk into the grain and broken where the boards meet, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("dust",     "The headline is drawn by a finger through the fine layer of production dust on a steel surface in "
                 "the scene, the clean metal shining through the strokes, "
                 "reading exactly, character by character, the Russian line «{}»."),
    ("banner",   "The headline is printed on a heavy canvas banner lashed to the railing in the scene, the fabric "
                 "sagging between the fixing points so the letters curve with it, "
                 "reading exactly, character by character, the Russian line «{}»."),
]

# Подпись под заголовком идёт тем же способом, что и он: иначе кадр распадается.
ПОДПИСЬ = {
    "engraved": "The caption is hard-stencilled below the plate, at one third of the headline cap height, "
                "reading exactly «{}».",
    "stencil":  "The caption is stencilled in a smaller size below the headline, in the same paint, "
                "reading exactly «{}».",
    "floor":    "The caption runs along the floor marking below the headline, in the same worn paint, "
                "reading exactly «{}».",
    "light":    "The caption is projected with the headline, smaller and lower in the same beam, "
                "reading exactly «{}».",
    "facade":   "The caption is stencilled on the wall below the dimensional letters, "
                "reading exactly «{}».",
    "chalk":    "The caption is written in the same chalk hand below the headline, "
                "reading exactly «{}».",
    "emboss":   "The caption is embossed below the headline in the same paper, smaller, "
                "reading exactly «{}».",
    "board":    "The caption occupies the lower row of the same flap board, "
                "reading exactly «{}».",
    "tape":     "The caption is laid in the same marking tape below the headline, thinner strips, "
                "reading exactly «{}».",
    "weld":     "The caption is cut through the same steel sheet below the headline, smaller, "
                "reading exactly «{}».",
    "led":      "The caption runs on the lower row of the same LED panel, dimmer, "
                "reading exactly «{}».",
    "crate":    "The caption is stencilled on the crate below the headline, smaller, "
                "reading exactly «{}».",
    "dust":     "The caption is drawn in the same dust below the headline, "
                "reading exactly «{}».",
    "banner":   "The caption is printed on the same banner below the headline, "
                "reading exactly «{}».",
}

# Номер слайда тоже не обязан всегда быть стальным ярлыком.
НОМЕР = [
    "A small milled steel tag the size of a matchbox is bolted flat near the lower left of the working area, "
    "engraved and accent paint filled with the single numeral {}, marking the position in the series.",
    "The single numeral {} is stencilled large and low in the corner of the working area, half worn away by traffic, "
    "marking the position in the series.",
    "The single numeral {} is painted inside a filled circle of brand colour low in the corner of the working area, "
    "marking the position in the series.",
    "The single numeral {} hangs low in the corner of the working area as one dimensional metal figure on a standoff "
    "with its own shadow, marking the position in the series.",
]


def _ровно(строка, соль=0):
    """Сумма кодов символов ложится кучно и половина приёмов не выпадает ни разу.
    Берём md5: он раскидывает ключи равномерно и при этом остаётся постоянным."""
    import hashlib
    ч = hashlib.md5(f"{соль}:{строка}".encode()).digest()
    return int.from_bytes(ч[:4], "big")


def приём(ключ):
    """Способ подачи выбираем от ключа кадра: одинаковый ключ даёт одинаковый
    кадр при перегенерации, а соседние единицы получают разные приёмы."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    номер = int(ключ.rsplit("-", 1)[-1]) if ключ.rsplit("-", 1)[-1].isdigit() else 0
    # внутри одной серии приём держим общим: слайды должны читаться как один набор
    return ПОДАЧА[_ровно(осн, 1) % len(ПОДАЧА)], НОМЕР[(_ровно(осн, 2) + номер // 4) % len(НОМЕР)]



# Один световой рисунок на весь пакет даёт ленту в одной тональности: всё
# тёмное, всё вечернее. Держим набор состояний света и раздаём их по кадрам,
# сохраняя объём и материальность.
СВЕТ_ВАРИАНТЫ = [
    "Hard directional key from the upper left at a shallow raking angle carving every weld bead, bolt head and paint "
    "chip into relief, a visible shaft of light with airborne dust in it, warm amber bounce lifting the deepest "
    "shadow, ink black falloff behind the subject.",
    "Flat overcast daylight through a wall of industrial glazing, soft and even with no hard shadow, the whole frame "
    "pale and cool, a single warm amber source deep inside the space giving the only heat.",
    "Low sun just after sunrise coming almost horizontally through the open gate, long orange shafts stretching "
    "across the floor, dust turning in them, the far end of the bay still cold blue.",
    "Blue hour outside just after the lamps come on, sky still deep cobalt, warm amber pooling out of every open "
    "gate and window, wet asphalt doubling every light.",
    "Bright hard midday sun with crisp black shadows and hot highlights on metal, the sky burnt out white, heat "
    "shimmer over the concrete apron.",
    "Overhead industrial fixtures at full power on a working shift, clean even light on the floor, the ceiling "
    "structure dark above, deep shadow only under the machines.",
    "Grey rain, everything wet and reflective, water running off the canopy edges, colours muted to steel and "
    "graphite, the amber of the interior lights bleeding into the puddles.",
    "Single work lamp clamped close to the subject in an otherwise dark bay, a tight warm pool of light with fast "
    "falloff into black, the rest of the space only hinted at.",
    "Soft north light in a clean renovated interior, white walls bouncing it around, one brand amber accent wall "
    "warming the whole frame, no hard shadow anywhere.",
    "Night on the territory under sodium and LED yard lighting, cold white pools on the apron between warm amber "
    "gaps, the sky black above the roofline.",
]


def свет(ключ, запасной):
    """Свет выбираем от ключа кадра: перегенерация даёт тот же кадр, а соседние
    единицы попадают в разное время суток."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    return СВЕТ_ВАРИАНТЫ[_ровно(осн, 3) % len(СВЕТ_ВАРИАНТЫ)] or запасной


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
        (имя_приёма, шаблон), шаблон_номера = приём(к["ключ"])
        куски.append(шаблон.format(к["заголовок"]))
        if к.get("подпись"):
            куски.append(ПОДПИСЬ[имя_приёма].format(к["подпись"]))
        if вид in ("карусель", "сторис"):
            куски.append(шаблон_номера.format(к["номер"]))
            if к["номер"] == к["всего"]:
                куски.append(воронка(бренд) if вид == "карусель" else
                             f"This is the closing frame of the series, so the {бренд.имя} mark from the attached logo "
                             f"file is engraved once, small, at three percent of the frame width, into a brushed steel "
                             f"plate low inside the working window"
                             + (f" with «{бренд.домен}» beneath." if бренд.домен else "."))
        куски.append(бренд.система(к["ключ"]))
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
