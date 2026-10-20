<?php
declare(strict_types=1);

/**
 * КЛЮЧ-АРТ: ПЕЧАТНЫЙ ПЛАКАТ ВМЕСТО ПРОСТОЙ КАРТИНКИ.
 *
 * СЛОВО ВЛАДЕЛЬЦА 13.10.2026: «Генерацию всех картинок необходимо выполнять по
 * структуре ключ арт завода oko». Это порт `core/klyuch_art.py` контент-завода
 * на конвейер постов центра: оси монтажа и типографики перенесены ДОСЛОВНО,
 * вместе с памятью на четыре и коридором промпта.
 *
 * ЗАЧЕМ ВООБЩЕ ПЛАКАТ, И ЭТО ЗАМЕР ЗАВОДА, А НЕ ВКУС. Дело не в модели и не в
 * деньгах: та же ячейка, те же $0.04. Дело в том, ЧТО просит промпт.
 *     промпт просит ФОТОГРАФИЮ -> один план, пустой фон, подпись сверху
 *     промпт просит ВЁРСТКУ    -> дешёвый баннер с плашками
 *     промпт просит ПЛАКАТ     -> фотомонтаж и напечатанная поверх типографика
 * Третье и есть ключ-арт: кадр забит до краёв четырьмя-шестью сценами в одном
 * тоне, а титул перестаёт быть подписью и сам становится дизайном.
 *
 * ТРИ ОСИ РАЗНООБРАЗИЯ, И НИ ОДНА ИЗ НИХ НЕ ТЕМА:
 *     МОНТАЖ       как устроен коллаж планов (12, из завода дословно)
 *     ТИПОГРАФИКА  как напечатан титул (12, из завода дословно)
 *     ЦВЕТОВОЙ КЛЮЧ как сведён свет (8, у центра СВОИ, см. ниже)
 * Это 1152 сочетания, и повтор ловится памятью, а не надеждой.
 *
 * СОВРЕМЕННО, ЯРКО И ЖИЗНЕРАДОСТНО - СЛОВО ВЛАДЕЛЬЦА 15.10.2026: «Фотографии и
 * плакаты выглядят старомодно, блекло, тускло и скучно… фотографии должны быть
 * современными, яркими и жизнерадостными, в современном модном стиле и
 * соответствовать той информации, которая публикуется в посте».
 * Это НЕ отмена «цветных и естественных» (13.10), а их уточнение: подделку под
 * плёнку и тонировку по-прежнему не просим, но и выцветшего, серого, пыльного
 * кадра быть не должно. Что именно делало ленту тусклой, замерено по промпту, а
 * не угадано: ключ «пасмурный-ровный» ДОСЛОВНО просил «no harsh contrast
 * anywhere, colours calm, shadows pale», ключ «вечерний-дом» - полумрак,
 * `FINISH` просил зерно («fine grain»), а задание сцены звало в «ОЛД music
 * school hall» и «village club». Оба тусклых ключа заменены яркими, зерно снято,
 * свет и цвет во всех восьми ключах подняты, а в герое и отделке названы
 * современная одежда, живые улыбки и движение.
 *
 * ЦВЕТОВАЯ ОСЬ У ЦЕНТРА СВОЯ, И ЭТО ТОЖЕ СЛОВО ВЛАДЕЛЬЦА 13.10.2026: «Снимки
 * должны быть цветными и естественными». У завода ключи цвета ночные и
 * драматические (ночь-и-акцент, монохром-с-искрой, высокий-контраст) - они
 * сделаны под ленту 18+, и в ленте центра такой кадр читается чужим. Поэтому
 * здесь восемь ключей ЕСТЕСТВЕННОГО СВЕТА: полдень в окне, тёплый зал, золотой
 * час, пасмурный ровный, сцена живым светом, зелень и дерево, светлый зал,
 * вечерний дом. Строятся они, как в заводе, ИЗ ПАЛИТРЫ: своих литералов цвета
 * в ключах нет ни одного.
 *
 * СЦЕНУ ПИШЕТ МОЗГ, А НЕ ЭТОТ ФАЙЛ. Монтаж говорит, КАК собран кадр,
 * типографика - КАК напечатан титул, ключ - КАК сведён свет. Что именно в
 * кадре по теме поста, называет мозг одной английской фразой: зашитая сцена
 * однажды выдала заводу ювелиру особняк, и это записано в его памяти.
 */

/* ОБЯЗАТЕЛЬНЫЕ БЛОКИ УЖАТЫ ПРОТИВ ЗАВОДСКИХ, И ЭТО НЕ НЕБРЕЖНОСТЬ.
 * У центра к ним добавлены два своих: ГЕРОЙ (возраст в кадре) и правило
 * естественного цвета - оба по слову владельца 13.10.2026. Полные заводские
 * формулировки вместе с ними давали 3570-3730 знаков, то есть выбивали из
 * коридора 2000-3300 и вытесняли СЦЕНУ, ради которой кадр и собирается.
 * Потолок поднимать нельзя (число владельца), поэтому сокращены формулировки,
 * а не выброшен ни один смысл: каждый урок завода про знак, запреты и отделку
 * на месте, только короче. Проверено на всех 1152 сочетаниях.
 */

/** Столько последних сочетаний по КАЖДОЙ оси не повторяем. Число завода. */
const SMM_KA_MEMORY = 4;

/** Коридор промпта. Числа владельца, поднимать потолок нельзя. */
const SMM_KA_MIN = 2000;
const SMM_KA_MAX = 3300;

/* СЖАТО 15.10.2026: место отдано оси приёма съёмки. Смысл целиком на месте -
   лист, монтаж, титул поверх, и чем он не является. Потолок не поднимаем. */
const SMM_KA_FORMAT = 'THE FORMAT. A contemporary one-sheet: a bright photographic MONTAGE with designed title type '
    . 'over it. Never a plain photo, banner or slide.';

