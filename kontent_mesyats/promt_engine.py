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

# Основа кадра и подбор действия живут отдельными модулями: их правят чаще, чем
# сам движок, и держать их здесь значит каждый раз трогать общий файл.
try:
    from osnovy import основа as _основа
except ImportError:
    _основа = None
try:
    from effekty import эффект as _эффект_среды
except ImportError:
    _эффект_среды = None

ПРЕДЕЛ = 10200
МИНИМУМ = 2000

РАЗМЕРЫ = {"1:1": "1080x1080", "4:5": "1080x1350", "9:16": "1080x1920",
           "16:9": "1920x1080", "4:3": "1440x1080", "1.91:1": "1200x630"}


class Бренд:
    # Паспорт разложен на части, потому что не каждой части место в каждом кадре.
    # «Территория» это привязка к фотографиям площадки: она обязательна кадру про
    # саму площадку и мешает кадру про счёт или про идею. «Знак» и «финал» идут
    # всегда. Старое единое поле «референсы» оставлено для совместимости.
    def __init__(self, имя, домен, палитра, свет, материал, шрифт, съёмка,
                 референсы="", территория="", знак="", финал=""):
        self.имя = имя
        self.домен = домен
        self.палитра = палитра        # строка с HEX и ролями
        self.свет = свет
        self.материал = материал
        self.шрифт = шрифт
        self.съёмка = съёмка
        self.референсы = референсы
        self.территория = территория
        self.знак = знак
        self.финал = финал

    def система(self, ключ="", правило_типографики="", правило_знака="", с_территорией=True,
                со_знаком=True):
        части = [self.съёмка, свет(ключ, self.свет) if ключ else self.свет,
                 self.материал, self.палитра, self.шрифт]
        голова = ""
        if self.территория and с_территорией:
            голова += self.территория
        # На закрывающем слайде карусели знак уже полностью описан блоком воронки:
        # повторять его правила значит и раздувать промпт, и звать второй логотип.
        голова += (self.знак if со_знаком else "") + self.финал
        if голова:
            части.insert(0, голова)
        elif self.референсы:
            части.insert(0, self.референсы)
        части.append(
            (правило_типографики or
             "Every letter is physically part of the scene, never a floating overlay: it lies in the plane of its "
             "surface, obeys the frame perspective and takes the same light and dust.") + " " +
            ((правило_знака or "") if со_знаком else "") + " "
            "Nothing crosses the characters, no blur, no unplanned line break, eight percent dead margin. "
            "Nothing from an interface: no buttons, swipe arrows, link chips, cursors, app icons or screen "
            "mock-ups. No text beyond the captions given here: no subtitles, extra numbers, "
            "scale bars, street names, addresses, watermarks, timestamps, price tags, currency signs, second logo, "
            "invented words, Latin placeholder lettering, emoji or icons. "
            "Every Cyrillic letter, digit, space, punctuation mark and Ё with its two dots is reproduced "
            "exactly as written above, without autocorrection or glyph substitution. A letterform that cannot be "
            "rendered cleanly is rendered larger and simpler, never in another alphabet.")
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
    ("floor",    "The headline is painted into the floor marking itself in the same worn safety yellow as the walkway "
                 "lines, seen from almost directly above so the letters keep their true shape and read flat, "
                 "reading exactly, character by character, the Russian line «{}»."),
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

# Читаемость нужна любому кадру: контраст, горизонтальная строка, надпись лицом
# к камере. Масштаб же правило ленты: кадр в ленте живёт размером с ноготь, а
# историю смотрят во весь экран с вытянутой руки, и требовать от неё той же
# высоты литер значит запретить в истории связную фразу.
ЧИТАЕМОСТЬ = ("Contrast is set, not hoped for: warm white on dark, or near black on solid amber. Amber type lives "
              "only on graphite or black; on any lighter ground the letters are warm white or near black, never "
              "amber. Where type crosses a bright or busy area the ground under it is darkened. Type is upright "
              "always, no italic or script. The outer guillemets around a quoted line are delimiters and are not drawn; "
              "guillemets inside the wording itself are. The headline faces camera square: foreshortened "
              "letters stop being letters. Its baseline is horizontal, never rotated, never running up or "
              "down the side of the frame.")
МАСШТАБ = ("The lettering is the subject here: the headline block spans at least sixty percent of the frame width "
           "and a quarter of its height and reads at a two hundred pixel thumbnail. Its cap height is never less "
           "than a twelfth of the frame height, on a wide frame as much as on a tall one: a headline that has to "
           "be looked for has already failed. " + ЧИТАЕМОСТЬ)

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
    "Hard directional key from the upper left at a shallow raking angle carving every weld bead and paint chip into "
    "relief, a visible shaft of dusty light, amber bounce lifting the shadow, ink black falloff behind.",
    "Flat overcast daylight through a wall of industrial glazing, no hard shadow, the frame pale and cool, one warm "
    "amber source deep inside giving the only heat.",
    "Low sun just after sunrise coming horizontally through the open gate, long amber shafts across the floor, dust "
    "turning in them, the far end of the bay still cold blue.",
    "Blue hour just after the lamps come on, sky deep cobalt, amber pooling out of every gate and window, wet "
    "asphalt doubling every light.",
    "Hard midday sun, crisp black shadows, hot highlights on metal, sky burnt out white, heat shimmer over the "
    "apron.",
    "Overhead fixtures at full power on a working shift, clean light on the floor, ceiling structure dark above, "
    "deep shadow only under the machines.",
    "Grey rain, everything wet and reflective, water off the canopy edges, colours muted to steel and graphite, "
    "interior amber bleeding into the puddles.",
    "One work lamp clamped close to the subject in a dark bay, a tight warm pool with fast falloff into black, the "
    "rest of the space only hinted at.",
    "Soft north light in a renovated interior, white walls bouncing it, one amber accent wall warming the frame, no "
    "hard shadow.",
    "Night on the territory under yard lighting, cold white pools on the apron between amber gaps, sky black above "
    "the roofline.",
]


