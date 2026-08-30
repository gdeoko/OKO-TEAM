# -*- coding: utf-8 -*-
"""Промпты визуала недель 2-4: посты и карусели.

Собираются из одной сборки, чтобы весь месяц выглядел одной серией: та же
палитра, та же типографика, тот же характер съёмки. Меняются сцена и надписи.

Правила соблюдены: английский промпт от 2000 знаков, русский текст задан
внутри промпта, референсами идут настоящие снимки объекта и логотип клиента,
формат передаётся драйверу отдельно (посты 16:9, карусели 4:5).
"""

БРЕНД = (
 "Brand system, follow exactly: deep graphite #14171C as the base of dark areas, "
 "warm white #F5F1E8 for light planes and body type, amber #E8A400 as the single "
 "accent used on one number, one rule or one highlighted word per frame and "
 "nowhere else. Typography: tall condensed grotesque, all caps, heavy weight for "
 "the headline, clean humanist sans for the supporting line, generous margins, "
 "text living inside the composition as a designed layer, never floating on top "
 "like a sticker. Editorial and premium, the kind of frame a large industrial "
 "developer runs in a paid campaign. "
)

СЪЁМКА = (
 "Documentary light, honest materials, real textures, nothing staged and nothing "
 "that looks like stock photography. Restrained cinematic colour, no orange and "
 "teal, no crushed blacks, no bloom, no vignette added in post. Light comes from "
 "one clear direction with gentle falloff, concrete stays concrete, metal stays "
 "metal, paper keeps its fibre. Everything in frame has a reason to be there. "
)

ЧИСТО = (
 "No invented brands, no logotypes of other companies, no latin brand words, no "
 "readable signage beyond what the brief asks for. No fake official documents: "
 "any paper in frame carries no institution name, no coat of arms, no stamp and "
 "no readable legal text. Nothing dystopian: no night, no neon, no smoke, no "
 "rust, no decay, no sci-fi glow, no floating particles, no decorative flares. "
)

КИРИЛЛИЦА = (
 "Text rendering is critical. Every letter must be correct Russian Cyrillic, "
 "spelled exactly as written here, with correct letterforms for Д, Ж, З, И, Й, Л, "
 "У, Ц, Ч, Ш, Щ, Ъ, Ы, Ь, Э, Ю, Я and dots on Ё where written. No "
 "transliteration, no invented words, no extra captions beyond what is listed, "
 "even kerning, letters never touching, lines never overlapping. "
)

КАЧЕСТВО = (
 "Rendered at 8K, ultra sharp, physically based light, natural perspective, no "
 "fisheye, no HDR halos, no plastic surfaces, no watermarks, print quality "
 "detail, no compression artefacts, no banding in the graphite areas. "
)


def пост(сцена, камера, зона, заголовок, строка, низ="", акцент=""):
    """Горизонтальный кадр к посту: сцена плюс типографика в спокойной зоне."""
    акц = (f"The element «{акцент}» is the only one set in amber. " if акцент else "")
    низ_строка = (f"and at the bottom a small line reading exactly «{низ}». "
                  if низ else "")
    return (
     f"A premium editorial photograph for an industrial brand campaign. "
     f"Scene: {сцена} " + СЪЁМКА + БРЕНД +
     f"Camera: {камера} Composition: {зона} stays calm and uncluttered for the "
     "typography, with a soft graphite gradient behind the letters so they read "
     "without a solid plate. "
     f"Typography in that area: a headline in Russian reading exactly "
     f"«{заголовок}», under it a supporting line reading exactly «{строка}», "
     + низ_строка +
     "The headline is set in warm white with a short amber rule above it, the "
     "supporting line in light grey, the bottom line small and quiet. The "
     "headline must fit inside its column with wide margins and never touch the "
     "frame edge: if it does not fit, set it smaller rather than wider. "
     + акц + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)