/* ============================ ОСЬ 1: МОНТАЖ ============================ *
 * Из завода дословно. Пустого фона нет ни в одном: кадр забит до краёв.
 * ТРИ ФРАЗЫ ПРАВЛЕНЫ, И ОБЕ ПРАВКИ НАЗВАНЫ: дым и уход в темноту спорят с
 * «цветными и естественными» снимками, поэтому у центра глубина делается
 * расфокусом и светом, а не дымовой машиной. Остальное слово в слово. */
const SMM_KA_MONTAGES = [
    'веер-глубины' => 'the hero stands largest in the centre; four or five further scenes fan out around and behind it, '
        . 'held in one bright colour key and falling softly out of focus at their edges, bound by overlap, '
        . 'depth of field and soft focus between the planes - never separate rectangles, never a grid',
    'рваные-планы' => 'three or four photographs are torn and laid over one another, raw white paper edges showing '
        . 'along every tear, the hero crossing two of them so the planes read as one picture rather than a '
        . 'collage',
    'сетка-с-номерами' => 'the sheet is divided into four unequal panels by fine hairlines, each numbered 01 to 04 in tiny '
        . 'type in its corner; one panel holds two thirds of the sheet and carries the hero, the rest carry '
        . 'the story around it',
    'колонна-и-полоса' => 'a solid colour column runs down one quarter of the sheet and carries the type; the remaining '
        . 'three quarters are a dense montage of two or three overlapping scenes with the hero largest at '
        . 'their centre',
    'сквозной-силуэт' => 'a large silhouette of the hero is cut out of the frame and the other scenes of the story live '
        . 'INSIDE that silhouette, a second world showing through the shape, with the real scene continuing '
        . 'around it',
    'лента-кадров' => 'a strip of small sequential frames runs along one edge like a contact sheet, each a real moment '
        . 'of the story, while the central image blows one of them up to full size with the hero in it',
    'разворот-витрины' => 'the foreground is a large glass surface - a window, a case, a screen - with the hero behind it, '
        . 'and the reflections in that glass carry three further scenes of the story, layered and '
        . 'transparent',
    'триптих-полосами' => 'three vertical bands of unequal width stand side by side with hair gaps between them, each a '
        . 'different moment, the hero spanning across two of them so the bands read as one continuous '
        . 'picture',
    'круг-в-центре' => 'a perfect circle or arch holds the hero sharp and bright at the centre of the sheet, and the '
        . 'rest of the frame is the same world continuing around it, a touch softer but just as bright, with two or three '
        . 'further scenes worked into that surround',
    'слои-дыма' => 'four planes of the story stand one behind another like painted flats, separated only by depth of '
        . 'field and soft daylight falloff, the nearest out of focus and huge, the farthest tiny and sharp',
    'угловой-разлом' => 'a hard diagonal splits the sheet corner to corner into two contrasting halves of the same story, '
        . 'the hero caught on the seam and belonging to both, with smaller scenes stacked in each half',
    'рассыпанные-карточки' => 'printed photographs and documents lie scattered across a surface, overlapping at angles, each '
        . 'showing a different moment, with the hero image largest among them and lifted slightly off the '
        . 'surface',
];

/* ========================== ОСЬ 2: ТИПОГРАФИКА ========================== *
 * Из завода дословно. Это НЕ плашка с подписью: титул сам дизайн. */
const SMM_KA_TYPO = [
    'арка-фольгой' => 'the headline arches in a wide curve across the upper third in a heavy high-contrast serif, '
        . 'foil-stamped in the accent colour, a fine hairline rule following the curve beneath it, the '
        . 'subline set in light italic along the same curve',
    'вертикаль-колонной' => 'the headline runs VERTICALLY up the side column, bottom to top, in a bold condensed sans with '
        . 'heavy letterspacing, one letter half-cropped by the edge of the sheet, the subline horizontal at '
        . 'the foot of the column in small caps',
    'блок-с-брусом' => 'the headline sits in a solid block in a massive condensed sans, the second word in the accent '
        . 'colour, a thick bar of that colour under it, the subline in light italic inside a thin ruled box '
        . 'beneath the bar',
    'сквозное-слово' => 'the single most important word is enlarged to nearly full width as a monumental knockout: the '
        . 'photograph shows THROUGH the letterforms, the remaining words set small and precise beside it',
    'подрезанная-строка' => 'the headline is set so large that its first and last letters run off both edges of the sheet, '
        . 'the eye completing them, with the subline tucked tight under one word in a much lighter weight',
    /* ПРАВЛЕНО 13.10.2026: модель прочитала «три ступени» как три ОДИНАКОВЫЕ
       строки, и живой кадр вышел с заголовком, напечатанным трижды. */
    'ступенчатый-блок' => 'the headline is SPLIT ACROSS three stepped lines, each line carrying DIFFERENT '
        . 'words of it and the headline never repeated, each line shifted further right than the last and each '
        . 'on its own baseline rule, weights alternating between heavy and light so the block reads as a '
        . 'staircase',
    'рамка-уголками' => 'the headline sits inside a frame drawn only by four corner marks and two short rules, the '
        . 'subline on the rule itself, a small tag box clipped to the top corner of that frame',
    'диагональ-скоростью' => 'the whole title block runs on a bold diagonal in heavy italic, speed streaks and thin '
        . 'accent-colour rules following the same angle, the subline riding the diagonal below it',
    'трафарет-штрихами' => 'the headline is stencilled in a military-stencil face with the bridges visible in the letters, a '
        . 'run of short diagonal stripes beside it, the subline stamped small inside a ruled box',
    'лента-подвала' => 'the headline is laid along a full-width band across the lower third, bone white over a calm, '
        . 'evenly lit part of the montage, a thin accent rule above and below it, the subline centred under the band',
    'два-веса' => 'the headline splits between two faces on consecutive lines - a heavy condensed sans and a light '
        . 'high-contrast serif italic - tightly locked together so they read as one phrase in two voices',
    'печать-по-поверхности' => 'the headline is printed directly into the texture of the largest surface in the montage - wood, '
        . 'stone, metal, cloth - following its grain and perspective, with objects of the scene overlapping '
        . 'and occluding parts of the letters so the type lives in that space',
];

