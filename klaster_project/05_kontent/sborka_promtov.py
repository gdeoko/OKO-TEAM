# -*- coding: utf-8 -*-
"""Промпты визуала «Кластер»: собираются из плана месяца и паспорта бренда.

Паспорт: амбер единственный акцент, графит и чернильно-чёрный на плоскостях,
тёплый белый на свету, честный износ, кинематографический объёмный свет.
С 27.08.2026 кадр строится как ключевой кадр кампании: четыре плана глубины,
действие в кадре, работающие люди, ракурс и оптика выбираются под сюжет.

    python3 sborka_promtov.py           # собрать и записать promts_new/gruppa_dobor.json
    python3 sborka_promtov.py --проверка # только показать длины и беды
"""
import json, re, sys, os, glob, hashlib
sys.path.insert(0, "/home/user/OKO-TEAM/kontent_mesyats")
from promt_engine import Бренд, собрать, проверить

КЛАСТЕР = Бренд(
    имя="КЛАСТЕР",
    домен="CLUSTERSPACE.RU",  # сайт живёт на нём с 14.08.2026

    палитра=("The palette is locked to five values and their gradations: amber #E8A400 as the single saturated accent "
             "and the only warm light, muted gold #C9A233 for secondary highlights on machined edges, graphite "
             "#14171C for solid bodies and shadowed metal, ink black #0E1116 for background and deep shadow, warm "
             "white #F5F1E8 for lit planes and primary lettering. No other hue exists anywhere, reflections, spill "
             "light, dust, glass and skin included: every glow, spark, flame, hot metal, lamp and light trail is "
             "amber or gold, every cool value is graphite, ink or warm white, so the picture can be as loud as it "
             "likes and still read as this brand at a glance. Grade it rich and contrasty like a campaign frame: "
             "crushed true blacks, amber highlights allowed to bloom and flare on the lens, haze carrying the "
             "accent colour through the air. Never neon purple, cyberpunk teal, candy gradients or the cold "
             "teal-and-orange stock grade."),
    свет=("Lighting is cinematic and volumetric, at the level of a commercial architecture shoot: one hard "
          "directional key from the upper left at a shallow raking angle carves every weld bead, bolt head, "
          "engraved edge and paint chip into relief and throws long soft edged shadows down and to the right; the "
          "beam itself reads as a visible shaft of light with fine airborne dust and a faint haze drifting through "
          "it, so the air in the room has body; a warm amber bounce from the lower right lifts the deepest shadow "
          "and reads as the single source of heat in a cold space; a thin cool rim separates the subject from an "
          "ink black falloff behind it; wet concrete and polished metal carry soft mirrored reflections of the "
          "amber source. Deep three dimensional separation between foreground, subject and background: something "
          "real sits in the near plane close to camera and out of focus, the subject is carved out by the key, the "
          "background falls away into black. The air itself is lit: haze, dust, steam and smoke catch the beam and "
          "give the room body, and where a hot source is in shot it blooms and throws a soft anamorphic streak. "
          "No flat frontal light and no even fill anywhere."),
    материал=("Material honesty everywhere: mill scale on steel, oxidised bolts, chipped edge paint, concrete with "
              "form-tie marks and honest wear, factory dust in the recesses, tyre scuffs on polished concrete, "
              "crane rail worn bright by use. No plastic perfection and no showroom sheen. People belong here and "
              "carry the action: a welder behind the shield with the arc lighting his visor, hands on a control "
              "panel, a driver stepping down from the cab, a shift crossing the apron in the rain. Faces are "
              "allowed when the face is the moment, caught mid work, never posed, never smiling at the camera, "
              "never a stock portrait. Clothing is real workwear with wear on it."),
    шрифт=("All lettering is one dense modern grotesque: wide tracked capitals in the headline, generously leaded "
           "technical setting in the caption, upright, never italic, outlined, scripted or drop-shadowed. Letters "
           "have real physical depth and catch the key light on their lit edge. The headline is the largest object "
           "in the frame after the subject and is composed into the architecture, aligned to a panel joint, a floor "
           "marking or the edge of a steel plate, so removing it would leave a hole in the composition."),
    съёмка=("Shot like a campaign frame, never like a survey photograph: the camera stands where the scene is most "
            "powerful and takes the angle that gives the subject mass, low to the ground looking up, or a hard "
            "three quarter diagonal, or a long lens stacking the depth into planes. Focal length is chosen for the "
            "shot: twenty four millimetres from close range to make the foreground loom, fifty for a straight "
            "confident read, a hundred and thirty five to compress and isolate. Aperture is deliberate: f/1.8 snaps "
            "the subject out of a dissolving background, f/11 holds the whole depth. Shutter is part of the "
            "picture: a thousandth freezes particles in mid air, half a second lets a moving light draw its trail. "
            "Anamorphic character welcome: horizontal flare off amber sources, oval bokeh. Full frame capture, "
            "eight thousand pixels of detail in the plane of focus, fine grain in the shadows."),
    # Территория подставляется только тем кадрам, где площадка и есть предмет
    # разговора. Владелец 27.08.2026: «не всегда референс равно фон визуала».
    # Кадру про счёт, про деталь или про идею настоящий двор не нужен, ему нужен
    # свой мир, и от одинакового фона как раз и берётся ощущение конвейера.
    территория=(
        "Photographs of the real site are attached and they are binding, not inspiration. This is a working "
        "industrial park in the south of Moscow as it stands today, not an architectural visualisation: long low "
        "production blocks of pale warm grey concrete, two continuous ribbon bands of glazing in dark frames along "
        "each block, scaffolding on the part of the facade being renewed, roller shutter gates flush in the wall at "
        "yard level, a wide concrete apron with box trucks and semi trailers, lamp posts and standing water after "
        "rain. Keep the block proportions, the two band glazing rhythm, the pale grey wall values and the flush "
        "gates exactly. Do not clad it in dark perforated panels, do not turn it into a glass tower, do not add "
        "floors absent from the photographs. A production interior is that same site: a clear hall on round painted "
        "columns, a poured seamless floor, roller gates in the end wall. An office or conference hall is the "
        "renovated administrative building: white walls with one amber accent wall, black framed glazed partitions, "
        "grey carpet, linear ceiling light. "),
    знак=(
        "The brand mark comes one to one from the attached logo file and is a physical object in the frame, never a "
        "flat sticker and never a watermark: a twelve toothed gear wheel with a clean circular centre, and inside "
        "that circle the stylised figure of a person with arms raised outward to both sides; where the wordmark "
        "appears it reads exactly «КЛАСТЕР». It has real thickness and its own cast shadow and takes the same light "
        "as everything around it. It appears once per frame, about three percent of the frame width, never larger "
        "than the headline, never centred as a badge and never repeated. "),
    финал=(
        "The finished frame reads as key art for a campaign: dense, layered, worth a second look. Build at least "
        "four depth planes, near foreground, subject, mid ground and dissolving background, with something crossing "
        "between them so the eye travels. Something is happening at this exact instant: a particle in flight, a "
        "light drawing its trail, a hand mid movement, hot metal cooling, steam leaving a valve. Photoreal and "
        "physically correct, at the level of a high end render married to a documentary photograph: true "
        "reflections and roughness on every material, believable contact shadows, caustics on wet concrete, "
        "subsurface glow through a lit edge. Composition is deliberate rather than centred, built on a diagonal or "
        "on thirds, the subject given room to be big. No flat backdrop behind a floating object, no illustration "
        "look, no painterly texture, no clip art, no sharpening halo."))

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
    "the renovated office corridor of the administrative building, white walls with one accent wall in brand amber, "
    "black framed glazed partitions along one side, grey carpet, a linear ceiling light running away from camera",
    "the conference hall seen from the back row, rows of black chairs receding toward a large bright screen, grey "
    "carpet, a linear ceiling light along the length of the room",
    "the inner street of the territory in the morning, roller gates running down both sides in perspective, a box "
    "truck backing into one of them, painted parking bays on the wet concrete",
    "the yard seen from above from the roof parapet, painted parking bays in a grid, trucks and cars standing in "
    "them at an angle, the long roof of the production block along one edge",
    "a machined metal part resting alone on a graphite bench in a near overhead close view, milled faces and tool "
    "marks reading clearly, the bench falling away into shadow",
    "the open door of a main switchboard cabinet, busbars and breaker rows in ordered ranks, cable glands along the "
    "bottom, a meter face at eye level",
    "a canteen servery counter with trays and a hot line behind glass, warm light above it, the dining room out of "
    "focus beyond",
    "the scaffolded part of the facade seen from the yard, the two ribbon bands of glazing continuing past the "
    "scaffold to the far end, a tower crane above the roofline",
    "an overhead crane hook and load block hanging over an empty bay, the crane rail running the length of the "
    "frame above, the floor far below in soft focus",
    "a stack of pallets wrapped in stretch film standing in a warehouse block, the film catching the light, racking "
    "receding behind them",
    "a wall of stacked euro pallets filling the frame, the pale wood grain and heat stamps reading clearly, "
    "one pallet pulled slightly out of the stack",
    "the underside of an overhead crane girder seen from below, the rail and festoon cabling running away in "
    "perspective, roof structure beyond",
    "a coil of steel strip standing on end on the floor, its wound edge filling most of the frame like a spiral, "
    "mill oil catching the light",
    "the tread plate of a steel staircase seen from directly above, its diamond pattern worn smooth in the middle "
    "by traffic",
    "a row of numbered roller gates along one long facade, seen at a shallow angle so they repeat away into "
    "distance",
    "a bundle of cable trays running along the ceiling of a corridor, cables sorted and tied, labels on each run",
    "the corner of a poured floor slab meeting a painted column base, the expansion joint filled and the marking "
    "line turning around it",
    "a service lift interior with brushed steel walls and a scuffed floor, the doors half open onto the bay",
    "an empty racking bay in a warehouse block seen straight on, uprights and beams making a grid across the frame",
    "the flat roof of the building with ventilation units in a row, the city skyline low behind them",
    "a compressed air manifold on a wall, gauges and quarter turn valves in a line, pipework running off both ways",
    "a workbench top filling the frame from directly above, tools laid out in order, swarf swept into one corner",
    "the yard gate barrier and guard window at the entrance, seen from the driver seat height",
    "a puddle on the apron reflecting the facade and the sky upside down, the real building small at the top of "
    "the frame",
    "a stack of steel channel and angle stock on a rack, the ends cut square and facing camera in a grid",
    "the loading dock leveller plate raised, the gap between the dock and the truck bed visible beneath it",
    "a bank of electricity meters on a wall, sealed and numbered, conduit running down from each",
    "the ceiling of a production hall seen looking straight up, roof lights and structure making a strict pattern",
    "a heavy steel door with a push bar and a numbered sign, the paint chipped around the handle",
    "a pile of production offcuts in a steel bin, bright cut faces catching the light",
    "an aisle between two production areas marked by yellow floor lines, machinery out of focus on both sides",
    "the corner of an office window with the industrial yard visible through it, blinds half drawn",
]

