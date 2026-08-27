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
        "The brand mark comes one to one from the attached logo file and is a physical object, never a flat sticker "
        "or watermark: a twelve toothed gear wheel with a clean circular centre holding the stylised figure of a "
        "person with arms raised to both sides; where the wordmark "
        "appears it reads exactly «КЛАСТЕР». It has real thickness, a cast shadow and the same light "
        "as everything around it. It appears once, in a corner, under a seventh of the frame width and a third of "
        "the headline cap height: a maker's mark, never a hero prop, a signboard or the biggest object in frame, "
        "never centred and never repeated. "),
    финал=(
        "The finished frame reads as key art for a campaign: dense, layered, worth a second look. Build four "
        "depth planes, near foreground, subject, mid ground and dissolving background, with something crossing "
        "between them so the eye travels. Something is happening at this instant: a particle in flight, a light "
        "drawing its trail, a hand mid movement, steam leaving a valve. Photoreal and physically correct, a high "
        "end render married to a documentary photograph: true reflections and roughness on every material, "
        "believable contact shadows, caustics on wet concrete. Composition is deliberate rather than centred, built "
        "on a diagonal or on thirds, the subject given room to be big. No flat backdrop behind a floating object, "
        "no illustration or painterly look, no clip art, no sharpening halo."))

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
 "P-S-subbota-rabochaya": "the inner street of an industrial territory on a bright Saturday morning, a semi trailer standing at an open roller gate of a workshop block with its ramp down, two pallets on the apron, yard marking running away in strict perspective, the guard post visible small at the far end",
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
    "a heavy truck standing still at a loading dock with its engine off, a stopwatch face on a steel plate "
    "bolted to the dock wall in the near plane",
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