/* ========================= ОСЬ 3: ЦВЕТОВОЙ КЛЮЧ ========================= *
 * Свои: яркий естественный свет. Палитра подставляется метками {фон} {акцент} {текст}.
 * ПРАВКА 15.10.2026 ПО СЛОВУ ВЛАДЕЛЬЦА («блекло, тускло, скучно»): два ключа
 * заменены - «пасмурный-ровный» (он сам просил «colours calm, shadows pale») на
 * ясный солнечный день в зале, «вечерний-дом-тёплый» (полумрак) на яркий день на
 * улице. У остальных шести поднят свет и насыщенность, формулировки заодно стали
 * короче: освободившиеся знаки ушли на требование современности, а потолок
 * коридора поднимать нельзя (число владельца). Имена ключей, которых больше нет,
 * выпадают из памяти оси сами - `smm_ka_triple` сверяет её с набором. */
const SMM_KA_COLOUR = [
    'полдень-в-окне' => 'bright midday sun pouring through tall windows, clean true colour, {текст} walls and light wood, '
        . '{акцент} sparking on brass and glass, shadows open and airy',
    'тёплый-зал' => 'the warm lamps of a modern hall, honey light on {текст} plaster, {акцент} glinting on instruments, '
        . 'every face bright and evenly lit, nothing sinking to black',
    'золотой-час' => 'low golden sun in long warm patches across the floor, skin healthy and glowing, {акцент} burning '
        . 'on metal, the far side of the room still fully coloured',
    'ясный-день-в-зале' => 'a crisp sunny day in a freshly renovated hall, high clean light, colour saturated and true, '
        . '{текст} and {акцент} fresh and sharp, shadows light and lively',
    'сцена-живым-светом' => 'stage light exposed FOR THE FACES: the performer bright and true, costume colours vivid, the '
        . 'hall behind readable rather than black, {акцент} warm on the boards',
    'зелень-и-дерево' => 'summer green outside the window against light wood inside, juicy saturated colour, {акцент} on '
        . 'the frames and brass, daylight white balance exactly right',
    'светлый-зал-и-золото' => 'a white airy hall full of high even light, {текст} and {акцент} carrying the sheet, clean and '
        . 'bright without washing out, faces lit from two sides',
    'яркий-день-на-улице' => 'open-air daylight under a blue sky, green trees behind, vivid clean colour, {акцент} on an '
        . 'instrument case, faces sunlit and smiling, no flat grey light',
];

/* ЦВЕТ ЯРКИЙ И ПРАВДИВЫЙ ОДНОВРЕМЕННО. Запреты на тонировку остались (слово
   владельца 13.10 про «цветные и естественные»), а к ним добавлен запрет на
   выцветшее и серое: ровно это он назвал «блекло и тускло» 15.10.2026. */
/* ======================= ОСЬ 4: ПРИЁМ СЪЁМКИ ======================= *
 * ЗАВЕДЕНА 15.10.2026 ПО ВТОРОМУ СЛОВУ ВЛАДЕЛЬЦА: «фото не получались
 * однотипными… пускай используются современные технологии создания
 * естественного фото, при необходимости даже 3d эффекты».
 * Три прежние оси говорили, КАК СЛОЖЕН лист (монтаж), КАК НАПЕЧАТАН титул
 * (типографика) и КАКОЙ СВЕТ (цвет), и ни одна не говорила, ЧЕМ И КАК СНЯТО.
 * Поэтому все 1152 сочетания давали один и тот же обычный кадр с разной
 * раскладкой: объектив, точка съёмки и приём были у них общие. Теперь ось
 * четвёртая, сочетаний 11520.
 * Приёмы названы те, которыми снимают СЕГОДНЯ, и два из них трёхмерные
 * (слоёный объём и изометрия) - ровно то, что просил владелец. Каждый приём
 * короткий: потолок коридора 3300 это его же число, и место под эту ось
 * освобождено сжатием наших формулировок, а не поднятием потолка. */
const SMM_KA_PRIEM = [
    'широкий-угол-вблизи' => 'a wide lens close to the hero, natural perspective, deep focus, the whole room crisp and airy behind',
    'длинный-фокус' => 'a long lens from across the room, the planes compressed, the background a soft bright wash of colour',
    'сверху-раскладкой' => 'a top-down flat lay of the objects of the story on a bright surface, even light, almost no shadow',
    'с-высоты' => 'a high wide angle from above the room, the whole scene laid open, daylight pouring in from the windows',
    'наклон-резкости' => 'a tilt-shift plane of focus: one bright band of the frame razor sharp, the rest melting away cleanly',
    'смаз-движения' => 'a panning shot: the hero sharp and still while the bright background streaks with movement',
    'подсветка-экраном' => 'a big LED screen or colour panel lights the scene, modern colour spill on the walls, faces still true',
    'слоёный-объём' => 'a layered paper-cut build in 3D: the planes physically offset in depth with real soft shadows between them',
    'изометрия-3d' => 'a clean isometric 3D render of the space blended with the photographed hero, modern, bright and precise',
    'макро-деталь' => 'a macro foreground detail of the key object, the bright scene alive and fully readable right behind it',
];

const SMM_KA_COLOUR_RULE = 'COLOUR IS BRIGHT, FRESH AND TRUE: right white balance, natural skin, saturated colour, '
    . 'open shadows, generous exposure, no dark corner. Nothing faded, grey, washed out or '
    . 'gloomy; no teal-and-orange, monochrome, sepia, night or crushed blacks.';

const SMM_KA_HERO = 'THE HERO. The people are %s: real Russian faces and ages in a true moment, modern clothes and '
    . 'hair, glad and alive - easy smiles, movement. Everyone in frame is of this age.';

