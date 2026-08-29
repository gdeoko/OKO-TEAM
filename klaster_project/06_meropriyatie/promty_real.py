# -*- coding: utf-8 -*-
"""Промпты генерации по референсам клиента.

Доберман попросил привязаться к их картинкам, Даниэль уточнил: не накладывать
текст на фото, а генерировать по их кадрам красивый светлый визуал. Поэтому
к каждому промпту прикладываются реальные снимки объекта, а в тексте прямо
сказано, что именно из них надо сохранить: форму корпуса, перфорированные
панели, чёрный потолок с воздуховодами, тёплые линейные светильники.

Объекты разные: фасад, производственный блок, конференц-зал, территория.
Одни офисы подряд не ставим.
"""

СВЕТ = (
 "Overall look, the most important instruction in this brief: bright, clean, "
 "optimistic daylight, a modern working Moscow business park photographed on a "
 "clear late summer morning. High soft sunlight, open blue sky with light "
 "cumulus, fresh air, everything reads well maintained and premium. Strictly "
 "forbidden: night, dusk, neon, glowing grids, holograms, floating particles, "
 "decorative lens flares, orange fog, teal and orange grading, silhouettes "
 "against backlight, sci-fi styling, smoke, sparks, rust, decay, cracked "
 "asphalt, puddles, construction scaffolding, building materials in big bags, "
 "site rubbish. The building is finished and in service, not under works. "
)

БРЕНД = (
 "Brand: amber #E8A400 appears only in small deliberate places, on the headline "
 "lettering, a short rule and painted floor or road lines, never as glow and "
 "never covering the frame. Base palette warm white #F7F5F0, light grey #D8DCE0, "
 "clean concrete #B9BEC4, deep graphite #24282E for type contrast. Typography: "
 "tall condensed grotesque, all caps, heavy weight for the headline, clean "
 "humanist sans for the small line, text placed in a calm area with a generous "
 "margin. "
)

КИРИЛЛИЦА = (
 "Text rendering is critical. Every letter must be correct Russian Cyrillic, "
 "spelled exactly as given, correct letterforms for Д, Ж, З, И, Й, Л, У, Ц, Ч, "
 "Ш, Щ, Ъ, Ы, Ь, Э, Ю, Я. No transliteration, no invented words, no extra "
 "captions or watermarks beyond what is listed. Kerning even, letters never "
 "touching, lines never overlapping. "
)

БЕЗ_ВЫДУМАННОГО = (
 "No invented brands anywhere in the frame. Vehicle liveries, banners and "
 "screens stay blank, and any visible sign on the building reads exactly "
 "«КЛАСТЕР» and nothing else. Never render another company name, logotype or "
 "latin brand word. "
)

КАЧЕСТВО = (
 "Rendered at 8K, ultra sharp, commercial architectural photography, physically "
 "based rendering, honest materials, natural perspective, no fisheye, no HDR "
 "halos, no oversharpening, no plastic surfaces, premium finish for a paid "
 "campaign. 16:9 aspect ratio, exactly 1920 by 1080 pixels, full bleed."
)

ССЫЛКА = "The attached photographs are the real object. "