def слайд(сцена, заголовок, строка, номер, всего):
    """Вертикальный слайд карусели: фото сверху, графитовая панель снизу."""
    return (
     "PORTRAIT VERTICAL POSTER, this comes before everything else: the image is "
     "taller than it is wide, close to 4:5, and never landscape or square. "
     f"This is slide {номер} of {всего} in a carousel for an industrial business "
     f"park. Photographic base filling the upper two thirds: {сцена} " + СЪЁМКА +
     "The lower third is a solid deep graphite #14171C panel where the typography "
     "lives, and the photograph fades into it with a soft gradient, so the slide "
     "reads as one designed object. " + БРЕНД +
     f"Typography inside the graphite panel: a headline in Russian reading "
     f"exactly «{заголовок}», under it a supporting line reading exactly "
     f"«{строка}». At the very bottom a thin divider and a footer line: on the "
     f"left the small text «clusterspace.ru», on the right the slide number "
     f"«{номер}/{всего}» in amber. The logo mark from the attached logo file sits "
     "small in the upper left corner of the photograph, reproduced exactly, "
     "undistorted, and no other marks appear anywhere. "
     "Camera: 35mm at f/4, eye level unless the scene says otherwise, verticals "
     "parallel, sharp subject, soft background falloff. "
     + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)