/**
 * ГЕРОЙ-ЧЕЛОВЕК ВМЕСТО ВОЗРАСТНОЙ ГРУППЫ.
 *
 * У поста-истории и у праздничной афиши в кадре не «взрослые 30-45», а
 * конкретный человек, и его лицо нельзя придумывать: настоящий портрет из
 * общественного достояния идёт ВТОРЫМ референсом (`core/smm_portret.php`), а
 * этот блок велит воспроизвести именно его.
 */
const SMM_KA_PORTRAIT = 'THE HERO IS A REAL PERSON: %s. The SECOND reference image is their real '
    . 'historical portrait. Reproduce that face faithfully - features, hair, beard, era clothing - so '
    . 'viewers know them at once; never invent another face, never modernise, age or rejuvenate them. '
    . 'The portrait belongs to the scene as a real object: the person in their own era, or framed on '
    . 'the wall, lit by the same light.';

/* ТОТ ЖЕ СМЫСЛ КОРОЧЕ: ни один урок завода не выброшен (один раз, верная форма и
   цвет, чистая матовая поверхность, тот же свет, резкие края, ничего поверх, без
   блика и свечения, не наклейка и не водяной знак, букв из знака не выдумывать) -
   сжаты формулировки. Освободившиеся знаки ушли на требование современности:
   потолок коридора это число владельца, его не поднимают. */
const SMM_KA_LOGO = 'LOGO IN SCENE: the FIRST reference image is the brand mark. Reproduce it exactly ONCE, true in '
    . 'shape and colour, on one clean matte surface or in the title block, in the same light. Edges '
    . 'crisp, nothing over it; no glare, bloom, reflection, glow, sticker, watermark or repeat; '
    . 'invent no lettering from it.';

const SMM_KA_REFS = 'REFERENCE IMAGES. Only that brand mark is supplied; everything else is photographed anew.';

/**
 * ЖЁСТКАЯ ЦЕНЗУРА КАДРА. Слово владельца 19.10.2026: «не допускай публикаций
 * фотографий, где дети или взрослые голые или босые или полуобнажённые… Используй
 * жёсткую цензуру на всё то что запрещено к публикации, согласно законодательству
 * Российской Федерации».
 *
 * ЦЕНА ИЗВЕСТНА: 19.10.2026 в 10:00 в ленту ВК и МАКС ушёл пост #26, где
 * семилетняя девочка стоит БОСИКОМ на деревянной сцене, ноги крупно. Ни одна
 * мерка этого не видела - ни сторож факта, ни валидатор, ни заслон «простое
 * запрещено»: кадр проверяется глазом (правило 57а).
 *
 * БЛОК СТОИТ ВСЕГДА И ЖЕРТВОЙ НЕ БЫВАЕТ. Место под него освобождено сжатием
 * НАШИХ же формулировок - потолок коридора 3300 это число владельца, его не
 * поднимают (правила 70, 70а).
 */
const SMM_KA_PRILICHIE = 'DECENCY, ABSOLUTE: all fully dressed, shoes on; no bare feet or chest, '
    . 'underwear, swimwear, sheer or revealing clothes, nudity, suggestive pose, alcohol, tobacco, '
    . 'drugs, weapon, blood or gambling.';

/* Из завода дословно. */
const SMM_KA_FORBIDDEN = 'FORBIDDEN. No empty background, no object on a plain backdrop, no price, hex code or number beyond the '
    . 'quoted lines, no invented words, watermark, caption bar, border or colour panel over the photo.';

/* ЗЕРНО СНЯТО СЛОВОМ ВЛАДЕЛЬЦА 15.10.2026: «fine grain» это плёночная примета, и
   именно она делала кадр старомодным. Запреты на пластик, HDR-свечение, тяжёлую
   виньетку и дымку остались. */
const SMM_KA_FINISH = 'FINISH. Contemporary editorial capture, crisp detail, vivid honest contrast, 8K on the hero. '
    . 'No film grain, CGI plastic, HDR glow, vignette or haze.';

/**
 * Палитра центра. Кремовый лист, золото, глубокая синь - те же цвета, что на
 * сайте (`public/assets/css/style.css`: --bg #FAF4E6, --gold #C79322,
 * тёмная тема #0A1330). Меняется настройками, не правкой кода.
 */
function smm_ka_palette(): array {
    return [
        '{фон}'    => (string) (setting('smm_ka_bg', '#0A1330')),
        '{акцент}' => (string) (setting('smm_ka_accent', '#C79322')),
        '{текст}'  => (string) (setting('smm_ka_paper', '#FAF4E6')),
    ];
}

/**
 * Монтаж, типографика и цветовой ключ, которых не было в своих окнах.
 *
 * ТРОЙКА, А НЕ ТРИ ОТДЕЛЬНЫХ ВОПРОСА: занять одну ось и забыть другую значит
 * однажды записать половину, и в заводе это уже стоило повторов в ленте.
 * ИДЕМПОТЕНТНО ПО `$чем`: повторный заход того же слота получает тот же плакат
 * и не платит за новый кадр (у завода эта правка куплена деньгами 11.10.2026).
 */
/**
 * МОНТАЖИ, КОТОРЫЕ НЕЛЬЗЯ ДАВАТЬ, КОГДА В КАДРЕ НАСТОЯЩИЙ ЧЕЛОВЕК.
 *
 * Куплено живым кадром в ночь на 15.10.2026. Афиша к 212-летию Лермонтова
 * вышла с фигурой БЕЗ ЛИЦА: в центре листа силуэт, вырезанный насквозь, а
 * внутри него видна комната. Виноват не мозг - ось «сквозной-силуэт» ДОСЛОВНО
 * просит «a large silhouette of the hero is cut out of the frame», а блок
 * портрета (SMM_KA_PORTRAIT) ровно так же дословно требует «reproduce that
 * face faithfully». Два указания спорят в одном промпте, и побеждает монтаж:
 * лица не остаётся вовсе, а похожий человек на втором плане выходит выдуманным.
 *
 * Список ЗАКРЫТЫЙ и в нём ровно то, что замерено. «Разворот-витрины» (герой за
 * стеклом) и «слои-дыма» (планы в глубине) тоже умеют спрятать лицо, но живого
 * брака по ним нет, и выбрасывать их по догадке значит обеднить ленту: у афиши
 * с портретом и так остаётся одиннадцать монтажей из двенадцати. Появится
 * кадр - добавить сюда, назвав дату и повод.
 */
