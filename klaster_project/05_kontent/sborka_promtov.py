# -*- coding: utf-8 -*-
"""Промпты визуала «Кластер»: собираются из плана месяца и паспорта бренда.

Паспорт взят из BRIEF_VISUAL.md дословно: амбер как единственный акцент,
графит и чернильно-чёрный на плоскостях, тёплый белый на свету, честный износ,
направленный кинематографический свет, никаких людей без нужды в масштабе.

    python3 sborka_promtov.py           # собрать и записать promts_new/gruppa_dobor.json
    python3 sborka_promtov.py --проверка # только показать длины и беды
"""
import json, re, sys, os, glob
sys.path.insert(0, "/home/user/OKO-TEAM/kontent_mesyats")
from promt_engine import Бренд, собрать, проверить

КЛАСТЕР = Бренд(
    имя="КЛАСТЕР",
    домен="CLUSTERSPACE.RU",
    палитра=("The palette is locked to five values and their gradations: amber #E8A400 as the single saturated accent "
             "and the only warm light in the frame, muted gold #C9A233 for secondary highlights on machined edges and "
             "leader lines, graphite #14171C for solid bodies, panels and shadowed metal, ink black #0E1116 for "
             "background and deep shadow, and warm white #F5F1E8 for lit planes, paper, hairlines and primary "
             "lettering. No other hue exists anywhere in the frame, including reflections, spill light, rust, dust, "
             "glass and skin. Never drift toward neon, cyberpunk, gloss, teal-and-orange film grading or a rendered "
             "look."),
    свет=("Lighting is architectural and cinematic: one hard directional key from the upper left at a shallow raking "
          "angle so every weld bead, bolt head, engraved edge and paint chip throws a long soft edged shadow down and "
          "to the right; a weak amber bounce from the lower right lifting only the deepest shadow and reading as the "
          "single source of warmth; ink black falloff in the far corner; no second key, no rim light, no lens flare, "
          "no glow, no haze machine."),
    материал=("Material honesty everywhere: mill scale on steel, oxidised bolts, chipped edge paint, concrete with "
              "form-tie marks and honest wear, factory dust settled in the recesses, tyre scuffs and old floor "
              "marking on polished concrete, crane rail worn bright by use; a working object photographed in a "
              "working place inside Moscow, never a render, stock illustration or vector layout; medium format "
              "capture, fine natural grain, deep true blacks, no plastic perfection and no showroom sheen. The space "
              "is empty of people unless a person is needed to read scale, and then only a back or a hand, never a "
              "face and never a smile."),
    шрифт=("All lettering is one dense modern grotesque with the feel of technical documentation rather than an "
           "advertising poster: wide tracked capitals in the headline, technical generously leaded setting in the "
           "caption, upright, never italic, outlined, scripted or drop-shadowed."),
    съёмка=("Cold architectural documentation photography on a digital medium format camera with a fifty millimetre "
            "equivalent lens, the camera axis perpendicular to the main surface of the scene, zero tilt, no "
            "converging verticals, no wide angle distortion, no vignette drama, no shallow bokeh and no dramatic "
            "angles."),
    референсы=(
        "The subject world is a working industrial park inside Moscow: fifty thousand square metres of production "
        "buildings, clear heights from six to twelve metres, floors rated to four thousand kilograms per square "
        "metre, five megawatts on the site and one hundred kilowatts to a single unit, an overhead crane rail "
        "running the length of the bay, two five tonne goods lifts, a separate roller gate to every block and a "
        "parking field for five hundred and fifty cars. Everything in frame must be consistent with that place: "
        "heavy structure, honest wear, real dust, cold northern daylight outside and one amber source inside. "
        "The finished frame reads at the level of a business magazine cover: composed on a strict geometric grid "
        "with generous negative space around the subject, one clear focal point, deep true blacks, eight thousand "
        "pixel sharpness across the plane of focus, commercial architectural photography quality, no illustration "
        "look, no 3d render look, no painterly texture and no artificial sharpening halo."))