# Месяц 1: сцены сведены со строкой «Визуал:» в MESYAC_1/NEDELYA_*.md. Одно
# предложение, только предметы и их расположение: цвет, свет, оптику и
# типографику добавляет паспорт бренда, дублировать их в сцене вредно.
СЦЕНЫ.update({
"P-01-krt-karta":
    "a printed district map spread flat on a workshop bench, cropped to two blocks, one of them shaded solid "
    "to its boundary while the street line of the other runs clear along the edge, a steel rule pinning the "
    "lower margin",
"P-01-krt-karta-b":
    "one frame divided by a single vertical seam, a factory hall with rail spurs running up to its gates "
    "standing on the left side and the same ground rebuilt into residential blocks along an embankment on "
    "the right",
"P-54-nds-schet":
    "two hands over a desk calculator standing on a workshop bench, a printed invoice sheet lying beside it a "
    "little further back, a steel rule and swept swarf along the far edge of the bench",
"P-05-krug-territoriya":
    "a walk through an industrial territory held inside a circular frame, the inner street running ahead "
    "between roller gates, a freight lift doorway and a crane hook passing close by at the frame edge",
"P-03-dzen-oblozhka-krt":
    "one frame cut corner to corner by a diagonal, working production sheds with roller gates filling the "
    "lower half and new residential towers standing on the upper half, wet asphalt along the seam",
"P-402-vc-kadry":
    "the hands of a machinist on the cross slide handwheel of a worn lathe, cropped at the wrists so no face "
    "is in frame, curled swarf lying on the bed and oil ghosting along the ways",
"P-06-pol-ankery":
    "a workshop floor slab filling the frame, four empty anchor holes left where a machine stood, a crack "
    "running along the slab joint past them, the wedge of an open gate thrown across the concrete",
"P-20-moshchnost-schet":
    "an incoming switchgear cabinet with its door swung open, a small tag wired to one breaker in the near "
    "plane, the hand of an electrician resting on the panel edge, cable glands entering from below",
"P-401-dzen-moshchnost":
    "a row of stamped equipment rating plates on machine casings, the nearest one filling the near plane and "
    "the rest falling away down the line, the hall behind them soft",
"P-04-nagruzka":
    "the concrete floor under a machine bed, one anchor plate and its bolt in the near plane, the machined "
    "foot of the frame resting on it, floor marking running away past the base into the bay",
"P-09-vc-oblozhka":
    "a production hall with a crane rail overhead in the near half and a row of residential towers behind it, "
    "a strip of ruled calendar tape running across the frame between them with cross marks at intervals",
"P-04-nagruzka-b":
    "a row of machine tools standing down one side of a production bay, their beds bolted to the floor at even "
    "intervals, a swept aisle running past them to the far end of the hall",
"P-409-kak-otvechaem":
    "the desk of a letting office from above, a floor plan of a block unfolded across it, a tape measure lying "
    "over the plan, a phone face up beside it and a mug at the corner of the desk",
"P-05-lift":
    "the open doors of a goods lift seen from inside a block, a pallet of steel stock standing on the cabin "
    "floor, a person beside it for scale, floor marking visible through the doorway",
"P-84-dzen-sreda-smeny":
    "a canteen servery with trays along the hot line and a row of changing room lockers standing beside it "
    "across a shared partition, one locker door open with a work jacket on the hook",
"P-407-dogovor-fiksiruem":
    "a meeting room table from above, two copies of a contract lying side by side, a marked up printout "
    "between them, two hands over the page and a coffee cup at the near corner",
"P-24-srok-uvedomleniya":
    "a machine being lifted off its foundation in a bay, empty anchor holes in the floor beneath it, rigging "
    "slings under the frame and a hydraulic lifting table taking the weight, a work order sheet on a crate in "
    "the near plane",
"P-403-rbk-promzemlya":
    "an aerial view of a city with the boundary between industrial roofs and housing running corner to corner "
    "across the frame, saw tooth sheds and service yards on one side of it, dense residential blocks on the other",
"P-24-dogovor-krt-b":
    "a single contract page under a desk lamp, one line of it underscored by a marker stroke, the margins "
    "empty, a pen lying across the lower corner of the sheet",
"P-404-dzen-12-voprosov":
    "a printed list of questions clamped to a clipboard, a tape measure lying across the sheet, the roller "
    "gates of a workshop standing out of focus behind it",
"P-07-shest-otrasley":
    "the inner drive between two blocks, a sectional door standing open on each side with work going on inside "
    "both, a trolley carrying a part being pushed across the drive between them",
"P-12-vosem-strok-platezha":
    "a desk carrying a calculator, a printed invoice and a folded floor plan of a block, a pencil resting on a "
    "hand written sheet of eight ruled lines beside them",
"P-24-pyat-strok-smety":
    "five machined steel strips laid one under another on a bench with an even gap between them, each strip "
    "blank, the lowest one set a finger further out than the rest",
"P-23-vorota-fura":
    "a semi trailer swinging round in the lower part of the frame with the opening of a loading gate above it, "
    "yard marking curving under the wheels, the steel canopy of the gate closing the top edge",
"P-405-dzen-cenovye-kategorii":
    "a row of breakers behind the open door of a distribution board, the hands of an energy engineer on a "
    "switch handle at the near end, the rest of the panel running away along the wall",
"P-27-ploshchadki-mira":
    "three separate city blocks laid out as three ruled ground plans side by side on one flat surface, a thin "
    "line running between them from the first plan to the last",
"P-20-moshchnost-schet-b":
    "two upright steel columns of very different height standing apart on a swept floor, the tall one on the "
    "left and the short one on the right, a thin bar spanning the gap between their tops",
"P-15-rbk-oblozhka":
    "a working industrial territory in the near half of the frame with a tower crane standing over one corner "
    "of it and a row of residential towers on the far side, open sky above the near roofs",
"P-13-chto-vhodit":
    "five machined steel strips laid in a stack on a bench, a thin scored line running across each of them, "
    "one larger blank plate standing on edge behind the stack",
"P-16-chetyre-stroki":
    "four flat steel plates lying in a stack with a finger's width between them on a bench, the top plate "
    "pushed back and the three below it set slightly proud of its edge",
"P-406-vc-robotizacia":
    "a six axis robot arm folded at rest inside an empty production cell, the mesh of a safety fence standing "
    "between it and the near edge of the frame, the hall behind falling away",
"P-29-infrastruktura":
    "the inner street of a territory at midday, workers in overalls walking away from the frame between the "
    "blocks, a canteen doorway at the far end, marking numbers painted on the apron",
"P-13-chto-vhodit-b":
    "a milled steel panel bolted flat to a wall, eight shallow grooves cut across it one under another at even "
    "spacing, one groove wider than the rest, screw heads at the panel corners",
"P-83-shchit-100-kvt":
    "a small stamped tag wired to a breaker on an incoming switchboard filling the near plane, the cable cores "
    "behind it running down into the cabinet and out of focus",
"P-417-vc-vtoraya-ochered":
    "the inside of a newly built bay, a grid of raw concrete columns receding to the far wall, a clean poured "
    "floor with no equipment standing on it, roof lights in a row overhead",
"P-88-vtoraya-ochered":
    "the entrance to a territory from the height of a truck cab, a site hoarding standing along the right side "
    "of the drive, temporary route marking painted on the asphalt ahead and a barrier arm beyond it",
"P-210-zavody-v-gorodah":
    "four fragments of industrial city in one frame divided by thin seams, a factory block against housing, a "
    "test track on a roof, a mine headframe and a works gate with people passing through it",
"P-07-shest-otrasley-b":
    "two doors in one corridor of a block standing opposite each other, a small plate mounted beside each of "
    "them, a trolley loaded with tooling standing on the floor between the two doors",
"P-407-dzen-tri-mesta":
    "a machine tool strapped to a rigging skate standing in front of the open doors of a goods lift, a tape "
    "measure extended across the doorway, slings coiled on the floor beside the skate",
"P-408-rbk-zachem-goroda":
    "a production block standing right up against a residential building with only a fence between them, "
    "windows lit in both at evening, a narrow strip of yard running along the fence",
"P-S-subbota-rabochaya":
    "the inner street of a territory on a working Saturday, a semi trailer standing at an open gate with its "
    "ramp down, pallets on the apron beside it and the guard post small at the far end of the row",
"P-11-shattl":
    "a minibus shuttle standing at the guard post of a territory in the morning, its door open with people "
    "stepping in one after another, the barrier arm raised over the drive behind it",
"P-22-dzen-pereezd-90":
    "a long painted line running down the middle of a bay floor from the near edge into the depth of the hall, "
    "four short cross marks scribed across it at intervals, a crane rail overhead",
})