def свет(ключ, запасной):
    """Свет выбираем от ключа кадра: перегенерация даёт тот же кадр, а соседние
    единицы попадают в разное время суток."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    return СВЕТ_ВАРИАНТЫ[_ровно(осн, 3) % len(СВЕТ_ВАРИАНТЫ)] or запасной



# ── Эффект кадра ───────────────────────────────────────────────────────────
# Владелец 27.08.2026: «не просто фон плюс текст, а целые экшен-сцены, насыщенно,
# объёмно, динамично». Композиция и свет задаются режимом, а вот атмосферу и
# действие даёт отдельный слой: в кадре всегда что-то происходит физически.
# Раздаём по ключу, чтобы соседние единицы не попадали в один приём.
ЭФФЕКТЫ = [
    "Two speeds in one frame: a fan of welding sparks, the near ones frozen at 1/2000 as hard white hot points, the "
    "far ones stretched into curved streaks bending to the floor and fading red. The arc is the only key, a 6000 K "
    "point, and haze turns it into a visible cone.",
    "The instant of impact frozen at 1/4000: a ring of scale and oil mist blasts outward as thousands of separate "
    "specks, dense at the source and thinning to a halo a metre out, while vented steam to one side is motion "
    "stretched into soft streaks.",
    "Twenty two seconds on a locked tripod: the vehicles that crossed the yard are gone and only their light "
    "survives, an amber beacon arc curving into the depth and two headlight ribbons bending around the dock, while "
    "every building and rail stays razor sharp. Wet concrete doubles every trail.",
    "Shot at 1/6 of a second: everything moving has dissolved into a continuous smeared band four hundred "
    "millimetres across the frame, while the steel structure, the control panel and a person standing still at the "
    "far end stay perfectly sharp. The contrast between the liquid band and the rigid frame is the whole picture.",
    "A jet of incandescent particles opens from a narrow root into a nine hundred millimetre plume: leading "
    "particles frozen as dots at 1/3200, trailing ones stretched into comet streaks that fork where they hit the "
    "floor. Beyond two metres, black.",
    "A panning frame at 1/40: the moving subject is held sharp from its leading edge back, its tail already melting "
    "into the pan, while posts and lamps behind it drag into clean horizontal streaks that carry the speed. Spray "
    "off the tyres stretches into sixty millimetre comma shaped tails.",
    "Rain drives across the near plane, drops streaking as short amber lines through every source, water sheeting "
    "off the canopy edge, wet concrete turning into a mirror that doubles the whole scene upside down, and one hard "
    "3200 K source raking low so every drop has an edge.",
    "Dust hangs thick in a hard shaft crossing the frame diagonally, each particle separately lit, the beam solid "
    "enough to read as an object with deep black either side. Something moves through the beam and drags a slow "
    "smear while the lit edge nearest camera stays sharp.",
    "Steam vents from a valve at the frame edge and rolls across the middle plane, backlit into a solid amber wall "
    "of light, the subject cutting a dark silhouette through it with a bright rim along one side and the far "
    "structure dissolving completely.",
    "Heat shimmer distorts the air above a hot surface in the mid plane, the background rippling through it, an "
    "amber glow radiating from the source and blooming into the lens as a soft horizontal streak, fine grit turning "
    "slowly in the rising air.",
    "Mixed uncorrected colour temperatures meet on one surface: 2000 K sodium flood from one side, 5600 K daylight "
    "wedge from an open gate on the other, the line between them running right through the subject, dust turning in "
    "both and each throwing its own coloured shadow.",
    "A load is lifted and the frame catches the movement: the load swings a fraction, its shadow races across the "
    "floor, the chains blur at 1/15 while the subject stays frozen sharp, and fine debris shaken loose falls "
    "through the key beam.",
]


def эффект(ключ):
    """Атмосферный слой кадра: своё действие у каждой единицы, повторов подряд нет."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    return ЭФФЕКТЫ[_ровно(осн, 7) % len(ЭФФЕКТЫ)]


# ── Графические приёмы для каруселей и историй ─────────────────────────────
# Кадр ленты живёт по другим законам, чем кинокадр: там работает не действие, а
# слоистость. Три плана минимум, один элемент пересекает границу блока.
ГРАФИКА = [
    "Composition: a flat graphite #14171C plate fills the lower sixty two percent with a hard horizontal edge, "
    "warm white #F5F1E8 above. The subject is cut out along a precise silhouette and straddles that edge, with a "
    "three pixel amber #E8A400 stroke and a soft contact shadow onto the plate only.",
    "Composition: a keyline rectangle in a four pixel amber #E8A400 stroke, inset over a warm white #F5F1E8 "
    "field, holds the photograph. One element of the subject is reprinted on top so it crosses the keyline and "
    "extends beyond it; there the stroke is interrupted and does not redraw.",
    "Composition: a full bleed photograph exposed a stop under works as ground. Across the lower third lies a "
    "glass panel: the image beneath it blurred, filled with graphite #14171C at under half opacity, a one pixel "
    "warm white lip on its top edge only. Inside it the headline and one figure in amber #E8A400 at four times "
    "its size.",
    "Composition: a warm white #F5F1E8 field split by a hard vertical edge. Left of it the photograph is a one "
    "colour halftone in amber #E8A400, round dots at thirty two lines per inch, screen angle forty five degrees. "
    "Right of it the same photograph in full colour at exact register, the subject unbroken across the split.",
    "Composition: a cut out subject on a warm white #F5F1E8 field with two flat duplicates of its own silhouette "
    "offset behind it on one axis, the first solid amber #E8A400, the second further out in graphite #14171C at "
    "low opacity. Edges stay hard, so it reads as risograph misregistration and not as blur.",
    "Composition: the ground is a mesh gradient of four poles, amber #E8A400 upper right, deep ember lower "
    "right, graphite #14171C lower left, warm white #F5F1E8 upper left, blended without banding under fine "
    "grain. A cut out subject lit from the upper right throws a long shadow toward the lower left. Type sits only "
    "in the darkest zone.",
    "Composition: the photograph fills the frame, desaturated and darkened into a substrate. Registered exactly "
    "on top, a technical line drawing of the same structure in amber #E8A400: thin orthographic outlines, dashed "
    "hidden lines, dimension lines with arrow terminators, aligned to the photograph perspective at the key "
    "edges.",
    "Composition: the whole frame carries a photocopier pass. Warm white #F5F1E8 base with uneven toner, density "
    "falling toward one edge, debris specks, crushed blacks and a one pixel fringe at high contrast edges under "
    "scan striation. One element resists it: a solid amber #E8A400 plate carrying the headline in near black, crisp on top.",
    "Composition: a graphite #14171C field going near black at the edges. A cut out subject with a strong "
    "silhouette is centred, and directly behind it a radial amber #E8A400 glow, its core hidden by the subject "
    "and haloing around the edges. A two pixel amber rim traces the top and right edges only. Type sits in the "
    "dark corner opposite.",
    "Composition: a six by eight module grid with generous gutters, drawn as filled modules in flat amber "
    "#E8A400 and flat graphite #14171C. Exactly ONE module carries a photograph and it is big, at least "
    "three columns by three rows, floating with its own shadow and turned two degrees off axis; every other "
    "filled module is flat colour. No second photograph, no repeated crop, no wallpaper of small pictures.",
]