# Поверхности для информационных слайдов каруселей: число живёт на реальной плоскости.
ПОВЕРХНОСТИ = [
    "a heavy brushed steel plate filling the frame edge to edge, fine machining marks catching the raking key, four "
    "countersunk screws at the corners, factory dust settled along the lower edge",
    "a poured concrete wall filling the frame, form-tie marks and honest wear across the surface, one thin amber "
    "datum hairline scribed along the lower third",
    "a folded technical drawing sheet lying flat on a graphite steel bench shot straight down from above, its printed "
    "body an unreadable grey texture with no legible word, a machined steel straightedge across the lower third",
    "a perforated facade panel of the building filling the frame, its round perforations in a strict grid, warm white "
    "light passing through from behind and pooling on the graphite frame",
    "a swept polished concrete floor shot straight down from above, old yellow floor marking half worn away, a crane "
    "rail edge crossing the upper part of the frame",
    "a matte graphite equipment cabinet door filling the frame, a milled ventilation grille along its lower edge, one "
    "amber indicator lamp unlit in the upper right",
    "a stack of mill-finish steel sheets seen edge on, filling the frame with horizontal strata of metal, the top "
    "sheet lifted a finger's width to catch the key light",
    "an empty loading gate opening seen straight on from inside the dark bay, the rectangle of the doorway filled "
    "with flat overcast daylight, rubber dock seals worn at the edges",
]