# Месяц 3, пятнадцать статей: сцены сведены со строкой «Визуал:» каждой статьи
# в MESYAC_3/NEDELYA_*.md. Одно предложение, только предметы и их расположение.
СЦЕНЫ.update({
"P-3101-kategoriya-nadezhnosti":
    "the main switchgear cabinet of a workshop with its door swung open showing two incoming feeds and a "
    "transfer panel, a printed single line diagram lying open in front of it, the bay receding behind",
"P-3102-shum-i-sanzona":
    "a sound level meter on a tripod standing at a work post beside a running compressor, ear defenders "
    "hanging on the machine frame, a residential block visible through the workshop window beyond",
"P-3103-ventilyaciya-otoplenie":
    "an air handling unit standing on the roof of a production building with its duct running into a wall "
    "opening, and below it the corner of a bay where a local exhaust arm hangs over a work post",
"P-3104-voda-i-stoki":
    "an open sewer inspection manhole in the yard of a production site with its cover lying beside it and a "
    "sampling device standing at the shaft, the workshop block with its gates behind",
"P-3105-othody-proizvodstva":
    "a waste container yard under a canopy with separate marked containers standing in a row and a drum on a "
    "pallet beside them, the gates of a workshop and a forklift further back",
"P-3201-kategoriya-na-dveri":
    "the metal door of a production block seen close up with a small category plate mounted on it beside the "
    "handle, the door standing ajar onto the bay behind",
"P-3202-vc-maly-format":
    "a cutaway of a two storey production building with a machine tool and a semi trailer at the gate on the "
    "lower floor and a smaller block with a goods lift on the upper floor",
"P-3203-strahovanie-ceha":
    "an opened policy document lying on a workshop bench with a machine nameplate and a valuation report "
    "beside it, a fire extinguisher standing at the machine bed and a lathe receding behind",
"P-3204-zimniy-schet-za-teplo":
    "a workshop bay in winter with its gate half rolled up, a thermometer mounted on a structural column in "
    "the near plane and vapour drifting in the open doorway",
"P-3205-vc-arenda-protiv-pokupki":
    "a pair of balance scales standing in a production interior with a door key and a stack of contracts on "
    "one pan and a small machine tool and a wall calendar on the other",
"P-3301-rbk-porogi-gektara":
    "an aerial view of an industrial quarter split by one straight line, a single long roofed building "
    "filling one side and a dense grid of small workshop blocks with gates on the other",
"P-3302-rbk-rynok-arendatora":
    "the long inner corridor of a new production building with a row of sectional gates repeating along one "
    "side, one of them rolled up and the rest closed, the run receding to the far end",
"P-3303-rbk-inzhenernyy-barer":
    "a distribution board in a workshop with its door open showing rows of breakers and busbars, an "
    "electricity meter mounted beside it, a machine tool under a dust cover further back",
"P-3304-vc-shest-stadiy-vybora":
    "a workshop floor plan unrolled across a desk with a tape measure, a hard hat and a printed list of "
    "machines lying on top of it and pencil marks along the gate dimensions",
"P-3305-vc-cena-prostoya":
    "a stopped lathe in an empty workshop with a part still clamped in its chuck and swarf lying in the tray, "
    "a large wall clock mounted on the wall behind it",
})


