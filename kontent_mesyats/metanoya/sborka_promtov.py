# -*- coding: utf-8 -*-
"""Промпты визуала МЕТАНОЙА: акварель, тёплый дом, без людей в кадре.

Детей в кадре нет по правилу проекта: согласия на съёмку нет, а рисованная
сцена работает лучше стока. Историю рассказывают предметы, свет и пространство.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from promt_engine import Бренд, собрать, проверить

METANOYA = Бренд(
    имя="МЕТАНОЙА",
    домен="METANOYA.APP",
    палитра=("The palette is warm and limited to five values and their gradations: soft amber #E8B54A for lamp light "
             "and highlights, dusty rose-beige #D9BFA6 for paper and warm surfaces, muted sage #8FA58B for plants and "
             "cloth, deep warm brown #4A3B2E for wood, outlines and shadow, and warm paper white #F7F1E6 for the "
             "ground and lit planes. No other hue exists anywhere. Never drift toward saturated cartoon colour, neon, "
             "glossy 3D render or advertising sheen."),
    свет=("Light is soft and domestic: one warm source, a window in the morning or a table lamp in the evening, gentle "
          "falloff, long quiet shadows, no hard contrast, no rim light, no flare and no glow."),
    материал=("Everything is painted in real watercolour on cold-pressed paper: visible paper grain, soft pigment "
              "edges where washes meet, granulation in the darker areas, a few pencil underdrawing lines left visible, "
              "small irregularities of a hand-painted illustration. Never a vector illustration, never a 3D render, "
              "never a digital brush with perfect edges."),
    шрифт=("Any lettering is a calm humanist sans with generous spacing, hand-placed on the object itself: painted on "
           "a wooden board, printed on a paper label, written on the page. Never a floating digital caption."),
    съёмка=("The frame is a hand-painted watercolour illustration for a children's book, composed calmly, viewed "
            "straight on or from slightly above. There are no people in the frame at all: no faces, no children, no "
            "adults, no silhouettes and no hands. The story is told by objects, light and space."))

СЦЕНЫ = {
 "P-M01-pochemu-ne-vidno":"a morning window with thin curtains moving in the draught, a glass of water on the sill catching the light, the room beyond quiet and empty",
 "P-M02-sem-fraz":"a kitchen table seen from slightly above with two mugs, one large and one small, and a folded napkin between them",
 "P-M03-pyat-minut":"a child's bedroom in the evening: a small lamp on the bedside table, a folded blanket and an open book lying face down",
 "P-M04-glava-stories":"an open illustrated book lying on a wooden table, its left page carrying a painted chapter cover and its right page a short text block rendered as soft unreadable lines",
 "P-M05-plan-zanyatiya":"a teacher's desk seen from above: a sheet with a lesson plan rendered as soft unreadable lines, a jar of pencils, a small bell and a folded cloth",
 "P-M06-mayak":"a lighthouse on a rocky shore at night, its warm beam crossing the dark water, small waves catching the light, no boats anywhere",
 "P-M07-ne-hochu":"a child's writing table with a closed book, a cup of tea gone cold and a chair pushed slightly back",
 "P-M08-akvarel-stories":"an artist's table with a watercolour sheet, a brush resting on a palette, small pools of pigment and a jar of cloudy water",
 "P-M09-kak-govorit":"a table lamp lit above an open book, two empty chairs pulled up to the table, the rest of the room in soft shadow",
 "P-M10-kuda-uhodyat":"an evening window with a lamp reflected in the dark glass, a jug of water and a single leaf on the sill",
 "P-M11-vosem-sposobov":"a stack of children's books on a bed with a bookmark sticking out of the top one, a lamp glowing beside them",
 "P-M12-proshchayut-bystree":"a playground in early morning light with two small toys left in the sand, footprints around them and nobody there",
 "P-M13-ozvuchka-stories":"a quiet recording corner: a microphone on a small stand, an open book on a music stand, a glass of water and a folded cloth",
 "P-M14-uderzhat-gruppu":"a classroom with a circle of small chairs, a candle on a low table in the middle and children's drawings pinned to the wall, the room empty",
 "P-M15-kak-sozdal-mir":"a window looking onto a courtyard in the morning, light falling across the sill, a small potted plant and an open notebook",
 "P-M16-rebenok-sovral":"a kitchen table with a broken cup, its pieces gathered together in the middle, two chairs facing each other",
 "P-M17-tri-voprosa-stories":"a bedside lamp casting a small circle of light on a blanket, a closed book beside it",
 "P-M18-metodika-uroka":"a classroom before the lesson: a circle of chairs, an open book on the teacher's table, morning light through tall windows",
 "P-M19-zachem-molitsya":"a windowsill in the evening with a lit candle and an open book beside it, the flame reflected in the dark glass",
 "P-M20-sem-istoriy":"a wooden shelf holding a few small objects that stand for stories: a smooth stone, a small boat, an oil lamp and a shepherd's crook, arranged simply",
 "P-M21-povtoryaet":"a hallway in the morning: small shoes standing neatly beside large ones, a coat hook above them, light from the doorway",
 "P-M22-prilozhenie-stories":"an open illustrated book on a wooden table with a painted chapter cover on the left page and a pencil bookmark",
 "P-M23-ne-hochet-v-shkolu":"a school yard in the morning with a small backpack left on a bench, autumn leaves on the ground, nobody around",
 "P-M24-geroi-very":"a wide sunrise over an open field with a single tall tree throwing a long shadow towards the viewer",
 "P-M25-o-dengah":"a child's money box on a table with a few coins beside it and a folded paper note, warm lamp light",
 "P-M26-svecha-stories":"a single candle burning on a wooden table, a small saucer under it, the room around it in soft shadow",
 "P-M27-vozrastnye-osobennosti":"three objects standing in a row on a shelf: a wooden toy, a school notebook and a pair of headphones, each casting its own soft shadow",
 "P-M28-esli-ya-plohoy":"a child's bed corner in the evening with a night lamp, a pillow and a soft toy sitting upright, the light very warm",
 "P-M29-devyat-veshchey":"a domestic still life on a kitchen table: a teapot, two mugs, a folded newspaper and a small jar of flowers",
 "P-M30-trista-voprosov":"a kitchen in the morning with a small chair pulled up to the table, a cup of milk and a plate with a half-eaten sandwich",
 "P-M31-posle-zanyatiya-stories":"a classroom table after the lesson: a child's drawing left on it, a pencil beside it and a chair turned outwards",
 "P-M32-ekran-i-vecher":"a child's room in the evening with a tablet lying face down on the desk and an open book beside it under a warm lamp",
 "P-M33-pochemu-korotkie":"a writing desk with a handwritten manuscript covered in pencil corrections, an eraser and a lamp above it",
 "P-M34-chto-sprosit":"a hallway with a school backpack leaning against the wall and warm light coming from the kitchen doorway",
 "P-M35-s-chego-nachat-stories":"an open book on a bed with a painted chapter cover visible, a small lamp glowing beside it",
 "P-M36-domashnee-chtenie":"a table lamp above an open book with two soft shadows on the wall behind it, the rest of the room dark and calm",
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
                кадры.append({"ключ": f"{ключ}-{int(н):02d}", "формат": формат, "вид": вид, "номер": int(н),
                              "всего": всего, "сцена": сцена,
                              "заголовок": заголовок.replace(" / ", " "), "подпись": подпись})
        else:
            кадры.append({"ключ": ключ, "формат": формат, "вид": "пост", "сцена": сцена,
                          "заголовок": е["титул"], "подпись": ""})
    return кадры


if __name__ == "__main__":
    п = собрать(METANOYA, кадры_из_плана(sys.argv[1]))
    беды = проверить(п)
    json.dump(п, open("promts.json", "w"), ensure_ascii=False, indent=1)
    дл = sorted(len(v["текст"]) for v in п.values())
    print(f"промптов {len(п)}, минимум {дл[0]}, максимум {дл[-1]}, замечаний {len(беды)}")
