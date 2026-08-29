# -*- coding: utf-8 -*-
"""Светлые кадры брокер-тура. Правка Добермана от 29.08.2026.

Его слова: «Тёмные производственные картинки - ассоциация со старыми заводами.
Все современные заводы и предприятия светлые, белые, с хорошим светом» и
«ощущение, что Лос-Анджелес 2028 года и машины уже начали войну с человечеством».

Что меняем против прошлой серии:
  · день вместо ночи, естественный свет вместо неона;
  · белое и светло-серое здание, синее небо, зелень, чистый бетон;
  · янтарь бренда остаётся акцентом на надписях и деталях, а не свечением;
  · никаких энергосетей, куполов, порталов, голограмм и частиц;
  · люди в кадре живые и обычные, а не силуэты в контровом свете.

Промпт по-английски, от 2000 знаков, русские надписи в кавычках внутри.
"""

СВЕТ = (
 "Overall look, and this is the most important instruction in the brief: bright, "
 "clean, optimistic daylight. This is a modern working business park in Moscow "
 "photographed on a clear late summer morning, not a dystopia and not an old "
 "Soviet plant. Sunlight is high and soft, the sky is open blue with light "
 "cumulus, surfaces are light grey concrete, white profiled metal, clean glazing "
 "and fresh asphalt. Everything reads airy and well maintained. "
 "Strictly forbidden: night, dusk, neon, glowing energy grids, light domes, "
 "holograms, floating particles, lens flares used as decoration, orange fog, "
 "teal and orange grading, silhouetted figures against backlight, sci-fi styling "
 "of any kind, smoke, sparks, rust, decay, cracked asphalt and puddles. "
)

БРЕНД = (
 "Brand: the accent colour amber #E8A400 appears only in small deliberate places, "
 "on the headline lettering, a thin rule and painted floor lines, never as glow "
 "and never covering the frame. Base palette is warm white #F7F5F0, light grey "
 "#D8DCE0, clean concrete #B9BEC4 and deep graphite #24282E for type contrast. "
 "Typography: tall condensed grotesque, all caps, heavy weight for the headline, "
 "clean humanist sans for the small line. Text sits in a calm area of the frame "
 "with a generous margin, never over a busy area. "
)

БЕЗ_ВЫДУМАННОГО = (
 "No invented brands anywhere in the frame. Building signage, vehicle liveries, "
 "banners and screens must stay blank or, if a sign is clearly visible on the "
 "administrative block, it reads exactly «КЛАСТЕР» and nothing else. Never render "
 "any other company name, logotype, latin brand word or made up park name. "
)

КИРИЛЛИЦА = (
 "Text rendering is critical. Every letter must be correct Russian Cyrillic, "
 "spelled exactly as given, correct letterforms for Д, Ж, З, И, Й, Л, У, Ц, Ч, Ш, "
 "Щ, Ъ, Ы, Ь, Э, Ю, Я, with the dots on Ё where written. No transliteration, no "
 "invented words, no extra captions or watermarks beyond what is listed. Kerning "
 "even, letters never touching, lines never overlapping. "
)

КАЧЕСТВО = (
 "Rendered at 8K, ultra sharp, commercial architectural photography, physically "
 "based rendering, honest materials, natural perspective, no fisheye, no HDR "
 "halos, no oversharpening, no plastic surfaces, premium finish for a paid "
 "campaign. 16:9 aspect ratio, exactly 1920 by 1080 pixels, full bleed."
)