# Сцена каждого слайда карусели и серии историй: выведена из его собственного
# заголовка и подписи в файле недели. Слайд про ворота показывает ворота, слайд
# про лифт показывает лифт. Внутри одной серии сцены разные, но из одного мира:
# карусель по договору идёт по столу, карусель по территории по территории.
СЦЕНЫ_СЛАЙДОВ = {
# P-02 карусель «Полгода без отгрузок»: мир опустевшего цеха
"P-02-karusel-krt-01": "an empty loading gate of a workshop shut from the inside of the bay, the dock leveller folded down, no truck on the apron beyond it, pallets stacked against the wall",
"P-02-karusel-krt-02": "a sealed envelope lying on a workshop bench beside a bundle of keys, the roller gate of the bay standing closed behind it, a trolley parked against the wall",
"P-02-karusel-krt-03": "a pad mounted transformer standing on a low plinth in a yard, its cable trench open in front of it, a workshop wall with a closed gate behind it",
"P-02-karusel-krt-04": "a machine tool, a piston compressor and a run of dismantled racking standing together on the apron of a bay, strapped to skates and ready to be taken away",
"P-02-karusel-krt-05": "a bay stripped of equipment, ventilation ducting still running along the roof structure and a cable tray still fixed to the wall, anchor holes left in the bare floor",
"P-02-karusel-krt-06": "a switchboard cabinet bolted into the wall of an empty bay, its door shut and sealed, the conduit from it disappearing into the concrete, nothing else in the room",
"P-02-karusel-krt-07": "a printed city map sheet lying flat on a bench, two blocks cropped inside a scribed rectangle, one of them shaded solid, a steel rule along the lower margin of the sheet",
"P-02-karusel-krt-08": "a workshop gate standing wide open onto a swept bay with a machine running inside, the apron in front of it clear, a numbered plate fixed to the wall beside the opening",
# P-S договор в четверг: мир стола с документами
"P-S-dogovor-v-cetverg-01": "a poured workshop floor and the ventilation duct above it in one frame, the duct running the length of the bay and the floor freshly finished, no machine standing on either",
"P-S-dogovor-v-cetverg-02": "a stapled contract standing open on a bench, its pages held flat by a steel rule, a pen resting in the gutter between the two open pages",
"P-S-dogovor-v-cetverg-03": "a bundle of contract pages clipped together on a bench beside a folded floor plan, the corner of the top sheet turned up, a workshop gate closed behind them",
# P-S сотня мастерских: мир плотного квартала мастерских
"P-S-sotna-masterskih-v-odnom-kvartale-01": "a dense quarter of small workshops from above, dozens of saw tooth roofs packed edge to edge with narrow service yards between them, a few gates standing open",
"P-S-sotna-masterskih-v-odnom-kvartale-02": "a narrow workshop street with shutters half raised on both sides, a small lathe standing inside one doorway, crates and stock stacked along the kerb",
"P-S-sotna-masterskih-v-odnom-kvartale-03": "a machined part resting on a trolley in the drive between two blocks, the open gate of the next workshop a few steps beyond it, tool boxes by the threshold",
# P-S 10 минут на отгрузке: мир ворот и двора
"P-S-10-minut-na-kajdoj-otgruzke-01": "a yard with a semi trailer swinging round in the middle of it, painted bays marking the turning circle, the long wall of a block with numbered gates closing the far side",
"P-S-10-minut-na-kajdoj-otgruzke-02": "the open gate of a bay from inside the dark hall, the rectangle of the opening filled with the flat yard beyond, dock seals worn along its edges, a pallet truck at the threshold",
"P-S-10-minut-na-kajdoj-otgruzke-03": "a stack of loaded pallets standing just inside a bay door, stretch film catching on the corners, the gate half raised above them",
"P-S-10-minut-na-kajdoj-otgruzke-04": "the tail of a semi trailer backed hard against a dock, the gap between the bed and the leveller plate showing beneath it, rubber seals pressed against the trailer sides",
# P-25 карусель про договор: мир стола, шесть строк как шесть предметов
"P-25-karusel-dogovor-01": "a stapled contract lying open on a bench with a steel rule across the lower third of the page, a pen and a bundle of keys beside it",
"P-25-karusel-dogovor-02": "a franked envelope propped against a desk tray beside a closed contract folder, a letter opener lying across the tray",
"P-25-karusel-dogovor-03": "a folded newspaper lying on a workshop bench beside a wall calendar torn down to three remaining sheets, a pencil across the calendar",
"P-25-karusel-dogovor-04": "ventilation ducting and a cable run fixed to the wall of an empty bay above a freshly poured floor, a folded drawing sheet left on the floor beneath them",
"P-25-karusel-dogovor-05": "a machine strapped to a rigging skate standing on the apron beside an open gate, slings and shackles laid out on the concrete in front of it",
"P-25-karusel-dogovor-06": "three steel bars of rising height standing in a row on a bench beside a closed contract folder, the tallest one nearest the edge",
"P-25-karusel-dogovor-07": "a machine standing on levelling wedges in a bare bay with its covers off, hand tools and a spirit level laid out on a crate beside it",
"P-25-karusel-dogovor-08": "a bundle of contract pages held together by a bulldog clip on a bench, one extra sheet lying loose beside the bundle, a pen across it",
"P-25-karusel-dogovor-09": "a contract squared up on a bench with two chairs pulled to the same side of it, a pen resting on the top page and a folder standing closed at the far edge",
# P-S что происходит с промзонами: мир города сверху
"P-S-cto-proishodit-s-promzonami-moskvy-01": "an aerial view of a city district where workshop roofs stop against rows of new housing, the boundary running straight through the frame, tower cranes on the built side",
"P-S-cto-proishodit-s-promzonami-moskvy-02": "a workshop bay half emptied of equipment, a machine strapped to a skate near the gate and anchor holes left in the floor behind it, crates stacked along the wall",
"P-S-cto-proishodit-s-promzonami-moskvy-03": "an aerial view of a working industrial quarter with a single block outlined by the streets around it, service yards and truck bays showing in the gaps between the roofs",
"P-S-cto-proishodit-s-promzonami-moskvy-04": "a printed city map sheet spread on a bench with a straightedge laid along one street, a pencil resting where two streets cross",
# P-S суббота на территории: мир территории в рабочую субботу
"P-S-subbota-na-territorii-01": "the inner street of a territory with two semi trailers standing at open gates on the same side, an overhead crane hook lowered inside one of the bays, trolleys on the apron",
"P-S-subbota-na-territorii-02": "the entrance group of a territory with a barrier arm down across the drive, a guard window beside it and a camera on a mast above, the gate open behind",
"P-S-subbota-na-territorii-03": "a closed roller gate at the end of a row with a small wicket door set into it standing ajar, the apron in front swept clear, a trolley parked against the wall",
"P-S-subbota-na-territorii-04": "the inner street of a territory in the evening with one gate still open at the far end, a car standing on the apron in front of it, the rest of the row shut",
# P-S шахта Цольферайн: мир сохранённой шахты и московского квартала
"P-S-sahta-kotoraa-zakrylas-v-1986-godu-01": "a tall lattice mine headframe standing above a brick winding house, the empty yard beneath it swept clean, rail track ending at the foot of the structure",
"P-S-sahta-kotoraa-zakrylas-v-1986-godu-02": "a long brick industrial hall with tall steel windows, a stone plaque set into the wall beside its doorway, the headframe rising above the roofline behind it",
"P-S-sahta-kotoraa-zakrylas-v-1986-godu-03": "the inside of a converted coal washing plant, the original steel machinery left standing in the hall with a new staircase threaded between the frames",
"P-S-sahta-kotoraa-zakrylas-v-1986-godu-04": "an aerial view of a Moscow industrial quarter with workshop roofs on one side of a street and new residential towers rising on the other",
"P-S-sahta-kotoraa-zakrylas-v-1986-godu-05": "a printed district map lying on a bench beside a phone face up, a pencil resting across the map where two blocks meet",
# P-89 карусель про стройку за забором: мир общей границы со стройплощадкой
"P-89-karusel-stroyka-ryadom-01": "a construction hoarding running the width of the frame with a working block standing directly behind it, a tower crane above the roofline, the shared apron scuffed by tyres",
"P-89-karusel-stroyka-ryadom-02": "a site programme sheet clipped to a board mounted on the hoarding, a hard hat resting on the ledge beneath it, the crane base visible past the end of the board",
"P-89-karusel-stroyka-ryadom-03": "one entrance drive shared by a semi trailer and a tipper truck, temporary route marking painted across the asphalt between them, cones set along the edge of the works",
"P-89-karusel-stroyka-ryadom-04": "site cabins stacked two high standing across a row of painted parking bays, an excavator parked beside them, the bays under the cabins no longer usable",
"P-89-karusel-stroyka-ryadom-05": "a precision machine standing in a bay with fine dust settled on its covers, a dial indicator mounted on the bed, the wall beyond it shared with the works",
"P-89-karusel-stroyka-ryadom-06": "a shared drive tracked with dried mud from site wheels, the ruts running from a gate in the hoarding toward the open door of a bay",
"P-89-karusel-stroyka-ryadom-07": "the raw concrete frame of a finished new block standing beside the working one, its floors clear and its gates not yet fitted, the yard between them swept",
"P-89-karusel-stroyka-ryadom-08": "a folded site plan lying on the bonnet of a car parked at the hoarding, a pen on top of it, the gate of the works standing open beyond",
# P-S четыре минуты, пять тонн, лифт: мир территории и трёх замеров
"P-S-4-minuty-5-tonn-5-tonn-01": "an industrial territory from the roof parapet of one of its blocks, the yard laid out in painted bays below, the long roofs of the other blocks running to the boundary fence",
"P-S-4-minuty-5-tonn-5-tonn-02": "the concrete floor of a bay with the levelling foot and anchor plate of a heavy machine bolted into it, the slab joint running past the base into the depth of the hall",
"P-S-4-minuty-5-tonn-5-tonn-03": "the open doorway of a goods lift with a pallet of steel stock standing inside the cabin, a tape measure hooked on the door frame across the opening",
"P-S-4-minuty-5-tonn-5-tonn-04": "the loading gate of a block from the middle of the yard, its shutter rolled fully up, painted bay lines running from the near edge of the frame to the threshold",
# P-S первый день ленты: мир утра на территории
"P-S-pervyj-den-lenty-01": "the entrance group of a territory early in the morning, a semi trailer just through the barrier standing on the drive, the guard window beside it and the gate open ahead",
"P-S-pervyj-den-lenty-02": "an aerial view of a working quarter with one street separating the workshop roofs from a row of new residential towers standing along it",
"P-S-pervyj-den-lenty-03": "the inside of a bay in the morning with the gate rolled up at the far end, a machine standing under the crane rail and the floor marking leading out through the opening",
# P-S суббота рабочая: мир субботнего просмотра
"P-S-subbota-rabochaya-01": "the inner street of a territory with a semi trailer standing at an open gate and its ramp down, pallets on the apron beside it, the row of gates running away past them",
"P-S-subbota-rabochaya-02": "a tape measure held open across the opening of a loading gate, its blade spanning the jambs, a notebook and a bundle of keys on a crate beside the threshold",
"P-S-subbota-rabochaya-03": "the guard post at the entrance of a territory with the barrier arm raised, a visitor log book open on the ledge of its window, the drive beyond running into the yard",
# P-S первый счёт: мир офисной части и бумаг
"P-S-pervyj-scet-01": "an office corridor of an administrative block in the morning, glazed partitions along one side and a linear ceiling light running away from the near edge of the frame",
"P-S-pervyj-scet-02": "seven printed sheets fanned across a desk in an office, the top one squared to the edge, a pen and a pocket calculator lying beside them",
"P-S-pervyj-scet-03": "the yard of a territory from the roof parapet, blocks standing around it with their gates shut, painted parking bays laid out in a grid below",
# P-53 карусель про индексацию: мир договора и мерных предметов
"P-53-karusel-indeksaciya-01": "a stapled contract lying open on a bench with three words of one clause underscored by a marker stroke, a steel rule across the lower part of the page",
"P-53-karusel-indeksaciya-02": "three steel bars of gently rising height standing in a row on a bench, evenly spaced, a pocket calculator lying in front of the shortest one",
"P-53-karusel-indeksaciya-03": "four steel bars standing on a bench with the gap in height between each pair growing sharply toward the far end of the row",
"P-53-karusel-indeksaciya-04": "a machined gauge block standing upright on a bench with a dial indicator resting against its face, the indicator stand clamped down beside it",
"P-53-karusel-indeksaciya-05": "a wall mounted pressure gauge with its needle standing off zero, pipework running away from it in both directions along the wall",
"P-53-karusel-indeksaciya-06": "an empty bench with a contract page lying face down on it and a pen resting across the blank back of the sheet, nothing else on the surface",
"P-53-karusel-indeksaciya-07": "a folded drawing sheet on a bench with a straightedge, a pair of dividers and a pencil laid out in a row along its lower edge",
"P-53-karusel-indeksaciya-08": "a contract folder standing open on a bench beside a phone lying face up, a pen across the open page and a bundle of keys at the corner",
# P-S сложный процент: мир договора и двух мерных пар
"P-S-slojnyj-procent-01": "a contract page on a desk with a finger resting on one clause partway down it, the rest of the sheet lying flat under a steel rule",
"P-S-slojnyj-procent-02": "a pocket calculator lying on a printed invoice on a bench, a pencil beside it and a folded sheet of hand written figures under the corner",
"P-S-slojnyj-procent-03": "two steel bars of slightly different height standing side by side on a bench, the taller one a finger's width above the other",
"P-S-slojnyj-procent-04": "two steel bars standing far apart in height on a bench, the tall one rising well above the short one, both squared to the same base line",
"P-S-slojnyj-procent-05": "a stack of printed sheets squared up on a bench beside a phone lying face up, a pen resting across the top sheet of the stack",
# P-S суббота и вторая смена: мир территории ночью
"P-S-subbota-i-vtoraa-smena-01": "the yard of a territory at night with a car at the exit drive and its headlights raking the asphalt, the blocks around it dark except for one open gate",
"P-S-subbota-i-vtoraa-smena-02": "a barrier arm lowered across an entrance drive at night, a lamp on the guard post above it, the road beyond running out into the dark",
"P-S-subbota-i-vtoraa-smena-03": "the window of a guard post at night with a pass log book open on the ledge, a phone and a set of keys beside it, the drive dark beyond the glass",
"P-S-subbota-i-vtoraa-smena-04": "a loading gate standing open at night with light falling out of the bay onto the apron, a semi trailer backed up to it and a trolley waiting on the concrete",
}