# Кадр карусели строится вёрсткой, а не действием, и на приёмке это читается как
# витрина без жизни: вырезанный предмет на пустой подложке. Действие целиком сюда
# не поставить, вёрстка развалится, поэтому просим одну живую деталь внутри
# фотографической части.
ОЖИВЛЕНИЕ = ("Inside the photograph one small thing is alive at this instant: dust turning in a shaft of light, "
             "steam leaving a valve, a hand mid movement, water running off an edge. The layout stays as "
             "described.")


def графика(ключ, номер=0):
    """Приём оформления для кадра ленты. Внутри серии держим один приём."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    return ГРАФИКА[_ровно(осн, 9) % len(ГРАФИКА)]


# ── Дизайнерские режимы ────────────────────────────────────────────────────
# Владелец 27.08.2026 забраковал прежний визуал как «фон плюс текст, скучно».
# Поэтому набор систем пересобран из двух разборов: DIZAJN_3D даёт объём,
# материал и оптику, DIZAJN_EKSHEN даёт движение, заморозку и следы. Каждая
# система задаёт планы, источники с кельвинами, шероховатости и роль надписи,
# то есть кадр строится физикой, а не подложкой под текст.
# Ни один блок не называет конкретный цех, пресс, конвейер или фуру: сцена
# приходит отдельной строкой, и часть кадров снимается в студии, на графической
# сетке или как макро предмета, куда сварочный пост не поставить. Поэтому приём
# сформулирован через «что бы ни было в этой сцене» и ложится на любую основу.
# Длины полей держим у нижней границы вилки: предел промпта 10 200 знаков, и
# паспорт бренда с основой и действием уже занимают большую его часть.

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
 "разрез": {
   "как": "Design system for this frame is INDUSTRIAL CUTAWAY: whatever this scene holds is sliced along one "
          "vertical plane. Foreground: a cut edge with exposed structure, sharp at f/8. Hero: the sliced volume, "
          "floor, span and roof as one section, parts offset 40 to 120 mm along that axis on one pixel muted gold "
          "#C9A233 leaders. Background: graphite void at eight percent luminance. A 5600 K key raked fifteen "
          "degrees camera left throws hard parallel shadow bars, a 3200 K practical burns inside the section, a "
          "6500 K strip behind rims every top edge. 35 mm, f/8, 1/125, camera at 1.2 m. The headline stands on "
          "the cut slab as extruded condensed caps 60 mm deep, reading exactly, character by character, the "
          "Russian line «{заголовок}».",
   "типографика":
      "Type is an extruded object standing inside the section, sixty millimetres deep, taking the raking key on "
      "its top bevel and dropping a hard contact shadow onto the slab.",
   "знак":
      "The brand mark is a small milled plate on the cut slab, about three percent of the frame width, with its "
      "own contact shadow and the same raking light.",
 },
 "заморозка": {
   "как": "Design system for this frame is FREEZE FRAME: the strongest action this scene can hold is stopped "
          "dead. Foreground: incandescent chips arcing at the lens, the nearest three defocused into hot amber "
          "discs. Hero: the contact point at optical centre, white hot particles leaving along a tangent. "
          "Background: haze at twenty percent contrast. Frozen by 1/8000 flash duration, not shutter: a 5600 K "
          "head camera right at forty five degrees as key, a gridded 5600 K strip behind at eighty degrees "
          "rimming every wet edge, a 2900 K fill from below. Motion is trajectory, not blur: each particle keeps "
          "its shape plus a 3 mm tail. 50 mm, f/4, low angle at 0.9 m. The headline reads exactly, character by "
          "character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is heavy condensed caps flush left in the upper dead zone, lit by the burst itself, warm at "
      "its left edge and near black at its right, and razor sharp while everything flies.",
   "знак":
      "The brand mark is embossed small into the lower corner, about three percent of the frame width, picking "
      "up the same hard rim light as the particles.",
 },
 "частицы": {
   "как": "Design system for this frame is PARTICLE COMPOSITE: the scene is built from four separated depth "
          "layers. One, foreground: dust and fine filings blown into soft overlapping discs over the outer "
          "eighteen percent as a vignette of matter. Two: the hero volume in full sharpness on a clean hard edge. "
          "Three: the structure behind, dropped two stops and cooled. Four: a ground graduating from ink black "
          "#0E1116 to graphite #14171C. A 5600 K key high behind camera left, a 6000 K narrow source behind the "
          "subject haloing through the dust, a 3000 K bounce off the floor. Low density single scatter, every "
          "filing on one vector with 4 to 8 mm streaks. 85 mm, f/2.8. The headline reads exactly, character by "
          "character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is a flat condensed caps block in warm white #F5F1E8 crossed by a six percent dust overlay, "
      "so it breathes the same air as the layers instead of sitting on them.",
   "знак":
      "The brand mark is a small flat lockup in the corner, about three percent of the frame width, carrying the "
      "same faint dust pass as the headline.",
 },
 "объёмтип": {
   "как": "Design system for this frame is DIMENSIONAL TYPE: the headline itself is the physical subject and the "
          "scene is its stage. Foreground: the free edge of the first letter, cropped and defocused, its extruded "
          "side wall filling the lower third with a slow specular gradient. Hero: the full line in condensed caps "
          "extruded 180 mm with a 3 mm chamfer, standing upright on the floor of the scene with its faces "
          "vertical and square to camera, never lying flat on a table or floor, the "
          "baseline level and every letter the same height, a shallow turn showing the extruded sides. Background: haze with one distant amber practical as a "
          "bokeh point. A 5600 K softbox high camera left, a 6500 K strip skimming every vertical edge, a 3000 K "
          "kicker under the letters. 65 mm, f/4. The letters read exactly, character by character, the Russian "
          "line «{заголовок}».",
   "типографика":
      "Letter faces are warm white #F5F1E8 powder coat at roughness 0.35 under a 0.05 clearcoat, the amber "
      "#E8A400 living on the milled side walls at 0.22 and never on the faces, and every letter casts a "
      "real contact shadow.",
   "знак":
      "The brand mark stands beside the letters as a small machined plate on the same floor, about three percent "
      "of the frame width, with its own shadow.",
 },
 "макро": {
   "как": "Design system for this frame is MACRO: the smallest telling detail of this scene, shot at 1:1. "
          "Foreground: a blurred sliver of the same material entering lower right. Hero: a 30 mm band of surface "
          "in true focus, depth of field about 3 mm, machined ridges crisp at centre and dissolving within a "
          "centimetre either side. Background: the object collapsing into gradient with two speculars blooming "
          "into round bokeh discs. A 5600 K strip softbox raked at ten degrees so every tool mark casts its own "
          "micro shadow, a 3200 K low fill, a 6500 K pinpoint behind for a hot ridge rim. Milled aluminium 0.22, "
          "cured epoxy carrying subsurface light 2 mm in, oil at 0.06. 100 mm macro, f/5.6. The headline reads "
          "exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline stays off the surface as a heavy condensed caps block in warm white #F5F1E8, perfectly sharp "
      "against a field that is almost entirely out of focus.",
   "знак":
      "The brand mark is a small flat lockup in the corner, about three percent of the frame width, kept out of "
      "the shallow focus band so it never competes with the detail.",
 },
 "изометрия": {
   "как": "Design system for this frame is ISOMETRIC DIORAMA: the scene is rebuilt as a precision scale model, "
          "orthographic, camera at thirty degrees elevation and forty five degrees rotation. Foreground: the cut "
          "edge of the base, a graphite #14171C slab with a 4 mm amber #E8A400 inlay. Middle: the model on a "
          "modular grid, its blocks separated so nothing occludes anything. Background: void in ink black "
          "#0E1116, the model on one soft shadow. A 5600 K overhead area source gives clean forty five degree "
          "shadows, a 6500 K rim from the far corner cuts the silhouette out of the void, a 2800 K glow leaks "
          "from every opening. Matte resin 0.6, brushed steel 0.25, amber #E8A400 acrylic 0.15. The headline "
          "reads exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "Flat condensed caps labels sit on hairline muted gold #C9A233 leaders inside the model, while the "
      "headline stands large in the void above at frame scale, not at model scale, its baseline level.",
   "знак":
      "The brand mark is inlaid into the base slab beside the headline, about three percent of the frame width, "
      "flush with the surface and catching the overhead source.",
 },
 "двойная": {
   "как": "Design system for this frame is DOUBLE EXPOSURE: two images share one negative. Base: a hard edged "
          "silhouette, a figure in profile or the outline of a building mass, on a field graduating from warm "
          "white #F5F1E8 at the top to graphite #14171C at the bottom. Inner: the scene of this frame, visible "
          "only inside that silhouette, exposed so its highlights punch through the silhouette edge while its "
          "shadows leave that edge razor sharp. Depth comes from the inner image: near planes sharp, the far end "
          "fading into haze at fifteen percent contrast, 4000 K fixtures receding and a 5600 K daylight wedge "
          "from a distant opening. Black point 10/255. The headline reads exactly, character by character, the "
          "Russian line «{заголовок}».",
   "типографика":
      "The headline is a condensed caps block placed entirely in the empty gradient outside the silhouette, set "
      "in graphite where the field is pale, never over the inner image.",
   "знак":
      "The brand mark is a small flat lockup in the pale part of the gradient, about three percent of the frame "
      "width, well clear of the silhouette edge.",
 },
 "вырезка": {
   "как": "Design system for this frame is CUTOUT COLLAGE: hard cutouts laid over rendered depth. Plate: the "
          "scene itself, defocused to f/1.8 softness and dropped two stops, working purely as atmosphere. Middle: "
          "two or three photographic cutouts with knife sharp edges and a 2 px warm white #F5F1E8 keyline, each "
          "with its own hard drop shadow offset 12 px down and right at forty percent, so each reads as a "
          "physical layer. Foreground: a flat amber #E8A400 bar with zero texture and a 40 lpi halftone patch in "
          "muted gold #C9A233 running off one edge. Every cutout is keyed from the upper left at 5600 K, one "
          "direction for all, because that is what stops a collage looking random. The headline reads exactly, "
          "character by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is the loudest element of the layout, dense condensed caps in graphite #14171C over the amber "
      "shape, its letters overlapping the cutout edges so the layers interlock.",
   "знак":
      "The brand mark is knocked out of the flat amber shape, about four percent of the frame width, hard edged "
      "and with no shadow of its own.",
 },
 "объёмсвет": {
   "как": "Design system for this frame is VOLUMETRIC LIGHT: the air is hazed and the beam becomes an object. "
          "Foreground: a near black defocused mass filling the left quarter. Hero: the subject standing in the "
          "beam path, its top surfaces carved out in amber, its lower body descending into graphite. Background: "
          "the space receding sixty metres, contrast falling until the far plane sits at twelve percent. Haze is "
          "low and even, so a 5600 K source through a high grid resolves into three parallel shafts with clean "
          "edges. A 2900 K sodium practical deep in the scene glows as a warm point, a 6500 K narrow source "
          "behind rims the subject. Dust motes resolve at 1/60 as 5 mm streaks. 35 mm, f/2.8. The headline reads "
          "exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline sits in the darkest quadrant in muted gold #C9A233 condensed caps, outside every shaft, so "
      "the beams stay the brightest thing in the picture.",
   "знак":
      "The brand mark is a small flat lockup in the same dark quadrant, about three percent of the frame width, "
      "never inside a shaft and never on the floor pool.",
 },
 "продукт": {
   "как": "Design system for this frame is HYPERREAL PRODUCT: the key object of this scene is treated as a "
          "premium product. Foreground: a shallow pool of wet polished concrete entering the bottom eighth, "
          "defocused, carrying an inverted amber smear of the subject. Hero: the object at three quarters, sixty "
          "percent of frame height, every edge resolved. Background: a seamless sweep from graphite #14171C to "
          "ink black #0E1116 at the base. A 1.5 m 5600 K softbox overhead as key, two vertical 5600 K strips at "
          "seventy degrees for the specular runs down the flanks, a 6500 K kicker behind. Machined aluminium "
          "0.22, amber #E8A400 powder coat 0.35, rubber 0.9, glass at IOR 1.52. 100 mm, f/8, black point 6/255. "
          "The headline reads exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is a dense condensed caps lockup in warm white #F5F1E8 set into the upper right negative "
      "space, flat on the picture plane and sharp to the pixel.",
   "знак":
      "The brand mark is a small flat lockup under the headline, about three percent of the frame width, aligned "
      "to the same left edge and kept off the sweep seam.",
 },
 "сварка": {
   "как": "Design system for this frame is ARC STRIKE: one blinding point source is the only key and the whole "
          "scene lives off its spill. Whatever this scene holds, its hottest point ignites right of centre and a "
          "fan of sparks leaves it down and left at about 12 m/s across a 120 degree cone: sparks within a metre "
          "frozen as hard white hot points, sparks beyond that stretched into curved 20 mm streaks bending to the "
          "floor and fading red. Camera 1.1 m off the ground, 35 mm, f/2.8, 1/2000 s, the source 1.4 m away so "
          "its near edge is razor sharp and the far wall dissolves. The core is 6000 K blowing to white, a 3000 K "
          "fixture 6 m behind camera left rims the subject. The headline reads exactly, character by character, "
          "the Russian line «{заголовок}».",
   "типографика":
      "The headline sits inside the shadow the arc throws, heavy condensed caps in warm white #F5F1E8, its lower "
      "letters buried behind frozen sparks so the type is inside the event.",
   "знак":
      "The brand mark is small in the darkest corner, about three percent of the frame width, lit only by the "
      "cold spill of the arc and holding no colour of its own.",
 },
 "удар": {
   "как": "Design system for this frame is IMPACT: the exact millisecond something in this scene lands and stops "
          "while everything else is still moving. A ring of scale, mist and micro debris blasts outward and "
          "slightly upward from the contact line, frozen mid flight as thousands of individual specks, densest in "
          "the first 300 mm and thinning to a halo at 1.2 m. A sheet of vapour vents to one side, stretched into "
          "soft 40 mm streaks. Camera at contact height, 24 mm, f/4, 1/4000 s, 900 mm out, a seven degree tilt so "
          "the structure runs diagonally. A 5600 K panel rakes from camera right at seventy degrees to edge every "
          "particle, a low 2700 K lamp throws amber up into the debris. The headline reads exactly, character by "
          "character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is set behind the debris field as one wide uppercase line in warm white #F5F1E8, grazed "
      "at its edges by flying specks so it reads as struck while every letter stays whole, and those specks "
      "stay sharp, never blurred.",
   "знак":
      "The brand mark is small in the quiet corner away from the blast, about three percent of the frame width, "
      "clean and unhit while the rest of the frame takes the debris.",
 },
 "следы": {
   "как": "Design system for this frame is LIGHT TRAILS: twenty two seconds of exposure on a locked tripod, so "
          "everything that moved through this scene has written light instead of leaving a body. An amber beacon "
          "arc curves from the right edge into the depth, two white headlight lines sweep left to right and bend "
          "around an obstacle, the movers themselves gone or ghosted, while structure, edges and rails stay "
          "perfectly sharp. Camera 1.6 m high, 20 mm, f/11, ISO 100, 22 s. Ambient is mixed and deliberately "
          "uncorrected: 2000 K sodium on the far wall, 4000 K LED overhead, cold 6500 K spill from one opening. "
          "Wet ground doubles every trail. The headline is set flat in the dark sky above the trails, never along "
          "the road, and reads exactly, character by character, the Russian line "
          "«{заголовок}».",
   "типографика":
      "The headline stands square to camera in the dark upper part of the frame, heavy uppercase in warm white "
      "#F5F1E8, one light trail passing in front of it, and it never lies along the road.",
   "знак":
      "The brand mark sits square to camera in a lower corner, about three percent of the frame width, "
      "upright and never laid into the road perspective.",
 },
 "кинетика": {
   "как": "Design system for this frame is KINETIC TYPE: the headline is a steel object standing inside the scene "
          "while the scene moves around it. The letters are extruded 180 mm deep in brushed steel, standing on "
          "the floor upright among whatever this scene holds, their faces vertical and turned to camera, never "
          "lying flat on the ground. A figure or a moving mass passes behind them left to right, "
          "cut in half by the letterforms, its motion dragged into a 1/15 s smear while the type stays razor "
          "sharp. Dust and fine swarf drift through the counters of the letters. Camera 1.2 m high, 28 mm, f/5.6, "
          "1/15 s on a tripod, almost square to the line so the baseline stays level and only a shallow turn "
          "lets the extrusion read. A "
          "5600 K key high camera left edges the top facets, a 2700 K bounce fills the sides. The letters read "
          "exactly, character by character, the Russian line «{заголовок}».",
   "типографика":
      "The line is set in uppercase so every letter is the same height and stands on one baseline. Letter "
      "faces are warm white #F5F1E8 and the extrusion sides catch amber #E8A400, every letter throws a "
      "hard contact shadow, and nothing moving smears the type itself.",
   "знак":
      "The brand mark is a small machined plate leaning against the base of the last letter, about three percent "
      "of the frame width, sharing its shadow.",
 },
 "конвейер": {
   "как": "Design system for this frame is LONG EXPOSURE BAND: 1/6 s from a locked tripod, so one moving line "
          "through this scene dissolves into a continuous smeared band four hundred millimetres across the frame "
          "while every fixed thing stays perfectly sharp. Whatever moves here, a load, a belt, traffic, a hand, "
          "becomes liquid colour, while the structure, the panel and one person standing still at the far end "
          "remain rigid: liquid band against rigid frame is the whole image. Camera 1.4 m high, 50 mm, f/11, ISO "
          "100, the moving line running from the lower right corner to the upper left third. A row of 4000 K "
          "battens overhead plus a 3000 K practical. The headline reads exactly, character by character, the "
          "Russian line «{заголовок}».",
   "типографика":
      "The headline is locked to the sharp structure in the still zone, uppercase in warm white #F5F1E8, with a "
      "hairline rule continuing the line of movement out of the band.",
   "знак":
      "The brand mark sits on the rigid structure, about three percent of the frame width, perfectly sharp so it "
      "belongs to the still half of the picture.",
 },
 "снизу": {
   "как": "Design system for this frame is LOW ANGLE WIDE: camera on the ground, lens 220 mm above the floor, "
          "16 mm ultra wide, f/8, 1/500 s, tilted up twenty degrees. The nearest object of this scene sits 700 mm "
          "from the front element and rises out of the frame: its near edge huge and slightly soft, its verticals "
          "converging hard toward the ceiling, any person small and high in the frame. Behind it the space "
          "recedes and the roof structure fans out to the corners. Vertical lines are left uncorrected so they "
          "read as thrust, and a faint 1/500 s edge of lifted dust sits at the base. An opening camera right "
          "pushes a 5600 K wedge across the floor, 4000 K fills the depth. The headline reads exactly, character "
          "by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline sits horizontally across the upper third against the converging verticals, uppercase in "
      "warm white #F5F1E8, its first line cropped by the frame edge so it feels bigger than the picture.",
   "знак":
      "The brand mark sits low in the opposite corner at the foot of the converging verticals, about three "
      "percent of the frame width, upright.",
 },
 "взрыв": {
   "как": "Design system for this frame is PARTICLE BURST: the whole frame is built around one jet of matter "
          "leaving a single point of this scene. A dense stream of incandescent particles leaves the working "
          "point at roughly 25 m/s aimed at the lower left corner, opening from a 25 mm root into a 900 mm plume, "
          "the leading particles frozen as dots and the trailing ones stretched into 30 mm comet streaks with "
          "micro forking where they split on impact. Behind the jet a slower cloud of fine dust scatters the "
          "light. Camera 600 mm from the source, 85 mm, f/4, 1/3200 s. The stream is its own key at about 2400 K, "
          "one 5600 K rim light behind camera left separates the near edges. The headline reads exactly, "
          "character by character, the Russian line «{заголовок}».",
   "типографика":
      "The headline is one short uppercase line in the empty upper right in warm white #F5F1E8, with a few stray "
      "particles crossing in front of it, so the burst passes through the plane of the type.",
   "знак":
      "The brand mark is small in the black beyond the plume, about three percent of the frame width, lit only by "
      "the rim source so it stays a quiet grey.",
 },
 "шлейф": {
   "как": "Design system for this frame is SPEED TRAIL: a panning frame at 1/40 s from a rig 900 mm off the "
          "ground, matched to about 30 km/h. The moving mass of this scene is held sharp from its leading edge "
          "back while its tail already melts into the pan, and everything behind it, posts, lamps, structure, is "
          "dragged into clean horizontal streaks that carry the speed. Spray or dust lifts off the contact points "
          "and stretches into 60 mm comma shaped tails. Camera twelve metres out, 70 mm, f/5.6, ISO 200. A low "
          "3200 K sun rakes from behind camera left along the flank, a cool 6500 K overcast fills, and the wet "
          "ground returns both. The headline reads exactly, character by character, the Russian line "
          "«{заголовок}».",
   "типографика":
      "The headline is placed in the empty third the movement is heading into, uppercase in warm white #F5F1E8, "
      "with the same directional drag on its trailing edge only.",
   "знак":
      "The brand mark sits behind the movement in the streaked half of the frame, about three percent of the "
      "frame width, sharp against the drag.",
 },
}

# Физика кадра одна на все системы: без неё генератор возвращается к плоскому
# софтбоксу и одинаковому пластиковому материалу, из-за чего кадр и читался как
# «фон плюс текст». Числа взяты из вывода разбора DIZAJN_3D и задают минимум,
# ниже которого падать нельзя, а не описание конкретной сцены.
ФИЗИКА = ("Physics floor: two light sources at least, stated colour temperatures, different angles, never one flat "
          "wash; three materials of different roughness, concrete 0.75, brushed steel 0.25, glass 0.02; black "
          "point at 6 of 255; two overlaid effects at most.")

# Тема сама подсказывает систему. Люди, работа, ошибки и кадры цеха идут через
# экшен-системы, цифры, деньги и сравнения через объёмные 3D-системы, город,
# отрасль и площадки мира через объёмный свет, двойную экспозицию, следы и
# вырезку. На рубрику даём пару, чтобы соседние единицы одной темы не выглядели
# близнецами, и следим, чтобы каждая из девятнадцати систем попала хотя бы в
# одну пару: иначе половина набора не выйдет в ленту ни разу.
РУБРИКА_РЕЖИМ = {
    "Цифры цеха": ("изометрия", "частицы"), "Цифры отрасли": ("продукт", "объёмтип"),
    "Деньги цеха": ("разрез", "продукт"), "Цена киловатта": ("разрез", "макро"),
    "Цена ошибки": ("удар", "заморозка"), "За что дают": ("изометрия", "объёмтип"),
    "Как выбирать": ("макро", "частицы"), "Не снесут": ("двойная", "объёмсвет"),
    "Сто производств": ("конвейер", "сварка"), "Кто стоит у станка": ("сварка", "кинетика"),
    "Кадры цеха": ("заморозка", "взрыв"), "Сколько отсюда ехать": ("шлейф", "следы"),
    "Стройка будущего": ("снизу", "конвейер"), "Промышленный город": ("следы", "снизу"),
    "Площадки мира": ("изометрия", "вырезка"), "Отрасль": ("вырезка", "следы"),
    "Рынок": ("продукт", "частицы"), "Воронка": ("объёмтип", "кинетика"),
    "Событие": ("сцена", "двойная"),
}


# Сцена бывает плоской: лист карты, чертёж, счёт, договор, экран. Системы,
# которые пересобирают предмет в объём, такую сцену просто отменяют: слайду «где
# смотреть свой квартал» изометрия подставила диораму зданий вместо карты, и
# текст стал обещать то, чего в кадре нет. Для плоских сцен эти системы убираем.
# Слова подобраны узко: «letter» ловил бы «lettering», «drawing» - «drawing its
# trail», «screen» - «screening», и под запрет попадала бы половина месяца.
ПЛОСКАЯ_СЦЕНА = ("map sheet", "sheet of paper", "paper sheet", "technical drawing",
                 "drawing sheet", "printed page", "printed map", "sheet of drawing",
                 "invoice", "contract", "spreadsheet", "ledger", "printout",
                 "a document", "the document", "loose paper", "stack of paper")
БЕЗ_ПЕРЕСБОРКИ = ("изометрия", "разрез", "взрыв", "удар", "конвейер", "сварка", "снизу")
ПЛОСКИЕ_ЗАПАСНЫЕ = ("макро", "сцена", "частицы", "продукт", "объёмсвет")


def _плоская(сцена):
    н = (сцена or "").lower()
    return any(сл in н for сл in ПЛОСКАЯ_СЦЕНА)


def плоские_серии(кадры):
    """Признак плоскости решается на всю серию, а не на слайд.

    Иначе карусель разъезжается: у половины слайдов договор на столе и система
    меняется, у другой половины остаётся прежняя, и набор перестаёт читаться как
    одна вещь. Серия считается плоской, если плоских слайдов в ней хотя бы треть.
    """
    всего, плоских = {}, {}
    for к in кадры:
        осн = к["ключ"].rsplit("-", 1)[0] if к["ключ"].rsplit("-", 1)[-1].isdigit() else к["ключ"]
        всего[осн] = всего.get(осн, 0) + 1
        плоских[осн] = плоских.get(осн, 0) + (1 if _плоская(к.get("сцена", "")) else 0)
    return {о for о in всего if плоских[о] * 3 >= всего[о] and плоских[о]}


def режим(ключ, рубрика="", вид="пост", сцена="", плоская=None):
    """Систему выбираем от темы и от ключа: рубрика задаёт пару подходящих
    систем, ключ выбирает одну из них. Серия слайдов держит одну систему."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    пара = РУБРИКА_РЕЖИМ.get(рубрика)
    если_плоская = _плоская(сцена) if плоская is None else плоская
    if not пара:
        имена = [и for и in РЕЖИМЫ if not (если_плоская and и in БЕЗ_ПЕРЕСБОРКИ)]
        return имена[_ровно(осн, 11) % len(имена)]
    # Соль подобрана по трём месяцам сразу: единиц в рубрике мало, а карусель
    # тянет за собой десяток кадров, поэтому неудачная соль сваливает четверть
    # месяца в одну систему. Замер - raznoobrazie.py.
    if если_плоская:
        годные = [и for и in пара if и not in БЕЗ_ПЕРЕСБОРКИ] or list(ПЛОСКИЕ_ЗАПАСНЫЕ)
        return годные[_ровно(осн, 16) % len(годные)]
    return пара[_ровно(осн, 16) % 2]