ПРОМПТЫ = {

"EV-01-svet-tur": (
 "A wide aerial three quarter photograph of a modern industrial business park in "
 "Moscow at ten in the morning, shot from a drone at about ninety metres. The "
 "estate reads as one organised campus: long light grey production buildings with "
 "white profiled metal cladding and continuous window bands, flat roofs with tidy "
 "rooftop units, wide clean internal roads with fresh line marking, ordered rows "
 "of parked cars, a few trucks standing calmly at loading aprons, young trees and "
 "mown green lawns along the roads, a glazed four storey administrative block with "
 "a bright entrance canopy in the near foreground. People walk towards that "
 "entrance in ordinary business clothes, small in frame, unhurried. "
 + СВЕТ + БРЕНД +
 "Camera: 35mm equivalent at f/6.3, 45 degree oblique, horizon in the upper "
 "quarter, gentle haze in the far distance where the city skyline sits, no "
 "vignetting. Composition: the campus occupies the middle band, the lower left "
 "quarter is a calm strip of road and lawn reserved for the type, the upper "
 "quarter is open sky. "
 "Typography in the lower left: a headline in Russian reading exactly "
 "«БРОКЕР-ТУР · 2 СЕНТЯБРЯ · 11:00», and under it a small line reading exactly "
 "«6-я Радиальная, 17 · новый конференц-зал». Headline in deep graphite on a "
 "light plate, or in warm white over the darker road surface, whichever keeps it "
 "perfectly legible, with a short amber rule above it. "
 + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО),

"EV-02-svet-blok": (
 "A bright interior photograph of an empty modern production unit, taken from the "
 "open gate looking in. White walls, a high clean ceiling with white steel "
 "structure and rows of daylight LED battens, a polished light grey concrete floor "
 "that reflects softly, a wide band of natural light coming through a glazed "
 "section and through the open sectional gate behind the camera. The volume feels "
 "generous, airy and ready: nothing is stored here yet, only a neat stack of new "
 "pallets against one wall and a clean forklift parked at the side. A man in a "
 "light shirt and dark trousers stands ten metres in, half turned, looking up at "
 "the height of the hall, holding a folder. He is lit clearly and looks calm and "
 "positive, an ordinary broker seeing a good unit for the first time. "
 + СВЕТ + БРЕНД +
 "Camera: 24mm at f/8, camera height 1.6 metres, one point perspective slightly "
 "off centre, verticals parallel, everything from three metres to the far wall "
 "sharp. Amber appears only as painted traffic lines on the floor and as the "
 "headline colour. Composition: the left third stays calm and light for the type, "
 "the man and the depth of the hall fill the right. "
 "Typography in the left third: a headline in Russian reading exactly "
 "«ВЫ ЗАХОДИТЕ ПЕРВЫМ», and under it a small single line reading exactly "
 "«Блоки 100-12 000 м² · 5 т/м² · от 20 до 300 кВт». "
 + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО),

"EV-03-svet-krt": (
 "A clean daylight aerial photograph of the same business park seen from directly "
 "above at about two hundred metres, almost a plan view, so the site reads like a "
 "living map. The estate is bright and orderly: light roofs, clean roads, marked "
 "parking, green strips, trucks at the aprons. Around it the surrounding city is "
 "visible and deliberately calmer in tone: residential blocks and construction "
 "sites rendered in soft desaturated light grey, clearly separate from the estate. "
 "A precise thin amber #E8A400 outline traces the boundary of the estate plot, "
 "drawn as a crisp cartographic line with small tick marks, the way a surveyor "
 "would draw it, flat and graphic, without glow, without a dome, without particles "
 "and without any energy effect. "
 + СВЕТ + БРЕНД +
 "Camera: 24mm equivalent at f/8, straight down with a five degree tilt, midday "
 "sun so shadows are short and the plan reads clearly, high micro contrast on "
 "roofs and road markings. Composition: the outlined estate sits centre right, the "
 "upper left quadrant is calm city texture reserved for the type. "
 "Typography in the upper left: a headline in Russian reading exactly "
 "«ВАШ АДРЕС ВНЕ ЗОНЫ КРТ», and under it a small line reading exactly "
 "«Площадка остаётся производственной». Headline in deep graphite for maximum "
 "legibility against the light aerial, with a short amber rule above it. "
 + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО),

"EV-04-svet-zal": (
 "A bright interior photograph of a new conference hall in a business park, shot "
 "from the back of the room towards the stage. Large windows along the left wall "
 "flood the room with clean morning daylight, white ceiling with recessed "
 "luminaires, light acoustic wall panels, a large screen showing a neutral light "
 "slide, rows of comfortable dark grey chairs with a few people already seated and "
 "two more arriving down the aisle in ordinary business clothes, a table with "
 "water bottles and printed folders near the entrance. The mood is the calm "
 "positive minute before a working meeting starts. "
 + СВЕТ + БРЕНД +
 "Camera: 28mm at f/5.6, camera height 1.7 metres, symmetrical composition along "
 "the aisle, verticals parallel, natural depth of field with the far screen "
 "slightly softer. Amber appears only in the headline and as a thin accent line on "
 "the stage edge. Composition: the lower right area over the empty chairs stays "
 "calm and light for the type. "
 "Typography in the lower right: a headline in Russian reading exactly "
 "«СЕГОДНЯ В 11:00», and under it a small line reading exactly "
 "«6-я Радиальная, 17 · 4 этаж · сбор с 10:40». "
 + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО),
}

if __name__ == "__main__":
    for имя, т in ПРОМПТЫ.items():
        print(f"{имя:20} {len(т):5} знаков {'ok' if len(т) >= 2000 else 'КОРОТКО'}")