const SMM_KA_MONTAGES_NO_FACE = ['сквозной-силуэт'];

/**
 * ЗАСЛОН СЦЕНЫ ДО ВСЯКОЙ ТРАТЫ.
 *
 * ПОЧЕМУ НЕ ХВАТАЕТ ЗАПРЕТА В ПРОМПТЕ: сцену пишет мозг, и 16.10.2026 он
 * написал дословно «a seven-year-old girl in a faded red dress stands BAREFOOT
 * on a worn wooden stage». Модель исполнила задание честно. Запрет и сцена
 * спорили бы в одном промпте, а в таком споре побеждает то, что описано
 * подробнее - этот урок куплен афишей Лермонтова, где монтаж пересилил блок
 * портрета и дал фигуру без лица (правило 57а).
 *
 * СЛОВО-ОПРЕДЕЛЕНИЕ СНИМАЕМ: «stands barefoot on a stage» без него остаётся
 * целым предложением. ОБОРОТ ОТКЛОНЯЕМ ЦЕЛИКОМ: «in a swimsuit» заменить
 * нечем, а выдумывать замену за мозг нельзя - честнее не собрать кадр, и
 * доводчик через час спросит у мозга другую сцену.
 *
 * «bare stage» И «bare walls» НЕ ТРОГАЕМ НАМЕРЕННО: это театральные слова, и
 * шаблон по одному «bare» краснел бы на пустой сцене без декораций.
 */
const SMM_KA_SNYAT = ['barefoot', 'barefooted', 'bare-footed', 'shoeless', 'shirtless', 'topless',
                      'bare-chested'];
const SMM_KA_OTKAZ = ['bare feet', 'bare foot', 'bare chest', 'bare torso', 'bare skin', 'bare legs',
                      'naked', 'nude', 'undressed', 'unclothed', 'half-dressed', 'underwear',
                      'swimsuit', 'swimwear', 'bathing suit', 'bikini', 'lingerie', 'see-through',
                      'wet t-shirt', 'alcohol', 'vodka', 'beer', 'wine glass', 'glass of wine',
                      'bottle of wine', 'champagne', 'whisky', 'whiskey', 'cocktail', 'cigarette',
                      'smoking', 'vape', 'drug', 'syringe', 'weapon', 'gun', 'rifle', 'blood',
                      'casino', 'gambling'];

function smm_ka_prilichie(string $сцена): array {
    $было = $сцена;
    foreach (SMM_KA_SNYAT as $с) {
        $сцена = preg_replace('~\\b' . preg_quote($с, '~') . '\\b~ui', '', $сцена) ?? $сцена;
    }
    $сцена = preg_replace('~\\s+([,.;])~u', '$1', $сцена) ?? $сцена;
    $сцена = trim(preg_replace('~\\s{2,}~u', ' ', $сцена) ?? $сцена);
    $низ = mb_strtolower($сцена);
    foreach (SMM_KA_OTKAZ as $с) {
        if (preg_match('~\\b' . preg_quote($с, '~') . '~u', $низ)) {
            return ['ок' => false, 'сцена' => $сцена, 'слово' => $с];
        }
    }
    return ['ок' => true, 'сцена' => $сцена, 'снято' => $было !== $сцена];
}

function smm_ka_triple(string $чем, bool $портрет = false): array {
    $было = json_decode((string) setting('smm_keyart_axes', '{}'), true);
    if (!is_array($было)) $было = [];

    $выдано = (array) ($было['выдано'] ?? []);
    $прежнее = $чем !== '' ? ($выдано[$чем] ?? null) : null;
    if (is_array($прежнее) && (string) ($прежнее['монтаж'] ?? '') !== '') {
        /* ПАМЯТЬ СЛОТА НЕ ИМЕЕТ ПРАВА ВЕРНУТЬ ЗАПРЕЩЁННЫЙ МОНТАЖ. Тройка
           идемпотентна по слоту нарочно (повторный заход не платит за новый
           кадр), но у афиши Лермонтова в памяти лежал именно «сквозной-силуэт»:
           без этой проверки пересборка кадра вернула бы ту же безликую фигуру. */
        /* И НЕ ИМЕЕТ ПРАВА ВЕРНУТЬ СНЯТУЮ ОСЬ. Набор ключей меняет слово
           владельца (15.10.2026 два тусклых цветовых ключа заменены яркими), а
           `smm_ka_prompt` на снятое имя отбивает кадр целиком словами «тройка
           осей неполная» - то есть пост остался бы без плаката, и в журнале
           стояло бы «плакат не собрался» без всякой вины мозга. 15.10.2026
           снятые имена лежали в памяти у семи слотов из двадцати трёх. Окно оси
           чистится само (сверяется с набором ниже), а память СЛОТА - нет. */
        $жив = array_key_exists((string) ($прежнее['монтаж'] ?? ''), SMM_KA_MONTAGES)
            && array_key_exists((string) ($прежнее['типографика'] ?? ''), SMM_KA_TYPO)
            && array_key_exists((string) ($прежнее['цвет'] ?? ''), SMM_KA_COLOUR)
            /* Ось приёма заведена 15.10.2026 позже остальных: у слотов, уже
               лежащих в памяти, её нет вовсе, и без этой строки они вечно
               возвращали бы тройку без приёма - то есть ровно ту однотипность,
               против которой ось и заведена. */
            && array_key_exists((string) ($прежнее['приём'] ?? ''), SMM_KA_PRIEM);
        if ($жив && !($портрет && in_array((string) $прежнее['монтаж'], SMM_KA_MONTAGES_NO_FACE, true))) {
            $прежнее['повтор'] = true;
            return $прежнее;
        }
    }

    $о = [];
    $оси = [
        'монтаж'      => $портрет
            ? array_values(array_diff(array_keys(SMM_KA_MONTAGES), SMM_KA_MONTAGES_NO_FACE))
            : array_keys(SMM_KA_MONTAGES),
        'типографика' => array_keys(SMM_KA_TYPO),
        'цвет'        => array_keys(SMM_KA_COLOUR),
        'приём'       => array_keys(SMM_KA_PRIEM),
    ];
    foreach ($оси as $имя => $набор) {
        $прежние = array_values(array_filter(
            (array) ($было[$имя] ?? []),
            static fn($x) => in_array($x, $набор, true)
        ));
        $окно = array_slice($прежние, -SMM_KA_MEMORY);
        $свободные = array_values(array_filter($набор, static fn($x) => !in_array($x, $окно, true)));
        if (!$свободные) $свободные = $набор;
        /* Сдвиг детерминирован по слоту: тот же слот - тот же плакат. */
        $сдвиг = (int) hexdec(substr(md5($чем . '|' . $имя), 0, 8));
        $о[$имя] = $свободные[$сдвиг % count($свободные)];
        $было[$имя] = array_slice(array_merge($прежние, [$о[$имя]]), -40);
    }

    if ($чем !== '') {
        $выдано[$чем] = $о;
        if (count($выдано) > 200) $выдано = array_slice($выдано, -200, null, true);
        $было['выдано'] = $выдано;
    }
    set_setting('smm_keyart_axes', (string) json_encode($было, JSON_UNESCAPED_UNICODE));
    return $о;
}

