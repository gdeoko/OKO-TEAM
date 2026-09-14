# -*- coding: utf-8 -*-
"""Промпты визуала МУЗМИР: свет репетиционного зала, бумага, инструмент.

Людей в кадре нет: участники это дети, и без письменного согласия их снимать
нельзя. Работают предметы, документы и пространство школы искусств.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from promt_engine import Бренд, собрать, проверить

MUZMIR = Бренд(
    имя="ПроКультура",
    домен="ПРОКУЛЬТУРА.РФ",
    палитра=("The palette is locked to five values and their gradations: deep burgundy #6E1B2B as the single accent "
             "on ribbons, seals and engraved letters, old gold #B08A3E for frames, instrument fittings and fine rules, "
             "warm ivory #F3EADA for paper, documents and lit planes, muted olive-grey #7A7A6B for cloth and shadowed "
             "walls, and dark walnut #2E2118 for wood, instrument bodies and deep shadow. No other hue exists "
             "anywhere. Never drift toward bright office colour, glossy award-site gradients or advertising sheen."),
    свет=("Light is daylight from a tall window on the left, soft and even, with a slow falloff across the room, long "
          "quiet shadows on the floor and a faint warm reflection from polished wood. No second light source, no rim "
          "light, no flare and no glow."),
    материал=("Material honesty: real paper with tooth and slight cockling, printed forms whose body text reads as a "
              "soft unreadable grey texture with no legible word, pencil marks in the margins of scores, felt of a "
              "piano hammer, rosin dust, worn varnish on an instrument, scuffed parquet, a brass music stand with "
              "fingerprints; a working school photographed as it is, never a render, stock illustration or vector "
              "layout; medium format capture, fine natural grain, deep true blacks, no plastic perfection."),
    шрифт=("Any lettering is a calm classical serif for headlines and a quiet grotesque for captions, set with "
           "generous spacing as on an official diploma, printed or engraved on the object itself. Never a floating "
           "digital caption."),
    съёмка=("Documentary still photography on a digital medium format camera with a fifty millimetre equivalent lens, "
            "camera axis perpendicular to the main surface or straight down onto the table, zero tilt, no converging "
            "verticals, no wide angle distortion and no dramatic angles. There are no people in the frame at all: no "
            "children, no adults, no hands and no silhouettes."))

СЦЕНЫ = {
 "P-Z01-pyat-let":"a teacher's desk shot straight down with a small stack of award certificates lying square on it, a closed folder beside them and a desk lamp throwing a warm pool of light",
 "P-Z02-vosem-oshibok":"a desk shot straight down with a printed application form, its body text an unreadable grey texture, a pen resting across it and a pair of glasses at the edge",
 "P-Z03-syomka-nomera":"an empty school hall with a grand piano and a phone on a small tripod set three metres away, daylight from tall windows on the left",
 "P-Z04-ocenka-stories":"a jury table with a printed score sheet, a pen and a glass of water, the hall behind it empty",
 "P-Z05-kollektivnaya-zayavka":"an administrator's desk shot straight down with a participant list table, a stamp, a folder and a stack of blank forms",
 "P-Z06-scena":"an empty concert hall stage with a grand piano and a single chair, stage light falling from above, the auditorium dark",
 "P-Z07-hochet-brosit":"a child's room corner with an upright piano, open sheet music on the stand and evening light through the window",
 "P-Z08-diplom-stories":"an award diploma lying square on a wooden table with a numbered field, a seal and a ribbon, warm daylight across it",
 "P-Z09-portfolio":"an open folder on a desk with document copies arranged in a neat overlapping row and a printed table beside them",
 "P-Z10-vygoranie":"a music classroom after lessons: an upright piano with the lid closed, sheet music left on the stand, two chairs and low evening light",
 "P-Z11-sem-priyomov":"a phone on a tripod facing an instrument in a rehearsal room, daylight from the window, the space otherwise empty",
 "P-Z12-tishe-luchshe":"a close view of grand piano keys from slightly above with sheet music on the desk above them, soft daylight",
 "P-Z13-sroki-stories":"a printed competition regulation lying on a desk with dates marked in pencil and a small calendar beside it",
 "P-Z14-skolko-stoit":"a table laid out from above with sheet music, a metronome, rosin, a spare set of strings and an instrument case corner",
 "P-Z15-kriterii":"a jury protocol sheet shot straight down with a column of score fields, a pen and reading glasses beside it",
 "P-Z16-bez-domashney":"a music notebook open on a desk with pencil markings in the margins, a metronome standing beside it",
 "P-Z17-posle-otpravki-stories":"an office desk with a printed list of applications, a rubber stamp and a tray of documents",
 "P-Z18-pervyy-instrument":"three instruments arranged in a row against a plain wall: a digital piano, a violin in its open case and a classical guitar",
 "P-Z19-medved-na-uho":"an old upright piano standing against a wall with the lid closed and a thin layer of dust on it, light from a side window",
 "P-Z20-vosem-nominaciy":"a rehearsal room table with several instrument details laid out in a row: a violin scroll, a mouthpiece, a tuning fork and a folded score",
 "P-Z21-programma-na-vyrost":"an open score of a difficult piece on a music stand with a pencil lying across the page, daylight from the left",
 "P-Z22-otchyotnost-stories":"an administrator's folder open on a desk with contracts, an act and a protocol arranged in a row",
 "P-Z23-raznye-bally":"two jury protocols lying side by side on a desk, their score columns visible as structure but the text an unreadable grey texture",
 "P-Z24-vtoroe-mesto":"a second-place diploma lying on a table beside a closed instrument case, warm daylight",
 "P-Z25-pyatnadcat-minut":"a child's practice corner with an instrument, a small timer on the lid and sheet music open on the stand, evening light",
 "P-Z26-besplatnye-stories":"a printed list of open competitions on a desk with one line marked in pencil and a stamp beside it",
 "P-Z27-kak-ustroeny-konkursy":"an organiser's desk from above: printed regulations, a protocol, a stack of diplomas and a seal",
 "P-Z28-cherez-desyat-let":"a music classroom with an upright piano and two chairs facing each other, afternoon light through the window, nobody there",
 "P-Z29-devyat-del":"a teacher's desk from above with a year folder, a calendar, a pencil, a tuning fork and a stack of blank forms",
 "P-Z30-podhodit-prepodavatel":"a music classroom with two chairs at the instrument and an open score on the stand, daylight from tall windows",
 "P-Z31-tri-zapisi-stories":"a phone on a tripod in front of an instrument with a wall calendar behind it carrying two pencil marks",
 "P-Z32-otchyot-uchreditelyu":"an annual report folder open on a desk with a printed table and a stack of protocols beside it",
 "P-Z33-pervye-15-sekund":"a jury workplace: a screen showing a paused video frame rendered as a dark rectangle, headphones resting beside it and a score sheet",
 "P-Z34-klass-iz-20":"a school hall prepared for a recording day: one tripod, one chair at the instrument and a clipboard with a list on a side table",
 "P-Z35-zayavka-stories":"a desk with a filled application form, a pen and an open laptop shown as a plain closed rectangle without any screen content",
 "P-Z36-godovoy-plan":"a wall calendar of the school year with pencil marks on several months, sheet music and a folder on the desk beneath it",
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
    п = собрать(MUZMIR, кадры_из_плана(sys.argv[1]))
    беды = проверить(п)
    json.dump(п, open("promts.json", "w"), ensure_ascii=False, indent=1)
    дл = sorted(len(v["текст"]) for v in п.values())
    print(f"промптов {len(п)}, минимум {дл[0]}, максимум {дл[-1]}, замечаний {len(беды)}")
