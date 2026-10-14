# -*- coding: utf-8 -*-
"""Список вырезов для урока «Выбор оборудования»: что генерим и каким промптом.

Каждый предмет идёт из самого занятия: о нём там говорят словами. Стиль общий,
чтобы вещи стояли в одном свете и читались как один комплект, а не как сборная
солянка со стоков.

    python3 predmety.py > predmety.json
"""
import json

СТИЛЬ = (
 "Single isolated product object on a fully transparent background, nothing else in frame. "
 "Photoreal studio product photography of real professional filmmaking gear, shot on a 100mm macro "
 "lens at f/8 with focus stacking, the whole object tack sharp from the nearest edge to the farthest, "
 "three quarter hero angle slightly above eye level so the volume and depth of the object read "
 "clearly against nothing. Lighting is a large soft key from the upper left with a gentle gradient "
 "falloff across the body, a tight violet rim light #7C5CFF tracing the left silhouette edge and a "
 "cooler cyan accent #22D3EE along the right edge, both subtle and physically plausible, plus a soft "
 "bounce fill from below so the lower third never collapses into muddy black. Materials must look "
 "real and used: anodized aluminium with fine machining marks and micro scratches, textured rubber "
 "grips with visible moulding grain, matte polycarbonate with a slight sheen, glass elements with "
 "honest multicoating reflections in deep blue and green, brushed steel screws, a few tiny dust "
 "specks, one faint fingerprint smudge on metal. The object itself stays natural black, graphite and "
 "grey professional gear; the violet and cyan only kiss the edges and never repaint the body. "
 "Perfect crisp alpha edge with no halo, no white fringe, no background fill of any kind, no ground "
 "plane, no cast shadow on any surface, no reflection plate under the object, no vignette. "
 "Composition: the object is centred, fills about eighty percent of the square frame, nothing is "
 "cropped by the frame edge, generous empty transparent margin all around. "
 "Quality target: commercial catalogue photography, 8K detail, ultra sharp micro texture, correct "
 "perspective, no lens distortion on straight edges. "
 "STRICT NEGATIVES: no text, no letters, no numbers, no brand names, no logos, no badges, no "
 "watermarks, no labels, no price tags, no people, no hands, no backdrop, no gradient background, "
 "no studio floor, no table, no second object unless explicitly described, no collage, no "
 "illustration, no plastic 3D render look, no cartoon, no toy proportions. "
)