# Сцена под каждый ключ: то, что видит камера в главном кадре. Остальное собирает движок.
СЦЕНЫ = {
 # --- месяц 1: перевод старых промптов на единый паспорт ---
 "P-53-karusel-indeksaciya": "three mill-finish steel bars of increasing height standing in a row on a polished concrete floor of an empty bay, evenly spaced, each casting its own long shadow toward the camera, crane rail visible overhead",
 "P-S-subbota-i-vtoraa-smena": "the inner street of an industrial territory late in the evening, roller gates closed along both sides, one gate open with warm light spilling onto the concrete apron, a single car parked at the far end",
 "P-54-nds-schet": "a printed rental invoice on warm white paper lying flat on a graphite steel bench shot straight down from directly above, its printed body an unreadable grey texture with no legible word, one line of it catching a narrow amber light, a machined steel straightedge across the lower third",
 "P-02-karusel-krt": "an aerial view of a Moscow industrial district at flat overcast noon, a hard boundary where low workshop roofs stop and new residential blocks begin, cranes standing over the built side, the working half occupying the near part of the frame",
 "P-03-dzen-oblozhka-krt": "one frame holding both worlds at once: in the near half the pale grey ribbon glazed facade and roller gates of a working production building, in the far half a row of new residential towers rising directly behind it, flat overcast daylight, wet asphalt between them",
 "P-S-dogovor-v-cetverg": "a stapled contract lying on a graphite steel bench under a desk lamp, its printed body an unreadable grey texture, a fountain pen resting across it, the workshop beyond falling into ink black",
 "P-S-sotna-masterskih-v-odnom-kvartale": "an aerial view of a dense low-rise workshop quarter at dusk, dozens of small saw-tooth roofs packed edge to edge, warm light escaping from a few open gates",
 "P-20-moshchnost-schet": "the open door of a workshop main switchgear cabinet seen straight on, breaker modules in a strict vertical column behind the glazed panel, bus bars and cable glands below, one amber indicator lamp glowing in the upper right",
 "P-04-nagruzka": "a polished concrete workshop floor shot from a low angle almost at floor level, the machine bed of a heavy lathe anchored into it in the near plane, old floor marking running away into the depth of the bay, crane rail overhead",
 "P-09-vc-oblozhka": "a working production hall in the near half of the frame with a crane rail overhead, and through the open gate at the far end a row of residential towers standing against the sky, the two worlds separated by one doorway",
 "P-S-10-minut-na-kajdoj-otgruzke": "a semi trailer standing at a workshop loading gate seen straight on from inside the dark bay, yard marking running away in strict perspective, wet asphalt holding the low amber light",
 "P-409-kak-otvechaem": "a heavy brushed steel plate bolted to the concrete flank of a workshop beside a closed roller gate, four countersunk screws at the corners, fine machining marks catching the raking key, factory dust along the lower edge",
 "P-407-dogovor-fiksiruem": "a contract page pressed flat under a sheet of glass on a graphite steel bench shot straight down from above, its printed body an unreadable grey texture, a machined steel straightedge lying across it and catching one amber highlight",
 "P-24-dogovor-krt": "a stapled contract opened flat on a workshop desk under a single directional lamp, its printed body an unreadable grey texture, a steel rule and a graphite pencil resting on the lower third, the bay behind in ink black",
 "P-25-karusel-dogovor": "a stapled contract lying open on a graphite steel bench shot straight down from directly above, its printed body an unreadable grey texture with no legible word, a machined steel straightedge across the lower third",
 "P-84-dzen-sreda-smeny": "an empty workshop changing room shot straight on, a row of steel lockers along the wall with doors closed, a bench in front of them, one door standing open onto darkness, warm light from a corridor beyond",
 "P-S-cto-proishodit-s-promzonami-moskvy": "an aerial view of a Moscow industrial district at flat overcast noon, a hard boundary where workshop roofs stop and new residential blocks begin, tower cranes standing over the new side",
 "P-S-subbota-na-territorii": "the inner street of an industrial territory on a quiet morning, roller gates closed along both sides, one gate half open with warm light inside, a single trolley standing on the concrete apron",
 "P-07-shest-otrasley": "the inner street of a dense industrial territory seen straight down its centre line, roller gates repeating along both sides in strict perspective, a steel trolley crossing between two of them, crane rail visible through an open gate",
 "P-S-sahta-kotoraa-zakrylas-v-1986-godu": "a tall steel headframe of a disused mine standing against an overcast sky, its lattice structure sharp against flat cloud, the empty yard below it swept and quiet",
 "P-12-vosem-cifr": "an empty production bay shot straight down its centre line, structural columns receding in strict perspective, crane rail overhead, roof lights above, polished concrete floor carrying old marking, the far end lost in ink black",
 "P-23-vorota-fura": "a semi trailer standing squarely at a workshop loading gate seen straight on from outside, the steel canopy and rubber dock seals of the gate framing it, yard marking running away under the wheels, wet asphalt holding the light",
 "P-89-karusel-stroyka-ryadom": "a construction hoarding running across the frame with a working production building standing directly behind it, a tower crane above, the shared concrete apron in the near plane carrying tyre scuffs",
 "P-27-ploshchadki-mira": "three fragments of industrial city in one frame divided by two thin vertical seams: a waterfront with gantry cranes, a narrow low-rise workshop street, and a shipyard basin, all under the same flat overcast light",
 "P-S-4-minuty-5-tonn-5-tonn": "a polished concrete workshop floor shot straight down from above, old yellow floor marking half worn away, the edge of a crane rail crossing the upper part of the frame, factory dust in the recesses",
 "P-13-chto-vhodit": "an empty production bay with its roller gate rolled fully up, the rectangle of the doorway filled with flat daylight, a crane rail running the length of the bay overhead, painted floor marking leading out through the gate",
 "P-15-rbk-oblozhka": "a working industrial territory seen from a high vantage point at flat overcast noon, a tower crane standing over one corner of it, the city skyline compressed on the horizon behind",
 "P-S-pervyj-den-lenty": "a graphite steel bench shot straight down from directly above with a blank warm white notebook page on it, a fountain pen resting across the page, one amber highlight along the pen barrel",
 "P-29-infrastruktura": "the inner street of an industrial territory in the evening, roller gates along both sides, a lit canteen window at the far end throwing warm light onto the concrete, painted floor marking leading toward it",
 "P-16-chetyre-stroki": "four flat machined steel plates lying in a vertical stack with a finger's width between them on a graphite bench shot straight down from above, each plate blank, the topmost catching the key light",
 "P-22-dzen-pereezd-90": "an empty production bay with a long painted line running down the centre of its concrete floor from the near edge of the frame into the depth of the bay, four short cross marks scribed across the line at intervals, crane rail overhead",
 "P-S-pervyj-scet": "a printed invoice on warm white paper lying on a graphite steel bench shot straight down from above, its printed body an unreadable grey texture, a pocket calculator resting beside it",
 "P-83-shchit-100-kvt": "a workshop main switchboard seen straight on, its steel door open, breakers in a strict column, cable glands entering from below, one small brushed steel tag wired to the bus bar and catching amber light",
 "P-S-slojnyj-procent": "three mill-finish steel bars of increasing height standing in a row on a polished concrete floor, evenly spaced, each casting its own long shadow toward the camera",
 "P-88-vtoraya-ochered": "a working production building in the near half of the frame and directly behind it the raw concrete frame of a new building under construction, a tower crane above it, the shared yard in front carrying tyre scuffs",
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


# Сцены месяцев 2 и 3 в том же паспорте: одна фраза, из которой движок собирает кадр.
СЦЕНЫ.update({
# --- месяц 2 ---
"P-10-metro-2028":
    "a hard-hat aerial of the industrial territory in the near half of the frame with a metro construction "
    "site beyond it, tower crane and shoring pit clearly readable, walking distance drawn on the ground as "
    "a shallow arc of amber floor marking painted across the concrete apron",
"P-08-den-proizvodstva":
    "the inner street of the territory at first light, roller gates being raised along the near side, "
    "headlights of arriving cars throwing long reflections on wet concrete, an industrial wall clock bolted "
    "to the gate pillar in the near plane",
"P-26-vc-ploshchadki-mira":
    "a working production hall seen from outside through its full-height glazing at dusk, dense residential "
    "city blocks rising directly behind it, amber light filling the bays while the housing beyond stays cold "
    "and unlit",
"P-S-cas-prostoa-masiny":
    "a heavy truck standing still at a loading dock with its engine off, the dock seal folded against the "
    "body, a stopwatch face on a steel plate bolted to the dock wall in the near plane",
"P-S-ponedel-nik-v-cehe":
    "an empty production bay at six in the morning, overhead crane rail catching the first key light, floor "
    "marking freshly swept, one work jacket hanging on a steel hook in the foreground",
"P-55-akt-priyomki":
    "a handover inspection form on warm white paper lying on the polished concrete floor of an empty bay, "
    "a folding rule and a phone face down beside it, the printed body an unreadable grey texture, one field "
    "of the form catching a narrow amber line",
"P-57-dzen-polnaya-stoimost":
    "a cost table drafted like a technical document on warm white paper pinned flat to a graphite steel "
    "panel, its rows machined as shallow grooves in the metal beneath the paper, a steel straightedge laid "
    "across the lower rows",
"P-S-voskresen-e-itogi-nedeli":
    "a lease contract lying open on a graphite steel bench in a dark empty office above the workshop, its "
    "printed body an unreadable grey texture, one clause underlined by a narrow amber line, a closed pen "
    "beside it",
"P-400-tehzadanie":
    "a steel clipboard with a technical brief clamped under its spring lying on a graphite workbench, the "
    "printed body an unreadable grey texture with four ruled empty fields, a machinist rule and a pencil "
    "aligned to its edge",
"P-31-ig-smena":
    "the morning entry gate of the territory with a queue of cars and a walking stream of workers seen from "
    "behind, the barrier arm raised, painted floor numbering running across the asphalt in the near plane",
"P-17-geografiya":
    "a survey plan of the southern part of the city milled as shallow grooves into a graphite steel plate "
    "lying flat, the site marked by a machined amber inlay, main road corridors cut as deeper channels",
"P-S-dvor-s-tocki-zrenia-voditela":
    "the yard seen from a truck cab window height, a roller gate directly ahead, the turning circle marked "
    "on the concrete, a wing mirror catching the amber source in the near corner of the frame",
"P-14-desyat-dney":
    "ten machined steel plates of equal size laid in a row on a graphite bench like a strip of days, each "
    "with a countersunk screw at its corner, raking light separating one plate from the next",
"P-S-svobodnye-pomesenia":
    "an empty production block with its roller gate fully open, daylight cutting a hard rectangle across the "
    "concrete floor, crane rail overhead, the far wall dissolving into black",
"P-50-struktura-platezha":
    "seven brushed steel bars of equal length stacked as a flight of steps on a graphite surface, one bar "
    "faced in amber, each casting its own shadow onto the one below",
"P-S-voskresen-e-i-karta":
    "a cadastral extract on warm white paper lying on a concrete floor with a torch beam across it, the "
    "printed body an unreadable grey texture, one boundary line traced in amber",
"P-61-tri-shemy-sosedstva":
    "three drafting blocks milled side by side into a graphite steel plate, connecting lines between them "
    "inlaid in amber, a machinist square laid across the lower edge",
"P-67-rbk-oblozhka":
    "a production building photographed straight on from the yard with a cost table drafted as a technical "
    "document standing in the near plane on a steel easel, the table plane parallel to the facade behind it",
"P-65-peregovory-shest":
    "six machined steel tabs standing upright in a row in a graphite base like index tabs of a contract, "
    "one tab faced in amber and pulled slightly forward from the rest",
"P-S-cena-vakansii":
    "an empty welding station in a bay, mask hanging on its hook, torch coiled on the bench, the workpiece "
    "untouched, a single hard key light across the cold seam",
"P-S-voskresen-e-doroga":
    "a shuttle bus standing at a marked stop by the checkpoint at dawn, doors open, the territory gate "
    "beyond it, wet asphalt carrying the amber reflection of the interior lights",
"P-30-smena-nayem":
    "a survey plan of the district milled into a graphite steel plate with a shallow circular groove cut "
    "around the site, the groove filled with amber, residential blocks rendered as low relief inside it",
"P-402-platezh-po-strokam":
    "seven brushed steel strips bolted flat in a stack onto a graphite panel like the lines of an invoice, "
    "one strip paint filled in amber, screw heads catching the key light",
"P-S-1-oktabra":
    "an electrical switchboard with its door open in a production block, breaker rows in hard raking light, "
    "a meter face in the near plane, a tariff sticker on the inner door reduced to unreadable grey texture",
"P-58-hodka-fury":
    "a truck pulled up square to a loading dock seen from behind at bumper height, the dock seal compressed "
    "around the body, a machined steel rule standing on the apron in the near plane",
"P-401-subbota":
    "the yard on a Saturday morning, one roller gate fully open on an otherwise closed row, long shadows "
    "across the empty concrete, no vehicles and no people",
"P-21-karusel-moshchnost":
    "a main switchboard cabinet standing open in a production block, busbars and breaker rows in hard raking "
    "light, an equipment rating plate screwed to the panel in the near plane",
"P-S-strojka-radom":
    "a metro construction site seen over the parapet of the territory, tower crane and shoring pit below, "
    "the workshop roofs of the site occupying the near third of the frame",
"P-403-vtoraya-ochered":
    "a production building under construction in scaffolding, tower crane above it, the finished facade of "
    "the first phase standing beside it in the same graphite panel rhythm",
"P-S-vtornik-razbor-mosnosti":
    "an equipment rating plate screwed to the flank of a machine, its stamped characters reduced to "
    "unreadable relief, a narrow amber line crossing one row, the machine body falling into black behind it",
# --- месяц 3 ---
"P-52-indeksaciya-pyat-let":
    "five brushed steel bars of increasing height standing in a row on a graphite base, the tallest faced "
    "in amber, each bar casting its own long shadow toward the camera",
"P-96-itog-mesyaca":
    "a grid of seven machined recesses milled into a graphite steel plate lying flat, each recess holding a "
    "countersunk screw, one recess paint filled in amber",
"P-64-vtoraya-ochered-punkty":
    "the scaffolded facade of the second phase photographed straight on from the yard, a drafting plate on a "
    "steel easel standing in the near plane parallel to it, site fencing across the lower edge",
"P-33-karusel-vtoraya-ochered":
    "the interior of a bay under construction, structural columns standing in a receding row, formwork marks "
    "on the concrete, the crane rail not yet fitted, daylight from the open gable end",
"P-S-den-priemki":
    "an electricity meter mounted in an open switchboard in a production block, its counter face in hard "
    "raking light, a phone held up to it in the near plane seen only as a hand",
"P-51-karusel-sem-strok":
    "an invoice on warm white paper clamped to a steel clipboard on a graphite bench, the printed body an "
    "unreadable grey texture, a machinist rule laid across one row, a pen resting at the margin",
"P-S-subbota-i-bumagi":
    "a wall planner milled as a grid of shallow grooves into a graphite steel panel bolted to a workshop "
    "wall, twelve grooves running across it, one groove paint filled in amber",
"P-404-chto-vzyat":
    "a tape measure, a folding rule and a technical brief laid out on a graphite workbench in a straight "
    "row, hard raking light separating each object from the surface",
"P-59-karusel-logistika":
    "a shipping register on warm white paper lying flat on a graphite bench shot straight down from above, "
    "the printed body an unreadable grey texture, a machined steel rule across the lower third",
"P-S-cto-vzat-na-vstrecu":
    "a steel clipboard with a technical brief standing propped against the leg of a workbench, a pen clipped "
    "to it, the empty bay receding into black behind",
"P-62-dogovor-krt-punkty":
    "a lease contract lying open on a graphite steel bench, the printed body an unreadable grey texture, "
    "four machined steel tabs standing along its edge, one tab faced in amber",
"P-32-vtoraya-ochered":
    "the scaffolded facade of the second phase seen from the yard with the tower crane above it, the same "
    "pale grey wall and dark framed ribbon glazing already fitted on the lower floors",
"P-63-karusel-status-uchastka":
    "a lease contract lying open on a concrete floor with a torch beam falling across one page, the printed "
    "body an unreadable grey texture, a single paragraph traced by a narrow amber line",
"P-S-sit-scetcik-dogovor":
    "an electrical switchboard standing open against a workshop wall, meter and breaker rows in hard raking "
    "light, the cabinet door swung toward the camera in the near plane",
"P-S-granica-rabot":
    "a construction fence line running through the territory, a block gate on the near side of it and "
    "scaffolding beyond, a temporary route arrow painted on the concrete",
"P-82-moshnost-delitsya":
    "a main switchboard busbar seen straight on with feeder breakers branching from it in a row, one feeder "
    "traced by a narrow amber line, the cabinet interior falling to black",
"P-408-sosedstvo":
    "the inner street of the territory in the morning, roller gates of separate blocks running down both "
    "sides in perspective, one gate open with amber light spilling out",
"P-S-samaa-bol-naa-proverka":
    "a cadastral extract clamped to a steel clipboard resting on a concrete floor, the printed body an "
    "unreadable grey texture, one line of it caught by a narrow amber light",
"P-405-kran-balka":
    "an overhead crane hook lowered over a machine bed in an empty bay, the crane rail running the length of "
    "the frame overhead, the load block in hard raking light",
"P-S-subbota-marsrut-masiny":
    "a truck turning into the inner street of the territory past an open roller gate, the yard otherwise "
    "empty, long shadows across wet concrete",
"P-406-moshchnost-pod-vas":
    "an equipment rating plate screwed to a machine flank in the near plane with an open switchboard "
    "standing behind it in the same bay, both in one hard raking key",
"P-66-karusel-peregovory":
    "a lease contract lying open on a graphite steel bench with six machined steel tabs standing along its "
    "edge, a pen laid across the page, the printed body an unreadable grey texture",
"P-S-ponedel-nik-na-strojke":
    "a production building under construction seen from the yard at first light, scaffolding on the facade, "
    "the crane still, site fencing across the near plane",
"P-80-devyat-voprosov-sosedi":
    "a grid of nine machined recesses milled into a graphite steel plate lying flat, each recess holding a "
    "countersunk screw, one recess paint filled in amber",
"P-410-shattl":
    "a shuttle bus standing at its marked stop by the checkpoint in the morning, doors open, a walking "
    "stream of workers seen from behind boarding it, the territory gate beyond",
"P-86-karusel-kooperaciya":
    "two routes milled as channels into a graphite steel plate lying flat, one short channel between two "
    "milled blocks and one long channel running off the plate edge, the short channel filled with amber",
"P-S-obsij-proezd-utrom":
    "two heavy trucks passing each other in the inner street of the territory, roller gates closed along "
    "both sides, the gap between the vehicles narrow and clearly readable",
"P-85-cena-rasstoyaniya":
    "a route drawn as a long milled channel across a graphite steel plate lying flat, a machinist rule "
    "measuring its length, the channel filled with amber at its far end",
"P-97-karusel-itog":
    "seven machined steel plates laid in a row on a graphite bench like a checklist, the last plate faced in "
    "amber and set slightly apart from the six before it",
"P-S-detal-uehala-v-sosednij-korpus":
    "a machined metal part resting on a graphite bench with the open roller gate of the next block visible "
    "beyond it through the yard, the part in sharp near focus",
})


# Резерв и отчёт о мероприятии: те же правила паспорта.
СЦЕНЫ.update({
"P-06-karusel-12-voprosov":
    "twelve machined recesses milled in a grid into a graphite steel plate lying flat, each holding a "
    "countersunk screw, one recess paint filled in amber, a machinist square along the lower edge",
"P-28-karusel-ploshchadki-mira":
    "a working production hall seen from outside through full-height glazing at dusk with dense city blocks "
    "rising directly behind it, amber light filling the bays while the housing beyond stays cold",
"P-56-karusel-akt":
    "a handover inspection form clamped to a steel clipboard resting on the polished concrete floor of an "
    "empty bay, a phone lying face down beside it, the printed body an unreadable grey texture",
"P-60-grafik-12-nedel":
    "twelve shallow grooves milled across a graphite steel panel bolted to a workshop wall like a countdown "
    "strip, the first groove paint filled in amber, raking light along the milled walls",
"P-81-karusel-sosedi":
    "two adjacent block gates in one long facade shot straight on, one closed and one open onto a lit "
    "interior, the shared concrete apron carrying tyre scuffs between them",
"P-90-sreda-smeny":
    "a workshop canteen and a locker row standing in one frame across a shared partition wall, both empty, "
    "one warm amber source above the canteen tables and cold falloff over the lockers",
"P-84-vk-marshrut-detali":
    "a machined metal part resting on a graphite bench with the open roller gate of the next block visible "
    "beyond it across the yard, the part in sharp near focus",
"P-130-vk-chetyre-sem-sot":
    "an aerial view of a dense Moscow district at flat overcast noon shot straight down at a shallow angle, "
    "residential blocks filling most of the frame and the long saw-tooth roofs of working production halls "
    "reading clearly between them, service yards and truck bays visible in the gaps",
"P-S-voskresen-e-spisok-goroda":
    "a machined metal part resting alone on a graphite bench in a near overhead close view, its milled faces "
    "and tool marks in hard raking light, the bench receding into black behind it",
"P-140-konferenc-zal":
    "the conference hall of the administrative building shot down its centre line from the back row, rows of "
    "black chairs receding toward a large bright screen on the end wall, a linear ceiling light running the "
    "length of the room, grey carpet, the side walls falling into shadow",
"P-141-lyudi-smeny":
    "a canteen servery and a locker row standing in one frame across a shared partition, both empty, a warm "
    "amber source above the servery counter and cold falloff over the lockers, a poured floor between them",
"P-142-karusel-fasad":
    "the long facade of a production block under renewal, scaffolding standing along one bay of it, the two "
    "ribbon bands of glazing in dark frames continuing past the scaffold to the far end, a wide concrete "
    "apron in front with a box truck parked at an angle",
"P-91-karusel-sem-mest":
    "seven machined steel plates laid in a row on a graphite bench like a checklist, hard raking light "
    "separating one plate from the next, the last plate faced in amber and set slightly apart",
"P-505-sobytie-teleskop":
    "the flat roof of the administrative building at night, a large amateur telescope on a heavy equatorial "
    "mount standing on the roof deck in the near plane with its tube raised into a deep clear sky, the "
    "silhouette of one person bent to the eyepiece seen from behind, the lit production buildings of the "
    "territory spread out far below and behind, a single warm amber source from the open roof hatch raking "
    "across the tube, the Milky Way and long star trails arching overhead, no crowd and no faces",
"P-504-karusel-kosmos-otchet":
    "the flat roof of the administrative building at night, its parapet and roof plant low in the frame, a "
    "large amateur telescope on a heavy equatorial mount standing on the roof deck in the near plane with "
    "its tube raised toward a deep clear sky, the lit production buildings of the territory spread out below "
    "and behind it, a single warm amber source from a roof hatch raking across the tube, no crowd and no faces",
})


ФОРМАТЫ = {"16:9": "16:9", "4:5": "4:5", "9:16": "9:16", "4:3": "4:3", "1:1": "1:1"}
БЕЗ_ГЕНЕРАЦИИ = {"P-05-lift", "P-11-shattl", "P-94-kvartal-karta", "P-01-krt-karta",
                 "P-92-peresmenka-reels"}


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
            # слайды бывают только у карусели и серии историй: у поста с опросом
            # та же разметка означает варианты ответа, а не кадры
            слайды = (re.findall(r"^\*\*(\d+)\.\*\* ([^\n]+)\n> ([^\n]+)", ч, re.M)
                      if ("карусел" in z or "истори" in z) else [])
            заг = re.search(r"\n\*\*(.+?)\*\*", ч)
            сп.append({"ключ": ссылки[0], "загол": z, "формат": формат, "слайды": слайды,
                       "тема": заг.group(1) if заг else "", "блок": ч,
                       # путь нужен замеру разнообразия: по нему видно, из какого
                       # месяца пришла единица
                       "файл": путь})
    return сп


# Второй публикации на ту же тему нужен свой кадр: заголовок вгравирован в сцену.
# Ключ с суффиксом -b наследует сцену базового, но снимается с другой точки.
ВАРИАЦИИ = {"b": " The camera stands one step further back and a quarter turn to the left of the "
                 "obvious view, so the same subject is read from a different angle than the frontal one.",
            "c": " The camera drops to waist height and moves a quarter turn to the right of the obvious "
                 "view, so the subject is read from below and from the side."}


def сцена_ключа(к):
    if к in СЦЕНЫ: return СЦЕНЫ[к]
    осн, _, суф = к.rpartition("-")
    if суф in ВАРИАЦИИ and осн in СЦЕНЫ:
        return СЦЕНЫ[осн] + ВАРИАЦИИ[суф]
    return None


# Строка под слайдом бывает двух видов: осмысленная подпись, которая идёт в кадр,
# и режиссёрская ремарка для съёмки или SMM. Ремарку в кадр пускать нельзя:
# «кадр территории сверху» и «опрос: читал / не открывал» так и печатались на
# картинке вместо того, чтобы остаться указанием для человека.
РЕМАРКА = re.compile(r"^\s*(кадр\b|живой кадр|опрос|викторин|стикер|слайдер|"
                     r"стрелка|съёмка|съемка|фото\b|видео\b|крупный план|"
                     r"общий план|обложка|скрин|снимок|инфографик|схема\b|"
                     r"график\b|карта\b|анимаци|титр)", re.I)


def служебная(подпись):
    """Возвращает подпись для кадра: ремарку заменяет пустой строкой."""
    п = (подпись or "").strip()
    return "" if РЕМАРКА.match(п) else п


def рубрика(е):
    """Рубрика из заголовка единицы: по ней движок подбирает дизайнерскую систему."""
    m = re.search(r"рубрика «([^»]+)»", е.get("загол", ""))
    return m.group(1) if m else ""


def кадры_единицы(е):
    """Список кадров под движок: один для поста, по слайду для карусели и серии."""
    к = е["ключ"]
    осн = к.rpartition("-")[0] if к.rpartition("-")[2] in ВАРИАЦИИ else к
    if к in БЕЗ_ГЕНЕРАЦИИ or осн in БЕЗ_ГЕНЕРАЦИИ: return []
    сцена = сцена_ключа(к)
    if not сцена: return []
    if not е["слайды"]:
        тема = е["тема"].replace("«", "").replace("»", "").strip()
        return [{"ключ": к, "формат": е["формат"], "сцена": сцена, "вид": "пост",
                 "заголовок": тема, "подпись": "", "рубрика": рубрика(е)}]
    всего = len(е["слайды"])
    вид = "сторис" if "истори" in е["загол"] else "карусель"
    вышло = []
    for i, (номер, заголовок, подпись) in enumerate(е["слайды"], 1):
        подпись = служебная(подпись)
        # выбор от ключа единицы: иначе все карусели идут по одному и тому же
        # ряду поверхностей и вся лента выглядит собранной из одного набора
        сдвиг = int(hashlib.md5(к.encode()).hexdigest()[:8], 16)
        поверхность = сцена if i == 1 else ПОВЕРХНОСТИ[(сдвиг + i - 2) % len(ПОВЕРХНОСТИ)]
        вышло.append({"ключ": f"{к}-{i:02d}", "формат": е["формат"], "сцена": поверхность,
                      "вид": вид, "номер": i, "всего": всего,
                      "заголовок": заголовок.replace(" / ", " ").strip(),
                      "подпись": подпись.strip(), "рубрика": рубрика(е)})
    return вышло


def главное(корень=".", писать=True):
    готовые = set()
    for ф in glob.glob(os.path.join(корень, "promts_new", "*.json")):
        if ф.endswith("gruppa_dobor.json"): continue
        готовые |= set(json.load(open(ф, encoding="utf-8")))
    кадры = []
    for е in единицы(корень):
        # если сцена описана в этом файле, кадр собирается движком заново,
        # даже когда старый промпт где-то лежит: паспорт бренда должен быть единым
        if е["ключ"] not in СЦЕНЫ and any(k == е["ключ"] or k.startswith(е["ключ"] + "-") for k in готовые):
            continue
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
        # старые версии тех же ключей убираем, чтобы источник был один
        убрано = 0
        for ф in sorted(glob.glob(os.path.join(корень, "promts_new", "*.json"))):
            if ф == путь: continue
            d = json.load(open(ф, encoding="utf-8"))
            новый = {k: v for k, v in d.items() if k not in промпты}
            if len(новый) != len(d):
                убрано += len(d) - len(новый)
                json.dump(новый, open(ф, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if убрано: print("убрано старых версий:", убрано)
    return промпты


if __name__ == "__main__":
    главное(".", писать="--проверка" not in sys.argv)