# Сцена под каждый ключ: то, что видит камера в главном кадре. Остальное собирает движок.
СЦЕНЫ = {
 # --- мероприятие с телескопом ---
 "P-500-teleskop-krysha": "a large amateur telescope on a heavy tripod standing on the flat roof of a production building at night, the parapet and roof vents in the foreground, the lit territory below and a distant city skyline on the horizon, deep clear sky above",
 "P-501-vk-teleskop": "a large amateur telescope on a tripod silhouetted against the night sky on the roof of an industrial building, warm amber light spilling from a rooftop hatch, the yard lights of the territory glowing far below",
 "P-502-stories-teleskop": "the eyepiece end of a large telescope in tight close-up against the night sky, the metal barrel catching one amber light from the side, everything beyond it falling into ink black",
 "P-503-karusel-teleskop": "a large amateur telescope on a heavy tripod on the flat roof of a production building at night, parapet edge crossing the lower part of the frame, distant city lights on the horizon under a clear dark sky",
 # --- обложки статей ---
 "P-401-dzen-moshchnost": "the open door of a workshop main switchgear cabinet seen straight on, breaker modules in a strict vertical column behind the glazed panel, bus bars and cable glands below, one amber indicator lamp unlit",
 "P-402-vc-kadry": "the hands of an older machinist resting on the cross-slide handwheel of a worn lathe, cropped tight at the wrists so no face is in frame, oil ghosting on the metal, curled steel swarf on the bed",
 "P-403-rbk-promzemlya": "an aerial view of a city at flat overcast noon showing a hard boundary where low workshop roofs and saw-tooth sheds stop and rows of housing begin, the working side occupying the near half of the frame",
 "P-404-dzen-12-voprosov": "a heavy brushed steel plate bolted to the concrete flank of a workshop beside a closed roller gate, its surface blank and lightly abraded, four countersunk screws at the corners",
 "P-405-dzen-cenovye-kategorii": "a workshop distribution board seen straight on with a row of identical breakers behind the glazed door, sealed terminal covers, cable glands entering from below, no legible markings",
 "P-406-vc-robotizacia": "a six-axis industrial robot arm at rest inside an empty production cell, safety fencing in the foreground catching the raking key, the hall behind falling into ink black",
 "P-407-dzen-tri-mesta": "a heavy machine tool strapped to a rigging skate standing on a polished concrete floor directly in front of closed goods lift doors, lifting slings coiled on the floor beside it",
 "P-408-rbk-zachem-goroda": "the flank wall and roof vents of a working production building standing directly behind a low fence, and immediately in front of it a residential courtyard, the two worlds separated by three metres",
 "P-409-dzen-transportny-byudzhet": "a semi trailer standing at a workshop gate seen straight on from inside the dark bay, yard marking running away from the camera in strict perspective, wet asphalt holding the low light",
 "P-410-dzen-shest-punktov": "a graphite steel bench shot straight down from directly above with a stapled contract on warm white paper lying on it, its printed body an unreadable grey texture with no legible word, a machined steel straightedge across the lower third",
 "P-411-vc-indeksacia": "three mill-finish steel bars of increasing height standing in a row on a polished concrete floor, evenly spaced, each casting its own long shadow toward the camera",
 "P-412-rbk-promipoteka": "six identical stamped steel tokens laid out in two rows of three on a graphite steel bench shot straight down from above, each blank, evenly spaced, edges catching the raking key",
 "P-413-dzen-priyomka": "a ring of keys and a blank acceptance form on warm white paper lying on the bare concrete floor of an empty workshop, roof light falling across them, the far end of the bay in ink black",
 "P-414-vc-zarplaty": "two mill-finish steel columns of visibly different height standing on a polished concrete floor facing each other across the frame, the taller one on the left, hard shadows raking right",
 "P-415-dzen-ohrana-truda": "a row of identical steel lockers along a workshop changing room wall shot straight on, doors closed, worn repainted metal and numbered hasps with no legible digits, one door standing open onto darkness",
 "P-416-rbk-nds-usn": "a machined steel gauge block standing upright on a graphite bench with a dial indicator resting against its face, shot straight on, the dial face blank and unreadable",
 "P-417-vc-vtoraya-ochered": "the interior of a newly built production bay still under construction, a grid of raw concrete columns receding in strict perspective, a clean poured floor, roof lights above and no equipment anywhere",
 "P-418-dzen-stroyka-za-zaborom": "a construction site hoarding running across the frame with a site traffic diagram mounted on a steel board beside a gate, its drawing an unreadable line texture, a working building visible above the hoarding",
 "P-419-rbk-vakantnost": "a long empty production hall shot straight down its centre line, columns receding in strict perspective, roof lights above, floor marking still painted for machines that are gone, the far end lost in ink black",
 "P-420-dzen-sosedi-po-stene": "two adjacent workshop gates in one long facade shot straight on, both open onto lit interiors, a shared concrete apron in front carrying tyre scuffs and a single steel trolley standing between them",
 # --- месяц 1, виральный блок ---
 "P-200-moskva-4700": "a wide Moscow industrial district seen from a high vantage point in flat overcast daylight, ranks of low factory blocks, saw-tooth roofs, rail spurs and chimney stacks receding toward a distant ring road, no billboards and no legible signage anywhere",
 "P-201-tarif-grafik": "a large folded technical drawing sheet lying flat on a graphite steel bench shot straight down from directly above, two hand-scribed lines diverging across it drawn in graphite pencil and amber paint, a machined steel straightedge and a pair of dividers resting on the lower third",
 "P-202-tokar-55": "the hands of an older machinist resting on the cross-slide handwheel of a worn lathe, cropped tight at the wrists so no face and no torso are in frame, oil ghosting on the metal, curled steel swarf on the bed",
 "P-203-29-vs-177": "two mill-finish steel bars of visibly different height standing upright side by side on a polished concrete floor, the short one on the left and the tall one on the right, their shadows raking away from the key light",
 "P-204-ota-tokio": "a narrow low-rise workshop street at dusk, roller shutters half open along both sides, one workshop doorway glowing warm with a small lathe visible inside, utility cables strung overhead, no readable shop signage",
 "P-205-promtur-ekskursiya": "a group of visitors in hard hats standing along a steel mezzanine railing seen from behind and slightly above, looking down at a working production line below, only backs and helmets in frame",
 "P-210-zavody-v-gorodah": "an industrial waterfront at first light, a working crane and a low brick production block standing directly against a dense city skyline across the water, no people, flat reflective water",
 "P-211-shest-kategoriy": "the open door of a workshop main switchgear cabinet seen straight on, six identical breaker modules stacked in one vertical column behind the glazed panel, bus bars and cable glands, one amber indicator lamp unlit",
 "P-212-tri-cifry-kadry": "three mill-finish steel bars of different heights standing in a row on a swept concrete floor, evenly spaced, each casting its own long shadow toward the camera",
 "P-206-london-sil": "an aerial view of a dense European industrial district at flat overcast noon, a hard boundary line where low workshop roofs stop and rows of housing begin, the working side occupying the near half of the frame",
 "P-207-brooklyn-navy-yard": "a working shipyard basin seen from the water at low sun, gantry cranes and long brick production sheds along the quay with a dense city skyline standing behind them, one vessel in dry dock, no readable signage",
 "P-208-vakantnost-6-15": "a long empty production hall shot straight down its centre line, columns receding in strict perspective, roof lights above, the far end lost in ink black falloff, floor marking still painted for machines that are gone",
 "P-209-promyshlenniy-okrug": "a residential courtyard in the foreground shot straight on, and directly behind it across a low fence the flank wall and roof vents of a working production building, the two worlds separated by three metres",
 # --- месяц 2, продукт и деньги ---
 "P-93-karusel-kvartal": "a cadastral plan of a city block printed on warm white paper lying flat on a graphite steel bench shot straight down from above, its parcel outlines drawn as fine hairlines with no legible text, one amber outline drawn around a single parcel, a machined steel straightedge across the lower third",
 "P-95-parkovka-550": "an empty parking field at early morning, rows of painted bays receding deep into the frame in strict perspective, wet asphalt holding the low light, the flank of a production building closing the far side",
 "P-306-karusel-shest-mer": "six identical stamped steel tokens laid out in two rows of three on a graphite steel bench shot straight down from above, each blank, evenly spaced, their edges catching the raking key",
 "P-307-karusel-chelovek-u-stanka": "a single machinist seen from behind standing at a large lathe in an otherwise empty hall, scale read by the height of the machine against the figure, no face in frame",
 "P-308-karusel-sem-strok-rashodov": "seven flat machined steel plates lying in a vertical stack with a finger's width between them on a graphite bench shot straight down from above, each plate blank, the topmost catching the key",
 "P-309-karusel-formula-stavki": "a graphite steel bench shot straight down from above with one blank warm white invoice sheet on it, its printed body an unreadable grey texture, a pocket calculator and a machined steel straightedge lying beside it",
 "P-300-1100-kreditov": "a single heavy brushed steel plate filling the frame edge to edge, four countersunk screws at the corners, fine machining marks catching the raking key light, factory dust along the lower edge",
 "P-301-liniya-poltora-mrot": "a horizontal machined steel datum bar spanning the full width of the frame at mid height, mounted a hand's width off a graphite wall so it throws a hard shadow, the wall above and below it empty",
 "P-302-svarshchik-protiv-menedzhmenta": "two mill-finish steel columns of visibly different height standing on a polished concrete floor facing each other across the frame, the taller one on the left, hard shadows raking to the right",
 "P-303-devyat-plyus-tri": "twelve identical steel blocks laid in one horizontal row on a graphite bench shot straight down from above, evenly spaced, the last three sitting slightly proud of the surface and catching more light",
 "P-304-shtraf-za-kazhdogo": "a row of identical empty steel lockers along a workshop changing room wall shot straight on, doors closed, worn paint and numbered hasps with no legible digits, one door standing open onto darkness",
 "P-305-porog-nds": "a machined steel gauge block standing upright on a graphite bench with a dial indicator resting against its face, shot straight on, the needle and dial face blank and unreadable",
 "P-120-kalendar-regulyatorika": "a wall-mounted steel planning board filling the frame, its surface ruled into a strict grid of empty cells by fine scribed hairlines, four magnetic markers parked along the lower rail",
 "P-121-razbor-nds-usn": "a graphite steel bench shot straight down from above with two blank warm white document sheets lying side by side, their printed bodies unreadable grey texture, a machined straightedge between them",
 "P-122-cifry-robotizacia": "a six-axis industrial robot arm at rest inside an empty cell, safety fencing in the foreground catching the key light, the hall behind falling into ink black",
 "P-123-instrukcia-cenovaya-kategoria": "an electricity meter and its sealed terminal cover mounted on a graphite switchboard panel shot straight on, cable glands below, the display blank and unreadable",
 "P-124-sravnenie-naym": "two identical empty workbenches standing side by side in a lit workshop bay, one with its tool board fully stocked and the other stripped bare, shot straight on",
 "P-125-mify-gospodderzhka": "a closed workshop roller shutter filling the frame, its horizontal slats worn and repainted many times, a small steel wicket door set into it standing shut",
 "P-126-istoria-kanban": "a wooden and steel card rack of the kind used on a production line, mounted on a graphite wall shot straight on, its slots holding blank warm white cards with no legible text",
 "P-127-do-posle-berezhlivoe": "one production aisle photographed straight down its centre line, cluttered with stacked pallets and part bins along both sides, roof lights above, the far end in ink black falloff",
 "P-87-vc-oblozhka-sosedstvo": "two adjacent workshop gates in one long facade shot straight on, both open onto lit interiors, a shared concrete apron in front carrying tyre scuffs and a single steel trolley standing between them",
 "P-310-vk-voronka-usloviy": "a heavy steel entrance gate to a production territory shot straight on from outside, closed, a barrier arm lowered in front of it, an empty guard window to one side",
 "P-311-vk-stanochnik-vyshe": "two mill-finish steel bars of different height standing upright on a polished concrete floor, the taller one nearer the camera, long shadows raking away from the key",
 "P-312-vk-liniya-vznosov": "a horizontal machined steel datum bar spanning the frame at one third height, mounted off a concrete wall so it throws a hard shadow, form-tie marks visible on the concrete",
}