/**
 * Печатные текстовые блоки.
 *
 * У завода их пять (тег, заголовок, подзаголовок, крючок, призыв). У центра
 * три, и это НЕ недоделка: крючок и призыв стоят в самом посте прямо под
 * картинкой, а футер поста несёт все ссылки и телефон. Каждая лишняя русская
 * строка на кадре - это ещё один шанс получить выдуманную орфографию, и
 * заголовок с подзаголовком модель уже пишет верно только потому, что они
 * переданы ДОСЛОВНО в кавычках.
 */
function smm_ka_text_blocks(string $тег, string $заголовок, string $подзаголовок, string $типографика): string {
    /* КАВЫЧКИ ВНУТРИ КАВЫЧЕК СТОИЛИ ЖИВОГО КАДРА (замер 13.10.2026).
       Подзаголовок «Как роль «профессионала» помогает ребенку в творчестве»
       передавался в задании в кавычках, а внутри него стояли ещё одни - и
       модель напечатала «профєсионала»: украинская «є» вместо «е» и потерянная
       буква. Строка, которую печатают на кадре, идёт без своих кавычек. */
    $чисто = static function (string $x): string {
        $x = str_replace(['«', '»', '“', '”', '„', '‟', '"'], '', $x);
        return trim(preg_replace('~\s{2,}~u', ' ', $x) ?? $x);
    };
    $тег          = $чисто($тег);
    $заголовок    = $чисто($заголовок);
    $подзаголовок = $чисто($подзаголовок);

    $стр = ['THE TEXT BLOCKS, PRINTED ON THE SHEET.'];
    $тег = trim($тег);
    if ($тег !== '') {
        $стр[] = 'A section tag "' . $тег . '" in a thin ruled box, small and stamped.';
    }
    $стр[] = 'The HEADLINE reads exactly "' . trim($заголовок) . '", largest on the sheet: '
           . ($типографика !== '' ? $типографика : 'set as the title of the piece') . '.';
    $под = trim($подзаголовок);
    if ($под !== '') {
        $стр[] = 'The SUBLINE "' . $под . '", a third of its size and lighter.';
    }
    /* ЗАГОЛОВОК НА ЛИСТЕ ОДИН, И ЗАПРЕТ СТОИТ ЗДЕСЬ, А НЕ ТОЛЬКО В ОСИ.
       Он один на все двенадцать типографик: «подрезанная строка», «два веса» и
       «ступенчатый блок» одинаково соблазняют модель повторить фразу. */
    $стр[] = 'Each quoted line appears EXACTLY ONCE: broken headline lines carry different words, '
           . 'never a repeat.';
    $стр[] = 'Spell each quoted line letter for letter in Russian Cyrillic: no Ukrainian є і ї ґ, no '
           . 'Latin lookalikes, no dropped or extra letters, no other words. Printed poster type '
           . 'with ink weight, never a caption bar.';
    return implode(' ', $стр);
}

/**
 * Полный промпт плаката. Порядок блоков не случаен: модель читает СЦЕНУ раньше
 * монтажа, и монтаж ложится на сцену, а не подменяет её.
 *
 * КОРИДОР ДЕРЖИТ КОД, А НЕ НАДЕЖДА. Не влезли - режем ЖЕРТВУ (строку про
 * референсы), потом укорачиваем сцену. Обязательные блоки не режутся никогда.
 */
