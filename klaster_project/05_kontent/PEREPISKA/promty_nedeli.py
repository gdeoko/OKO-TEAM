# -*- coding: utf-8 -*-
"""Промпты визуала недели 1: посты Телеграма и карусель.

Правила соблюдены: английский промпт от двух тысяч знаков, русский текст на
картинке задан внутри промпта в кавычках, весь дизайн описан, а не только фон.
Референсами идут настоящие снимки объекта, чтобы кадры были про «Кластер», а
не про безымянный завод.

Палитра бренда клиента: графит #14171C, тёплый белый #F5F1E8, янтарь #E8A400.
"""

БРЕНД = (
 "Brand system, follow exactly: deep graphite #14171C as the base of dark areas, "
 "warm white #F5F1E8 for light planes and body type, amber #E8A400 as the single "
 "accent used on one number, one rule or one highlighted word per frame and "
 "nowhere else. Typography: tall condensed grotesque, all caps, heavy weight for "
 "the headline, clean humanist sans for the supporting line, generous margins, "
 "text living inside the composition as a designed layer, never floating on top "
 "like a sticker. Layout is editorial and premium, the kind of frame a large "
 "industrial developer would run in a paid campaign. "
)

КАЧЕСТВО = (
 "Rendered at 8K, ultra sharp, commercial photography and design hybrid, "
 "physically based light, honest materials, natural perspective, no fisheye, no "
 "HDR halos, no plastic surfaces, no stock-photo cheesiness, no watermarks. "
 "Aspect ratio exactly 16:9, 1920 by 1080 pixels, full bleed. "
)

КИРИЛЛИЦА = (
 "Text rendering is critical. Every letter must be correct Russian Cyrillic, "
 "spelled exactly as written here, with correct letterforms for Д, Ж, З, И, Й, Л, "
 "У, Ц, Ч, Ш, Щ, Ъ, Ы, Ь, Э, Ю, Я and dots on Ё where written. No "
 "transliteration, no invented words, no extra captions beyond what is listed, "
 "even kerning, letters never touching, lines never overlapping. "
)

ЧИСТО = (
 "No invented brands, no logotypes of other companies, no latin brand words. "
 "Signage stays blank unless the brief says otherwise. Nothing dystopian: no "
 "night, no neon, no smoke, no rust, no decay, no sci-fi glow, no floating "
 "particles, no lens flares used as decoration. "
)

