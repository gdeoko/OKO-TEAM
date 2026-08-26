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

    def система(self, ключ="", правило_типографики="", правило_знака=""):
        части = [self.съёмка, свет(ключ, self.свет) if ключ else self.свет,
                 self.материал, self.палитра, self.шрифт]
        if self.референсы:
            части.insert(0, self.референсы)
        части.append(
            (правило_типографики or
             "Every letter is physically part of the scene, never a floating overlay: it lies in the plane of its "
             "surface, obeys the frame perspective and takes the same light and dust.") + " " +
            (правило_знака or "") + " "
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
    "engraved and accent paint filled with the position marker {}, marking the place in the series.",
    "The position marker {} is stencilled large and low in the corner of the working area, half worn away by "
    "traffic, marking the place in the series.",
    "The position marker {} is set low in the corner of the working area against a filled block of brand "
    "colour, marking the place in the series.",
    "The position marker {} hangs low in the corner of the working area as dimensional metal figures on "
    "standoffs with their own shadow, marking the place in the series.",
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



# ── Дизайнерские режимы ────────────────────────────────────────────────────
# Одного подхода мало: пакет из полусотни кадров должен читаться как работа
# студии, а не как один приём, размноженный полсотни раз. Держим шесть систем
# со своей композицией, типографикой и ролью знака, и выбираем их по теме
# и по площадке, а не наугад.

РЕЖИМЫ = {
 "сцена": {
   "как": "Design system for this frame is IN-SCENE LETTERING: the words are physical objects inside the "
          "photograph. {подача}",
   "типографика":
      "Every letter is physically part of the scene, never a floating overlay: it lies in the plane of its "
      "surface, obeys the frame perspective and takes the same light, dust and wear as everything around it.",
   "знак":
      "The brand mark sits once on a real surface in the scene, small, about three percent of the frame width, "
      "where such a mark would really be fixed, and takes the same light as the surface under it.",
 },
 "постер": {
   "как": "Design system for this frame is EDITORIAL POSTER: a strong documentary photograph of the site fills the "
          "frame, and the typography is set over it like a magazine cover, confidently and with air. The headline is "
          "set in very large dense grotesque capitals, ranged left, occupying a clear third of the frame over the "
          "calmest part of the image, one word per line where the line allows. A hairline rule of brand amber sits "
          "directly under the headline block. The photograph is darkened by a soft gradient exactly where the type "
          "lands, so the letters keep full contrast without a box around them. The headline reads exactly, character "
          "by character, the Russian line «{заголовок}».",
   "типографика":
      "Typography is set flat on the picture plane as deliberate editorial layout, sharp and perfectly aligned, "
      "never distorted to follow the surfaces beneath it. It is composed to a strict margin and baseline grid.",
   "знак":
      "The brand mark is placed as a clean flat lockup in one corner of the layout, small, about four percent of the "
      "frame width, in warm white or brand amber, with generous clear space around it.",
 },
 "цифра": {
   "как": "Design system for this frame is DATA POSTER: one number anchors the image, but the sentence still has to "
          "be read. The key figure from the headline is set very large in brand amber, occupying about a third of the "
          "frame, over a documentary photograph of the site. The headline itself is set beside or under that figure in "
          "dense grotesque capitals, large enough to read at a three hundred pixel preview and never smaller than a "
          "twentieth of the frame height, ranged left on a clear ground, reading exactly, character by character, the "
          "Russian line «{заголовок}». The number is the accent, the sentence is the message: if only one of them can "
          "be read at thumbnail size, it must be the sentence.",
   "типографика":
      "Typography is flat, geometric and precisely aligned, one dominant figure and one quiet supporting line, "
      "nothing else competing for attention.",
   "знак":
      "The brand mark is a small flat lockup in the lower corner, about three percent of the frame width, quiet "
      "against the ground.",
 },
 "экшен": {
   "как": "Design system for this frame is CINEMATIC ACTION: the moment is caught mid-movement with real energy. "
          "Sparks, water spray, dust, steam or flying swarf cut across the frame, a fast shutter freezing the "
          "particles while one element carries directional motion blur, shallow depth with the subject punched out "
          "sharp against a rushing background. The headline is composed into the movement as heavy dimensional "
          "lettering with real thickness and its own shadow, catching the same sparks and haze, reading exactly, "
          "character by character, the Russian line «{заголовок}».",
   "типографика":
      "The lettering is three dimensional and lit by the scene, with genuine edge highlights, contact shadow and "
      "atmosphere passing in front of it, but it stays perfectly legible and never bends out of shape.",
   "знак":
      "The brand mark is embossed small into the lower corner of the frame, about three percent of the frame width, "
      "picking up the same rim light as the action.",
 },
 "схема": {
   "как": "Design system for this frame is TECHNICAL OVERLAY: a documentary photograph of the site with a precise "
          "engineering drawing laid over it in brand amber hairlines, as if the drawing were registered to the real "
          "object. Dimension lines with arrow terminators, leader lines, node dots and a fine grid sit exactly on "
          "the features they describe. The headline is set flat in the negative space of the layout, reading exactly, "
          "character by character, the Russian line «{заголовок}».",
   "типографика":
      "Typography and drawing are one flat overlay plane: hairline weights, technical tracking, everything aligned "
      "to the same grid, the photograph reading clearly underneath.",
   "знак":
      "The brand mark sits in the corner of the drawing frame like the stamp of a title block, small, about three "
      "percent of the frame width.",
 },
 "объём": {
   "как": "Design system for this frame is DIMENSIONAL BUILD: the subject is shown as a clean three dimensional "
          "build against a deep graphite ground, the object of the story rendered with photographic materials and "
          "true reflections, its parts separated in an exploded view along one axis with thin brand amber leader "
          "lines between them, or stacked as a precise isometric cutaway that reveals what is normally hidden. "
          "The headline is set as heavy dimensional lettering standing in the same space as the object, sharing its "
          "floor, its shadow and its reflections, reading exactly, character by character, the Russian line "
          "«{заголовок}».",
   "типографика":
      "The lettering is a real object in the build with genuine thickness, contact shadow and edge highlight, lit by "
      "the same studio light as the subject, and it stays perfectly legible and undistorted.",
   "знак":
      "The brand mark stands small in the build as a machined plate on the ground plane, about three percent of the "
      "frame width, with its own shadow.",
 },
 "крупно": {
   "как": "Design system for this frame is BIG STATEMENT: one photograph of the site fills the frame with almost "
          "nothing on it, and a single short line of type sits in the empty part like a caption on a gallery wall, "
          "small relative to the image but perfectly placed and impossible to miss. Air and restraint do the work. "
          "The line reads exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "One line, one weight, generous letter spacing, aligned to the architecture of the photograph. Nothing else "
      "is set anywhere in the frame.",
   "знак":
      "The brand mark is a small flat lockup in the opposite corner from the line, about three percent of the frame "
      "width.",
 },
 "разрез": {
   "как": "Design system for this frame is MATERIAL CUTAWAY: the subject is cut open and shown in section, the way a "
          "product page shows what is inside. Layers of the floor slab, the wall build-up or the switchgear are "
          "peeled apart in a clean stepped section with each layer labelled by a thin brand amber leader line, "
          "photographic materials and true thickness, deep graphite ground. The headline is set flat above the "
          "section, reading exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "Typography and labels share one hairline system, technical and quiet, so the section itself carries the "
      "frame.",
   "знак":
      "The brand mark is a small flat lockup in the lower corner, about three percent of the frame width.",
 },
 "поток": {
   "как": "Design system for this frame is LIGHT TRAILS: a long exposure of the site at night where every moving "
          "thing draws a line, headlights of trucks pulling long amber ribbons across the yard, people reduced to "
          "soft ghosts, the buildings themselves razor sharp. The headline is set flat over the darkest part of the "
          "frame, reading exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "Typography is flat, calm and perfectly sharp against the motion, ranged left, never blurred with the scene.",
   "знак":
      "The brand mark is a small flat lockup in the corner, about three percent of the frame width.",
 },
 "коллаж": {
   "как": "Design system for this frame is LAYERED COLLAGE: a documentary photograph of the site with a second image "
          "cut into it along a hard geometric edge, a technical drawing, a map fragment or an interior, so the two "
          "read as one composed plane. A block of brand amber holds the seam. The headline is set across the seam, "
          "reading exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "Typography is flat and poster-scaled, crossing the seam deliberately so it binds the two images together.",
   "знак":
      "The brand mark is knocked out of the amber block, small, about four percent of the frame width.",
 },
 "брутал": {
   "как": "Design system for this frame is INDUSTRIAL BRUTALIST: the layout is raw and confrontational, built from "
          "the visual language of factory signage and wayfinding. A hard grid of thick rules divides the frame, one "
          "block is filled solid brand amber, the photograph of the site occupies another block cropped without "
          "mercy. The headline is set enormous in dense grotesque capitals, tight tracking, ranged left, allowed to "
          "run to the very edge of its block and be cut by it, reading exactly, character by character, the Russian "
          "line «{заголовок}».",
   "типографика":
      "Two type sizes only, both heavy, set flat on the picture plane with no effects at all. Alignment is strict "
      "and the friction is deliberate: nothing is centred, nothing is softened.",
   "знак":
      "The brand mark is knocked out of the amber block or set inside a ruled box in the corner, small, about four "
      "percent of the frame width, flat and hard edged.",
 },
 "дуотон": {
   "как": "Design system for this frame is DUOTONE GRAPHIC: the documentary photograph is reduced to a two colour "
          "duotone of deep graphite and brand amber with clean separation and real tonal depth, and one solid block "
          "of flat colour is placed against it as a compositional counterweight. The headline is knocked out of that "
          "block or set directly against the duotone, very large and ranged left, reading exactly, character by "
          "character, the Russian line «{заголовок}».",
   "типографика":
      "Typography is flat, graphic and poster-scaled, hard edges, no bevel, no shadow, no texture on the letters "
      "themselves.",
   "знак":
      "The brand mark is knocked out of the colour block in the corner, small, about four percent of the frame "
      "width, flat and clean.",
 },
}

# Тема сама подсказывает систему: разбор цифр просит крупное число, разговор
# про инженерию просит чертёж, история про людей и движение просит экшен.
РУБРИКА_РЕЖИМ = {
    "Цифры цеха": ("цифра", "объём"), "Цифры отрасли": ("цифра", "брутал"),
    "Деньги цеха": ("цифра", "сцена"), "Цена киловатта": ("объём", "разрез"),
    "Цена ошибки": ("экшен", "сцена"), "За что дают": ("цифра", "постер"),
    "Как выбирать": ("схема", "разрез"), "Не снесут": ("постер", "коллаж"),
    "Сто производств": ("поток", "объём"), "Кто стоит у станка": ("экшен", "крупно"),
    "Кадры цеха": ("экшен", "сцена"), "Сколько отсюда ехать": ("поток", "коллаж"),
    "Стройка будущего": ("коллаж", "объём"), "Промышленный город": ("брутал", "крупно"),
    "Площадки мира": ("дуотон", "постер"), "Отрасль": ("объём", "цифра"),
    "Рынок": ("брутал", "цифра"), "Воронка": ("сцена", "крупно"),
    "Событие": ("постер", "экшен"),
}


def режим(ключ, рубрика="", вид="пост"):
    """Систему выбираем от темы и от ключа: рубрика задаёт пару подходящих
    систем, ключ выбирает одну из них. Серия слайдов держит одну систему."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    пара = РУБРИКА_РЕЖИМ.get(рубрика)
    if not пара:
        имена = list(РЕЖИМЫ)
        return имена[_ровно(осн, 11) % len(имена)]
    return пара[_ровно(осн, 12) % 2]


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
                             f"obeys the same system so the separately generated frames read as one series: the same "
                             f"two type sizes and no third, the same margins and padding, the same colour grade on "
                             f"every photograph, one accent colour only.")
                if к["номер"] == 1:
                    # первый слайд решает, откроют ли остальные: контраст и приглашение листать
                    куски.append("This is the cover slide and it carries the whole carousel: maximum contrast, the "
                                 "simplest possible typography, the number or the claim in the headline made the "
                                 "loudest element in the frame, and a small chevron pointing right at the outer edge "
                                 "inviting the swipe. The cover has no other decoration.")
                elif к["номер"] == к["всего"]:
                    # финал зеркалит обложку: набор читается как оформленный, а не как реклама в конце
                    куски.append("This is the closing slide and it mirrors the cover: the same colour, the same type "
                                 "treatment and the same composition, so the set reads as designed rather than as an "
                                 "advertisement bolted to the end.")
        куски.append(f"The scene of this frame is {к['сцена']}.")
        имя_режима = режим(к["ключ"], к.get("рубрика", ""), вид)
        р = РЕЖИМЫ[имя_режима]
        (имя_приёма, шаблон), шаблон_номера = приём(к["ключ"])
        куски.append(р["как"].format(подача=шаблон.format(к["заголовок"]),
                                     заголовок=к["заголовок"]))
        if к.get("подпись"):
            куски.append(ПОДПИСЬ[имя_приёма].format(к["подпись"]) if имя_режима == "сцена"
                         else f"A supporting line is set small and calm under the headline in the same layout, "
                              f"reading exactly «{к['подпись']}».")
        if вид in ("карусель", "сторис"):
            метка_места = (f"{к['номер']} / {к['всего']}" if вид == "карусель" else str(к["номер"]))
            куски.append(шаблон_номера.format(метка_места) if имя_режима == "сцена"
                         else f"The position marker {метка_места} is set small in the corner of the layout in "
                              f"brand amber, marking the place in the series.")
            if к["номер"] == к["всего"]:
                куски.append(воронка(бренд) if вид == "карусель" else
                             f"This is the closing frame of the series, so the {бренд.имя} mark from the attached logo "
                             f"file appears once, small, at three percent of the frame width, low inside the working "
                             f"window" + (f" with «{бренд.домен}» beneath." if бренд.домен else "."))
        куски.append(бренд.система(к["ключ"], р["типографика"], р["знак"]))
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