# Одна и та же строка на последнем слайде каждой карусели превращает набор в
# шаблон, и критики поймали это первым делом: в одном кадре «СОХРАНИТЕ» стояло
# дважды, крупно в подписи слайда и мелко в подвале. Держим набор закрывающих
# строк и выбираем по ключу, пропуская ту, что повторяет слово из подписи.
ЗАКРЫВАЮЩИЕ = [
    "СОХРАНИТЕ, ЧТОБЫ НЕ ИСКАТЬ",
    "ПЕРЕШЛИТЕ ТОМУ, КОМУ ЭТО СЕЙЧАС НУЖНО",
    "ВОПРОСЫ ЗАКРЫВАЕМ ЗА ОДИН ЗВОНОК",
    "ПРИЕЗЖАЙТЕ ПОСМОТРЕТЬ СВОИМИ ГЛАЗАМИ",
    "СПРОСИТЕ ЦИФРЫ ПО СВОЕЙ ЗАДАЧЕ",
    "ОТВЕЧАЕМ В ТОТ ЖЕ РАБОЧИЙ ДЕНЬ",
    "РАЗБЕРЁМ ВАШ СЛУЧАЙ ПО ТЕЛЕФОНУ",
    "НАПИШИТЕ, ЧТО ПРОВЕРИТЬ ПЕРВЫМ",
]