function smm_ka_prompt(
    string $сцена,
    string $герой,
    array $оси,
    string $тег,
    string $заголовок,
    string $подзаголовок,
    string $персона = ''
): array {
    $сцена = trim(preg_replace('~\s+~u', ' ', $сцена) ?? '');
    $сцена = rtrim($сцена, " .");
    /* ПУСТОЙ ЗАГОЛОВОК - БРАК, А НЕ МЕЛОЧЬ. В задание уходит строка
       `The HEADLINE reads exactly "<...>"`, и с пустыми кавычками модель
       придумывает заголовок сама: так 16.10.2026 пост #21 вышел в ленту с
       выдуманным «ОСВИСТАННЫЙ БАЛЕТ, СТАВШИЙ КЛАССИКОЙ» и почти тем же
       подзаголовком рядом. Отбиваем до траты на картинку. */
    if (trim($заголовок) === '') {
        return ['ок' => false, 'почему' => 'заголовок пуст: на лист ушли бы пустые кавычки, и модель придумала бы его сама'];
    }
    if ($сцена === '') {
        return ['ок' => false, 'почему' => 'сцена не названа: что в кадре, говорит мозг, а не каталог приёмов'];
    }
    /* ЖЁСТКАЯ ЦЕНЗУРА ДО ТРАТЫ (слово владельца 19.10.2026). */
    $пр = smm_ka_prilichie($сцена);
    if (empty($пр['ок'])) {
        return ['ок' => false, 'почему' => 'сцена не проходит цензуру по слову «' . $пр['слово']
            . '»: кадр не собирается, доводчик спросит у мозга другую сцену'];
    }
    $сцена = (string) $пр['сцена'];
    $м = (string) (SMM_KA_MONTAGES[(string) ($оси['монтаж'] ?? '')] ?? '');
    $т = (string) (SMM_KA_TYPO[(string) ($оси['типографика'] ?? '')] ?? '');
    $ц = (string) (SMM_KA_COLOUR[(string) ($оси['цвет'] ?? '')] ?? '');
    $п = (string) (SMM_KA_PRIEM[(string) ($оси['приём'] ?? '')] ?? '');
    if ($м === '' || $т === '' || $ц === '' || $п === '') {
        return ['ок' => false, 'почему' => 'оси неполные: ' . json_encode($оси, JSON_UNESCAPED_UNICODE)];
    }
    $ц = strtr($ц, smm_ka_palette());
    /* ЖЕРТВА ИЩЕТСЯ ПО ЗНАЧЕНИЮ, А НЕ ПО НОМЕРУ: прежде стоял unset($б[6]), и
       первый же вставленный блок молча сдвинул бы жертву на чужую строку. */
    $рефы = $персона !== ''
        ? 'REFERENCE IMAGES. Two are supplied: the brand mark and the portrait above.'
        : SMM_KA_REFS;

    $блоки = [
        SMM_KA_FORMAT,
        'THE MONTAGE. ' . $сцена . '. Built this way: ' . $м . '. Shot like this: ' . $п . '.',
        $персона !== ''
            ? sprintf(SMM_KA_PORTRAIT, $персона)
            : sprintf(SMM_KA_HERO, $герой !== '' ? $герой : 'real people of the age the post is about'),
        SMM_KA_PRILICHIE,
        smm_ka_text_blocks($тег, $заголовок, $подзаголовок, $т),
        'COLOUR. ' . $ц . '. ' . SMM_KA_COLOUR_RULE,
        SMM_KA_LOGO,
        $рефы,
        SMM_KA_FORBIDDEN,
        SMM_KA_FINISH,
    ];
    $собрать = static fn(array $б): string => implode("\n\n", $б);
    $текст = $собрать($блоки);

    if (mb_strlen($текст) > SMM_KA_MAX) {
        /* ЖЕРТВА ПЕРВОЙ: строка про референсы. */
        $без = $блоки;
        $и = array_search($рефы, $без, true);
        if ($и !== false) unset($без[$и]);
        $текст = $собрать(array_values($без));
    }
    if (mb_strlen($текст) > SMM_KA_MAX) {
        /* ДАЛЬШЕ РЕЖЕТСЯ ТОЛЬКО СЦЕНА, И СЧИТАЕТСЯ ЕЙ БЮДЖЕТ, А НЕ ПРЕДЛОЖЕНИЯ.
           Первая сборка резала сцену по точкам, и промпт на 3445 знаков вышел за
           потолок как был: мозг прислал сцену ОДНОЙ фразой, резать было нечего, а
           обязательные блоки резать нельзя. Бюджет считается от потолка минус всё
           остальное, и сцена укорачивается по слову. */
        $пустая = $блоки;
        $пустая[1] = 'THE MONTAGE. . Built this way: ' . $м . '. Shot like this: ' . $п . '.';
        $и2 = array_search($рефы, $пустая, true);
        if ($и2 !== false) unset($пустая[$и2]);
        $бюджет = SMM_KA_MAX - mb_strlen($собрать(array_values($пустая)));
        if ($бюджет > 0) {
            /* РЕЖЕМ ЦЕЛЫМИ ОБОРОТАМИ, А НЕ ПО СЛОВУ, И ЭТО КУПЛЕНО ЖИВЫМ КАДРОМ.
               Пословная обрезка оборвала сцену афиши Лермонтова на середине
               оборота: в промпт ушло «...on a windowsill, and a candlelit-free.»
               Модель получила незаконченную фразу и ДОСТРОИЛА её сама - поставила
               в ленту кадров свечи и новогоднюю ёлку, на октябрьской афише ко дню
               рождения. Ни одна мерка такого не ловит: длина в коридоре, заслон
               «простое запрещено» доволен, брак виден только глазами.
               Обрубок хуже короткой сцены: короткая просто молчит, а обрубок
               ПРОСИТ выдумать окончание. */
            $обороты = preg_split('~(?<=[,;.])\s+~u', $сцена) ?: [];
            $коротко = '';
            foreach ($обороты as $об) {
                $проба = $коротко === '' ? $об : ($коротко . ' ' . $об);
                if (mb_strlen($проба) > $бюджет) break;
                $коротко = $проба;
            }
            /* Ни один оборот не влез - берём по слову, иначе сцены не будет
               вовсе. Повисшие в воздухе предлог, артикль и союз снимаем: именно
               они и просят продолжения. */
            if ($коротко === '') {
                foreach (preg_split('~\s+~u', $сцена) ?: [] as $сл) {
                    $проба = $коротко === '' ? $сл : ($коротко . ' ' . $сл);
                    if (mb_strlen($проба) > $бюджет) break;
                    $коротко = $проба;
                }
            }
            /* ЗАЧИН БЕЗ ПРОДОЛЖЕНИЯ СНИМАЕТСЯ ЦЕЛИКОМ. Оборот целый, точка на
               месте, длина в коридоре - и всё равно обрубок: в живом кадре поста
               #21 (15.10.2026) сцена кончилась словами «Around this central
               moment.», потому что перечисление малых сцен за этой запятой в
               бюджет не влезло. Для модели это прямая просьба выдумать, что же
               там вокруг: ровно та беда, что поставила ёлку на октябрьскую афишу
               (правило 60), только на оборот выше.
               Список зачинов ЗАКРЫТЫЙ, и снимается только КОРОТКИЙ оборот (до
               пяти слов): «In the corner a cellist tunes his strings» тоже
               начинается предлогом, но это законченная мысль, и терять её
               незачем. Цена ошибки в эту сторону - пять слов сцены. */
            $зачины = '(?:around|behind|beside|near|beyond|along|across|through|above|below|between|among|within|under|over|next|close|further|meanwhile|alongside|surrounding)';
            for ($i = 0; $i < 4; $i++) {
                $куски = preg_split('~(?<=[,;.])\s+~u', $коротко) ?: [];
                if (count($куски) < 2) break;
                $последний = (string) end($куски);
                $слов = count(preg_split('~\s+~u', trim($последний)) ?: []);
                if ($слов > 5 || !preg_match('~^' . $зачины . '\b~ui', trim($последний))) break;
                array_pop($куски);
                $коротко = implode(' ', $куски);
            }
            /* Точку снимаем вместе с запятой: обрубок её не имеет, а снятый
               зачин оставляет позади себя оборот С точкой, и ниже мы ставим
               свою - на живом прогоне вышло «...is played..». */
            $коротко = rtrim($коротко, " ,;:-.");
            $хвосты = '(?:a|an|the|and|or|with|of|in|on|at|by|for|to|from|while|as|its|their|his|her)';
            $коротко = (string) preg_replace('~[\s,;:]+' . $хвосты . '$~ui', '', $коротко);
            $коротко = rtrim($коротко, " ,;:-.");
            if ($коротко !== '') {
                $блоки[1] = 'THE MONTAGE. ' . $коротко . '. Built this way: ' . $м . '. Shot like this: ' . $п . '.';
            }
        }
        $без = $блоки;
        $и3 = array_search($рефы, $без, true);
        if ($и3 !== false) unset($без[$и3]);
        $текст = $собрать(array_values($без));
    }

    $о = [
        'ок'          => true,
        'промпт'      => $текст,
        'монтаж'      => (string) ($оси['монтаж'] ?? ''),
        'типографика' => (string) ($оси['типографика'] ?? ''),
        'цвет'        => (string) ($оси['цвет'] ?? ''),
        'приём'       => (string) ($оси['приём'] ?? ''),
        'знаков'      => mb_strlen($текст),
        'коридор'     => [SMM_KA_MIN, SMM_KA_MAX],
    ];
    if (mb_strlen($текст) < SMM_KA_MIN || mb_strlen($текст) > SMM_KA_MAX) {
        $о['вне_коридора'] = sprintf('промпт %d знаков вне коридора %d-%d',
            mb_strlen($текст), SMM_KA_MIN, SMM_KA_MAX);
    }
    return $о;
}