ФОРМАТЫ = {"16:9": "16:9", "4:5": "4:5", "9:16": "9:16", "4:3": "4:3", "1:1": "1:1"}
БЕЗ_ГЕНЕРАЦИИ = {"P-05-lift", "P-11-shattl", "P-94-kvartal-karta"}


def единицы(корень):
    """Все единицы месяцев с их заголовком, слайдами и ссылкой на промпт."""
    сп = []
    пути = sorted(glob.glob(os.path.join(корень, "MESYAC_*", "NEDELYA_*.md")))
    for доп in ("REZERV.md", "SOBYTIE_KOSMOS.md"):
        if os.path.exists(os.path.join(корень, доп)): пути.append(os.path.join(корень, доп))
    for путь in пути:
        s = open(путь, encoding="utf-8").read()
        for ч in re.split(r"\n(?=## )", s):
            z = ч.split("\n")[0][3:].strip()
            if not re.match(r"(Instagram|Telegram|ВКонтакте|Дзен|vc\.ru|РБК)", z): continue
            ссылки = re.findall(r"промпт[ы]? `([^`]+)`", ч)
            if not ссылки: continue
            виз = re.search(r"Визуал: ([^\n]+)", ч)
            формат = "4:5" if "карусел" in z else ("9:16" if "истори" in z else "16:9")
            if виз:
                m = re.match(r"\s*(\d+:\d+)", виз.group(1))
                if m and m.group(1) in ФОРМАТЫ: формат = m.group(1)
            слайды = re.findall(r"^\*\*(\d+)\.\*\* ([^\n]+)\n> ([^\n]+)", ч, re.M)
            заг = re.search(r"\n\*\*(.+?)\*\*", ч)
            сп.append({"ключ": ссылки[0], "загол": z, "формат": формат, "слайды": слайды,
                       "тема": заг.group(1) if заг else "", "блок": ч})
    return сп