ПРОМПТЫ = {

"P-01-krt-karta": dict(
 образцы=["fasad_1", "dvor"],
 текст=(
  "An editorial aerial illustration of a Moscow industrial quarter seen from "
  "directly above at about four hundred metres, rendered as a clean cartographic "
  "photo hybrid. The frame is split by information, not by a line: on the left "
  "two residential blocks under construction shown in cool desaturated grey with "
  "tower cranes, on the right a working production estate with long light roofs, "
  "marked parking, trucks at loading docks and green strips along the roads. A "
  "precise thin amber #E8A400 outline traces the boundary of the production plot "
  "like a surveyor would draw it, flat and graphic, with small tick marks, no "
  "glow. Over the residential half a soft graphite overlay carries a fine grid, "
  "the way a planning document looks. "
  + БРЕНД +
  "Camera: 24mm equivalent, straight down with a five degree tilt, midday sun so "
  "shadows are short and the plan reads clearly, high micro contrast on roofs and "
  "road markings. Composition: the outlined estate sits in the right two thirds, "
  "the upper left quadrant stays calm and slightly darkened for the type. "
  "Typography in the upper left: a headline in Russian reading exactly "
  "«ТРИ МЕСЯЦА НА ВЫЕЗД», under it a supporting line reading exactly "
  "«Столько остаётся арендатору, когда квартал уходит под жильё», and lower a "
  "small caption reading exactly «6-я Радиальная, 17с1 · вне зоны КРТ на 08.2026». "
  "Headline in warm white with a short amber rule above it, supporting line in "
  "light grey, caption small and quiet. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)),

"P-05-opros": dict(
 образцы=["dvor", "proezd", "fasad_3"],
 текст=(
  "A bright documentary photograph of a truck yard in a working Moscow business "
  "park, shot at eye level from the position of a person standing where a lorry "
  "would stop. A clean white box truck is mid-manoeuvre in front of loading "
  "docks, its turning path suggested by fresh amber #E8A400 guidance lines "
  "painted on new asphalt, drawn as real road marking and not as a graphic "
  "effect. In the near foreground the bottom of a sectional gate, a concrete "
  "kerb and a manhole cover give scale. In the middle distance a man in a light "
  "shirt with a folder stands watching the manoeuvre, ordinary, unposed, face "
  "partly turned away. Morning light, open blue sky with light cumulus, long "
  "clean shadows. "
  + БРЕНД +
  "Camera: 35mm at f/8, camera height 1.6 metres, verticals parallel, deep "
  "sharpness from the kerb to the far facade, honest colours. Composition: the "
  "left third is calm asphalt kept free for the type, the truck and the man fill "
  "the right. A subtle graphite gradient sits under the type area so the letters "
  "read without a solid plate. "
  "Typography in the left third: a headline in Russian on two lines reading "
  "exactly «КУДА ВЫ ИДЁТЕ ПЕРВЫМ?». The headline must fit inside the left third "
  "with a wide margin on both sides and must never touch or cross the right edge "
  "of its column; if it does not fit, set it smaller rather than wider. Under it "
  "a supporting line "
  "reading exactly «Опытного видно за пять минут», and at the bottom a small "
  "line reading exactly «Разворот в три приёма: 10 минут на каждой машине» "
  "Headline warm white, amber rule "
  "above it. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)),

"P-08-moshnost": dict(
 образцы=["ceh", "fasad_3"],
 текст=(
  "A precise industrial still life photograph of an electrical distribution board "
  "inside a clean modern production hall: a grey metal cabinet with the door "
  "open, neat rows of breakers, tidy cable management, a digital meter with a "
  "calm readout, all lit by cool daylight from a high window plus soft fill. On "
  "the polished light concrete floor in front of the board lies a coiled heavy "
  "cable and a clipboard with a technical drawing. Everything is new and "
  "maintained, nothing dusty or dangerous, no sparks and no warning drama. In the "
  "blurred background the hall opens up: white columns, daylight battens, a clean "
  "forklift far away. "
  + БРЕНД +
  "Camera: 50mm at f/4, camera height 1.4 metres, slight three quarter angle to "
  "the cabinet, sharp on the breakers, background falling off softly, no "
  "distortion. Composition: the right third is calm bright wall reserved for the "
  "type, with a soft graphite gradient behind the letters. Amber appears only on "
  "one number in the type and on a single marker tag on a cable. "
  "Typography in the right third: a headline in Russian on two lines reading "
  "exactly «5 МВТ НА ЗДАНИИ. ДО ВАШЕГО СТАНКА МОЖЕТ НЕ ДОЙТИ НИЧЕГО», under it a "
  "supporting line reading exactly «Спросите цифру в договоре, а не мощность "
  "здания», and at the bottom a small line reading exactly "
  "«От 20 кВт на помещение с увеличением до 300 кВт». The figure «300 кВт» is the "
  "only element in amber. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)),

"P-04-sosedi": dict(
 образцы=["ceh", "dvor", "fasad_1"],
 текст=(
  "A warm documentary photograph of two ordinary craftsmen meeting in the yard "
  "between two production buildings: one in a work apron holding a small "
  "machined metal part, the other in a light shirt looking at it, both in their "
  "forties, unposed, caught mid conversation, faces partly turned away from "
  "camera. Around them a real working estate on a clear morning: light grey "
  "buildings with window ribbons, open sectional gates, a pallet stack, a clean "
  "forklift crossing the frame in the distance, young trees along the road. "
  "Nothing staged, nothing corporate, the feeling of a place where people know "
  "each other by name. "
  + БРЕНД +
  "Camera: 35mm at f/2.8, camera height 1.6 metres, the two men on the right "
  "third in sharp focus, the estate softly falling off behind them, natural "
  "colours, morning light from the left. Composition: the upper left stays open "
  "sky and calm facade for the type, with a light graphite gradient under the "
  "letters. "
  "Typography in the upper left: a headline in Russian on two lines reading "
  "exactly «СОСЕД ПО ТЕРРИТОРИИ СДЕЛАЕТ ДЕТАЛЬ ЗА ЧАС», under it a supporting "
  "line reading exactly «Сто производств и шесть отраслей на одной площадке», and "
  "a small bottom line reading exactly «6-я Радиальная, 17с1». Amber only on the "
  "short rule above the headline. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)),
}

# Карусель: восемь слайдов в едином стиле, вертикаль 4:5.
КАРУСЕЛЬ_ОБЩЕЕ = (
 "PORTRAIT ORIENTATION, this is mandatory: the frame is taller than it is wide, "
 "aspect ratio exactly 4:5, 1080 pixels wide and 1350 pixels tall, full bleed. "
 "Never output a square or a landscape frame. One visual system "
 "across the whole series: deep graphite #14171C background field, warm white "
 "#F5F1E8 type, amber #E8A400 on exactly one element per slide, a thin amber rule "
 "above the headline, and a slim footer strip carrying the small line "
 "«clusterspace.ru» on the left and the slide number on the right. Typography: "
 "tall condensed grotesque all caps for the headline, clean humanist sans for the "
 "body line, wide margins, text designed into the frame. "
)

КАРУСЕЛЬ = [
 ("K-01-1", "a close photograph of an official letter lying on a工 worn desk, "
            "seen at an angle, with a wristwatch and keys beside it",
  "«ОСВОБОДИТЬ ПОМЕЩЕНИЕ ЗА 3 МЕСЯЦА»", "Письмо приходит обычным вторником", "1/8"),
 ("K-01-2", "a wide shot of a heavy electrical transformer strapped on a low "
            "loader trailer on a highway at dawn",
  "ТРАНСФОРМАТОР ЕДЕТ ДОЛЬШЕ", "Чем 3 месяца, которые вам дали на выезд", "2/8"),
 ("K-01-3", "a freshly poured industrial concrete floor being levelled, wet "
            "surface catching daylight, empty hall around",
  "ПОЛ ПОД СТАНИНУ СОХНЕТ 28 СУТОК", "Деньгами это не ускоряется", "3/8"),
 ("K-01-4", "clean ventilation ductwork under a high industrial ceiling, an "
            "engineer on a lift platform working on a connection",
  "ВЕНТИЛЯЦИЯ: МЕСЯЦ ПРОЕКТ, МЕСЯЦ МОНТАЖ", "И только потом первый запуск", "4/8"),
 ("K-01-5", "a small group of workers waiting at a bus stop near a residential "
            "district in the early morning, seen from behind",
  "ПОЛОВИНА СМЕНЫ ЖИВЁТ У СТАРОГО АДРЕСА", "Через весь город они не поедут", "5/8"),
 ("K-01-6", "two documents side by side on a table, one thick with stamps, one a "
            "single printed sheet, shot from above",
  "КОМПЕНСАЦИЯ СОБСТВЕННИКУ. ПИСЬМО АРЕНДАТОРУ", "Так это устроено по закону", "6/8"),
 ("K-01-7", "an empty production unit mid move-out, a few pallets, marks on the "
            "floor where machines stood, daylight through an open gate",
  "ОТ 3 ДО 8 МЛН РУБЛЕЙ", "Переезд цеха на 300 м² и 6 месяцев до прежнего объёма", "7/8"),
 ("K-01-8", "a clean aerial of a working production estate on a clear morning, "
            "an amber cartographic outline around the plot",
  "ПРОВЕРЬТЕ СВОЙ КВАРТАЛ ЗА 4 МИНУТЫ", "Инструкция по ссылке в профиле", "8/8"),
]


def карусель_промпт(сцена, заголовок, строка, номер):
    """Слайд карусели целиком в генерации: и сцена, и текст, и знак бренда.

    Правило владельца жёсткое: ничего не собираем кодом поверх картинки. Текст
    пишем внутри промпта, логотип и настоящие снимки объекта прикладываем
    образцами, вертикальный формат просим прямо в первой строке.
    """
    return (
     "PORTRAIT VERTICAL POSTER, size 1024 by 1536 pixels. This is the first and "
     "most important requirement: the image is taller than it is wide. Do not "
     "return 1536 by 1024, do not return a square, do not return a landscape "
     "image under any circumstances. "
     f"This is one slide of an eight slide carousel for an industrial business "
     f"park. Photographic base filling the upper two thirds: {сцена}. Documentary "
     "light, honest materials, real textures, nothing staged, nothing that looks "
     "like stock photography. "
     "The lower third is a solid deep graphite #14171C panel where the typography "
     "lives, and the photograph fades into it with a soft gradient, so the slide "
     "reads as one designed object. "
     + КАРУСЕЛЬ_ОБЩЕЕ +
     f"Typography inside the graphite panel, set as part of the design: a "
     f"headline in Russian reading exactly {заголовок}, set in a tall condensed "
     f"grotesque, all caps, warm white #F5F1E8, with a short amber #E8A400 rule "
     f"above it. Under the headline a supporting line reading exactly «{строка}» "
     f"in a clean humanist sans, light grey. At the very bottom a thin divider "
     f"and a footer line: on the left the small text «clusterspace.ru», on the "
     f"right the slide number «{номер}» in amber. The logo mark from the attached "
     "logo file sits small in the upper left corner of the photograph, "
     "reproduced exactly, undistorted, no other marks anywhere. "
     "Camera: 35mm at f/4, eye level unless the scene says otherwise, verticals "
     "parallel, sharp subject, soft background falloff, restrained cinematic "
     "colour, no orange and teal, no crushed blacks, no bloom. "
     + ЧИСТО +
     "No fake official documents: any paper in frame carries no institution name, "
     "no coat of arms, no stamp and no readable legal text. "
     + КИРИЛЛИЦА +
     "Rendered at 8K, ultra sharp, print quality detail, no compression "
     "artefacts, no banding in the graphite panel, premium finish for a paid "
     "campaign.")


for имя, сцена, заг, стр, ном in КАРУСЕЛЬ:
    ПРОМПТЫ[имя] = dict(образцы=["logo", "ceh", "fasad_1"],
                        текст=карусель_промпт(сцена, заг, стр, ном))



ПРОМПТЫ["P-02-cena-scet"] = dict(
 образцы=["ceh", "fasad_1"],
 текст=(
  "A calm office still life shot from above at a slight angle: a printed invoice "
  "and a printed listing lie side by side on a matte dark desk, a pen and a "
  "phone with a calculator on screen beside them. The two sheets are clearly "
  "different documents, the numbers on them deliberately out of focus and "
  "unreadable, no institution names, no stamps, no logos, nothing that could be "
  "read as a real company paper. A single amber #E8A400 sticky flag marks one "
  "line on the invoice. Light is soft daylight from a window on the left with a "
  "gentle falloff to the right, the desk surface keeps its texture. "
  + БРЕНД +
  "Camera: 50mm at f/4 from above at about 30 degrees, sharp on the marked line, "
  "the rest falling off softly, no distortion, honest colour. Composition: the "
  "upper right area is clean dark desk kept free for the type. "
  "Typography in the upper right: a headline in Russian on two lines reading "
  "exactly «900 В ОБЪЯВЛЕНИИ, 1098 В СЧЁТЕ», under it a supporting line reading "
  "exactly «Обмана нет, и это самое неприятное», and a small bottom line reading "
  "exactly «3 вопроса, которые снимают разницу». The figure «1098» is the only "
  "element in amber. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО))

ПРОМПТЫ["P-06-ota"] = dict(
 образцы=["fasad_1", "proezd"],
 текст=(
  "A documentary photograph of a dense small-workshop district in a large Asian "
  "city: narrow street, two and three storey buildings where the ground floor is "
  "a working metal workshop with an open roller shutter and the upper floors are "
  "flats with laundry and plants on the balconies. A worker in overalls carries a "
  "small machined part across the street, a bicycle leans on the wall, a school "
  "building is visible at the end of the street. Late afternoon light, warm, "
  "honest, no exotic postcard styling, no tourists. "
  + БРЕНД +
  "Camera: 35mm at f/4, eye level, slight one point perspective down the street, "
  "sharp foreground, soft distance, restrained documentary colour. Composition: "
  "the upper left sky and wall area stays calm for the type with a soft graphite "
  "gradient behind the letters. "
  "Typography in the upper left: a headline in Russian on two lines reading "
  "exactly «9100 ЦЕХОВ В 1983. ОСТАЛОСЬ 3481», under it a supporting line "
  "reading exactly «Район Ота, Токио: как дорогая земля съедает производство», "
  "and a small bottom line reading exactly «Разбираем по 1 городу в месяц». The "
  "figure «3481» is the only element in amber. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО))

ПРОМПТЫ["P-07-pol"] = dict(
 образцы=["ceh", "dvor"],
 текст=(
  "A precise industrial photograph inside a clean production hall: a heavy metal "
  "lathe standing on a polished light concrete floor, its cast iron base bolted "
  "down, fresh amber #E8A400 floor marking running past it. Beside the machine a "
  "steel rule and a folded technical drawing lie on the floor, giving the frame a "
  "sense of measurement. Daylight comes from a high window band on the left, LED "
  "battens overhead, white columns receding into the depth of the hall, a neat "
  "pallet stack far away. Everything is maintained and working, no dirt, no "
  "rust, no drama. "
  + БРЕНД +
  "Camera: 35mm at f/5.6, camera height 1.2 metres so the floor plane reads "
  "clearly, verticals parallel, sharp from the drawing to the machine, honest "
  "materials. Composition: the right third is calm bright wall reserved for the "
  "type with a soft graphite gradient behind the letters. "
  "Typography in the right third: a headline in Russian on two lines reading "
  "exactly «200 КГ ИЛИ 5 ТОНН», under it a supporting line reading exactly "
  "«На фотографии эти помещения выглядят одинаково», and a small bottom line "
  "reading exactly «5 т/м² на 1 этаже, 1,2 т/м² на верхних». The figure «5 ТОНН» "
  "is the only element in amber. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО))

ПРОМПТЫ["P-10-obed"] = dict(
 образцы=["fasad_1", "dvor", "ceh"],
 текст=(
  "A warm documentary photograph of a canteen inside an industrial business park "
  "at lunch time: workers in clean overalls and a couple of engineers in shirts "
  "sit at simple tables with trays, daylight floods in through a tall window that "
  "shows the yard and a production building outside. On the counter a normal hot "
  "line with soup and second courses, a woman in a white coat serving. The mood "
  "is ordinary and comfortable, people talking, nobody posing, faces mostly "
  "turned away from camera. "
  + БРЕНД +
  "Camera: 35mm at f/2.8, camera height 1.5 metres, the nearest table sharp, the "
  "hall falling off softly, natural warm colour, no orange grading. Composition: "
  "the lower left area over an empty table stays calm for the type with a light "
  "graphite gradient behind the letters. "
  "Typography in the lower left: a headline in Russian on two lines reading "
  "exactly «СМЕНА ЕЗДИТ ОБЕДАТЬ 20 МИНУТ», under it a supporting line reading "
  "exactly «Каждый день, за ваш счёт», and a small bottom line reading exactly "
  "«Столовая, душевые и 267 машиномест на территории». The figure «20 МИНУТ» is "
  "the only element in amber. "
  + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО))


if __name__ == "__main__":
    for имя, п in ПРОМПТЫ.items():
        знаков = len(п["текст"])
        print(f"{имя:16} {знаков:5} знаков {'ок' if знаков >= 2000 else 'КОРОТКО'}")