/**
 * ЗАСЛОН: ПРОСТОЕ ЗАПРЕЩЕНО. Мера смотрит, ПРОСИТ ли промпт плакат, а не
 * красив ли вышедший кадр: судить кадр нечем, а промпт судится даром и ДО
 * траты. Пусто - всё на месте.
 */
function smm_ka_simple(string $промпт): array {
    $т = mb_strtolower($промпт);
    $нет = [];
    $монтаж = ['montage', 'planes', 'panels', 'collage', 'torn', 'contact sheet',
               'silhouette', 'bands', 'scattered', 'behind it', 'around it', 'further scenes'];
    $титул = ['headline', 'title', 'subline', 'letterforms', 'typography', 'letterspac',
              'stencil', 'foil', 'knockout', 'baseline'];
    $есть = static function (array $слова) use ($т): bool {
        foreach ($слова as $с) if (mb_strpos($т, $с) !== false) return true;
        return false;
    };
    if (!$есть($монтаж)) $нет[] = 'нет монтажа: кадр просит один план, а не коллаж сцен';
    if (!$есть($титул))  $нет[] = 'нет оформления титула: текст придёт подписью сверху';
    /* ОТРИЦАНИЕ ЭТО НЕ СПРОС. Свой блок запретов говорит «No empty background»,
       и счёт «слово есть в тексте» краснел бы на нашем же запрете. */
    foreach (['plain background', 'empty background', 'white background', 'studio backdrop',
              'seamless backdrop', 'isolated on'] as $с) {
        if (preg_match('~(?<!no )(?<!never )' . preg_quote($с, '~') . '~u', $т)) {
            $нет[] = 'просит пустой фон (' . $с . '): простое запрещено';
            break;
        }
    }
    return $нет;
}

/** Свод для пульта и для отчёта. */
function smm_ka_svod(): string {
    return sprintf(
        "КЛЮЧ-АРТ КОНВЕЙЕРА ЦЕНТРА\n  монтажей %d\n  типографик %d\n  цветовых ключей %d\n  приёмов съёмки %d\n"
        . "  сочетаний %d\n  память оси %d\n  коридор %d-%d",
        count(SMM_KA_MONTAGES), count(SMM_KA_TYPO), count(SMM_KA_COLOUR), count(SMM_KA_PRIEM),
        count(SMM_KA_MONTAGES) * count(SMM_KA_TYPO) * count(SMM_KA_COLOUR) * count(SMM_KA_PRIEM),
        SMM_KA_MEMORY, SMM_KA_MIN, SMM_KA_MAX
    );
}