# ── посты недель 2-4 ──────────────────────────────────────────────────────
ПОСТЫ = {
"P-201-otvet": dict(
 образцы=["ceh", "fasad_1"],
 сцена="a working desk in a leasing office: an open floor plan of a production "
       "unit, a steel tape measure lying across it, a phone showing a chat with "
       "a timestamp, a pen and a coffee cup. Shot from above at a slight angle.",
 камера="50mm at f/4 from above at about 40 degrees, sharp on the plan and the "
        "phone, edges falling off softly.",
 зона="the right third of the frame over the plain desk surface",
 заголовок="ОДИН ВОПРОС, ОТВЕТ В ТОТ ЖЕ ДЕНЬ",
 строка="Ставка, свободные блоки, нагрузка и мощность цифрами",
 низ="clusterspace.ru · 8 985 331 02 71", акцент="ОДИН ВОПРОС"),

"P-202-lift": dict(
 образцы=["ceh", "dvor"],
 сцена="the open doors of a large freight lift seen from inside a production "
       "unit: a pallet with metal stock standing in the cabin, a worker beside "
       "it for scale, floor marking visible in the doorway, clean industrial "
       "light.",
 камера="24mm at f/5.6, camera height 1.5 metres, one point perspective into "
        "the cabin, verticals parallel.",
 зона="the left third over the wall beside the lift",
 заголовок="5 ТОНН И ГАБАРИТ КАБИНЫ",
 строка="Станок проходит по весу и не проходит по высоте",
 низ="2 грузовых лифта по 5 тонн · кран-балка для негабарита", акцент="5 ТОНН"),

"P-203-kadry": dict(
 образцы=["ceh", "fasad_1"],
 сцена="an experienced machinist in his fifties standing at a lathe in a clean "
       "workshop, hands on the controls, looking at the part he is turning. "
       "Daylight from a high window band, tidy tools, no mess.",
 камера="50mm at f/2.8, eye level, sharp on the hands and the face in three "
        "quarter view, workshop softly out of focus behind.",
 зона="the upper right over the bright wall",
 заголовок="СРЕДНИЙ ВОЗРАСТ ТОКАРЯ 55 ЛЕТ",
 строка="Зарплаты станочников за год выросли на 39 %",
 низ="Спрос обгоняет предложение в 3-4 раза", акцент="55 ЛЕТ"),

"P-204-smeta": dict(
 образцы=["ceh", "dvor"],
 сцена="an empty production unit prepared for a new tenant: bare polished "
       "concrete floor, fresh white walls, a coil of heavy cable and a small "
       "stack of building materials by the wall, daylight through an open gate.",
 камера="24mm at f/8, camera height 1.6 metres, deep sharpness, verticals "
        "parallel.",
 зона="the upper left over the wall and open air",
 заголовок="1,5-3 МЛН ДО ПЕРВОГО СТАНКА",
 строка="Столько стоит довести пустую площадку под техпроцесс",
 низ="Пол, мощность, вентиляция, ворота, такелаж", акцент="1,5-3 МЛН"),

"P-205-ventilyaciya": dict(
 образцы=["ceh"],
 сцена="clean ventilation ductwork under a high industrial ceiling, a local "
       "extraction hood over a work station, an engineer on a lift platform "
       "connecting a section, everything new and properly mounted.",
 камера="35mm at f/5.6, camera height 1.6 metres, looking up slightly, sharp "
        "on the ductwork.",
 зона="the lower left over the empty floor",
 заголовок="ВЕНТИЛЯЦИЯ: 500 ТЫСЯЧ И 3 НЕДЕЛИ",
 строка="Проект месяц, монтаж месяц, отгрузки стоят",
 низ="4 вопроса, которые снимают риск до подписания", акцент="500 ТЫСЯЧ"),

"P-207-krt-stat": dict(
 образцы=["fasad_1", "dvor"],
 сцена="an aerial view of a Moscow industrial district at midday: production "
       "buildings with light roofs on one side, residential construction with "
       "tower cranes on the other, a clear boundary between them formed by a "
       "road and a green strip.",
 камера="24mm equivalent, straight down with a five degree tilt, short midday "
        "shadows, high micro contrast.",
 зона="the upper left quadrant over the calmer city texture",
 заголовок="102 ПРОЕКТА КРТ ЗА 7 МЕСЯЦЕВ",
 строка="Промзоны занимают 17 % территории старой Москвы",
 низ="Проверьте свой квартал за 4 минуты", акцент="102"),

"P-208-vybor": dict(
 образцы=["ceh", "fasad_3"],
 сцена="a comparison scene on a desk: two identical clipboards side by side "
       "with blank forms, a calculator, a tape measure and a hard hat, shot "
       "from above on a dark matte surface.",
 камера="50mm at f/5.6 from directly above, even light, sharp across the frame.",
 зона="the right half over the empty desk",
 заголовок="12 ПАРАМЕТРОВ ДЛЯ СРАВНЕНИЯ",
 строка="Две площадки с одной ставкой отличаются на миллионы",
 низ="Сохраните таблицу и заполните её цифрами", акцент="12"),

"P-209-roboty": dict(
 образцы=["ceh"],
 сцена="an industrial robot arm working inside a clean modern production cell, "
       "safety fencing around it, a technician watching from outside the cell, "
       "bright even light, no sparks and no drama.",
 камера="35mm at f/4, camera height 1.5 metres, sharp on the robot arm, cell "
        "softly falling off.",
 зона="the upper right over the bright wall",
 заголовок="29 РОБОТОВ ПРОТИВ 177",
 строка="Плотность роботизации в России и в мире",
 низ="Роботу нужны место, ровный пол и мощность", акцент="177"),

"P-210-sosedstvo": dict(
 образцы=["dvor", "fasad_1", "ceh"],
 сцена="two workers from different workshops meeting in the yard between "
       "buildings, one handing over a small machined part to the other, both "
       "unposed and caught mid conversation, production buildings around them.",
 камера="35mm at f/2.8, eye level, sharp on the two men, estate softly behind.",
 зона="the upper left over sky and facade",
 заголовок="6 ОТРАСЛЕЙ НА ОДНОЙ ТЕРРИТОРИИ",
 строка="Подрядчик через двор вместо другого города",
 низ="100 производств · 6-я Радиальная, 17с1", акцент="6 ОТРАСЛЕЙ"),

"P-301-scheta": dict(
 образцы=["ceh"],
 сцена="a stack of printed invoices lying on a workbench next to a hard hat "
       "and work gloves, the numbers deliberately out of focus, one sheet "
       "slightly separated from the rest.",
 камера="50mm at f/2.8 from above at 30 degrees, shallow depth, sharp on the "
        "top sheet edge.",
 зона="the upper right over the bench surface",
 заголовок="5 СЧЕТОВ ПОСЛЕ ПОДПИСАНИЯ",
 строка="Пол, электрика, такелаж, вентиляция, ворота",
 низ="На просмотре про них не спрашивают", акцент="5 СЧЕТОВ"),

"P-302-dvor": dict(
 образцы=["dvor", "proezd"],
 сцена="a wide industrial yard with fresh asphalt and clear line marking, a "
       "box truck reversing towards a loading dock, a man in a light shirt "
       "watching the manoeuvre from a safe distance, morning light.",
 камера="35mm at f/8, camera height 1.6 metres, deep sharpness, verticals "
        "parallel.",
 зона="the left third over the empty asphalt",
 заголовок="ВОРОТА СМОТРЯТ ВТОРЫМИ",
 строка="Первым смотрят двор перед ними",
 низ="Разворот в 3 приёма: 10 минут на каждой машине", акцент="ВТОРЫМИ"),

"P-303-kilovatt": dict(
 образцы=["ceh"],
 сцена="an electricity meter and a distribution board in a clean utility room, "
       "neat cable management, a technician's clipboard hanging beside, calm "
       "cool daylight from a small window.",
 камера="50mm at f/4, camera height 1.4 metres, sharp on the meter face.",
 зона="the right third over the plain wall",
 заголовок="ЦЕНА КИЛОВАТТА В 2026",
 строка="Индексацию сдвинули на 1 октября, передача плюс 16 %",
 низ="От 20 кВт на помещение с увеличением до 300 кВт", акцент="16 %"),

"P-304-zolferayn": dict(
 образцы=["fasad_1"],
 сцена="a preserved industrial heritage site in Europe: a tall steel winding "
       "tower and brick workshop buildings converted into public space, people "
       "walking between them, late afternoon light.",
 камера="35mm at f/5.6, eye level, verticals parallel, wide establishing view.",
 зона="the lower left over the paved ground",
 заголовок="ШАХТА ЗАКРЫЛАСЬ В 1986",
 строка="Сегодня туда приезжают 1,5 млн человек в год",
 низ="Промышленный туризм в России вырос на 40 % за год", акцент="1,5 МЛН"),

"P-305-metro": dict(
 образцы=["fasad_1", "proezd"],
 сцена="a new metro station under construction near an industrial district: "
       "construction fencing, a crane, the future entrance taking shape, "
       "production buildings visible behind, clear daylight.",
 камера="35mm at f/8, eye level, verticals parallel, deep sharpness.",
 зона="the upper right over the sky",
 заголовок="МЕТРО В 2028, МЦД В 2029",
 строка="Обе станции строятся по периметру территории",
 низ="Сейчас шаттл от метро Царицыно, 15 минут", акцент="2028"),

"P-307-protokol": dict(
 образцы=["ceh"],
 сцена="two copies of a contract lying open on a meeting table with a "
       "highlighter and two pens, the text deliberately out of focus, a glass "
       "of water at the edge of frame.",
 камера="50mm at f/2.8 from above at 35 degrees, shallow depth of field.",
 зона="the upper left over the table surface",
 заголовок="ЧИТАЕМ ПРОТОКОЛ ПРИ ВАС",
 строка="По каждой правке 1 из 3 ответов, без «посмотрим позже»",
 низ="Возвращаем версию с пометками за 2 рабочих дня", акцент="ПРИ ВАС"),

"P-308-otrasl": dict(
 образцы=["fasad_1", "fasad_3"],
 сцена="a long production building with a continuous window ribbon seen from "
       "the access road, a couple of trucks at the docks, clean asphalt, blue "
       "sky with light clouds.",
 камера="35mm at f/8, camera height 1.6 metres, three quarter view along the "
        "facade, verticals parallel.",
 зона="the lower left over the road surface",
 заголовок="13 МЛН М² И ОЧЕРЕДЬ НА НИХ",
 строка="Свободных блоков с нагрузкой и мощностью почти нет",
 низ="Блоки от 100 до 12 000 м² · 5 т/м² на первом этаже", акцент="13 МЛН М²"),

"P-310-subbota": dict(
 образцы=["fasad_1", "dvor"],
 сцена="a leasing manager and a visitor walking across the yard towards a "
       "production block on a Saturday morning, both with folders, the estate "
       "quiet and sunlit around them.",
 камера="35mm at f/4, eye level, the two figures on the right third, estate "
        "softly behind.",
 зона="the upper left over sky and facade",
 заголовок="СУББОТА, 19 СЕНТЯБРЯ",
 строка="Просмотры по записи: 10:00, 12:00 и 14:00",
 низ="Берите рулетку и список оборудования", акцент="19 СЕНТЯБРЯ"),

"P-401-smena": dict(
 образцы=["fasad_1", "proezd"],
 сцена="a small group of workers walking from a shuttle bus towards the "
       "entrance of a production building in the morning, ordinary clothes, "
       "unhurried, the bus still standing behind them.",
 камера="35mm at f/4, eye level, sharp on the group, building behind slightly "
        "soft.",
 зона="the upper right over the sky and facade",
 заголовок="15 МИНУТ ВМЕСТО 1,5 ЧАСОВ",
 строка="Дорога решает, останется станочник или уйдёт",
 низ="Шаттл от метро Царицыно · 5 км от МКАД", акцент="15 МИНУТ"),

"P-403-vysota": dict(
 образцы=["ceh"],
 сцена="the interior of a tall production hall shot upwards along a column: "
       "steel roof trusses, a crane beam running under them, ventilation ducts "
       "below the beam, daylight from roof lights.",
 камера="24mm at f/5.6, camera height 1.4 metres, looking up, verticals kept "
        "as parallel as possible.",
 зона="the right third over the plain wall surface",
 заголовок="ВЫСОТА ДО БАЛКИ, А НЕ ДО ПОТОЛКА",
 строка="Разница съедает от 1 до 2 метров",
 низ="Потолки от 6 до 12 метров по корпусам", акцент="ДО БАЛКИ"),

"P-404-rynok": dict(
 образцы=["fasad_1", "ceh"],
 сцена="an empty production unit with columns receding into depth, one shaft "
       "of daylight from an open gate on the floor, nothing stored inside, the "
       "space reading as available and ready.",
 камера="24mm at f/8, camera height 1.5 metres, one point perspective, deep "
        "sharpness.",
 зона="the upper left over the wall",
 заголовок="ПЛОЩАДЕЙ МНОГО, ПОМЕЩЕНИЙ НЕТ",
 строка="Новое строят под склад, станки ставить негде",
 низ="5 т/м² на первом этаже и 1,2 т/м² на верхних", акцент="НЕТ"),

"P-405-sobytie": dict(
 образцы=["fasad_1"],
 сцена="people gathered on a rooftop of an office building in the evening "
       "around an amateur telescope, city lights far below, a few children in "
       "the group, calm and warm atmosphere, no dramatic sky effects.",
 камера="35mm at f/2.8, eye level, sharp on the group, city softly behind.",
 зона="the lower left over the rooftop surface",
 заголовок="ЛЕКЦИЯ И ТЕЛЕСКОП НА КРЫШЕ",
 строка="Один вечер сближает соседей быстрее года рассылок",
 низ="Промышленный туризм вырос на 40 % за год", акцент="НА КРЫШЕ"),

"P-406-volfsburg": dict(
 образцы=["fasad_1"],
 сцена="a large European factory town seen from a bridge: production halls on "
       "one side of the water, residential blocks and a park on the other, "
       "clear daylight, everything working and maintained.",
 камера="35mm at f/8, eye level from the bridge, wide establishing view, "
        "verticals parallel.",
 зона="the upper left over the sky",
 заголовок="ЗАВОД НА 6,5 МЛН М² ВНУТРИ ГОРОДА",
 строка="125 000 жителей и 60 000 работающих рядом",
 низ="Производство и город совместимы", акцент="6,5 МЛН М²"),

"P-407-kooperaciya": dict(
 образцы=["ceh", "dvor"],
 сцена="a small batch of freshly machined metal parts in a plastic crate being "
       "carried across a yard between two workshops, hands and crate in the "
       "foreground, buildings softly behind.",
 камера="50mm at f/2.8, chest height, sharp on the parts, background soft.",
 зона="the upper right over the facade",
 заголовок="ДЕТАЛЬ ЗА 3 ЧАСА ВМЕСТО 4 ДНЕЙ",
 строка="Подрядчик через двор, а не в другом городе",
 низ="100 производств и 6 отраслей на территории", акцент="3 ЧАСА"),

"P-408-itogi": dict(
 образцы=["fasad_1", "dvor"],
 сцена="an aerial three quarter view of a working industrial estate in the "
       "morning: light roofs, marked parking, trucks at the docks, green "
       "strips along the roads, city skyline in the haze behind.",
 камера="35mm equivalent at f/6.3, 45 degree oblique from about 90 metres.",
 зона="the lower left over the road and lawn",
 заголовок="8 ЦИФР ПРО ПРОИЗВОДСТВО В МОСКВЕ",
 строка="4700 площадок, 760 000 занятых, рост 12,1 %",
 низ="Итоги месяца одним материалом", акцент="8 ЦИФР"),
}

