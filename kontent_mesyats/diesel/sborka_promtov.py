# -*- coding: utf-8 -*-
"""Промпты визуала DIESEL: собираются из плана месяца и паспорта бренда.

Палитра предварительная, до подтверждения бренд-паспорта клиентом: графит,
промышленный оранжевый и тёплый белый. Это цвет техники и порта, он честно
ложится на нишу и не спорит с фотографией.
"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from promt_engine import Бренд, собрать, проверить

DIESEL = Бренд(
    имя="DIESEL",
    домен="DIESELCOMPANY.PRO",
    палитра=("The palette is locked to five values and their gradations: industrial orange #FF6A00 as the single "
             "saturated accent, muted brass #B8752A for secondary highlights on machined edges and leader lines, "
             "graphite #1A1D21 for solid bodies and shadowed metal, ink black #0B0D10 for background and deep shadow, "
             "and cold white #EEF1F4 for lit planes, paper, hairlines and primary lettering. No other hue exists "
             "anywhere, including reflections, spill light, rust, dust, glass and skin. Never drift toward neon, "
             "cyberpunk, gloss or a teal and orange film look."),
    свет=("Lighting is documentary and industrial: one hard directional key from the upper left at a shallow raking "
          "angle so every weld bead, bolt head, engraved edge and paint chip throws a long soft edged shadow down and "
          "right; a weak brass bounce from the lower right lifting only the deepest shadow; an ink black falloff in "
          "the far corner; no second key, no rim light, no flare, no glow."),
    материал=("Material honesty everywhere: mill scale on steel, oxidised bolts, chipped edge paint, factory dust in "
              "the recesses, tyre scuffs on concrete, container corrugation with real dents and weld seams, machine "
              "oil ghosting on metal; a working object photographed in a working place, never a render, stock "
              "illustration or vector layout; medium format capture, fine natural grain, deep true blacks, no plastic "
              "perfection, no showroom sheen."),
    шрифт=("All lettering is one dense modern condensed grotesque with the feel of shipping documentation, wide "
           "tracked capitals in the headline and technical, generously leaded setting in the caption, upright, never "
           "italic, outlined or scripted."),
    съёмка=("Cold technical documentation photography on a digital medium format camera with a fifty millimetre "
            "equivalent lens, camera axis perpendicular to the main surface of the scene, zero tilt, no converging "
            "verticals, no wide angle distortion, no vignette drama, no shallow bokeh and no dramatic angles."))

# сцена под каждый ключ: то, что видит камера. Всё остальное собирает движок.
СЦЕНЫ = {
 "P-D01-cena-dvazhdy": "two identical quad bikes standing side by side in a dark unlit warehouse bay, a heavy steel partition between them, the concrete floor carrying tyre scuffs and old paint marking, both machines completely clean of any brand badge",
 "P-D02-sem-oshibok": "the corrugated end wall of a shipping container filling the frame, its ribs vertical, real dents, weld seams and factory dust on the paint, one lashing ring bolted low",
 "P-D03-utilsbor": "a graphite steel desk shot straight down from directly above with one customs declaration form on cold white paper lying on it, its printed body an unreadable grey texture with no legible word, a machined steel straightedge across the lower third and a graphite pencil resting against it",
 "P-D04-konteyner-stories": "a forty foot container standing closed on a terminal apron with its seal in place, the corrugation catching raking light, an empty concrete yard around it",
 "P-D05-chetyre-zadachi": "four quad bikes standing in a row on a swept concrete floor of an empty hangar, evenly spaced, each on its own shadow, all badges blank",
 "P-D06-pyat-shagov": "five flat machined steel plates lying in a row on a graphite steel bench, each bolted at both ends with a single hex screw, a port gantry crane visible far behind through an open gate",
 "P-D07-chuncin": "a wide industrial river city in heavy morning fog seen from a high vantage point, ranks of factory blocks and chimneys receding into the haze, a bridge silhouette crossing the water",
 "P-D08-proverka-stories": "the inside of an assembly shop with one machine frame on a steel trestle, hand tools laid out on a bench beside it, the line empty of people",
 "P-D09-shest-strok": "six flat machined steel bars lying parallel across a graphite steel surface like the rows of an invoice, each bolted at both ends, one of them filled flat with industrial orange paint",
 "P-D10-kalendar-sezona": "a calendar grid stamped into a large steel sheet bolted to a workshop wall, its cells shallow milled, two of them struck through with orange paint",
 "P-D11-vosem-shagov": "an assembly shop seen straight on with a row of identical machine frames on trestles receding into the depth, tool boards on the wall, the line empty of people",
 "P-D12-surron": "a lightweight electric enduro motorcycle standing alone on a forest dirt track, its tyre print visible behind it, low sun raking through trunks, no rider anywhere",
 "P-D13-port-stories": "a container terminal at dusk, stacks of containers in rows, a gantry crane spanning them, an empty apron in the foreground",
 "P-D14-belyy-i-kargo": "two rubber stamps lying on two sheets of shipping paperwork on a graphite desk shot from directly above, one sheet carrying a crisp ink impression and the other left blank",
 "P-D15-kontrakt": "a contract on cold white paper lying on a graphite steel desk under a sheet of heavy plate glass, its printed body an unreadable grey texture, five steel bookmarks clipped along its edge",
 "P-D16-razvalitsya": "an extreme close view of a welded tube frame joint on a machine, the weld bead honest and slightly uneven, mill scale and grinding marks visible, a serial plate riveted beside it with its numbers blank",
 "P-D17-inspekciya-stories": "a factory acceptance area with one machine standing on a marked floor square, an inspection table with paperwork beside it, the space empty of people",
 "P-D18-vybor-modeli": "four quad bikes standing in a row in a dark hangar, each lit by its own pool of light, blank badges, swept concrete floor",
 "P-D19-2400": "a wall of stacked shipping containers filling the frame, the nearest one square to the camera, corrugation and honest dents catching the raking light",
 "P-D20-sem-priznakov": "an empty bonded warehouse with a marked floor grid, a single wooden pallet in the middle distance and roller shutter doors closed along the far wall",
 "P-D21-gidrocikl": "a personal watercraft standing on its trailer inside an empty hangar, water long dried off the hull, the concrete floor carrying old marking paint",
 "P-D22-stanok-stories": "a CNC machining centre standing in a workshop bay, its doors closed, swarf swept into a pile beside it, the space empty of people",
 "P-D23-oborudovanie": "a large CNC machining centre seen straight on in a workshop, its control panel dark, coolant lines and cable trays running above, the floor marked with machine outlines",
 "P-D24-sroki": "a shipping schedule board of enamelled steel bolted to a wall, its slots holding blank metal tags, four of them struck with orange paint",
 "P-D25-prokat": "four quad bikes parked in a row on a gravel apron of a countryside base, a wooden fence line behind them, low evening light, no people",
 "P-D26-voprosy-stories": "a sealed container door photographed square on, its locking bars, hinges and seal in sharp relief",
 "P-D27-razbor-rynka": "shipping documents, a contract and a steel rule laid out in a strict grid on a graphite desk shot from directly above, printed bodies an unreadable grey texture",
 "P-D28-shilditki": "an assembly line inside a factory with a row of identical bare machine frames hanging on the conveyor, no badges and no logos anywhere, the line empty of people",
 "P-D29-desyat-voprosov": "the corrugated side of a shipping container filling the frame, a row of blank steel tags wired to its lashing rings",
 "P-D30-odna-postavka": "a quad bike standing on a dirt track at the edge of a harvested field, tyre prints behind it, low sun, no people",
 "P-D31-dokumenty-stories": "a machine standing under a tarpaulin in a yard, its outline visible through the fabric, the concrete around it empty",
 "P-D32-zapchasti": "a steel shelving rack holding spare parts in labelled bins with blank labels, a set of hand tools laid out on the bench in front of it",
 "P-D33-partiya": "an open forty foot container photographed square on from behind, four quad bikes lashed inside in two rows, the lashing straps tensioned",
 "P-D34-deshevle": "two invoices of different length lying side by side on a graphite steel desk shot from directly above, both printed bodies an unreadable grey texture",
 "P-D35-voronka-stories": "a sealed container standing on an empty terminal apron, its number plate area blank, raking light across the corrugation",
 "P-D36-polnyy-gid": "eight flat machined steel plates laid out in two rows on a graphite steel bench, each bolted with a single hex screw, a steel rule lying across them",
}


def кадры_из_плана(путь_json):
    план = json.load(open(путь_json, encoding="utf-8"))
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
    к = кадры_из_плана(sys.argv[1])
    п = собрать(DIESEL, к)
    беды = проверить(п)
    json.dump(п, open("promts.json", "w"), ensure_ascii=False, indent=1)
    дл = sorted(len(v["текст"]) for v in п.values())
    print(f"промптов {len(п)}, минимум {дл[0]}, максимум {дл[-1]}, замечаний {len(беды)}")
    for k, б in беды[:5]: print("  ", k, б)
