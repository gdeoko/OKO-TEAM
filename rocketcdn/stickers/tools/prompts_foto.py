# -*- coding: utf-8 -*-
"""Задания на фотореалистичные кадры пака Rocket Pack.

Промпт собирается из двух частей: свой абзац про предмет и общий
технический блок. Общий блок один на весь пак, и это не экономия -
именно он держит пак единым: один и тот же чёрный фон, один и тот же
свет, один объектив, одна композиция. Разойдись он между единицами, и
стикеры встали бы в ряд разного размера, разной яркости и с разным
краем, а владелец забраковал прошлый пак ровно за неровность.

Свой абзац отвечает за предмет: форма, материал, где лежит фирменный
цвет. Он пишется подробно, потому что общего блока модели мало: она
дорисовывает недосказанное по своему вкусу, и тогда в паке появляется
чужая вещь.
"""

ОБЩЕЕ = """
BACKGROUND, this is non negotiable: absolute PURE BLACK, hex #000000, \
mathematically flat, on every side of the object. No gradient, no vignette, \
no studio backdrop, no floor, no table, no horizon, no reflection plane, no \
stars, no nebula, no dust, no smoke, no particles, no cast shadow, no drop \
shadow, no glow halo spreading across the black. Nothing at all in the frame \
except the single object described above. Leave a generous empty black margin \
on all four edges so the object never touches the frame border.

LIGHTING: cinematic three point setup against black. Key light is a large soft \
rectangular softbox from the upper left at 45 degrees, cool neutral white, \
giving a broad gentle falloff across the surfaces and one crisp specular \
highlight on the most prominent form. A hard narrow rim light from the lower \
right in saturated cyan hex #42B2DC wraps the right silhouette edge in a thin \
bright contour line that separates the object cleanly from the black. A weaker \
rim in pale cyan hex #7FD8FA kisses the left silhouette edge. A very subtle \
violet hex #8A59F6 bounce sits in the deepest shadow. Fill is minimal so the \
shadow side stays deep, but nothing inside the object crushes to pure black.

CAMERA AND OPTICS: 85mm portrait lens equivalent, straight-on eye level, \
aperture f/9 so the whole object is tack sharp front to back. Absolutely no \
depth of field blur, no bokeh, no motion blur, no lens flare, no chromatic \
aberration.

COMPOSITION: the object is perfectly centred in a square 1:1 frame, upright \
and level unless the description says otherwise, occupying about 68 percent of \
the frame, with equal empty black margin left and right, top and bottom.

QUALITY: 8K, ultra sharp, commercial product photography of a physical \
scale model, Octane and Redshift render quality, crisp micro detail in the \
reflections and the material grain, clean anti-aliased silhouette edge against \
the black.

STRICT PROHIBITIONS: no text of any kind, no letters, no numbers, no words, no \
watermark, no signature, no caption, no logo lettering, no brand name. No \
background elements whatsoever. No packaging, no mockup, no frame, no border, \
no grid, no colour swatches, no multiple views, no collage, no side by side \
variants. Exactly one single object in the frame. The background must stay pure \
black #000000 everywhere the object is not.
"""