def закрывающая(ключ, подпись=""):
    """Строка подвала последнего слайда: своя у каждой карусели."""
    осн = ключ.rsplit("-", 1)[0] if ключ.rsplit("-", 1)[-1].isdigit() else ключ
    годные = [с for с in ЗАКРЫВАЮЩИЕ
              if not any(сл in (подпись or "").upper() for сл in с.split()[:1])]
    годные = годные or ЗАКРЫВАЮЩИЕ
    return годные[_ровно(осн, 23) % len(годные)]


def воронка(бренд, ключ="", подпись=""):
    # Формулировка сжата: место в промпте нужнее системе кадра, чем описанию плиты
    return (f"This closing slide carries the funnel, centred at seventy nine percent down the "
            f"frame, a brushed steel plate with four countersunk screws, engraved and paint filled with the "
            f"{бренд.имя} wordmark from the attached logo file"
            # Домен на плите нужен, только если его нет в самой подписи слайда:
            # иначе адрес стоит в кадре дважды и подвал читается как ошибка вёрстки.
            + (f"; beneath it, in the accent colour at a quarter of the headline cap height, «{бренд.домен}»"
               if бренд.домен and бренд.домен.lower() not in (подпись or "").lower() else "")
            + f"; stencilled below in warm white capitals at a third of that cap height, the closing line "
              f"«{закрывающая(ключ, подпись)}».")