def кадры_единицы(е):
    """Список кадров под движок: один для поста, по слайду для карусели и серии."""
    к = е["ключ"]
    if к in БЕЗ_ГЕНЕРАЦИИ or к not in СЦЕНЫ: return []
    сцена = СЦЕНЫ[к]
    if not е["слайды"]:
        тема = е["тема"].replace("«", "").replace("»", "").strip()
        return [{"ключ": к, "формат": е["формат"], "сцена": сцена, "вид": "пост",
                 "заголовок": тема, "подпись": ""}]
    всего = len(е["слайды"])
    вид = "сторис" if "истори" in е["загол"] else "карусель"
    вышло = []
    for i, (номер, заголовок, подпись) in enumerate(е["слайды"], 1):
        поверхность = сцена if i == 1 else ПОВЕРХНОСТИ[(i - 2) % len(ПОВЕРХНОСТИ)]
        вышло.append({"ключ": f"{к}-{i:02d}", "формат": е["формат"], "сцена": поверхность,
                      "вид": вид, "номер": i, "всего": всего,
                      "заголовок": заголовок.replace(" / ", " ").strip(),
                      "подпись": подпись.strip()})
    return вышло


def главное(корень=".", писать=True):
    готовые = set()
    for ф in glob.glob(os.path.join(корень, "promts_new", "*.json")):
        if ф.endswith("gruppa_dobor.json"): continue
        готовые |= set(json.load(open(ф, encoding="utf-8")))
    кадры = []
    for е in единицы(корень):
        if any(k == е["ключ"] or k.startswith(е["ключ"] + "-") for k in готовые): continue
        кадры += кадры_единицы(е)
    промпты = собрать(КЛАСТЕР, кадры)
    длины = sorted(len(v["текст"]) for v in промпты.values())
    print(f"кадров собрано: {len(промпты)}")
    if длины:
        print(f"длина промпта: минимум {длины[0]}, медиана {длины[len(длины)//2]}, максимум {длины[-1]}")
    беды = проверить(промпты)
    print("бед:", len(беды))
    for k, b in беды[:10]: print("  ", k, b)
    if писать and промпты and not беды:
        путь = os.path.join(корень, "promts_new", "gruppa_dobor.json")
        json.dump(промпты, open(путь, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("записано:", путь)
    return промпты


if __name__ == "__main__":
    главное(".", писать="--проверка" not in sys.argv)
