# -*- coding: utf-8 -*-
"""Промпты визуала TAPPIO: предметная съёмка вокруг телефона.

Экраны в кадре всегда выключены: интерфейс, нарисованный моделью, выглядит
подделкой и устаревает с первым обновлением системы. Работают предметы, свет и
надписи на физических поверхностях.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from promt_engine import Бренд, собрать, проверить

TAPPIO = Бренд(
    имя="TAPPIO",
    домен="TAPPIO.APP",
    палитра=("The palette is locked to five values and their gradations: electric blue #2F6BFF as the single accent on "
             "engraved letters and thin rules, cool graphite #23262B for device bodies and shadowed metal, soft "
             "aluminium #C9CDD2 for brushed surfaces, near black #0C0E11 for background and deep shadow, and cool "
             "white #F2F4F7 for paper and lit planes. No other hue exists anywhere. Never drift toward neon gradients, "
             "rainbow reflections or advertising gloss."),
    свет=("Light is a single soft studio source from the upper left with a large diffusion: a clean highlight along "
          "one edge of every object, gentle falloff, soft grounded shadows on the surface, one weak fill from the "
          "lower right, no rim light, no flare and no glow."),
    материал=("Material honesty: brushed aluminium with fine machining lines and real fingerprints, glass with dust "
              "specks, a braided cable with memory of its coil, paper with tooth and a pencil mark, a desk surface "
              "with light scuffs; real objects photographed on a real desk, never a render, stock illustration or "
              "vector layout; medium format capture, fine natural grain, deep true blacks, no plastic perfection."),
    шрифт=("Any lettering is a precise modern grotesque with wide tracking, engraved into a brushed metal plate or "
           "printed on paper lying in the scene, never a floating digital caption."),
    съёмка=("Product-documentary still photography on a digital medium format camera with a fifty millimetre "
            "equivalent lens, shot straight down onto the desk or perpendicular to a flat surface, zero tilt, no wide "
            "angle distortion and no dramatic angles. There are no people in the frame: no faces, no hands and no "
            "silhouettes. Every phone, tablet or laptop in the scene is switched off and shown as a plain dark "
            "rectangle with no interface, no icons, no text and no reflection of a screen."))

СЦЕНЫ = {
 "P-T01-batareya":"a phone lying face down on a graphite desk beside a coiled braided charging cable and a small power adapter, the surface otherwise empty",
 "P-T02-vosem-funkciy":"a phone lying face down on a clean desk with a brushed metal plate beside it, everything squared to the frame",
 "P-T03-pamyat":"a phone face down on a desk beside a short stack of memory cards and a small metal tray",
 "P-T04-zhesty-stories":"a phone face down on a desk with a printed keyboard diagram on paper lying next to it",
 "P-T05-privatnost":"a phone face down on a desk beside a small bunch of keys and a folded sheet of paper",
 "P-T06-skrytye-funkcii":"a desk from above with a phone face down, a magnifier, a folding ruler and a small notebook arranged in a row",
 "P-T07-syomka":"a phone mounted on a small tripod on a desk near a window, its screen dark, soft daylight from the left",
 "P-T08-proverka-stories":"a phone face down on a desk beside a portable drive and a bunch of keys",
 "P-T09-nastroyka-gid":"a new phone lying in its open box on a desk with a cable and a small notebook beside it",
 "P-T10-klaviatura":"a desk with a phone face down and a printed keyboard layout sheet beside it, a pencil resting across the paper",
 "P-T11-sem-nastroek":"a phone face down on a desk beside a closed notebook and a pen, the desk otherwise clear",
 "P-T12-avtomatizacii":"a desk with a phone face down and a hand-drawn flow diagram on paper beside it, boxes and arrows in pencil",
 "P-T13-set-stories":"a desk with a phone face down beside a small router and a network cable coiled loosely",
 "P-T14-perenos":"two phones lying face down side by side on a desk with a cable between them",
 "P-T15-uvedomleniya":"a phone face down on a desk beside an open notebook with a short pencil list",
 "P-T16-ustarevshie-sovety":"a desk with a phone face down and an old worn charging cable beside it, coiled",
 "P-T17-fotoarhiv-stories":"a desk with a small stack of printed photographs face down and a phone face down beside them",
 "P-T18-ekrannoe-vremya":"a bedside table with a phone lying face down and a closed book beside it, low evening light",
 "P-T19-podpiski":"a desk from above with a phone face down and a printed bank statement lying beside it, its text an unreadable grey texture",
 "P-T20-vosem-nastroek-poezdka":"a desk from above with a phone face down, a passport, folded printed tickets and a luggage tag",
 "P-T21-semeynyy-dostup":"several phones of different sizes lying face down in a row on a desk, evenly spaced",
 "P-T22-son-stories":"a bedside table with a phone face down, a small alarm clock and a glass of water, dim light",
 "P-T23-telefon-rebenku":"a desk with a phone face down beside a school backpack strap and a pencil case",
 "P-T24-zametki":"a desk from above with a phone face down beside a stack of documents and a pen",
 "P-T25-icloud":"a desk with a phone face down beside a portable external drive and a short cable",
 "P-T26-ekran-stories":"a desk with a phone face down and three small blank cards arranged in a row beside it",
 "P-T27-bezopasnost-gid":"a desk from above with a phone face down, a bunch of keys and a closed notebook, a metal plate at the edge",
 "P-T28-napominaniya":"a desk with a phone face down beside a paper to-do list with three pencil-marked lines",
 "P-T29-devyat-nastroek":"a desk from above with a phone face down and a small object placed beside it, everything squared and evenly lit",
 "P-T30-obnovlyatsya":"a phone face down on a desk connected to a charging cable, the adapter plugged into a socket strip beside it",
 "P-T31-produkt-stories":"a desk with a phone face down and a blank printed form beside it, a pen resting on the paper",
 "P-T32-fayly":"a desk from above with a phone face down and several paper folders fanned out beside it",
 "P-T33-kamera-priyomy":"a phone on a small tripod on a desk with an optics cleaning cloth folded beside it, screen dark",
 "P-T34-shablon-produkt":"a blank printed form on a desk with its blocks marked out in pencil and a pen lying across it",
 "P-T35-itogi-stories":"a desk from above with a phone face down and a wall calendar page beside it carrying one pencil mark",
 "P-T36-rabochiy-instrument":"a morning desk with a phone face down, a notebook and a cup, soft daylight from the left",
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
    п = собрать(TAPPIO, кадры_из_плана(sys.argv[1]))
    json.dump(п, open("promts.json", "w"), ensure_ascii=False, indent=1)
    дл = sorted(len(v["текст"]) for v in п.values())
    print(f"промптов {len(п)}, минимум {дл[0]}, максимум {дл[-1]}, замечаний {len(проверить(п))}")