def поля_сторис():
    return ("This is a vertical 9:16 story frame, exactly 1080x1920 pixels, built around the platform interface: the "
            "top 250 pixels go to progress bars and the account name, the bottom 250 to the reply field, and 80 "
            "along each side are lost under the thumb. Everything meaningful lives inside the "
            "central working window of 920 by 1420 pixels, and the headline sits in the upper part of that window "
            "since a story reads higher than its middle. The headline cap height is at least eight percent of the "
            "frame width so it holds at arm's length, stepping down to no less than five percent when the "
            "line is long, and it never runs longer "
            "than five lines. The poll or question sticker is NOT drawn: the area reserved for it stays clean.")


def собрать(бренд, кадры):
    """кадры: список словарей с ключами ключ, формат, сцена, заголовок, подпись,
    и необязательными номер, всего, вид ('карусель' | 'сторис' | 'пост')."""
    промпты = {}
    плоские = плоские_серии(кадры)
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
                куски.append(f"Slide {к['номер']} of {к['всего']} of one vertical carousel. Every slide obeys the "
                             f"same system so separately generated frames read as one series: two type sizes, the "
                             f"same margins, the same grade, one accent colour. The mark sits lower left, the "
                             f"position marker lower right.")
                if к["номер"] == 1:
                    # первый слайд решает, откроют ли остальные: контраст и приглашение листать
                    куски.append("This is the cover slide and it carries the whole carousel: maximum contrast, the "
                                 "simplest typography, the number or claim in the headline the loudest element in "
                                 "frame, and a small chevron at the outer edge inviting the swipe. No other "
                                 "decoration.")
                elif к["номер"] == к["всего"]:
                    # финал зеркалит обложку: набор читается как оформленный, а не как реклама в конце
                    куски.append("This closing slide mirrors the cover: the same colour, type treatment and "
                                 "composition, so the set reads as designed rather than as an advertisement "
                                 "bolted to the end.")
        куски.append(f"The scene of this frame is {к['сцена']}.")
        # В посте и статье кадр держит действие, в карусели и историях слоистость:
        # первое даёт кино, второе даёт ленту, и путать их нельзя.
        руб = к.get("рубрика", "")
        # Основа решает, из чего вообще сделан кадр: настоящая площадка, студийный
        # свет, вырезка на сделанном фоне, сетка, предмет, диорама или метафора.
        # Референс площадки прикладываем только документальной основе.
        имя_основы, текст_основы, с_территорией = ("площадка", "", True)
        if _основа:
            имя_основы, текст_основы, с_территорией = _основа(к["ключ"], руб)
            if текст_основы:
                куски.append(текст_основы)
        # В посте и статье кадр держит действие, в карусели и историях слоистость:
        # первое даёт кино, второе даёт ленту, и путать их нельзя.
        if вид in ("карусель", "сторис"):
            куски.append(графика(к["ключ"]))
            # Обложка карусели живёт правилом «никаких украшений»: живая деталь ей
            # мешает, а место в промпте она занимает как раз там, где его нет.
            if not (вид == "карусель" and к.get("номер") == 1):
                куски.append(ОЖИВЛЕНИЕ)
        elif _эффект_среды:
            куски.append(_эффект_среды(к["ключ"], руб, к.get("сцена", "")))
        else:
            куски.append(эффект(к["ключ"]))
        куски.append(ФИЗИКА)
        _осн = к["ключ"].rsplit("-", 1)[0] if к["ключ"].rsplit("-", 1)[-1].isdigit() else к["ключ"]
        имя_режима = режим(к["ключ"], к.get("рубрика", ""), вид, к.get("сцена", ""),
                           плоская=_осн in плоские)
        р = РЕЖИМЫ[имя_режима]
        (имя_приёма, шаблон), шаблон_номера = приём(к["ключ"])
        куски.append(р["как"].format(подача=шаблон.format(к["заголовок"]),
                                     заголовок=к["заголовок"]))
        # Кадр живёт в ленте размером с ноготь. Гравировка на маленькой табличке
        # красива вблизи и пуста на превью, поэтому масштаб надписи задаём жёстко
        # и одинаково для любого приёма подачи.
        куски.append(ЧИТАЕМОСТЬ if вид == "сторис" else МАСШТАБ)
        if к.get("подпись"):
            куски.append(ПОДПИСЬ[имя_приёма].format(к["подпись"]) if имя_режима == "сцена"
                         else f"A supporting line is set small and calm under the headline in the same layout, "
                              f"reading exactly «{к['подпись']}».")
        if вид in ("карусель", "сторис"):
            метка_места = (f"{к['номер']} / {к['всего']}" if вид == "карусель" else str(к["номер"]))
            куски.append(шаблон_номера.format(метка_места) if имя_режима == "сцена"
                         else f"The position marker reads {метка_места}, small, in brand amber.")
            if к["номер"] == к["всего"]:
                куски.append(воронка(бренд, к["ключ"],
                                     к.get("заголовок", "") + " " + (к.get("подпись") or ""))
                             if вид == "карусель" else
                             f"This is the closing frame of the series, so the {бренд.имя} mark from the attached logo "
                             f"file appears once, small, at three percent of the frame width, low inside the working "
                             f"window" + (f" with «{бренд.домен}» beneath." if бренд.домен else "."))
        закрывающий = вид in ("карусель", "сторис") and к.get("номер") == к.get("всего")
        куски.append(бренд.система(к["ключ"], р["типографика"], р["знак"], с_территорией,
                                   со_знаком=not закрывающий))
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