ПРОМПТЫ = {

"real-1-fasad": dict(
 образцы=["fasad_1", "fasad_2", "fasad_3"],
 текст=(
  ССЫЛКА +
  "Recreate this exact building as a finished, polished architectural "
  "photograph on a bright summer morning. Keep the architecture recognisable "
  "and true to the reference: a long two storey production and office block, "
  "white perforated metal panel band running along the whole upper floor, "
  "continuous dark framed window ribbon below it, flat roof, a straight clean "
  "asphalt drive along the facade with fresh line marking, tall slim street "
  "lights, low green planting strip in front. Same proportions, same rhythm of "
  "panels and windows, same perspective from the drive looking along the "
  "facade. What changes: the building is complete and immaculate, all "
  "scaffolding, temporary fences, pallets and construction bags are gone, the "
  "asphalt is new, the grass is mown, a few clean cars are parked in order and "
  "two people in business clothes walk towards the entrance, small in frame. "
  + СВЕТ + БРЕНД +
  "Camera: 24mm at f/8, camera height 1.6 metres, three quarter view along the "
  "facade, verticals strictly parallel, sky occupying the upper third. "
  "Composition: the lower left area over the asphalt stays calm and free for "
  "the type. Typography in the lower left: a headline in Russian reading "
  "exactly «БРОКЕР-ТУР · 2 СЕНТЯБРЯ · 11:00», and under it a small line reading "
  "exactly «6-я Радиальная, 17 · новый конференц-зал». Headline in warm white "
  "with a short amber rule above it. "
  + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО)),

"real-2-ceh": dict(
 образцы=["ceh", "fasad_3", "dvor"],
 текст=(
  ССЫЛКА +
  "Recreate the interior of this production hall as a bright, premium "
  "photograph. Keep what the reference shows: a wide clean industrial hall, "
  "white walls, rows of round white columns carrying the ceiling, a light "
  "polished concrete floor with soft reflections, a band of daylight coming "
  "from the glazed openings along the far wall. What changes: everything is "
  "finished, bright and ready for a tenant, the ceiling carries neat rows of "
  "daylight LED battens, fresh amber traffic lines are painted on the floor, "
  "and the hall feels airy and generous rather than empty and cold. In the left "
  "third a broker in a light shirt with a lanyard holds a tablet with a simple "
  "floor plan and talks to a client in a dark jacket, both ordinary business "
  "people in their forties, faces partly turned away, natural posture, caught "
  "mid conversation during a viewing. Far in the background a clean forklift "
  "and a neat stack of new pallets. "
  + СВЕТ + БРЕНД +
  "Camera: 24mm at f/5.6, camera height 1.6 metres, one point perspective "
  "slightly off centre, verticals parallel, sharp from three metres to the far "
  "wall. Composition: the upper right quadrant is calm bright wall kept free "
  "for the type. Typography in the upper right: a headline in Russian on two "
  "lines reading exactly «КТО ВЛАДЕЕТ ИНФОРМАЦИЕЙ, ТОТ ПЕРВЫМ ДЕЛАЕТ СДЕЛКУ», "
  "and under it a small line reading exactly «Всё о свободных блоках из первых "
  "рук». Headline in deep graphite with a short amber rule above it. "
  + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО)),

"real-4-zal": dict(
 образцы=["zal_1", "zal_2"],
 текст=(
  ССЫЛКА +
  "Recreate this conference hall as a bright, premium photograph taken minutes "
  "before a business meeting starts. Keep the room unmistakably the same as in "
  "the reference: a rectangular hall shot down the central aisle towards the "
  "stage, dark graphite ceiling with exposed round ventilation ducts running "
  "along both sides, warm linear light lines recessed in the ceiling, textured "
  "acoustic wall panels with a subtle pattern, black chairs with writing tablets "
  "and tan leather straps arranged in straight rows, a wide projection screen on "
  "the far wall, tall windows with light roller blinds on the right. What "
  "changes: the room is warmer and brighter, daylight pours through the right "
  "hand windows and lifts the whole space, about twenty five people in ordinary "
  "business clothes are already seated, two more walk down the aisle away from "
  "camera, a speaker stands beside the screen. The screen shows a neutral light "
  "slide with no text. "
  + СВЕТ + БРЕНД +
  "Camera: 28mm at f/5.6, camera height 1.7 metres, symmetrical composition "
  "along the aisle, verticals strictly parallel, natural depth of field with the "
  "far screen slightly softer. Composition: the lower left area over the seats "
  "stays calm for the type. Typography in the lower left: a headline in Russian "
  "reading exactly «СЕГОДНЯ В 11:00», and under it a small line reading exactly "
  "«6-я Радиальная, 17 · 4 этаж · сбор с 10:40». Headline in warm white with a "
  "short amber rule above it. "
  + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО)),

"real-5-dvor": dict(
 образцы=["dvor", "proezd", "fasad_2"],
 текст=(
  ССЫЛКА +
  "Recreate this loading yard as a bright, premium photograph of a working "
  "business park. Keep the place recognisable from the reference: a long light "
  "grey production building with a continuous window ribbon and a white "
  "perforated panel band above, a wide open yard in front of it, loading docks "
  "along the facade, trucks standing at the docks. What changes: the yard is "
  "finished and immaculate, the asphalt is new and dry with fresh white and "
  "amber line marking, the sky is open and blue, low green planting runs along "
  "the edge. Two clean white box trucks stand at the docks, one is being loaded. "
  "In the near foreground on the right a broker in a light shirt walks beside a "
  "client in a dark jacket, both talking, folder under the arm, ordinary "
  "business people, faces partly turned away, unhurried. "
  + СВЕТ + БРЕНД +
  "Camera: 35mm at f/8, camera height 1.6 metres, three quarter view across the "
  "yard, verticals parallel, deep sharpness. Composition: the lower left "
  "quarter over the asphalt stays calm and free for the type. Typography in the "
  "lower left: a headline in Russian reading exactly «СДЕЛКА: ИСКУССТВО ИЛИ НАВЫК?», and "
  "under it a small line reading exactly «Пять блоков аргументов для вашего "
  "клиента». Headline in deep graphite on the light asphalt, with a short amber "
  "rule above it. "
  + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО)),
}

if __name__ == "__main__":
    for имя, п in ПРОМПТЫ.items():
        print(f"{имя:16} {len(п['текст']):5} знаков, образцы: {', '.join(п['образцы'])}")