# ключ: (эмодзи, подпись, движение, образцы, абзац про предмет)
#
# движение: см. ДВИЖЕНИЯ в foto_sticker.py. «нет» значит, что кадр сам
# по себе не стикер и идёт в сборку парой (замок закрыт -> замок открыт).
СЮЖЕТЫ = [

("launch", "🚀", "Взлёт", "полёт", "mark", """
A premium photoreal 3D render of the same slender cone-nosed rocket from the \
attached brand mark, climbing steeply, nose to the upper right at about 45 \
degrees. Hull is polished pearl-white automotive lacquer with clearcoat, \
roughness 0.10, broad soft reflections, one razor specular sweep along the \
upper left edge. Nose tip and the two swept delta fins are brushed cool silver \
metal, circular brush grain visible, roughness 0.30, metalness 1.0. A single \
large round porthole sits on the upper hull: thick convex glass, ink-black \
interior hex #050C15, hard crescent highlight upper left, machined metal bezel \
ring with tiny hex bolts. A crisp painted accent stripe in cyan hex #42B2DC \
runs the length of the hull with a narrower deep ocean blue hex #0A5897 stripe \
under it. From the tail nozzle comes a SHORT contained thrust plume, no longer \
than one third of the rocket's own length: a white hot core fading to cyan hex \
#42B2DC and then to violet hex #8A59F6 at its very tip, with clean defined \
edges, no smoke, no soot, no long trail, no sparks scattered around.
"""),

("earth", "🌍", "Сеть", "парит", None, """
A photoreal render of planet Earth as seen from low orbit, the real thing, \
built from NASA Blue Marble satellite imagery: true continental shapes with \
Africa and Europe facing the camera, real ocean colour shifting from deep \
navy in the abyss to turquoise over the shelves, real desert ochre, real \
forest green, real ice white at the poles, and a layer of genuine wispy white \
cloud with soft self-shadowing sitting above the surface. A thin atmospheric \
limb glows pale cyan hex #7FD8FA all around the disc, brightest on the sunlit \
edge. The terminator runs down the right side: a soft gradual transition into \
night where scattered warm city lights glitter along the coastlines. Over the \
sunlit face lies a delicate network of thin glowing cyan hex #42B2DC lines \
connecting small bright nodes, like a data mesh drawn on the globe, subtle and \
elegant, never covering the geography.
"""),

("jupiter", "🟠", "Юпитер", "парит", None, """
A photoreal render of the planet Jupiter as a full sphere, built from real NASA \
Cassini and Juno imagery: the authentic banded atmosphere with alternating \
light cream zones and dark red-brown belts, genuine turbulent swirls and eddies \
where bands shear against each other, fine filamentary detail inside every \
band, and the Great Red Spot sitting in the southern hemisphere as a real \
oval storm with a darker core and a pale collar of churned cloud around it. \
Colours are the true ones: cream hex #E8D8B8, ochre hex #C89A62, brick hex \
#A65A3C, deep umber in the shadows. The sphere is lit from the upper left with \
a broad soft falloff into a dark limb on the lower right, and a thin cool cyan \
hex #42B2DC rim light traces the shadowed edge so the planet reads round.
"""),

("mars", "🔴", "Марс", "парит", None, """
A photoreal render of the planet Mars as a full sphere, built from real NASA \
Viking and MRO global mosaics: the authentic rust surface with genuine albedo \
markings, the dark basaltic plains of Syrtis Major and Acidalia clearly \
readable as darker grey-brown regions against the bright ochre dust, the pale \
Hellas basin, the great Valles Marineris canyon system cut as a long dark scar, \
the Tharsis volcanoes as subtle circular shields, and a small bright white \
polar ice cap at the top. Colours are the true ones: dust ochre hex #C1663B, \
deeper rust hex #8E4326, dark basalt grey-brown hex #5A3A2C, ice white. A very \
faint dusty haze softens the limb. Lit from the upper left, dark limb lower \
right, with a thin cyan hex #42B2DC rim light on the shadowed edge.
"""),

("saturn", "🪐", "Сатурн", "парит", None, """
A photoreal render of the planet Saturn with its full ring system, built from \
real NASA Cassini imagery, seen at a gentle tilt of about 20 degrees so the \
rings read clearly as a flat disc, not a line. The globe carries authentic soft \
pastel banding in butterscotch and cream, hex #E3C88E and hex #C9A06A, with \
very fine subtle detail, far smoother and more delicate than Jupiter. The rings \
are the real ones: distinct concentric bands of differing brightness and \
density with the dark Cassini Division cleanly visible as a gap, made of icy \
particles so they are partly translucent, brighter where they catch the light \
and dimmer where they cross in front of the planet. The rings cast a real thin \
curved shadow onto the globe, and the globe casts its shadow across the far \
side of the rings. Lit from the upper left, thin cyan hex #42B2DC rim on the \
shadowed limb.
"""),

("moon", "🌙", "Луна", "парит", None, """
A photoreal render of Earth's Moon as a full sphere, built from real NASA LRO \
imagery: the authentic near side with the dark basaltic maria clearly readable \
in their true places, Mare Tranquillitatis, Mare Serenitatis, Mare Imbrium and \
Oceanus Procellarum as grey-brown plains against the lighter cratered \
highlands, and the bright Tycho crater near the bottom with its long radiating \
ray system. Crater rims catch the light on one side and hold sharp shadow on \
the other, giving real relief; thousands of small craters pepper the highlands. \
The surface is genuinely grey, hex #B8B4AE in the highlands and hex #6E6A66 in \
the maria, with no artificial colour tint. Lit from the upper left with a long \
raking angle so the terrain stands out, dark limb lower right, thin cool cyan \
hex #42B2DC rim light on the shadowed edge.
"""),

("sun", "☀️", "Солнце", "пульс", None, """
A photoreal render of the Sun as a full sphere, built from real NASA SDO \
imagery: the churning granulated photosphere with visible convection cells, a \
few darker sunspot groups with genuine umbra and penumbra structure, and bright \
faculae networks around them. The disc glows from within, hottest white-gold at \
the centre hex #FFF3D0, deepening to orange hex #FF9A2E and then to deep amber \
hex #D2561A toward the limb, with real limb darkening. Around the edge rises a \
thin turbulent corona and two or three modest arcing prominences that loop out \
and back, no longer than a tenth of the disc's diameter, glowing orange-white \
with fine filament structure. No long flares, no rays shooting off frame, no \
lens flare, no star burst.
"""),

("astro", "👨‍🚀", "Космонавт", "парит", None, """
A premium photoreal 3D render of a modern spacesuit helmet alone, floating, \
seen three-quarter front. The shell is glossy white composite with clearcoat, \
roughness 0.12, subtle panel seams and a machined metal neck ring with locking \
lugs. The visor is a large curved gold-free mirrored bubble tinted deep cyan \
hex #0A5897, and across it runs a clean curved reflection: a soft white \
softbox streak in the upper left and, lower right, the small mirrored \
reflection of a cyan-lit planet limb. Nothing human is visible through the \
visor, it reads as a dark mirror. Two small cyan hex #42B2DC status lights sit \
on the side of the shell, and a thin cyan accent line traces the visor frame. \
No face, no person, no body, no gloves, no hands.
"""),

("shield", "🛡", "Щит VPN", "покой", None, """
A premium photoreal 3D render of a heraldic shield standing upright, pointed at \
the bottom, gently convex. The face is brushed dark gunmetal steel, roughness \
0.32, metalness 1.0, with visible fine circular brush grain and a soft anodised \
blue-grey cast. A thick polished chrome bevel frames the whole outline, \
catching a razor specular highlight along its upper left. Inset into the centre \
of the face is a glowing emblem of pure light in cyan hex #42B2DC: a simple \
bold keyhole shape, slightly emissive so it throws a faint cyan bounce onto the \
surrounding steel. Fine concentric machined grooves radiate from the emblem. \
The rivets along the bevel are real hex bolts with tiny highlights. No text, no \
letters, no cross, no star, no animal.
"""),

# Замок идёт ДВУМЯ кадрами, и это не прихоть: владелец просил один
# стикер, где замок закрыт, ключ вставили и он открылся. Одной картинкой
# такого не снять, а просить у модели «два состояния в кадре» значит
# получить коллаж, который общий блок запрещает. Поэтому снимаем два
# отдельных кадра, второй по первому образцу, и растворяем между ними.
("lock_a", "🔒", "Замок закрыт", "нет", None, """
A premium photoreal 3D render of a heavy padlock, seen straight on, upright and \
level. The body is a rounded rectangle of polished chrome steel with a deep \
mirror finish, roughness 0.08, showing one broad soft studio reflection band \
across it and razor highlights on its chamfered edges. The shackle is brushed \
steel, roughness 0.30, a clean U arcing above the body and CLOSED: both of its \
ends are fully seated in the two shoulders of the body, no gap anywhere. A \
machined keyhole sits in the lower centre of the body face, empty and dark \
inside, with a chamfered metal collar around it. A thin horizontal light line is \
inlaid across the upper body face in cyan hex #42B2DC, dim and cool, barely \
glowing. Four tiny hex bolts sit at the corners of the body face. No key, \
nothing inserted in the keyhole, no chain, no hasp, no text.
"""),

("lock_b", "🔓", "Замок открыт", "нет", "lock_a", """
A premium photoreal 3D render of EXACTLY THE SAME padlock as in the attached \
reference image: same body shape, same chrome finish, same brushed steel \
shackle, same keyhole, same size, same camera angle, same straight-on view, \
same position in frame, same lighting. Change only two things. First, the \
shackle is now OPEN: its right end has lifted clear of the body shoulder and \
the whole shackle has pivoted around its left end, swinging up and to the right \
by about 40 degrees, so a clear gap is visible where it used to seat. Second, a \
polished brass key is now INSERTED in the keyhole, pushed fully home, its \
round bow standing out below the body face, catching a warm specular highlight. \
The inlaid light line across the body face now glows BRIGHT cyan hex #42B2DC, \
clearly emissive, throwing a cool bounce onto the chrome around it. Nothing \
else changes, no chain, no hasp, no text.
"""),

("key", "🔑", "Ключ", "покой", None, """
A premium photoreal 3D render of a single modern key lying diagonally, bow at \
the lower left and blade pointing to the upper right. The bow is a solid \
rounded shape in polished brass with a warm mirror finish, roughness 0.09, with \
a circular hole through it and a chamfered edge catching a hard specular \
crescent. The blade is machined nickel steel, roughness 0.22, with crisply cut \
teeth along the lower edge and a fine milled groove running its length. Where \
bow meets blade there is a short knurled collar with real micro knurling. A \
thin cyan hex #42B2DC light line is etched along the blade groove and glows \
faintly, throwing a cool bounce onto the steel beside it. No keyring, no chain, \
no tag, no text.
"""),

("anon", "🥷", "Анонимность", "парит", None, """
A premium photoreal 3D render of a featureless mask, a smooth oval face shield \
with no eyes, no nose and no mouth, floating upright and facing the camera. The \
surface is deep matte charcoal hex #14181F, soft velvety roughness 0.72, \
absorbing light so it reads as a void, with only a faint sheen along the brow \
and the jaw. Across the eye line runs a single horizontal band of glowing cyan \
hex #42B2DC light, sharp edged, slightly emissive, throwing a narrow cool \
bounce onto the matte surface just below it. A thin polished chrome edge trims \
the whole outline of the mask, catching a bright rim from the lower right. No \
face, no eyes, no features, no person, no hood, no body, no hands, no text.
"""),

("geo", "🌐", "Смена страны", "парит", None, """
A premium photoreal 3D render of a stylised globe with a location pin. The \
globe is a polished sphere of deep ocean blue glass hex #0A5897 with real \
refraction and a bright specular highlight in the upper left; raised across its \
surface are the continents as slightly proud plates of brushed chrome, edges \
catching a thin bright line, arranged in a plausible world layout. Thin engraved \
meridian and parallel lines glow faintly cyan hex #42B2DC. Standing on the \
upper right of the globe is a classic teardrop map pin, its body polished \
violet hex #8A59F6 lacquer with clearcoat, a chrome collar at the neck, and a \
round window in its head glowing cyan white. No text, no country names, no \
flags.
"""),

("tunnel", "🕳", "Туннель", "пульс", None, """
A premium photoreal 3D render of a short circular tunnel portal seen head on, \
as if looking straight down a tube. The outer ring is a thick machined chrome \
collar with concentric turned grooves and a chamfered lip, roughness 0.10, \
catching a hard specular arc along its upper left. Inside, the tube recedes \
inward through a series of six glowing concentric rings, each smaller than the \
last, running from bright cyan hex #7FD8FA at the mouth through cyan hex \
#42B2DC to deep violet hex #5B32C9 at the far end, where a small bright point \
of white light sits at the vanishing centre. The inner wall between the rings \
is dark brushed metal so the glowing rings read as light, not paint. No text, \
no arrows, no particles outside the portal.
"""),

("unblock", "🚫", "Блок снят", "пульс", None, """
A premium photoreal 3D render of a heavy prohibition disc, the round sign with \
a thick diagonal bar, shown BROKEN. The disc face is glossy signal red lacquer \
hex #D0342C with clearcoat and a broad soft studio reflection, the raised rim \
and the diagonal bar are polished chrome with razor highlights. The whole disc \
has cracked cleanly in two along a jagged fracture running from upper left to \
lower right; the two halves have separated by a small gap of about one tenth of \
the disc width and rotated slightly apart. Out of the fracture pours bright \
cyan hex #42B2DC light, illuminating the broken inner edges, which show real \
thickness and a chipped chalky core. A few small chips hang in the gap. No \
text, no letters, no smoke, no sparks flying off frame.
"""),

("bolt", "⚡", "Скорость", "пульс", None, """
A premium photoreal 3D render of a single lightning bolt symbol standing \
upright, the classic zig-zag: a broad shoulder at the top left, a sharp descent \
to the right, a hard reversal and a pointed tip at the bottom right. It is a \
solid physical object with real thickness of about one eighth of its height, \
its faces flat and its edges cleanly chamfered. The material is thick polished \
glass tinted cyan hex #42B2DC with genuine refraction and internal caustics, \
lit from within so the core glows brighter than the surface, with a bright \
white-cyan hot line running down the middle of the volume. The chamfered edges \
catch hard specular lines, and the polished faces show a soft studio reflection. \
No electricity arcs, no sparks, no cloud, no text.
"""),

("dc", "🏢", "Свои ЦОД", "покой", None, """
A premium photoreal 3D render of a single server rack cabinet standing upright, \
seen three-quarter front. The frame is brushed dark gunmetal steel, roughness \
0.34, with real perforated mesh doors showing a fine regular hole pattern, \
chamfered corner posts and machined hinges. Behind the mesh, stacked server \
units fill the rack, each with a row of small status LEDs glowing cyan hex \
#42B2DC, a few in violet hex #8A59F6, spilling a soft cool light through the \
perforations onto the surrounding metal. The top panel has a recessed vent \
grille. Cable bundles are neatly dressed down one side in dark sleeving. Real \
micro detail: screw heads, rail slots, ventilation slits. No text, no labels, \
no screens, no room, no floor.
"""),

("speed", "🏎", "На пределе", "пульс", None, """
A premium photoreal 3D render of a single round instrument gauge, seen straight \
on, like a high end car speedometer. The bezel is machined chrome with turned \
concentric grooves and a chamfered lip catching a hard specular arc. The dial \
face is deep matte ink hex #050C15 with a fine sunburst texture, carrying a \
crisp tick scale of raised metal marks around the circumference, long marks and \
short ones, and an arc segment at the high end glowing cyan hex #42B2DC. The \
needle is polished steel with a counterweight tail and a bright red-orange \
lacquer tip, swung hard over to the high end of the scale, almost at the stop. \
A domed glass cover sits over the dial with real refraction and one crescent \
reflection in the upper left. No numbers, no digits, no text, no letters on the \
dial.
"""),

("wifi", "📶", "Раздача", "пульс", None, """
A premium photoreal 3D render of a signal symbol: four upright bars of \
increasing height standing in a row, left shortest and right tallest, each a \
solid rounded-rectangle block with real thickness and softly chamfered edges. \
The two left bars are brushed cool silver metal, roughness 0.30. The two right \
bars are thick polished glass tinted cyan hex #42B2DC, lit from within with a \
bright glowing core and real refraction, throwing a faint cool bounce onto the \
metal bars beside them. All four sit on a common baseline, evenly spaced, \
perfectly level. Above and behind the tallest bar arc three thin concentric \
radio waves of glowing cyan light, each thinner and fainter than the last. No \
text, no device, no antenna, no phone.
"""),

("cloud", "☁️", "Облако", "парит", None, """
A premium photoreal 3D render of a stylised cloud as a solid physical object, \
built from four or five overlapping rounded lobes forming the classic cloud \
silhouette, wider than it is tall, flat along the bottom. The material is \
glossy pearl-white lacquer with clearcoat, roughness 0.11, showing broad soft \
studio reflections and a crisp specular sweep across the upper left lobes; the \
undersides fall into a cool blue-grey shadow hex #8FA6BA. A thin cyan hex \
#42B2DC light line is inlaid along the bottom edge of the cloud and glows, \
casting a cool bounce under the lobes. Below it, one small arrow of cyan light \
points upward into the cloud body. No rain, no vapour, no real cloud wisps, no \
text.
"""),

("play", "▶️", "Стриминг", "пульс", None, """
A premium photoreal 3D render of a play button: an equilateral triangle \
pointing right, set inside a round disc, seen straight on. The disc is polished \
chrome with a turned concentric grain and a chamfered rim catching a hard \
specular arc along the upper left. The triangle is a raised solid block of \
thick glass tinted cyan hex #42B2DC with real refraction, internal caustics and \
a bright glowing core, its edges cleanly chamfered and catching white specular \
lines, standing proud of the disc face by about one tenth of the disc diameter \
and casting a soft contact shadow onto it. A thin ring of cyan light is \
recessed just inside the rim and glows faintly. No text, no screen, no player \
interface, no progress bar.
"""),

("download", "⬇️", "Загрузка", "покой", None, """
A premium photoreal 3D render of a download symbol as a physical object: a thick \
arrow pointing straight down, its shaft a square-section bar and its head a \
broad triangular point, standing above a shallow open tray. The arrow is \
polished chrome with a mirror finish, roughness 0.08, showing a soft studio \
reflection band down the shaft and razor highlights on the chamfered edges of \
the head. The tray below is a wide shallow U of brushed gunmetal steel with a \
bright cyan hex #42B2DC light line glowing along its inner floor, throwing a \
cool bounce up onto the arrow head above it. The arrow hovers just above the \
tray with a visible gap. No text, no progress bar, no percentage, no file icon.
"""),

("chart", "📈", "Рост", "покой", None, """
A premium photoreal 3D render of a rising bar chart: four solid upright bars in \
a row on a common baseline, each taller than the one to its left, evenly spaced, \
with real thickness and softly chamfered top edges. The first two bars are \
brushed gunmetal steel, roughness 0.32; the third is polished chrome; the \
fourth and tallest is thick glass tinted cyan hex #42B2DC, lit from within with \
a glowing core and real refraction. Rising above and across them runs a bold \
arrow of glowing cyan light, climbing from the lower left to the upper right \
and ending in a clean arrow head above the tallest bar, slightly emissive so it \
throws a cool bounce onto the bars beneath. No text, no numbers, no axes, no \
grid lines.
"""),

("fire", "🔥", "Турбо", "пульс", None, """
A premium photoreal 3D render of a single flame, the classic teardrop fire \
shape, tall with a curling pointed tip leaning slightly to the right and a \
broad rounded base. It is rendered as real fire with genuine turbulent internal \
structure and layered tongues, but in the brand palette instead of orange: the \
hot core is white-cyan hex #EAFBFF, surrounding it a body of bright cyan hex \
#42B2DC, and the outer tongues and the tip fade into violet hex #8A59F6 and \
then into deep violet hex #5B32C9 where they thin out. The edges of the tongues \
are crisp and defined, not blurry, and the whole flame glows from within. No \
wood, no candle, no lighter, no smoke, no sparks, no embers, no text.
"""),

("ok", "✅", "Готово", "пульс", None, """
A premium photoreal 3D render of a check mark as a solid physical object, the \
classic tick: a short stroke coming down to the left and a long stroke rising \
to the upper right, with real thickness of about one sixth of its height, flat \
faces and cleanly chamfered edges, the ends cut square. The material is glossy \
lacquer in vivid signal green hex #27C56A with clearcoat, showing a broad soft \
studio reflection across the long stroke and a razor specular line along the \
upper chamfer. The inner corner where the two strokes meet holds a soft ambient \
occlusion shadow. A thin edge of cyan hex #42B2DC light runs along the bottom \
chamfer and glows faintly. No circle, no box, no background shape, no text.
"""),

("bad", "❌", "Не вышло", "пульс", None, """
A premium photoreal 3D render of a cross mark as a solid physical object: two \
equal bars crossing at right angles in an X, with real thickness of about one \
sixth of their length, flat faces, cleanly chamfered edges and square cut ends. \
The material is thick polished glass tinted signal red hex #D0342C with genuine \
refraction and internal caustics, lit from within so the volume glows deeper red \
where the two bars overlap. The chamfered edges catch hard white specular lines \
and the faces show a soft studio reflection. The X is upright and symmetrical, \
both bars at exactly 45 degrees. No circle, no box, no background shape, no \
text.
"""),

("heart", "❤️", "Спасибо", "пульс", None, """
A premium photoreal 3D render of a heart as a solid physical object, the classic \
symmetrical heart silhouette with two round lobes at the top, a clean cleft \
between them and a pointed tip at the bottom, gently plump and rounded in three \
dimensions like a polished stone. The material is glossy lacquer in deep \
crimson hex #E0303F with a thick clearcoat, roughness 0.08, showing two broad \
soft studio reflections across the lobes and one small hard specular dot high \
on the left lobe. The lower right side falls into a rich dark shadow with a \
violet hex #8A59F6 bounce in it, and a thin cyan hex #42B2DC rim traces the \
right silhouette edge. Perfectly symmetrical, perfectly upright. No hands, no \
arrow, no wings, no text, no sparkles.
"""),

("like", "👍", "Одобряю", "парит", None, """
A premium photoreal 3D render of a stylised thumbs-up hand, the friendly \
smooth-surfaced kind used in modern 3D iconography, not a real photographed \
human hand: a rounded closed fist seen three-quarter front with the thumb \
extended straight up, four fingers folded into soft rounded blocks with gentle \
creases where they meet, and a smooth wrist stub cut off cleanly at the bottom. \
Proportions are chunky and appealing, the thumb slightly thick and the knuckles \
soft. The material is glossy pearl-white lacquer with clearcoat, roughness \
0.12, showing broad soft reflections on the knuckles and a crisp specular \
highlight along the top of the thumb; the shadow side is cool blue-grey hex \
#8FA6BA. Around the wrist stub sits a thick cuff of cyan hex #42B2DC lacquer \
with a thin chrome trim ring. Perfectly symmetrical lighting, clean anatomy, \
five digits total, nothing deformed. No arm, no sleeve, no person, no text.
"""),

("warn", "⚠️", "Внимание", "пульс", None, """
A premium photoreal 3D render of a warning triangle as a solid physical object: \
an equilateral triangle standing on its base with generously rounded corners, \
real thickness of about one eighth of its side, flat faces and cleanly \
chamfered edges. The face is glossy lacquer in warm amber hex #F5A524 with \
clearcoat, showing a broad soft studio reflection; the chamfered rim is \
polished chrome catching razor specular lines. Raised proud of the face in the \
centre stands a thick exclamation mark, a tapered vertical bar with a round dot \
below it, moulded in the same amber but darker hex #B06E08 and lit so it casts \
a soft contact shadow on the triangle face. A thin cyan hex #42B2DC light line \
is inlaid along the lower chamfer and glows faintly. No text, no letters, no \
road sign post.
"""),

("hello", "👋", "Привет", "парит", None, """
A premium photoreal 3D render of a stylised waving hand, the friendly \
smooth-surfaced kind used in modern 3D iconography, not a real photographed \
human hand: an open palm facing the camera, four fingers together and slightly \
splayed, pointing up and tilted a little to the right, the thumb extended out \
to the left, and a smooth wrist stub cut off cleanly at the bottom. Proportions \
are chunky and appealing, fingertips softly rounded, gentle creases where \
fingers meet the palm. The material is glossy pearl-white lacquer with \
clearcoat, roughness 0.12, with broad soft reflections across the palm and a \
crisp specular highlight along the fingers; the shadow side is cool blue-grey \
hex #8FA6BA. Around the wrist stub sits a thick cuff of violet hex #8A59F6 \
lacquer with a thin chrome trim ring. Clean anatomy, exactly four fingers and \
one thumb, nothing deformed, nothing extra. No arm, no sleeve, no person, no \
text.
"""),
]


def промпт(абзац, есть_образец=False):
    """Абзац про предмет плюс общий технический блок."""
    начало = ("Using the attached image as the shape reference, keep it exact "
              "where the description says so.\n\n" if есть_образец else "")
    return (начало + абзац.strip() + "\n" + ОБЩЕЕ).strip()