# ── карусели недель 2-4 ───────────────────────────────────────────────────
КАРУСЕЛИ = {
"K-02": [
 ("a close view of a contract page on a desk with a pen resting on it, text "
  "deliberately unreadable", "9 ВОПРОСОВ ДО ПОДПИСАНИЯ", "Договор подписывают за 20 минут, живут с ним 3 года"),
 ("an aerial view of an industrial quarter with a residential construction site "
  "nearby", "ВХОДИТ ЛИ КВАРТАЛ В ПЕРЕЧЕНЬ КРТ", "Проверяется за 4 минуты по открытым данным"),
 ("an electrical distribution board with neat breakers in a clean utility room",
  "СКОЛЬКО КВТ В ДОГОВОРЕ", "Мощность здания и ваша цифра это разные вещи"),
 ("a polished industrial concrete floor with a heavy machine base bolted down",
  "НАГРУЗКА НА ПОЛ ПО ЭТАЖАМ", "Просите конструктивный расчёт, а не слово «усиленное»"),
 ("the open doors of a freight lift with a pallet inside a production hall",
  "ПРОЁМ ВОРОТ И ГАБАРИТ КАБИНЫ", "Станок проходит по весу и не проходит по высоте"),
 ("a utility invoice lying on a workbench with the numbers out of focus",
  "ЧТО ВХОДИТ В ЭКСПЛУАТАЦИЮ", "Разница между объявлением и счётом доходит до 22 %"),
 ("a calculator and a printed table on a dark desk, numbers unreadable",
  "ФОРМУЛА ИНДЕКСАЦИИ ЦИФРАМИ", "«По соглашению сторон» означает письмо с новой ставкой"),
 ("an empty production unit mid fit-out with a few tools on the floor",
  "МОНТАЖНЫЙ ПЕРИОД БЕЗ АРЕНДЫ", "Сколько дней вы заводите оборудование бесплатно"),
 ("a wide aerial of a working industrial estate on a clear morning",
  "СОХРАНИТЕ СПИСОК", "Пройдите по нему на ближайшем просмотре"),
],
"K-03": [
 ("a concrete mixer truck parked across an entrance gate of an industrial yard",
  "СТРОЙКА ЗА ЗАБОРОМ", "6 вопросов, которые стоят вам парковки"),
 ("a construction site fence with a project information board, text unreadable",
  "ВОПРОС 1: СРОКИ РАБОТ", "И на каком этапе стройка находится сегодня"),
 ("an industrial yard with temporary traffic cones and a redirected route",
  "ВОПРОС 2: СХЕМА ДВИЖЕНИЯ", "Кто её рассылает и когда она меняется"),
 ("construction site cabins and machinery parked on a paved area",
  "ВОПРОС 3: ГДЕ ВСТАНЕТ ТЕХНИКА", "И сколько парковки она у вас заберёт"),
 ("a dusty industrial yard with a water truck damping the road",
  "ВОПРОС 4: ШУМ, ПЫЛЬ, ВИБРАЦИЯ", "Есть ли ограничения по часам работ"),
 ("a clean swept industrial access road with a sweeper machine",
  "ВОПРОС 5: КТО УБИРАЕТ ПРОЕЗД", "Грязь с колёс остаётся вашей проблемой"),
 ("a finished new building next to older production halls, both in use",
  "ВОПРОС 6: ЧТО БУДЕТ ПОСЛЕ ВВОДА", "Останется ли ваш въезд прежним"),
 ("an aerial of an industrial estate with a clear amber boundary line",
  "ПРИШЛИТЕ АДРЕС БЛОКА", "Отправим схему границ работ до просмотра"),
],
"K-04": [
 ("an aerial three quarter view of a working industrial estate in the morning",
  "7 ЦИФР ДЛЯ СРАВНЕНИЯ ПЛОЩАДОК", "Остальное это лирика"),
 ("a polished concrete floor with a heavy lathe standing on it",
  "5 Т/М² НА ПЕРВОМ ЭТАЖЕ", "И 1,2 т/м² на верхних этажах"),
 ("the interior of a tall production hall with roof trusses and a crane beam",
  "ОТ 6 ДО 12 МЕТРОВ ВЫСОТЫ", "Считается до низа балки, а не до потолка"),
 ("an electrical distribution board with a meter in a clean utility room",
  "ОТ 20 ДО 300 КВТ НА ПОМЕЩЕНИЕ", "Отдельной строкой в договоре"),
 ("an open sectional gate of a production unit with a truck outside",
  "ВОРОТА 4 НА 4 МЕТРА", "И 2 грузовых лифта по 5 тонн"),
 ("an empty production unit with columns receding into the depth",
  "ОТ 100 ДО 12 000 М²", "Офисы от 50 до 500 м² в тех же корпусах"),
 ("a shuttle bus stopping near an industrial estate entrance in the morning",
  "15 МИНУТ ОТ МЕТРО ШАТТЛОМ", "И 267 машиномест на территории"),
 ("a wide aerial of the estate with a clear amber plot boundary",
  "СОХРАНИТЕ И СВЕРЬТЕ СО СВОЕЙ", "clusterspace.ru · 8 985 331 02 71"),
],
}

ПРОМПТЫ = {}
for имя, п in ПОСТЫ.items():
    ПРОМПТЫ[имя] = dict(образцы=п["образцы"],
                        текст=пост(п["сцена"], п["камера"], п["зона"],
                                   п["заголовок"], п["строка"],
                                   п.get("низ", ""), п.get("акцент", "")))

for ключ, слайды in КАРУСЕЛИ.items():
    всего = len(слайды)
    for н, (сцена, заг, стр) in enumerate(слайды, 1):
        ПРОМПТЫ[f"{ключ}-{н}"] = dict(
            образцы=["logo", "ceh", "fasad_1"],
            текст=слайд(сцена, заг, стр, н, всего))


if __name__ == "__main__":
    коротких = [и for и, п in ПРОМПТЫ.items() if len(п["текст"]) < 2000]
    print(f"промптов: {len(ПРОМПТЫ)}, короче 2000 знаков: {коротких or 'нет'}")
    for и, п in list(ПРОМПТЫ.items())[:3]:
        print(f"  {и}: {len(п['текст'])} знаков")