ФОРМАТЫ = {"16:9": "16:9", "4:5": "4:5", "9:16": "9:16", "4:3": "4:3", "1:1": "1:1"}
# Кадры, которые нейросетью не рисуются: карта и схема квартала берутся из
# официального источника с подписью и датой среза, кружок и Reels это видео.
# P-05-lift и P-11-shattl отсюда убраны: открытый грузовой лифт и шаттл у КПП это
# обычные фотокадры, в файлах недель они идут с описанием кадра, а не со ссылкой
# на внешний источник, и без них у этих единиц не остаётся визуала вообще.
БЕЗ_ГЕНЕРАЦИИ = {"P-94-kvartal-karta", "P-01-krt-karta",
                 "P-93-karusel-kvartal", "P-05-krug-territoriya",
                 "P-92-peresmenka-reels"}

# Сцены месяца 2 живут отдельным модулем: их писали, пока паспорт правила другая
# пачка, и класть полторы сотни записей в один файл с паспортом значит сделать
# его нечитаемым. Вливаем при загрузке, старые имена ключей убираем.
for _имя in ("sceny_m2", "sceny_m3"):
    try:
        _мод = __import__(_имя)
    except ImportError:
        continue
    for _старое, _новое, _ in getattr(_мод, "СТАРЫЕ_КЛЮЧИ", []):
        СЦЕНЫ.pop(_старое, None)
        for _к in [k for k in СЦЕНЫ_СЛАЙДОВ if k.startswith(_старое + "-")]:
            СЦЕНЫ_СЛАЙДОВ.pop(_к, None)
    for _поле, _куда in (("СЦЕНЫ_M2", СЦЕНЫ), ("СЦЕНЫ_M3", СЦЕНЫ),
                         ("СЦЕНЫ_SLAJDOV_M2", СЦЕНЫ_СЛАЙДОВ),
                         ("СЦЕНЫ_SLAJDOV_M3", СЦЕНЫ_СЛАЙДОВ)):
        _куда.update(getattr(_мод, _поле, {}))
    БЕЗ_ГЕНЕРАЦИИ |= set(getattr(_мод, "БЕЗ_ГЕНЕРАЦИИ_M3", ()))


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
# «живая съёмка двора» и «цифры крупно» тоже ремарки: после сведения сцен они
# остались единственными подписями, которые печатались бы на картинке как текст
РЕМАРКА = re.compile(r"^\s*(кадр\b|живой кадр|живые кадр|живая съёмк|живая съемк|"
                     r"цифры крупно|вид\b|опрос|викторин|стикер|слайдер|"
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


def _без_кавычек(з):
    """Заголовок статьи в плане стоит в ёлочках, в кадре они не нужны.

    Модель честно рисует кавычки, и заголовок кадра выглядит цитатой из
    чужого текста вместо утверждения.
    """
    # Косую черту не трогаем: это авторский перенос строки, и разбирает его
    # _разрезать, превращая вторую половину в подпись.
    з = з.strip()
    for л, п in (("«", "»"), ('"', '"'), ("“", "”")):
        if з.startswith(л) and з.endswith(п):
            з = з[len(л):-len(п)].strip()
    return з


# Порог опущен с 62 до 48 после приёмки: строка в 61 знак на широком кадре
# набирается вдвое мельче нужного, и правило высоты литер вступает в спор с
# требованием напечатать текст дословно. Модель разрешает спор мелким кеглем.
ПРЕДЕЛ_ЗАГОЛОВКА = 48
# Мягкий потолок второго прохода: лучше голова в шестьдесят знаков, чем строка в
# девяносто, которую модель наберёт вдвое мельче нужного.
МЯГКИЙ_ПРЕДЕЛ = 66


ХВОСТЫ_НЕЛЬЗЯ = {
    "и", "а", "но", "или", "в", "во", "на", "с", "со", "по", "за", "от", "до",
    "при", "для", "к", "ко", "у", "из", "о", "об", "про", "над", "под", "что",
    "как", "чем", "того", "этого", "их", "его", "её", "не", "же", "ли", "бы",
}


def _обрубок(голова):
    """Разрез не должен оставлять заголовок висеть на предлоге или союзе."""
    слова = голова.rstrip(".,:;").split()
    return bool(слова) and слова[-1].lower() in ХВОСТЫ_НЕЛЬЗЯ


def _разрезать(заголовок, подпись):
    """Длинный заголовок в кадре набирается мелко, и кадр умирает на превью.

    Заголовок в плане пишется информативно, часто в два предложения. В тексте
    публикации это правильно, в кадре нет: 90 знаков нельзя набрать литерой в
    двенадцатую часть высоты. Первое предложение остаётся заголовком, хвост
    уезжает в подпись, где ему и место.
    """
    # Косая черта в заголовке слайда это авторский перенос: «ПРИШЛИТЕ АДРЕС В
    # ДИРЕКТ / ОТПРАВИМ СХЕМУ». Раньше она просто съедалась пробелом, и две фразы
    # слипались в одну строку без знака препинания.
    if " / " in заголовок:
        голова, _, хвост = заголовок.partition(" / ")
        # В заголовке бывает несколько переносов подряд: оставшиеся склеиваем
        # запятой перед союзом и точкой во всех прочих случаях.
        куски = [ч.strip() for ч in хвост.split(" / ") if ч.strip()]
        хвост = куски[0] if куски else ""
        for ч in куски[1:]:
            хвост += (", " if ч.split()[0].lower() in ("а", "и", "но", "или") else ". ") + ч
        хвост = хвост.strip()
        # Заголовок слайда пишется капсом, подпись капсом не бывает. Понижаем
        # регистр только если хвост целиком в верхнем: иначе пострадают имена.
        if хвост:
            хвост = хвост.lower() if хвост.isupper() else хвост
            хвост = хвост[0].upper() + хвост[1:]
        if хвост and not хвост.endswith((".", "!", "?")):
            хвост += "."
        подпись = (хвост + " " + подпись).strip() if подпись else хвост
        return голова.strip().rstrip(".,:;"), подпись
    if len(заголовок) <= ПРЕДЕЛ_ЗАГОЛОВКА:
        return заголовок, подпись
    # Второй потолок нужен для строк вроде «Три месяца на выезд и от 3 до 8
    # миллионов на переезд: считаем цену КРТ для цеха на 300 метров»: точка после
    # «переезд» даёт голову в 51 знак, чуть выше жёсткого порога, и строгий поиск
    # отказывался резать вовсе. Девяносто два знака мелким кеглем хуже, чем
    # пятьдесят один крупным.
    for потолок in (ПРЕДЕЛ_ЗАГОЛОВКА, МЯГКИЙ_ПРЕДЕЛ):
        голова, хвост = _искать_разрез(заголовок, потолок)
        if голова:
            break
    if not голова:
        return заголовок, подпись
    хвост = хвост[0].upper() + хвост[1:] if хвост else ""
    if хвост and not хвост.endswith((".", "!", "?")):
        хвост += "."
    подпись = (хвост + " " + подпись).strip() if подпись else хвост
    return голова.rstrip(".:;"), подпись


def _искать_разрез(заголовок, потолок):
    лучшая = None
    # Запятая берётся только как последняя мера и только для совсем длинных строк:
    # разрыв по запятой рвёт фразу, разрыв по точке нет.
    знаки = (". ", ": ", "? ", "! ", "; ")
    for знак in знаки + ((", ",) if len(заголовок) > 72 else ()):
        if знак == ", " and лучшая:
            break
        место = 0
        while True:
            место = заголовок.find(знак, место + 1)
            if место < 0:
                break
            голова = заголовок[:место].strip()
            if (14 <= len(голова) <= потолок and not _обрубок(голова)
                    and (лучшая is None or len(голова) > len(лучшая[0]))):
                лучшая = (голова, заголовок[место + len(знак):].strip())
    return лучшая or ("", "")


# Владелец 27.08.2026: истории по договору не нужны, сдаём посты, карусели и
# статьи по всем площадкам. Текст серий остаётся в планах недель, но кадры под
# них не собираются и в пакет они не попадают.
БЕЗ_ИСТОРИЙ = True


def кадры_единицы(е):
    """Список кадров под движок: один для поста, по слайду для карусели и серии."""
    if БЕЗ_ИСТОРИЙ and "истори" in е["загол"]:
        return []
    к = е["ключ"]
    осн = к.rpartition("-")[0] if к.rpartition("-")[2] in ВАРИАЦИИ else к
    # запрет базового ключа на вариацию не переносится, если у вариации своя
    # сцена: у P-01-krt-karta-b кадр не карта, а таймлайн, и в файле недели он
    # помечен генерацией. Наследование запрета отняло бы у него единственный кадр
    if к in БЕЗ_ГЕНЕРАЦИИ or (осн in БЕЗ_ГЕНЕРАЦИИ and к not in СЦЕНЫ): return []
    сцена = сцена_ключа(к)
    if not сцена: return []
    if not е["слайды"]:
        # Тема поста в плане пишется в два предложения, и в кадре это девяносто
        # знаков мелким кеглем. Режем так же, как заголовок слайда.
        тема, хвост = _разрезать(_без_кавычек(е["тема"]), "")
        return [{"ключ": к, "формат": е["формат"], "сцена": сцена, "вид": "пост",
                 "заголовок": тема, "подпись": хвост, "рубрика": рубрика(е)}]
    всего = len(е["слайды"])
    вид = "сторис" if "истори" in е["загол"] else "карусель"
    вышло = []
    for i, (номер, заголовок, подпись) in enumerate(е["слайды"], 1):
        подпись = служебная(подпись)
        ключ_слайда = f"{к}-{i:02d}"
        # сцена слайда пишется под его собственный заголовок и подпись: слайд про
        # ворота показывает ворота, слайд про лифт показывает лифт. Поверхность из
        # ПОВЕРХНОСТИ осталась запасным вариантом для серий без своих сцен: выбор
        # от ключа единицы, иначе все карусели идут по одному и тому же ряду
        сцена_слайда = СЦЕНЫ_СЛАЙДОВ.get(ключ_слайда)
        if not сцена_слайда:
            сдвиг = int(hashlib.md5(к.encode()).hexdigest()[:8], 16)
            сцена_слайда = сцена if i == 1 else ПОВЕРХНОСТИ[(сдвиг + i - 2) % len(ПОВЕРХНОСТИ)]
        _заг, _подп = _разрезать(_без_кавычек(заголовок), подпись.strip())
        вышло.append({"ключ": ключ_слайда, "формат": е["формат"], "сцена": сцена_слайда,
                      "вид": вид, "номер": i, "всего": всего,
                      "заголовок": _заг, "подпись": _подп, "рубрика": рубрика(е)})
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
