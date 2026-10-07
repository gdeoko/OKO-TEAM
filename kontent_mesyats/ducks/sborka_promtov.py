# -*- coding: utf-8 -*-
"""Промпты визуала DUCK'S GAME SPACE.

Мир кадра: вечерний клуб, приглушённый направленный свет, сукно, латунь и
дерево. Людей в кадре нет: снимаем предметы и пространство, чтобы визуал не
устаревал и не требовал релизов от гостей.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from promt_engine import Бренд, собрать, проверить

DUCKS = Бренд(
    имя="DUCK'S",
    домен="DUCKS.CLUB",
    палитра=("The palette is locked to five values and their gradations: brass #C9A227 as the single warm accent on "
             "metal edges, chip rims and engraved letters, deep table green #14342A for the baize, graphite #1C1F23 "
             "for wood, leather and shadowed surfaces, ink black #0B0C0E for the room beyond the light, and warm "
             "white #F2EFE9 for card faces, lit planes and primary lettering. No other hue exists anywhere, including "
             "reflections, spill light and glass. Never drift toward casino neon, red felt, gold glitter or "
             "advertising gloss."),
    свет=("Lighting is a single low pendant lamp hanging over the table: a hard warm pool of light on the playing "
          "surface, fast falloff into ink black beyond its edge, long soft shadows from every chip and card, one weak "
          "brass bounce from polished metal, no second lamp, no rim light, no flare and no glow."),
    материал=("Material honesty: baize with real nap and a worn patch where hands rest, chips with milled edges and "
              "small chips of paint missing, playing cards with slightly softened corners, brushed brass with "
              "fingerprints, oiled wood with scratches, a dartboard with sisal fibre visible and old holes; a working "
              "club photographed as it is, never a render, stock illustration or vector layout; medium format capture, "
              "fine natural grain, deep true blacks, no plastic perfection."),
    шрифт=("All lettering is one dense modern condensed grotesque with the feel of a tournament board, wide tracked "
           "capitals in the headline and technical setting in the caption, upright, never italic, outlined or scripted."),
    съёмка=("Cinematic still photography on a digital medium format camera with a fifty millimetre equivalent lens, "
            "camera axis perpendicular to the main surface or straight down onto the table, zero tilt, no converging "
            "verticals, no wide angle distortion and no dramatic angles. There are no people in the frame at all: no "
            "hands, no faces, no silhouettes."))

СЦЕНЫ = {
 "P-K01-ruki-govoryat": "a poker table shot straight down from directly above, its green baize filling the frame, nine playing positions marked by chip stacks of different heights, two face-down cards at each seat and a dealer button in place, the room beyond the light pool completely black",
 "P-K02-pervyy-vecher": "a corner of the club table under the pendant lamp with a printed hand-ranking card lying on the baize, a stack of chips beside it and a glass of water leaving a ring on the wood rail",
 "P-K03-tri-drotika": "a sisal dartboard photographed square on and filling the frame, three darts grouped in one sector, old puncture marks across the surface, the wall around it in deep shadow",
 "P-K04-chetverg-stories": "an empty poker table under its pendant lamp before the evening starts, baize swept, chips racked, cards squared in the middle",
 "P-K05-trenazher-resheniy": "a poker table shot straight down with five community cards face up in a row, two face-down cards at one seat and unequal chip stacks around them",
 "P-K06-chetyre-formata": "four separate playing tables in one dark hall, each under its own pendant lamp, the pools of light not touching each other, the space between them black",
 "P-K07-bez-kalyana": "the club hall photographed straight on with completely clear air, the light beams from the pendant lamps clean and free of any smoke or haze, tables and chairs in their evening arrangement",
 "P-K08-reyting-stories": "a leaderboard panel of brushed metal mounted on the club wall, its rows milled into the surface with blank name slots, brass edging along the frame",
 "P-K09-igry-vernulis": "a wide view of the club hall in the evening: a poker table under its lamp in the foreground, a dartboard lit on the far wall, a billiard table in the middle distance, all empty",
 "P-K10-tilt": "a knocked-over stack of chips scattered across the baize, one chip standing on its edge against the others, the rest of the table in shadow",
 "P-K11-kombinacii": "a poker table shot straight down with a single hand of cards laid face up in a neat row on the baize, a small stack of chips beside it",
 "P-K12-kto-za-stolom": "a poker table shot straight down from above with nine seats marked, each with its own chip stack of different height and its own way of stacking, all seats empty",
 "P-K13-brosok-stories": "a dartboard on the wall with three darts in it, a chalk scoreboard beside it with blank surface, a spotlight throwing the shadow of the darts across the sisal",
 "P-K14-korporativ": "three playing tables arranged for a group evening in one hall, each under its own lamp, chairs pulled slightly out, the room otherwise empty and dark",
 "P-K15-horoshaya-ruka": "a poker table shot straight down with three community cards of the same suit face up in a row, one folded hand face down at the edge and a large stack of chips pushed forward",
 "P-K16-chetyre-zanyatiya": "one wide frame of the club divided by light into four zones: the poker table in the foreground, the dartboard glowing on the far wall, the billiard table between them and the bar counter at the edge, all empty",
 "P-K17-prishel-odin-stories": "the entrance area of the club seen straight on: a coat rail, a low bench, a doorway leading into the dark hall with one lit table visible beyond it",
 "P-K18-navyk-resheniy": "a poker table shot straight down with cards and chips arranged like a diagram: two hole cards, five community cards in a row and three chip stacks of clearly different heights",
 "P-K19-blef": "a corner of the poker table under the lamp with two face-down cards at the rail and one tall stack of chips pushed into the centre, the seat itself empty and dark",
 "P-K20-etiket": "a close view of the table edge with a dealer button, a stack of chips, a folded hand face down and a service call chip, all lying in their proper positions on the baize",
 "P-K21-troynaya-dvadcatka": "an extreme close view of the treble twenty segment of a sisal dartboard, wire and fibre in sharp relief, one dart embedded in it, the rest of the board falling into shadow",
 "P-K22-bounty-stories": "a poker table with tall chip stacks pushed towards the centre and several small bounty markers of brushed brass lying beside them",
 "P-K23-vecher-bez-lenty": "a poker table shot straight down with cards and chips in play and one phone lying face down on the wooden rail at the edge, its screen invisible",
 "P-K24-reyting": "a brushed metal leaderboard panel on the club wall photographed square on, milled rows with blank slots, a brass frame and a small hook for the marker",
 "P-K25-ladies-night": "a poker table under a slightly softer pendant lamp, cards squared in the middle, chips racked evenly, a single tall glass on the rail leaving a ring on the wood",
 "P-K26-kuhnya-stories": "the club before opening: chip trays lined up on a service table, card decks still sealed, a dealer tray and a stack of blank tournament sheets",
 "P-K27-pokernyy-bum": "a wide evening view of the hall with several tables under their lamps, the pools of light separated by darkness, the room empty and ready",
 "P-K28-stanciya": "a poker table shot straight down at showdown: two hands face up at opposite seats, five community cards in a row and a large pot of chips gathered in the centre",
 "P-K29-devyat-oshibok": "a poker table shot straight down with cards and chips arranged in a strict grid like a study diagram, each group separated by empty baize",
 "P-K30-vecher-pomnitsya": "the hall late in the evening: one table still lit under its lamp with chips scattered mid-game, the rest of the room dark",
 "P-K31-bilyard-stories": "a billiard table under its own long lamp, balls racked and one cue lying across the cloth, the room beyond in shadow",
 "P-K32-turnir-na-20": "three playing tables in one hall with the central one lit brighter than the others, chairs arranged around it, the outer tables in half shadow",
 "P-K33-nevozvratnye": "a poker table close view with one folded hand face down beside a half-used stack of chips, the pot in the centre out of focus depth but still readable",
 "P-K34-dlya-svoih": "the club hall in warm evening light with tables set, chairs slightly turned as if people had just stepped away, everything empty",
 "P-K35-zapis-stories": "the club entrance seen straight on with a brushed metal plate beside the door and a low lamp above it, the hall dark beyond",
 "P-K36-pervyy-vecher-gid": "a poker table under the pendant lamp with a hand-ranking card, a chip stack, a dealer button and a deck squared in the middle, everything arranged as before a first game",
}


def кадры_из_плана(путь):
    план = json.load(open(путь, encoding="utf-8"))
    кадры = []
    for е in план:
        ключ = е["промпт"]
        if not ключ: continue
        формат = е["визуал"].split("·")[0].strip()
        сцена = СЦЕНЫ.get(ключ)
        if not сцена: raise SystemExit("нет сцены для " + ключ)
        if е["слайды"]:
            вид = "сторис" if "истори" in е["загол"] else "карусель"
            всего = len(е["слайды"])
            for н, заголовок, подпись in е["слайды"]:
                кадры.append({"ключ": f"{ключ}-{int(н):02d}", "формат": формат, "вид": вид,
                              "номер": int(н), "всего": всего, "сцена": сцена,
                              "заголовок": заголовок.replace(" / ", " "), "подпись": подпись})
        else:
            кадры.append({"ключ": ключ, "формат": формат, "вид": "пост",
                          "сцена": сцена, "заголовок": е["титул"], "подпись": ""})
    return кадры


if __name__ == "__main__":
    п = собрать(DUCKS, кадры_из_плана(sys.argv[1]))
    беды = проверить(п)
    json.dump(п, open("promts.json", "w"), ensure_ascii=False, indent=1)
    дл = sorted(len(v["текст"]) for v in п.values())
    print(f"промптов {len(п)}, минимум {дл[0]}, максимум {дл[-1]}, замечаний {len(беды)}")
    for k, б in беды[:5]: print("  ", k, б)