ПРЕДМЕТЫ = {
 # камера и её тело
 "kamera_sverhu": "A full frame mirrorless camera body with a short prime lens seen from a high three quarter angle looking down onto the top plate, showing the mode dial, shutter button, record button and hot shoe, articulated screen folded closed.",
 "kamera_ekran": "A mirrorless camera body in profile with the articulated side screen swung fully out and tilted toward the viewer, the screen itself switched off and matte dark, battery door closed, strap lugs visible.",
 "kinokamera": "A compact cinema camera in a skeleton cage rig with a top handle, a side wooden grip, an empty cold shoe and a short cine lens with visible focus gear ring, chunky and professional.",
 "telefon_shtativ": "A modern smartphone held vertically in a spring loaded metal clamp on a small desktop tripod with spread legs, phone screen switched off and black, clamp screw visible.",
 "fotoapparat": "A compact DSLR style photo camera body with a pentaprism hump and a short zoom lens, viewfinder eyecup visible, grip textured rubber, mode dial on the shoulder.",
 # оптика
 "obyektiv_portret": "A fast 85mm portrait prime lens standing upright on its bayonet mount, long barrel, wide front element with a warm violet coating reflection, broad rubberised focus ring.",
 "obyektiv_zoom": "A standard 24 to 70 zoom lens at mid extension, visible zoom and focus rings with different ribbing, petal lens hood mounted forward, metal mount with electronic contacts facing the viewer.",
 "obyektiv_makro": "A macro lens lying horizontally at a three quarter angle, extremely long barrel, internal focusing scale window, front element deep inside the barrel.",
 "bayonet": "A lens bayonet mount ring seen almost straight on, polished stainless steel flange with three locking tabs, gold electronic contact pins in a row, rubber weather seal gasket.",
 "diafragma_blok": "An iris diaphragm mechanism unit taken out of a lens, nine curved metal blades forming a rounded aperture opening, blackened steel, actuator ring around it.",
 "filtr_nd": "A circular neutral density filter in an aluminium ring, glass tilted so a soft cyan reflection slides across it, knurled edge for screwing, rear threads visible.",
 "blenda": "A petal shaped lens hood standing on its wide end, matte black inner flocking visible inside, bayonet tabs on the narrow end.",
 # матрица и запись
 "matrica": "A bare camera image sensor on its green circuit board, the rectangular sensor surface showing a faint rainbow interference sheen, gold bonding wires along the edges, tiny surface mount components around it.",
 "karta_sd": "A single SD memory card standing tilted on its long edge, contact pins clearly visible, write protect switch on the side, matte label area completely blank with no text.",
 "karta_cf": "A CFexpress type B memory card standing tilted, thick metal shell, dense contact slots on the end, blank label area with no text.",
 "ssd_disk": "A compact external solid state drive with a short braided cable coiled loosely beside it, textured metal casing, USB C port visible.",
 "kardrider": "A card reader hub with two open card slots, short cable, aluminium body, slots empty and dark inside.",
 "akkumulyator": "A camera battery pack standing upright next to a small charging dock, contact terminals on top, blank label area with no text.",
 # звук
 "radiosistema": "A wireless microphone system: a small transmitter pack with a short antenna and a matching receiver pack, both with blank dark screens, arranged side by side at slight angles.",
 "naushniki": "Closed back studio monitoring headphones folded at a three quarter angle, thick padded earcups in worn pleather, coiled cable looping once.",
 "mikser": "A small portable audio recorder mixer with four physical gain knobs, two XLR inputs on the side, dark unlit screen, rubberised chassis.",
 "vetrozashita": "A furry grey windjammer windshield for a shotgun microphone, long hair fibres catching the rim light, mounting collar visible at the open end.",
 "kabel_xlr": "A black XLR microphone cable coiled into a neat loose spiral, both connectors visible, one male with pins and one female with sockets, metal shells.",
 # свет
 "svet_panel": "A bi colour LED panel light with a honeycomb grid attachment, four barn doors partially open, control knobs on the back edge, panel surface unlit and matte.",
 "svet_palka": "An RGB LED light tube wand standing diagonally, the tube glowing softly with a violet to cyan gradient along its length, rubber end caps, small control panel dark.",
 "otrazhatel": "A round five in one reflector disc seen at a steep angle, silver side facing the viewer with soft crinkled texture, zipped fabric edge.",
 "zontik": "A translucent white shoot through photo umbrella opened, ribs visible through the fabric, metal shaft pointing toward the viewer at a three quarter angle.",
 "svet_stoyka": "A collapsible light stand with three spread legs and two raised sections, tightening knobs, empty spigot on top, air cushioned joints.",
 # движение и опора
 "shtativ_mini": "A tabletop mini tripod with short rubber footed legs spread wide and a small ball head with an empty quick release plate on top.",
 "slayder": "A camera slider rail with a carriage sitting in the middle of the rail, smooth anodised rails, two end feet, tension knob on the carriage.",
 "monopod": "A collapsed monopod standing vertically with a small folding foot base at the bottom and a ball head on top, twist locks along the sections.",
 "klyetka": "An empty camera cage rig frame with a top handle and multiple threaded mounting holes, cold shoe mounts, NATO rail along one side.",
 "monitor": "A five inch on camera field monitor on a small articulating arm, screen switched off and matte black, sun hood attached, battery plate on the back.",
 # материал и монтаж
 "noutbuk": "A thin open laptop seen at a three quarter angle with the screen switched off and perfectly black, keyboard visible in perspective, aluminium chassis.",
 "hlopushka": "A film clapperboard with the clapper sticks open at an angle, the slate surface completely blank and matte with no writing at all, diagonal stripes on the sticks.",
 "bloknot": "A small hardcover notebook lying closed at a slight angle with a slim metal pen resting diagonally on its cover, elastic band closure, blank cover.",
 "flesh": "A compact USB flash drive standing upright with its metal connector exposed, brushed body, small loop hole at the end.",
}


def главное():
    з = [{"файл": "u3_%s.png" % имя, "размер": "1:1", "промпт": СТИЛЬ + текст}
         for имя, текст in ПРЕДМЕТЫ.items()]
    print(json.dumps(з, ensure_ascii=False))


if __name__ == "__main__":
    главное()
