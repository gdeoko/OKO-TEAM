"""Сборка промптов. Сценарий описывает СВОЁ, остальное добавляется само.

## Зачем сборщик, а не сорок готовых текстов

Требование владельца — промпт от 3000 знаков на каждую кнопку. Сорок
сценариев по три тысячи это сто двадцать тысяч знаков. Написанные
стеной, они превращаются в мёртвый груз: поправить освещение во всех
сразу нельзя, забытый кусок видно только на готовой картинке, а новый
сценарий стоит полдня.

Поэтому сценарий объявляет только то, чем он отличается: гардероб,
поза, обстановка, свет, объектив, настроение. Всё общее — качество
кожи, анатомия рук, запреты — живёт здесь в одном экземпляре. Длина
получается сама и проверяется тестом.

## Порядок блоков не случаен

Модели внимательнее к началу промпта. Поэтому сначала идёт главное
(кто и что делает), потом обстановка и свет, и только в конце
технические слова про резкость и разрешение. Негатив уходит отдельным
полем, а не в конец текста: смешанный с описанием, он начинает
работать как описание.

## Про русский

Промпты только на английском. Модель обучена на английском, русский
даёт мусор — проверено, тест `test_промпты_на_английском_и_не_пустые`
сторожит это отдельно.
"""

# ДЛИНА ПРОМПТА: ЧЕМ КОРОЧЕ, ТЕМ ТОЧНЕЕ. Это не вкусовщина, это замер.
#
# Требование владельца от 20.09.2026 было «от 3000 знаков на кнопку», и
# сборщик честно выдавал 8400. 21.09.2026 на карте прогнали один и тот
# же снимок двумя промптами — восьмитысячным и на 450 знаков, по два
# зерна каждый:
#
#     8400 знаков  грудь вдвое больше, чем на референсе, тело зрелое
#      450 знаков  грудь как на референсе, тело своё, фон на месте,
#                  и ОБА зерна дали одно и то же
#
# Причина простая: «не увеличивай грудь» — одна фраза среди двух тысяч
# токенов, и внимания ей достаётся по остаточному принципу. Модель
# слушает не того, кто громче, а того, кто короче.
#
# Поэтому теперь наоборот: есть ПОТОЛОК. Каждый блок ниже ужат до
# одного-двух предложений, общие слова про резкость и цвет сведены в
# одну строку, а всё, что можно сказать запретом, ушло в негатив — он
# считается отдельным полем и место в промпте не занимает.
МИН_ДЛИНА = 400
МАКС_ДЛИНА = 2200

# Общее для всех кадров. Один экземпляр: разойдётся по сценариям —
# и правка освещения превратится в сорок правок.
# Два варианта первого блока. Разница не косметическая: у режимов без
# входного фото нет лица, которое надо сохранять, и требование «сохрани
# её черты» для них бессмысленно — модель начинает искать референс,
# которого нет.
# СЛОЖЕНИЕ НАЗЫВАЕТСЯ ПРИЛАГАТЕЛЬНЫМИ, А НЕ УСЛОВИЕМ. Замер 21.09.2026.
#
# В промпте годами стояло «грудь ровно того размера, какой показывает
# одетый силуэт». По-русски это разумно, для модели — пустой звук:
# текстовый кодировщик не умеет «посмотреть и вывести», он реагирует на
# конкретные слова. Условие не значит ничего, и в пустоту встаёт
# собственная привычка сборки — большая грудь и зрелое тело.
#
# Проверено на одном снимке, по два зерна:
#     «размер, какой показывает силуэт»   грудь вдвое больше референса
#     «petite, slim, SMALL NATURAL BREASTS»  как на референсе, оба зерна
#
# Отсюда `СЛОЖЕНИЕ`: буквальные слова, три набора. Умолчание — стройное,
# потому что ошибается модель всегда в одну сторону, в большую, и лишний
# раз сделать худую худой безопаснее, чем полную — «жирной коровой с
# огромными сиськами» (слова владельца, 21.09.2026).
#
# Правильный конец этой истории — кнопка «Фигура» на экране варианта,
# три положения. Пока её нет, работает умолчание.
СЛОЖЕНИЕ = {
    "стройная": (
        "Petite and slim with a SMALL, ALMOST FLAT CHEST: tiny natural "
        "breasts, an A cup at most, barely a swell above the ribs, wide "
        "apart and set high, with small nipples. No cleavage, no "
        # «teenage-slim» убрано 24.09.2026. По-английски teenage — это
        # ровно «подростковая», 13–19 лет, а не «молодая» (young). Мы
        # этой строкой просили у сборки подростковое телосложение в
        # каждом кадре с кнопкой «стройная». Нужный смысл — «худая»,
        # он и остался.
        "roundness, no weight to them — a slender narrow ribcage, "
        "a flat stomach and narrow hips. If the result shows a handful, "
        "it is wrong."
    ),
    "средняя": (
        "An average, natural build with medium natural breasts — neither "
        "slimmed down nor enlarged."
    ),
    "пышная": (
        "A full, soft, curvy build with large natural breasts, wide hips "
        "and a soft belly."
    ),
    # ПО УМОЛЧАНИЮ С 24.09.2026 — «как на фото».
    #
    # Раньше умолчанием была «стройная», и она ПЕРЕБИВАЛА референс:
    # пышная клиентка получала модельное тело, а выбор «пышная» в боте
    # вдобавок спорил с постоянным негативом, который запрещал
    # «busty, curvy». Требование владельца: «возраст, фигура, форма
    # тела, цвет кожи — максимально как на референсе».
    #
    # Текст тут не описывает фигуру, а ЗАПРЕЩАЕТ её сочинять. Пустая
    # строка не годилась бы: без единого слова о теле сборка валится в
    # собственное умолчание — модельную фигуру, — и именно это видно на
    # замере 24.09.2026.
    # СЛОВА ПОДОБРАНЫ ЗАМЕРОМ, А НЕ ПО СМЫСЛУ. Первая редакция этого
    # текста говорила «HER BUILD IS READ OUT OF THE REFERENCE
    # PHOTOGRAPH», дальше шли «shape», «proportions», «weight»,
    # «toned», «straightened», «turned into a model». По-русски это
    # описание живого тела, а сборка прочитала его как задание на
    # скульптуру: на кнопке «Поставить раком» вместо женщины выходила
    # гипсовая статуя. Замер 24.09.2026, одно зерно, одна кнопка,
    # менялся только этот абзац (цветность кадра, у нормальных 14…89):
    #
    #     как на фото (первая редакция)   1,8   гипс
    #     стройная                       13,1   живой кадр
    #     средняя                        12,2   живой кадр
    #
    # Поэтому здесь нет ни одного слова из словаря ваяния. Тело
    # называется телом, части — частями, а «модель» уточнена до
    # «fashion model», чтобы её нельзя было прочитать как трёхмерную.
    "как_на_фото": (
        "HER BODY IS COPIED FROM THE REFERENCE PHOTOGRAPH AND NOT "
        "INVENTED: the same breasts and the same size of them, the same "
        "waist, the same belly, the same hips and thighs, the same "
        "shoulders, the same height. A soft belly stays a soft belly and "
        "a flat chest stays flat. She is not made slimmer, not made "
        "bigger, not made fitter and not turned into a fashion model; "
        "she is the same real woman as in the photograph, "
        "photographed with her clothes off."
    ),
}
СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ = "как_на_фото"

# РАЗМЕР ГРУДИ СЛОВАМИ НЕ ДЕЛАЕТСЯ — ЕГО ДЕЛАЮТ ВЕСА.
#
# Замер 24.09.2026 на снимке худой плоской клиентки, un_full, одно
# зерно: «как на фото», «стройная» (SMALL, ALMOST FLAT CHEST), прямой
# приказ «плоская остаётся плоской» и вся лестница denoise от 1,00 до
# 0,70 дали ОДНУ И ТУ ЖЕ круглую грудь. Шесть попыток, ни одна не
# сдвинула размер: у сборки свой прочный навык, и текстом он не
# правится. Она и сама его не переступает — из четырёх заказанных ей
# «женщин с плоской грудью» плоской вышла одна.
#
# Поэтому размер ушёл на карту, в лору `Flat Chest (Qwen)`, а здесь
# лежит только сила. Выбрал человек — верим человеку: своё тело он
# знает лучше любой меры. Не выбирал («как на фото») — карта меряет
# снимок сама и включает лору, только если грудь ПЛОСКАЯ наверняка
# (`плоскость_по_снимку` в gpu/приёмка.py).
ПЛОСКОСТЬ_ЛОРЫ = {
    "стройная": 1.0,
    # Средняя — это и есть то, что сборка рисует сама, без лоры.
    "средняя": 0.0,
    "пышная": 0.0,
    "как_на_фото": "авто",
}


def плоскость(сложение):
    """Сила лоры плоской груди для выбранного сложения."""
    return ПЛОСКОСТЬ_ЛОРЫ.get(сложение or СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ,
                              ПЛОСКОСТЬ_ЛОРЫ[СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ])


# ДЛИННОЕ ОПИСАНИЕ ВНЕШНОСТИ МЕШАЛО ВНЕШНОСТИ. Замер 22.09.2026.
#
# Здесь лежали 2267 знаков перечисления: то же лицо, те же скулы, те же
# родинки, тот же загар, та же ключица. Треть всего промпта, и стояла
# она ровно в мёртвой середине — там, где модель пролистывает.
#
# Двенадцать кнопок, одно зерно, один референс, отличалось только это
# место:
#
#     2267 знаков  Ника на 11 кадрах из 12, на «сверху» вышла брюнетка,
#                  кожа местами намасленная, «крупный план» расплывался
#      300 знаков  Ника на 12 из 12, грудь маленькая везде, кожа
#                  матовая, ракурсы читаются по кнопкам
#
# Сокращение не ослабило сходство, а усилило: внешность держат якорь
# личности в начале, стартовый латент и негатив, а перечисление только
# разбавляло всё остальное — позу, ракурс и откровенную строку, ради
# которых человек и нажал кнопку.
# ВОЗРАСТ ТЕПЕРЬ СИММЕТРИЧЕН. Было «an adult, and as young an adult as
# the photograph shows... do not age her up» — то есть запрет старить
# при разрешении молодить. Требование владельца от 24.09.2026: возраст
# максимально как на референсе. Молодить — такая же подмена человека,
# как и старить, и «моложе» тут ещё и опаснее: снимок присылает
# взрослый человек, и уводить его вид к детскому нельзя ни на сколько.
# Поэтому здесь сказано И то, И другое: её собственные годы, и она
# взрослая.
ТЕЛО_ПО_ФОТО = (
    "The woman from the reference photograph, one to one. FACE "
    "preserved exactly, and with it her hair, her skin, her body and "
    "HER OWN AGE: she looks exactly as old as she looks in that "
    "photograph, no younger and no older, and she is an adult woman. "
    "WHAT IS "
    "UNDER THE CLOTHES IS NOT YOURS TO INVENT: it is read out of that "
    "photograph, and a small or flat chest stays small. Do not "
    "beautify, do not slim, do not enlarge, do not age her up and do "
    "not make her look younger than she is. Any "
    "departure from the reference is a defect, even a flattering one."
)


# Референс есть ВСЕГДА (решение владельца 21.09.2026), поэтому вариант
# «лица нет, придумай» удалён целиком. Старое имя оставлено: каталог и
# тесты ссылаются на «face preserved exactly» как на признак того, что
# блок сохранения лица на месте.
ТЕЛО = ТЕЛО_ПО_ФОТО

# Парные сцены: людей двое, и референсов двое.
#
# ЧЕСТНО О ПРЕДЕЛЕ. Узел `TextEncodeQwenImageEditPlus` принимает
# `image1..image3` БЕЗ подписей ролей: сказать модели «на первом снимке
# мужчина, на втором женщина» технически нечем — в кодировщик уходит
# один общий текст и безымянный список картинок. Слова «first reference»
# в тексте ниже — единственная доступная зацепка, и работает она через
# раз: модель может перепутать, кто где, или смешать двоих в одного.
#
# Поэтому здесь упор не на «кто первый», а на то, что людей РОВНО ДВОЕ и
# они РАЗНЫЕ. Смешение двух лиц в одно — самый частый брак парных
# сцен, и стоит он дороже перепутанного порядка.
ТЕЛО_ПАРА = (
    "Two reference photographs, one person in each. Build ONE frame with "
    "both of them together. FACE preserved exactly for each of them: same "
    "bone structure, same eyes, same nose, same lips, same marks — both "
    "instantly recognisable. Each keeps their own hair, skin tone "
    "and build. They share one light, one floor and "
    "one perspective, touching where the scenario says they touch — no "
    "collage, no floating second figure, honest scale between them. "
    "TWO different people, and the two faces stay two faces: never "
    "blended into one face and never swapped between the bodies."
)

# Про кожу сказано ДВАЖДЫ и по-разному: «настоящая» — и отдельно
# «матовая, сухая». Одних запретов (oiled skin, body oil) не хватило:
# на прогоне 22.09 тела продолжали блестеть. Дистиллированная сборка
# слушает утверждение лучше, чем запрет, поэтому матовость сказана
# положительно, в лоб.
КОЖА = (
    "Real skin: visible pores, fine hair, uneven tone, natural blemishes. "
    "No plastic smoothing, no airbrushing. The skin is MATTE and DRY — "
    "soft diffuse sheen at most, never oiled, never wet-looking, never "
    # «chest», а не «breasts»: этот кусок общий, он достаётся и мужским
    # сценам, где про грудь говорить нечего (тест «у двух мужчин про
    # грудь молчим»).
    "glistening, no baby-oil highlights on the chest, belly or thighs."
)

АНАТОМИЯ = (
    "Correct anatomy: five fingers per hand, joints that bend the right "
    "way, symmetric eyes, weight resting on something."
)

ТКАНЬ = (
    "Fabric behaves as fabric: it creases, hangs and presses into skin."
)

СТАРШИНСТВО = (
    "Where the action above and the pose below disagree, THE ACTION WINS "
    "— it is what was ordered. The camera angle, the focal length, the "
    "light and the place are not overridden by it and stay exactly "
    "as written."
)

КАМЕРА_ОБЩЕЕ = (
    "Shot on a full-frame camera: sharp on the eyes, natural depth of "
    "field, no digital zoom look."
)

ЦВЕТ = (
    "Natural colour, daylight white balance, nothing oversaturated."
)

# Когда место задало СВОЙ свет — неон, лампу отеля, закат, — требование
# дневного баланса белого спорит с ним и гасит его. Тогда говорим не
# «дневной», а «такой, какой поставило место», и отдельно просим, чтобы
# цвет кожи остался кожей.
ЦВЕТ_ПРИ_СВОЁМ_СВЕТЕ = (
    "Colour comes from the light described above and nothing else — do "
    "not neutralise it to daylight. Skin still reads as skin: never "
    "dyed a flat colour by the coloured light, never oversaturated."
)

# «ОДНО ТЕЛО» — находка прогона 22.09.2026. На крупных интимных планах
# сборка сваливала в один кадр лицо сверху и пах снизу как две
# отдельные картинки: получалось второе туловище, руки прирастали к
# паху, грудь сливалась в полосу. Референс поясной, а просят кадр во
# весь рост — модель дорисовывала недостающее, вместо того чтобы взять
# один непрерывный план. Требование непрерывности тела снимает это.
КОМПОЗИЦИЯ = (
    "Whole subject inside the frame, nothing important cropped away."
)

# Требование непрерывности тела РАЗНОЕ у одиночки и у пары, и спутать
# их нельзя: «одно туловище, одна голова» в парной сцене — прямое
# указание слепить двоих в одного.
# СЧЁТ ТЕЛ И КОНЕЧНОСТЕЙ — вслух и только про то, что ДОЛЖНО быть.
# Поломки отсюда убраны намеренно: сборка рисует названное даже под
# отрицанием. Замер 22.09.2026 — фраза «never a separate strip of face
# pasted above the body» УВЕЛИЧИЛА число коллажей; те же поломки,
# перенесённые в негатив (ЛИШНИЕ_ЛЮДИ, КАША_ИЗ_ТЕЛ), их убрали.
#
# Работает при этом не слово «правильно», а ПРОСЛЕЖИВАЕМОСТЬ: каждая
# конечность названа растущей из своего места. Тем же приёмом ушёл
# фантомный фаллос на соло — рука, прослеженная от плеча, перестала
# читаться сборкой как отдельный предмет.
ОДНО_ТЕЛО = (
    "ONE single continuous body: one head on her own neck, one torso, "
    "two arms growing from her own shoulders, two legs growing from her "
    "own hips — two hands and two feet in all, and every one of them "
    "traceable back along its own limb to the place it grows from. Head, "
    "chest, belly and hips follow one another in the natural order and "
    "at natural distances, as in a single unretouched photograph."
)

ДВА_ТЕЛА = (
    "EXACTLY TWO bodies in the frame: two heads, each on its own neck, "
    "four arms and four legs, four hands and four feet in all. Every "
    "limb is traceable back along itself to the one body it grows from, "
    "and the two bodies keep their own outlines where they touch, each "
    "whole and separate, as in a single unretouched photograph. Every "
    "elbow and knee bends forwards only, never backwards."
)

КАЧЕСТВО = (
    "Photorealistic photograph, not a render, not a painting, not CGI."
)

# Негатив сторожит ровно то, что просил владелец: результат обязан
# совпадать с референсом, а не быть «лучше» него. Поэтому здесь не
# только привычный брак (лишние пальцы, пластиковая кожа), но и
# ПРИУКРАШИВАНИЕ — оно портит сходство, а выглядит как удача, и потому
# опаснее откровенного брака.
НЕГАТИВ = (
    "cartoon, anime, illustration, painting, drawing, 3d render, cgi, "
    "doll, figurine, video game character, plastic skin, waxy skin, "
    "airbrushed, beauty filter, poreless, smoothed skin, instagram face, "
    "generic model face, stock photo model, "
    "different person, changed face, distorted face, face swap artifacts, "
    # ПОРНО-ГЛЯНЕЦ. Прогон 22.09.2026: в парных сценах тела выходили
    # намасленными и блестящими — вид коммерческого порно, который
    # владелец забраковал ещё на одиночных.
    "oiled skin, body oil, wet shiny skin, glossy plastic skin, "
    "greasy highlights, airbrushed porn look, "
    # ЗАПРЕТОВ «НЕ ПЫШНАЯ» И «НЕ ВЗРОСЛАЯ» ЗДЕСЬ БОЛЬШЕ НЕТ, и это
    # правка 24.09.2026 по требованию владельца «фигура и возраст
    # максимально как на референсе».
    #
    # Они стояли постоянными, на КАЖДОМ кадре: «large breasts, busty,
    # voluptuous, curvy» и «mature woman, milf, older woman». Пышной
    # клиентке это запрещало быть пышной, а взрослой — быть своего
    # возраста, и спорило с её же собственным снимком. Заодно оно
    # спорило с выбором «пышная» в самом боте: положительный промпт
    # просил большую грудь, а негатив её запрещал.
    #
    # Теперь эти запреты живут в `ХУДОБА_И_МОЛОДОСТЬ` и подклеиваются
    # ТОЛЬКО когда человек сам выбрал «стройная»: там они не спорят ни
    # с промптом, ни с референсом. Симметричные запреты («толще, чем на
    # референсе», «моложе», «старше») остаются постоянными — они как
    # раз и держат сходство.
    "different body type, slimmer than reference, thinner waist, "
    "slimmed down, weight loss, fatter than reference, enlarged breasts, "
    "bigger breasts, smaller breasts, enlarged buttocks, wider hips, "
    "narrower hips, flattened belly, belly removed, waist snatched, "
    "longer legs, changed height, changed proportions, idealized body, "
    "fitness model body, hourglass figure added, "
    "changed hair colour, changed hair length, changed skin tone, "
    "tanned differently, removed moles, removed freckles, removed scars, "
    "younger face, older face, changed age, "
    "deformed hands, extra fingers, missing fingers, fused fingers, "
    "extra limbs, malformed limbs, bad anatomy, broken proportions, "
    "asymmetric eyes, crossed eyes, extra teeth, watermark, signature, "
    "text, caption, logo, username, frame, border, jpeg artifacts, "
    "oversaturated, blown highlights, crushed blacks, blurry, "
    "out of focus, lowres, duplicate, cropped head, floating limbs, "
    # СКЛЕЙКА ТЕЛА. Прогон 22.09.2026, крупные интимные планы: лицо
    # ставилось прямо над пахом, появлялось второе туловище, кисти
    # прирастали к промежности, грудь слипалась в сплошную полосу.
    "mutated, duplicated torso, two bodies merged, second body, "
    "face on top of crotch, head attached to pelvis, "
    "disconnected body parts, hands merged into body, "
    "fused breasts, breasts merged into one mass, "
    "collage, split image, stacked images, picture within a picture, "
    # ГИПС И ЧЁРНО-БЕЛОЕ. Замер 24.09.2026: на части зёрен вместо
    # женщины выходила серая скульптура — кожа без цвета, свет
    # студийный, поза верная. Приёмка такие кадры пропускала (статуя
    # голая, состав тот), поэтому ловим с двух сторон: здесь запретом,
    # на карте — проверкой цветности.
    "statue, sculpture, marble, plaster cast, clay model, mannequin, "
    "monochrome, greyscale, black and white, desaturated, colourless skin"
)

# Куски по СЕМЕЙСТВУ режима, а не по каждому виду отдельно: пяти- и
# десятисекундный ролик отличаются длиной, а не словами.
#
# Ключи совпадают с приставками видов из pricing.JOBS: i2i, i2v, sound.
# Режимов без входного снимка больше нет — см. pricing.БЕЗ_ФОТО.
ПО_ВИДУ = {
    # Фото-в-фото бывает ДВУХ видов, и это разные товары.
    #
    # «Новое место» — обстановку сочиняем с нуля.
    # «То же место» — обстановку берём с присланного фото.
    #
    # Раньше был только первый, и обе категории каталога делали одно и
    # то же разными словами.
    "i2i": (
        "Take the person from the reference photographs and build a new "
        "frame around her as described below. Only the person carries "
        "over: pose, framing and surroundings are yours to compose."
    ),
    # ДВА СПИСКА, И ОБА ОБЯЗАТЕЛЬНЫ.
    #
    # Сперва здесь было сказано «оставь всё как есть, кроме одежды» — и
    # прогон 22.09.2026 отдал семь одинаковых кадров: фон, лицо и
    # сложение держались идеально, а «Вид сзади», «Раком» и «Лёжа на
    # спине» выглядели одной и той же стоящей вполоборота. Модель
    # поняла буквально: не менять ничего.
    #
    # Поэтому теперь два списка. Что КОПИРУЕТСЯ — место, свет, время
    # суток. Что МЕНЯЕТСЯ — одежда, поза, ракурс, план. Без второго
    # списка товара нет: вариант и есть поза с ракурсом, за них платят.
    "i2i_фон": (
        "EDIT THIS PHOTOGRAPH: keep the PLACE, change the PERSON'S POSE. "
        "COPIED from the photograph and not invented: the room or "
        "backdrop behind her, its colour and material, the objects in "
        "it, the light and the direction it comes from, the time of day. "
        "A plain studio backdrop stays the same plain studio backdrop of "
        "the same grey. No bedroom, hotel, pool or beach appears, and no "
        "furniture that was not already there. "
        "CHANGED according to the scenario below: her clothes come off "
        "entirely, and her POSE, her position in the frame, the CAMERA "
        "ANGLE and the CROP are the scenario's to set. They must clearly "
        "differ from the photograph — if the scenario says she lies "
        "down, she lies down; if it says the camera is low, the camera "
        "is low; if it says a close-up, the frame closes in. Copying her "
        "pose from the photograph is as much a failure as inventing a "
        "new room."
    ),
    "i2i_пара": (
        "Two references, one person in each. Build a single new frame "
        "with BOTH of them in it, posed as the scenario says. Neither "
        "original frame is kept — only the two people."
    ),
    "inpaint": (
        "Change ONLY the region marked in the supplied mask. Everything "
        "outside it stays byte-for-byte as it was: the face, the hair, the "
        "pose, the background, the light direction, the grain. The edited "
        "region must match the surrounding frame in colour temperature, "
        "noise and sharpness so the seam is invisible at full resolution."
    ),
    # РОЛИК СОБИРАЕТСЯ КОРОТКИМ ПРОМПТОМ, и это не небрежность.
    #
    # У ролика ПЕРВЫЙ КАДР УЖЕ ГОТОВ: его сделал первый проход, там
    # правильное лицо, правильное сложение, правильная комната. Второму
    # проходу не нужно ничего этого описывать — ему нужно объяснить
    # ДВИЖЕНИЕ. Пересказывать ему заново внешность значит звать его
    # нарисовать человека заново, и он зовётся: владелец 22.09.2026
    # получил ролик, где «вообще другой человек, другие формы».
    #
    # Поэтому у i2v собирается только: этот блок, строка владельца и
    # запрет на подмену. Ни сохранения лица, ни сложения, ни кожи с
    # анатомией — всё это уже в кадре, который оживляют.
    "i2v": (
        "Animate the supplied photograph into a vertical clip, 9:16. The "
        "first frame is that photograph itself, unchanged. If a second "
        "image is supplied it is the LAST frame, and the motion must "
        "arrive at it smoothly rather than cutting to it. Motion is small, "
        "continuous and physically plausible: breathing that lifts the "
        "chest, a slow blink, hair settling, fabric shifting with the "
        "body. The face must stay the same face in every single frame."
    ),
    "sound": (
        "Animate the supplied photograph into a vertical clip with speech, "
        "9:16. Lips must match the audio precisely: closures on b, p and m, "
        "teeth on f and v, an open jaw on broad vowels. Jaw, cheeks and "
        "throat move with the mouth; the whole face participates, not the "
        "mouth alone. Eyes stay alive between phrases with natural blinks "
        "and micro-movements. The face must stay the same face throughout."
    ),
}


# ЗАДАНИЕ РОЛИКА, КОГДА ДВИЖЕНИЕ НАПИСАНО САМОЙ КНОПКОЙ.
#
# То же, что «i2v», но без «дыхание, моргание, волосы оседают»: эта
# фраза спорит с актом и выигрывает — сборка охотнее делает маленькое
# движение, чем большое.
ВИДЕО_БЕЗ_ДЫХАНИЯ = (
    "Animate the supplied photograph into a clip. The first frame is "
    "that photograph itself, unchanged, and everything that follows "
    "grows out of it without a cut. The face must stay the same face in "
    "every single frame.")


def семейство(вид):
    """Вид генерации -> семейство промпта. i2v_5 и i2v_10 отличаются
    длиной, а не словами, поэтому текст у них общий."""
    return вид.rsplit("_", 1)[0] if вид[-1].isdigit() else вид


class Блок:
    """Одна грань сценария. Пустые не попадают в текст.

    `откровенное` — строка ВЛАДЕЛЬЦА. Она не пишется здесь и не живёт в
    коде: её место в `ОТКРОВЕННОЕ.txt`, где одна строка на сценарий.
    Разделение простое и постоянное: всё, что делает кадр работой, а не
    браком — свет, объектив, анатомия, кожа, ткань, композиция, запреты
    — собирается автоматически и одинаково для всех сценариев; что
    именно происходит в кадре, владелец пишет сам.

    Слот необязателен: пустой сценарий собирается и работает, просто
    показывает героиню в заданной обстановке без явного действия.
    """

    __slots__ = ("гардероб", "поза", "обстановка", "свет", "камера",
                 "настроение", "ещё", "откровенное", "место_кратко",
                 "жёстко", "движение")

    def __init__(self, гардероб="", поза="", обстановка="", свет="",
                 камера="", настроение="", ещё="", откровенное="",
                 место_кратко="", жёстко="", движение=""):
        # ЧТО ИМЕННО ДВИЖЕТСЯ В РОЛИКЕ. Заполняется только у ролика и
        # только у кнопки, для которой движение написано: см.
        # `catalog.ДВИЖЕНИЕ`. У фотографии слот пустой — «движение» в
        # тексте неподвижного кадра сборка рисует смазом.
        self.движение = движение
        # ЖЁСТКАЯ ПОСТАНОВКА. Ракурс и поза, отобранные владельцем на
        # живых кадрах и повторяемые дословно у КАЖДОГО клиента. Стоит
        # сразу за актом, то есть в первой трети промпта, — дальше
        # сборка до него не доходит (проверено: держится примерно
        # первая тысяча знаков).
        #
        # Слот заполняется ТОЛЬКО там, где владелец кадр принял. Пустой
        # — сцена собирается как раньше, по его строке.
        self.жёстко = жёстко
        self.откровенное = откровенное
        # Короткая форма выбранного места — для парной сборки, куда
        # полное описание не влезает (см. `собрать_пару`).
        self.место_кратко = место_кратко
        self.гардероб = гардероб
        self.поза = поза
        self.обстановка = обстановка
        self.свет = свет
        self.камера = камера
        self.настроение = настроение
        self.ещё = ещё


# ПОСЛЕДНЕЕ СЛОВО. Ставится в самый конец промпта.
#
# Модель внимательна к началу и к концу, а провисает в середине — и
# ровно в середине у нас откровенная строка владельца, где стоят слова
# «tits», «sexy pose», «wet». Они тянут в порно-эстетику: большая
# грудь, масляная кожа, гостиничный номер вместо набережной. Замерено
# 21.09.2026: чем длиннее промпт вокруг этих слов, тем сильнее их тяга.
#
# Поэтому требование о сложении повторяется последним — коротко и без
# оговорок, уже после всего.
ПОСЛЕДНЕЕ_ХВОСТ = (
    # «her own young face» было тем же перекосом, что и в `ТЕЛО_ПО_ФОТО`:
    # оно просило молодость, а не её собственный возраст. См. там же.
    "Her own waist, her own hips, her own face at her own age. She is "
    "not a porn model and this is not a glamour shoot; anything added "
    "to flatter her is a defect."
)

# То же самое без «её»: у сцены из двух мужчин женского тела в кадре
# нет, и «her own hips» там читается как указание одного из них
# переделать.
ПОСЛЕДНЕЕ_БЕЗ_ПОЛА = (
    "FINAL CHECK, outranking every word above: these are the bodies and "
    "the faces from the references, unchanged. Nothing is idealised, "
    "nothing is added to flatter them."
)


# Одежда, которую вообще может назвать вариант или человек. Список
# нужен ровно для одного решения: говорить ли про поведение ткани.
# Ошибка в меньшую сторону безобидна — пропадёт одно предложение.
ОДЕЖДА_СЛОВА = (
    "dress", "skirt", "shirt", "blouse", "bra", "panties", "knickers",
    "lingerie", "stockings", "tights", "swimsuit", "bikini", "shorts",
    "jeans", "sweater", "uniform", "leggings", "corset", "blazer",
    "hoodie", "jacket", "trousers",
)


# ДВА ХВОСТА НЕГАТИВА, КОТОРЫЕ ЗАВИСЯТ ОТ КАДРА. Прогон 22.09.2026.
#
# Положительный текст уже говорит и «ровно двое», и «оба голые». На
# части кнопок этого не хватило: у пары «Сверху» и «Крупный план»
# набиралась куча из трёх лиц, а на «Лицом к лицу» и «От первого лица»
# один из двоих оставался в белье со своего референса. Негатив при
# CFG 1.5 живой, и запрет добивает то, что утверждение не дожало.
#
# Хвосты именно ПО КАДРУ, а не общие: «two people» нельзя запрещать
# парной сцене, а одежду нельзя запрещать там, где человек сам про неё
# написал.
# ТРЕТЬЕГО В КАДРЕ НЕТ. Правило владельца от 22.09.2026, жёсткое:
# «более 2 человек в кадре не должно быть». Ловилось на парных сценах —
# в позе 69 приходила третья девушка, на «отлизывает сзади» — четвёртая
# голова у края. Считаем вслух: лишние головы, лишние лица, ряд голов,
# кто-то на фоне.
ЛИШНИЕ_ЛЮДИ = (
    "third person, third woman, third man, three people, four people, "
    "extra person, extra head, third head, fourth head, extra face, "
    "three heads, four heads, row of heads, duplicated face, cloned "
    "face, crowd, group, people in the background, someone in the "
    "background, bystander, onlooker"
)
ТОЛЬКО_ОДИН = "two people, second person, couple, another woman, another man"

# АНАТОМИЯ ЦЕЛАЯ. Второе жёсткое правило владельца от 22.09.2026:
# «вся анатомия тел должна быть идеальная, чтобы не было каши
# сросшихся конечностей». В парных сценах ломалось ровно это: тела
# срастались тазами, у одной выходила третья рука, ступня оказывалась
# ничьей. Общего «bad anatomy» на это не хватало — перечислено
# поимённо то, что сборка рисует.
КАША_ИЗ_ТЕЛ = (
    "merged bodies, fused bodies, conjoined bodies, bodies growing into "
    "each other, shared torso, shared limb, limb belonging to no one, "
    "third arm, third leg, fifth limb, extra foot, three feet, three "
    "hands, extra arms, extra legs, arm without a shoulder, leg without "
    "a hip, detached hand, detached foot, floating hand, twisted neck, "
    "head rotated backwards, impossible contortion, melted anatomy, "
    "knee bent backwards, knee bent the wrong way, inverted knee, "
    "elbow bent backwards, leg bent inside out, impossible joint"
)
ОДЕТЫЕ = (
    "clothed, dressed, partially dressed, underwear, lingerie, bra, "
    "panties, knickers, thong, bikini, swimsuit, shorts, boxers, "
    "stockings, dress, skirt, shirt, top, covered breasts, covered crotch, "
    # НАЗВАНО ТО, ЧТО НА РЕФЕРЕНСАХ. Прогон 22.09.2026: модели на
    # снимках сняты в купальниках — розовый у неё, серый у второй,
    # серые шорты у него, — и Qwen Edit тащит их в кадр, даже когда в
    # тексте сказано «полностью голые». Общего слова «bikini» мало:
    # в запретах должны стоять те же куски, которые сборка рисует —
    # лямки, верх, низ.
    "bikini top, bikini bottom, bikini straps, bra strap, shoulder strap, "
    "swim trunks, grey shorts, swimwear"
)

# ЧЕМ УТВЕРЖДАТЬ НАГОТУ. Отрицание одежды против купальника с
# референса не работает (см. ОДЕТЫЕ выше) — работает утверждение того,
# чего в одежде НЕ БЫВАЕТ. Замер 22.09.2026, шесть кругов по четыре
# зерна: «both are completely naked» оставляло лифчик на 9 кадрах из
# 12; формулировки ниже — ни на одном.
СОСКИ_ВИДНЫ = ("Her chest is bare skin and her own nipples are in plain "
               "view; her hips are bare skin as well.")
# Со спины сосков не видно, и утверждение про них молчит — тогда
# лифчик возвращается. Для видов сзади своя формула, про спину.
СПИНА_ГОЛАЯ = ("Her whole back is bare skin from her shoulders down to "
               "her waist, with no strap and no band anywhere on it.")

# Мужская анатомия, наоборот, СТИРАЕТСЯ: стоящий во весь рост мужчина
# читается сборкой как обнажённый портрет, и пах выходит гладким.
# Помогает только запрет самой пустоты.
#
# И есть третий случай, обратный «члену у девушки»: сборка рисует
# МУЖЧИНЕ ЖЕНСКУЮ АНАТОМИЮ. Пойман 22.09.2026 на «Наезднице»: она
# сидит сверху, член по тексту внутри неё — рисовать в паху нечего, и
# пах мужчины вышел женским. Запрет пустоты этого не ловит: пах не
# пустой, он занят. Ловится только прямым называнием.
ЧЛЕН_НЕ_СТЁРТ = ("smooth featureless crotch, no penis, censored, "
                 "vulva on the man, vagina on the man, female genitals "
                 "on the man, man without a penis")

# А ЖЕНЩИНЕ сборка дорисовывает член — на слове «мастурбирует», на позе
# «раком», на любом откровенном действии. Владелец ловил это четырежды
# и 22.09.2026 закрыл вопрос жёстким правилом: «у девушек не должно
# быть хуев, это анатомия».
#
# Поэтому запрет стоит ВЕЗДЕ, где в сцене нет мужчины, — и у пары
# женщин, и у одиночной кнопки. Одиночная сборка написана про женщину
# насквозь (22 женских местоимения, ни одного мужского, и всюду грудь),
# так что стереть мужчину этот запрет не может: мужчины там и не было.
# Единственное исключение — сцены, где мужчина есть в кадре: МЖ и ММ.
# Их отбирает `мужчина_в_кадре()`.
МУЖСКОЕ_ЛИШНЕЕ = ("penis, cock, phallus, erect penis, male genitals, "
                  "testicles, futanari, intersex, hermaphrodite, "
                  "man, male body")

# Мужчина в кадре есть, а члена в кадре нет — «Кунилингус» МЖ: он лежит
# ничком лицом у её вульвы, своего паха не видно. Сторожить тут надо не
# пустоту паха (её и не увидеть), а ровно одно: чтобы мужчина остался
# мужчиной и не оделся.
МУЖЧИНА_НЕ_ЖЕНЩИНА = ("vulva on the man, vagina on the man, female "
                      "genitals on the man, breasts on the man, man "
                      "turned into a woman, second woman instead of the "
                      "man, clothed man, shorts on the man")

# Мужские слова, по которым сборку видно как МЖ/ММ. Хватает любого:
# парная сборка всегда называет мужчину «the man», а «one man and one
# woman» стоит в хвосте каждой МЖ-кнопки.
МУЖСКИЕ_СЛОВА = ("the man", "one man and one woman", "erect penis",
                 "his penis", "two men", "both men")


def мужчина_в_кадре(промпт):
    """Есть ли в кадре мужчина. Сравнение без учёта регистра.

    23.09.2026 признаком мужчины служили слова «erect penis» — и это
    прошло мимо «Кунилингуса» МЖ: член там не назван, потому что его не
    видно. Кнопка МЖ уехала в женскую ветку и получила в негатив
    «penis, man, male body» — то есть САМА ЗАПРЕЩАЛА МУЖЧИНУ. На
    восьми кадрах это и дало «кашу»: мужчина то в серых шортах, то
    отвёрнут, то без рук. Признак теперь — любое мужское слово сборки.
    """
    т = промпт.lower()
    return any(м in т for м in МУЖСКИЕ_СЛОВА)


# Запреты, которые годятся ТОЛЬКО при явном выборе «стройная».
#
# До 24.09.2026 они стояли в постоянном негативе и запрещали пышной
# клиентке быть пышной. Здесь они остаются потому, что у «стройной»
# сборка охотно дорисовывает грудь: владелец ловил это сам — «в
# референсе маленькая грудь, а на выходе огромные сиськи».
ХУДОБА_И_МОЛОДОСТЬ = (
    "large breasts, big breasts, huge breasts, enlarged bust, busty, "
    "voluptuous, curvy, breast implants, boob job, heavy chest, "
    "cleavage added, push-up effect, thickened waist"
)


def негатив(промпт):
    """Негатив под КОНКРЕТНЫЙ кадр, выведенный из его же текста.

    Ничего не надо прокидывать через полпрограммы: собранный промпт и
    есть источник правды. В нём видно, пара это или один, и названа ли
    в кадре одежда.
    """
    куски = [НЕГАТИВ, ЛИШНИЕ_ЛЮДИ, КАША_ИЗ_ТЕЛ]
    # «Не пышная» ставится, только когда человек сам выбрал «стройную».
    # Признак берём из самого промпта, как и всё остальное здесь: текст
    # сложения в нём уже стоит, и второго источника правды заводить
    # незачем.
    if (СЛОЖЕНИЕ_КРАТКО["стройная"] in промпт
            or СЛОЖЕНИЕ["стройная"][:60] in промпт):
        куски.append(ХУДОБА_И_МОЛОДОСТЬ)
    # Признака два, потому что сборки две: длинная (одиночная) и
    # короткая (парная). Пропустить парную значило бы запретить ей
    # второго человека — то есть сломать саму кнопку.
    пара_видна = ("EXACTLY TWO bodies" in промпт
                  or "Exactly two people in the frame" in промпт)
    if not пара_видна:
        куски.append(ТОЛЬКО_ОДИН)
    if "Fabric behaves as fabric" not in промпт:
        куски.append(ОДЕТЫЕ)
    # Запрет пустого паха ставим ТОЛЬКО там, где член в кадре и должен
    # быть: в женской сцене он сам по себе становится подсказкой, и
    # сборка рисует его девушке — владелец ловил это трижды.
    # Мужчина в кадре есть ровно там, где его анатомия названа самой
    # сборкой. Тогда сторожим обратное — чтобы пах не вышел гладким.
    # Везде остальном это женская сцена, и член в ней запрещён.
    # СРАВНЕНИЕ БЕЗ УЧЁТА РЕГИСТРА, и это не придирка. 23.09.2026
    # жёсткая постановка «Раком» написала «HIS ERECT PENIS» прописными
    # — точное сравнение не сработало, сцена сошла за женскую, и в
    # негатив уехали «penis, man, male body». То есть кнопка «МЖ»
    # запрещала мужчину. Поймано тестом до выкладки.
    if "erect penis" in промпт.lower():
        куски.append(ЧЛЕН_НЕ_СТЁРТ)
    elif мужчина_в_кадре(промпт):
        куски.append(МУЖЧИНА_НЕ_ЖЕНЩИНА)
    else:
        куски.append(МУЖСКОЕ_ЛИШНЕЕ)
    return ", ".join(куски)


def одежда_названа(блок):
    """Названа ли одежда СОБСТВЕННЫМИ словами сцены или человека.

    Смотрим только в гардероб и в откровенную строку — не в свои же
    служебные абзацы. Иначе получается круг: фраза «ни бикини, ни
    шорт» сама включает разговор о ткани, ради запрета которого она и
    написана.
    """
    текст = " ".join((getattr(блок, "гардероб", "") or "",
                      getattr(блок, "откровенное", "") or "")).lower()
    return any(с in текст for с in ОДЕЖДА_СЛОВА)


def последнее(сложение_текст):
    """Повтор требования о сложении в самом конце промпта.

    Раньше тут стояло «грудь ровно того размера, какой показывает
    одетый референс» — то же условие, которое модель не выполняет,
    только в конце. Теперь в конце повторяются ТЕ ЖЕ БУКВАЛЬНЫЕ СЛОВА,
    что и в начале: модель внимательна к началу и к концу, а провисает
    в середине — там, где стоит откровенная строка владельца.
    """
    if not сложение_текст:
        return ПОСЛЕДНЕЕ_БЕЗ_ПОЛА
    return ("FINAL CHECK, outranking every word above: " + сложение_текст
            + " " + ПОСЛЕДНЕЕ_ХВОСТ)


# Что дописывается к ролику вместо всего снятого выше. Одна строка, и
# она про ОДНО: не подменять человека, который уже стоит в первом кадре.
ВИДЕО_ДЕРЖАТЬ = (
    "The person in the first frame is the person for the whole clip: "
    "same face in every frame, same body, same breast size, same hair, "
    "same room, same light. Nothing and nobody is replaced or redrawn."
)


def своя_строка_флаг(блок, значение):
    """Написал ли владелец этому варианту свой текст.

    Считать по наличию `блок.откровенное` нельзя: туда каталог всегда
    подклеивает служебную строку про наготу.
    """
    if значение is None:
        return bool(getattr(блок, "откровенное", "").strip())
    return bool(значение)


def первое_предложение_акта(блок):
    """Сам акт без служебного хвоста про наготу.

    Каталог склеивает строку владельца и обязательную строку через
    пустую строку — берём то, что до неё.
    """
    текст = getattr(блок, "откровенное", "").strip()
    return текст.split("\n\n")[0].strip()


# ---------------------------------------------------------------------
# КОРОТКИЙ ПРОМПТ ДЛЯ ПАРЫ
#
# Замер 22.09.2026, «Секс раком», четыре круга по два зерна. Длинный
# парный промпт (5343 знака) НИ РАЗУ не дал всё нужное сразу: что ни
# подними наверх, вытесняется другое.
#
#     место первым        неон идеальный, акта и наготы нет
#     акт выше места      поза пошла, неон исчез
#     одежда не названа   одно зерно голое, позы нет
#     акт стал заданием   поза на обоих, нагота и неон ушли
#     709 ЗНАКОВ          неон, поза, грудь, лица, ровно двое — сразу
#
# Причина не в порядке, а в длине: модель держит примерно первую
# тысячу знаков. У одиночной сцены есть вторая опора — присланный
# снимок в стартовом латенте (denoise 0.85), и там длинный текст
# работает: 12 кнопок из 12 по лицу. У пары латент стирается целиком
# (denoise 1.0, людей двое), опоры нет, и лишний текст только мешает.
#
# Поэтому у пары своя сборка, и она короткая.

# Мужская нагота названа ПРЯМО и анатомично. Сборка охотно рисует
# женскую наготу и прячет мужскую под одежду: общего «оба голые» ей не
# хватает. Замер на двух формулировках по два зерна:
#     «оба голые, на нём одежды нет»            1 кадр из 2
#     формулировка ниже, с названной анатомией  2 из 2
# Своя формулировка на каждый состав: в ЖЖ мужская анатомия — это не
# оговорка, а другой кадр.
# Про КАЖДОГО ОТДЕЛЬНО и через то, чего в одежде не бывает. Общее
# «оба раздеты догола» раздевало одного из двоих: множественное число
# сборка применяет к тому, кто ей ближе. Прогон 22.09.2026 — на
# блондинке оставался лифчик с её же референса в 9 кадрах из 12, пока
# нагота не стала утверждением про соски и голую спину.
ПАРА_РАЗДЕТЫ_ДОГОЛА = {
    "mf": ("Her chest is bare skin with her own nipples in plain view, "
           "her hips are bare skin and her back is bare skin with no "
           "strap on it. He is bare from his chest down to his knees, "
           "nothing on his hips: his erect penis is in plain view, of an "
           "ordinary human size, growing from his own hips."),
    "ff": ("The first woman's chest is bare skin with her own nipples in "
           "plain view, her hips are bare skin and her back is bare skin "
           "with no strap on it. The second woman's chest is bare skin "
           "with her own nipples in plain view and her hips are bare "
           "skin as well."),
    "mm": ("The first man is bare from his chest down to his knees, his "
           "erect penis in plain view growing from his own hips. The "
           "second man is bare the same way, nothing on his hips and his "
           "erect penis in plain view."),
}

# Сложение одной фразой: в короткий промпт абзац на 319 знаков не
# влезает, а размер груди владелец называет первым делом.
СЛОЖЕНИЕ_КРАТКО = {
    "стройная": "She is petite with a small, almost flat chest.",
    "средняя": "She has an average build with medium natural breasts.",
    "пышная": "She is full and curvy with large natural breasts.",
    # У парной сборки жёсткий лимит длины, поэтому здесь коротко — но
    # про то же самое: тело не сочиняем, а читаем со снимка.
    # Те же слова, что и в длинном: без «build», «weight» и прочего
    # словаря ваяния — см. замер над `СЛОЖЕНИЕ["как_на_фото"]`.
    "как_на_фото": ("Her body is copied from her reference photograph "
                    "and not invented: same breasts, same waist, same "
                    "hips, same belly."),
}

ПАРА_ТЕХНИКА = "Photorealistic, matte skin, correct hands."


# КОМНАТА С ПЕРВОГО СНИМКА — одной короткой строкой, и в КОНЦЕ.
#
# Держит комнату не текст, а стартовый латент (см. `DENOISE_ФОН` в
# `bot.py`): при denoise 0,85 обстановка первого снимка переживает часть
# шагов и остаётся узнаваемой. Строка нужна лишь затем, чтобы текст об
# обстановке не молчал — молчание сборка читает как «сочиняй».
#
# Отсюда два ограничения, оба проверяются тестами. Короткая: у парного
# промпта жёсткий лимит длины, и абзац, как у одиночной сцены, его
# ломает. В конце: начало промпта занято наготой и руками, и сдвинуть
# их за первую тысячу знаков — вернуть себе серые шорты на мужчине.
ПАРА_КОМНАТА_С_РЕФЕРЕНСА = (
    "The place is COPIED from the FIRST reference photograph: the same "
    "room, the same light. Only the people change."
)


def собрать_пару(блок, сложение=None, своя_строка=None, состав="mf",
                 фон="новый"):
    """Короткий промпт парной сцены. См. заметку выше о длине."""
    куски = ["Explicit photograph of the two people from the reference "
             "photos."]

    # Акт берём, ТОЛЬКО если владелец его написал. Без этого в слот
    # действия попадала служебная строка про наготу, и кадр начинался
    # со слов «exactly as described above», где выше ничего нет.
    # ЖЁСТКАЯ ПОСТАНОВКА ЗАМЕНЯЕТ АКТ, а не дополняет его. В ней уже
    # сказано и что происходит, и откуда снято — это дословный текст,
    # на котором владелец принял кадр. Дописывать к нему строку из
    # каталога значило бы смешать две постановки в одном промпте и
    # получить третью, непроверенную.
    жёстко = (getattr(блок, "жёстко", "") or "").strip()
    if жёстко:
        куски.append(жёстко)
    elif своя_строка_флаг(блок, своя_строка):
        акт = первое_предложение_акта(блок)
        if акт:
            куски.append(акт)
    # В жёсткой постановке нагота обоих уже названа своими словами,
    # ровно так, как в проверенном кадре. Общий блок добавил бы
    # вторую формулировку про то же самое — в частности «penis of
    # an ordinary human size», которая спорит с «full adult size»
    # из постановки. Две разные меры одного и того же в одном
    # тексте — верный способ получить третью.
    if жёстко:
        # Полный блок наготы дублировал бы постановку и спорил с ней о
        # размере («ordinary human size» против «full adult size»).
        # Но ОДНУ строку из него оставить пришлось: проверка живым
        # прогоном 23.09.2026 показала, что без неё серые шорты с
        # референса возвращаются на мужчину на половине зёрен. Это та
        # самая формула, что работает везде, — про то, чего в одежде
        # НЕ БЫВАЕТ, и без меры длины.
        # Ничего не дописываем: замер 23.09.2026 показал, что вторая
        # фраза про его наготу делает ХУЖЕ, а не лучше. Одно короткое
        # «completely naked» внутри постановки — 6 кадров из 8 чистых;
        # с добавленной строкой — 3 из 8.
        pass
    else:
        куски.append(ПАРА_РАЗДЕТЫ_ДОГОЛА.get(состав,
                                            ПАРА_РАЗДЕТЫ_ДОГОЛА["mf"]))
    # У двух мужчин про женскую грудь молчим.
    if состав == "mm":
        сложение = ""
    if сложение != "":
        куски.append(СЛОЖЕНИЕ_КРАТКО.get(сложение or СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ,
                                         СЛОЖЕНИЕ_КРАТКО[СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ]))
    # Счёт людей И конечностей одной фразой: в парной сборке места на
    # отдельный абзац нет (см. заметку о длине выше), а обе поломки
    # владелец назвал одним правилом — «больше двух не должно быть, и
    # анатомия идеальная, без каши сросшихся конечностей».
    куски.append("Exactly two people in the frame, and both faces are the "
                 "ones from the references. Two heads, four arms and four "
                 "legs in all, every limb traceable to the one body it "
                 "grows from, both bodies whole and separate where they "
                 "touch; every elbow and knee bends forwards only, "
                 "never backwards.")
    # СОСТАВ. Каталог кладёт его первым абзацем «ещё»: «на первом
    # снимке мужчина, на втором женщина» или «обе женщины». Без него
    # ЖЖ превращается в МЖ — единственное, чем эти кнопки и
    # отличаются.
    состав = (getattr(блок, "ещё", "") or "").strip().split("\n\n")[0].strip()
    if состав:
        куски.append(состав)
    место = (getattr(блок, "место_кратко", "") or "").strip()
    if место:
        куски.append(место)
    # Камера — одним предложением: в коротком тексте два лишних
    # предложения про объектив стоят столько же, сколько само место.
    # У жёсткой постановки камера своя, названа внутри неё, и вторая
    # строка про объектив спорила бы с первой.
    камера = ("" if жёстко else (getattr(блок, "камера", "") or "")).strip()
    if камера:
        куски.append(камера.split(". ")[0].rstrip(".") + ".")
    if фон == "референс":
        куски.append(ПАРА_КОМНАТА_С_РЕФЕРЕНСА)
    куски.append(ПАРА_ТЕХНИКА)
    return " ".join(куски)


def собрать(вид, блок, фон="новый", пара=False, сложение=None,
            своя_строка=None, состав="mf"):
    """Сценарий + общие блоки -> готовый промпт.

    Порядок намеренный: модели внимательнее к началу, поэтому сначала
    кто и что, потом где и при каком свете, и только в конце техника.

    `пара` — в кадре двое, и референсов двое. Меняет первый блок и
    описание режима: см. ТЕЛО_ПАРА о том, почему порядок референсов
    ненадёжен и что с этим сделано.
    """
    сем = семейство(вид)
    if сем not in ПО_ВИДУ:
        raise KeyError(f"неизвестный вид работы: {вид}")
    if сем in ("i2v", "sound"):
        # Короткая сборка: см. комментарий у ключа «i2v» выше.
        #
        # ДВИЖЕНИЕ КНОПКИ ВЫТЕСНЯЕТ ОБЩУЮ ФРАЗУ ПРО ДЫХАНИЕ. Она верна
        # для портрета и неверна для акта: человек платит за секс, а
        # получает неподвижную пару, которая дышит (замер на живом
        # ролике 23.09.2026). Общий текст остаётся у кнопок, для
        # которых движение ещё не написано.
        дв = (getattr(блок, "движение", "") or "").strip()
        куски = [ВИДЕО_БЕЗ_ДЫХАНИЯ if дв else ПО_ВИДУ[сем]]
        if дв:
            куски.append(дв)
        if getattr(блок, "откровенное", ""):
            куски.append(блок.откровенное.strip())
        if блок.ещё:
            куски.append(блок.ещё.strip())
        куски.append(ВИДЕО_ДЕРЖАТЬ)
        return "\n\n".join(куски)
    if фон not in ("новый", "референс"):
        raise ValueError(f"фон бывает «новый» или «референс», а не {фон!r}")

    # У пары своя сборка, короткая: длинный текст она не держит.
    if пара and сем == "i2i":
        return собрать_пару(блок, сложение, своя_строка, состав, фон)

    if сем == "i2i" and пара:
        ключ = "i2i_пара"
    elif сем == "i2i" and фон == "референс":
        ключ = "i2i_фон"
    else:
        ключ = сем
    # ПОРЯДОК ПЕРВЫХ ДВУХ БЛОКОВ РЕШАЕТ, ЧТО ПОЛУЧИТСЯ.
    #
    # Обычно первым идёт сохранение человека, а следом режим. Но когда
    # обстановка берётся с референса, работа — это ПРАВКА присланного
    # снимка, и сказать об этом надо первым словом: модель читает начало
    # промпта как задание, а всё дальнейшее как подробности. Скажешь
    # сперва «вот женщина, вот её лицо» — она и строит новую женщину.
    # 1. ЧТО ЗА РАБОТА. Первым словом — всегда, и для правки снимка, и
    # для сборки нового кадра: модель читает начало как задание.
    # ЗАДАНИЕ — ЭТО САМ АКТ, А НЕ «СОБЕРИ КАДР С ДВУМЯ ЛЮДЬМИ».
    #
    # Замер 22.09.2026, четыре пробы на «Сексе раком». Первым блоком
    # стояло общее описание работы, а откровенная строка — четвёртой, и
    # модель раз за разом возвращала фронтальный парный портрет: двое
    # стоят, смотрят в объектив. Она честно делала то, что прочитала
    # первым.
    #
    # Поэтому когда у варианта есть своя строка, она ПРИКЛЕИВАЕТСЯ К
    # ЗАДАНИЮ, в тот же абзац: не «собери кадр, а ниже подробности», а
    # «собери вот это».
    # ЖЁСТКАЯ ПОСТАНОВКА У ОДИНОЧНОЙ КНОПКИ — то же, что у парной.
    #
    # Обычная сборка описывает ракурс, план и позу СВОИМИ словами, и
    # каждый раз выходит «что-то похожее» на отобранный кадр. Там, где
    # владелец кадр принял, похожего мало: текст, на котором кадр и
    # вышел, встаёт заданием, а поля «гардероб», «поза» и «камера»
    # молчат — иначе они спорят с ним за ту же роль.
    жёстко = (getattr(блок, "жёстко", "") or "").strip()
    акт = ""
    if своя_строка_флаг(блок, своя_строка):
        акт = первое_предложение_акта(блок)
    куски = [ПО_ВИДУ[ключ] + (" THE FRAME TO BUILD IS THIS: " + акт
                              if акт else "")]

    # 1а. ГДЕ — но только когда место ВЫБРАНО и его надо построить.
    #
    # Обстановка стояла в промпте после внешности, то есть в середине, и
    # прогон 22.09.2026 показал итог: восемь выбранных мест дали восемь
    # одинаковых студийных кадров, место не появилось ни разу. Когда
    # человек выбрал «Ночной отель», отель — это и есть работа, и он
    # обязан стоять там же, где стоит задание.
    #
    # Когда место НЕ выбрано, обстановка приходит с самого снимка, её
    # описывать нечем и не надо: `i2i_фон` уже велел скопировать задник.
    место_задано = фон == "новый" and getattr(блок, "обстановка", "")

    def поставить_место():
        if место_задано:
            куски.append(блок.обстановка.strip())
            if блок.свет:
                куски.append(блок.свет.strip())

    # МЕСТО ВПЕРЁД — НО НЕ ВПЕРЁД ДЕЙСТВИЯ.
    #
    # Описание места это две тысячи знаков, и 22.09.2026 фирменная
    # студия их отработала: неон, пол, свет — всё вышло точь-в-точь. А
    # акт пропал, и оба остались одеты. Место встало заданием, а то,
    # ради чего нажали кнопку, оказалось примечанием к нему.
    #
    # Поэтому когда у варианта есть своя откровенная строка, первым
    # идёт ОНА, и место встаёт сразу следом. Когда строки нет — место
    # первое, как и было: иначе восемь мест давали восемь одинаковых
    # студийных кадров (замер того же дня).
    # `своя_строка` приходит от каталога и значит РОВНО ОДНО: владелец
    # написал этому варианту свой текст. Считать её по наличию
    # `блок.откровенное` нельзя — туда каталог всегда подклеивает
    # служебную строку про наготу, и тогда «своя строка есть» было бы
    # верно всегда.
    своя_строка = своя_строка_флаг(блок, своя_строка)
    if not своя_строка:
        поставить_место()
    # ПОРЯДОК БЛОКОВ ПЕРЕСОБРАН 22.09.2026 ПО ЖАЛОБЕ ВЛАДЕЛЬЦА:
    # «позы, ракурсы и 18+ не так, как я написал».
    #
    # Он прав, и причина знакомая: его строка и поза стояли ПОСЕРЕДИНЕ
    # промпта, между сохранением внешности и техникой. Модель читает
    # начало и конец, а середину пролистывает — ровно там и лежало то,
    # ради чего человек нажал кнопку.
    #
    # Теперь порядок такой:
    #   1. что за работа (правка снимка),
    #   2. ЧТО ПРОИСХОДИТ — строка владельца,
    #   3. ПОЗА, РАКУРС, ПЛАН — то, чем отличается вариант,
    #   4. кто в кадре: лицо, тело, сложение,
    #   5. техника,
    #   6. повтор требования о сложении.
    #
    # Внешность съехала с второго места на четвёртое сознательно: она
    # держится и латентом, и негативом, а действие с позой — только
    # словами.
    текст_сложения = ""
    if сложение != "":
        текст_сложения = СЛОЖЕНИЕ.get(сложение or СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ,
                                      СЛОЖЕНИЕ[СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ])

    # 1б. КТО В КАДРЕ, одной фразой. Подробности будут ниже; здесь —
    # только чтобы кадр не начался с чужого человека.
    if сем in ("i2i", "inpaint"):
        куски.append(ЯКОРЬ_ПАРЫ if пара else ЯКОРЬ_ЛИЧНОСТИ)
        # СКОЛЬКО ЛЮДЕЙ В КАДРЕ — сразу за тем, КТО они, и до всего
        # остального. Стояло в технике, пятнадцатым блоком из двадцати
        # одного, и не работало: у пары «Сверху» и «Крупный план»
        # набиралась куча из трёх лиц. Негатив до них дошёл и не
        # победил. Это уже третий случай за прогон, когда важное
        # начинало работать от одного переноса вверх.
        куски.append(ДВА_ТЕЛА if пара else ОДНО_ТЕЛО)
        # СЛОЖЕНИЕ У ПАРЫ — ТОЖЕ В НАЧАЛО. Владелец 22.09.2026: «на
        # твоих прогонах у Ники грудь большая». На одиночных она идёт
        # как надо — там кадр опирается на присланный снимок. У пары
        # опоры на снимок нет вовсе (denoise 1.0, людей двое), и одно
        # упоминание в середине не удерживало ничего.
        if пара and текст_сложения:
            куски.append("Each woman in this frame: " + текст_сложения)

    # 2. ЧТО ПРОИСХОДИТ. При жёсткой постановке это уже сказано выше
    # её собственными словами — повторять своими значит спорить с ней.
    if getattr(блок, "откровенное", "").strip():
        куски.append(блок.откровенное.strip())
        куски.append(ДЕЙСТВИЕ_ЗАВЕРШЕНО_ПАРА if пара
                     else ДЕЙСТВИЕ_ЗАВЕРШЕНО)
        if пара:
            куски.append(ПАРА_ОБА_ГОЛЫЕ)
        # И только теперь — где это происходит.
        поставить_место()
        if блок.поза:
            # Строка владельца часто задаёт позу, а поза есть и у
            # сценария. «Стоит раком» против «повёрнута на сорок
            # градусов» — прямое противоречие, и модель разрешает его
            # как придётся. Поэтому старшинство объявлено явно, и
            # только над позой: ракурс, объектив, свет и место остаются
            # за сценарием — за них человек и выбрал эту кнопку.
            куски.append(СТАРШИНСТВО)

    # 3. ЧЕМ ОТЛИЧАЕТСЯ ЭТОТ ВАРИАНТ.
    #
    # ЖЁСТКАЯ ПОСТАНОВКА ВСТАЁТ ВМЕСТО ПОЗЫ И РАКУРСА — и только вместо
    # них. Это ровно та часть, которую бот описывал своими словами и
    # из-за которой выходило «что-то похожее» вместо отобранного кадра
    # (контрольный прогон 23.09.2026: «Мастурбация раком» пришла
    # фронтальной сидя, у «Раздвинуть ножки» осталась юбка).
    #
    # Строку владельца, место, внешность и технику постановка НЕ
    # трогает: строку он правит в админке, и она обязана доезжать до
    # промпта, а остальное держит кадр узнаваемым.
    for поле in ("гардероб", "поза", "камера", "настроение", "ещё"):
        if жёстко and поле in ("поза", "камера"):
            if поле == "поза":
                куски.append(жёстко)
            continue
        значение = getattr(блок, поле)
        if значение:
            куски.append(значение.strip())

    # 4. КТО В КАДРЕ и 4а. ГДЕ.
    куски.append(ТЕЛО_ПАРА if пара else ТЕЛО_ПО_ФОТО)
    if текст_сложения:
        # У пары адресно: иначе описание женской фигуры достаётся
        # обоим, и мужчина уезжает в женскую сторону.
        куски.append(f"Each woman in this frame: {текст_сложения}"
                     if пара else текст_сложения)
    if not место_задано:
        for поле in ("обстановка", "свет"):
            значение = getattr(блок, поле)
            if значение:
                куски.append(значение.strip())

    # 5. ТЕХНИКА и 6. ПОВТОР.
    куски += [КОЖА, АНАТОМИЯ]
    # Про ткань говорим, ТОЛЬКО если одежда в тексте уже названа —
    # гардеробом варианта или строкой человека («снимает платье»).
    # В сцене, где одежды нет вовсе, «ткань мнётся и прижимается к
    # коже» работает как подсказка одеть человека: 22.09.2026 парный
    # вариант «рядом» вышел в бикини и шортах ровно с ней в тексте.
    if одежда_названа(блок):
        куски.append(ТКАНЬ)
    куски += [КОМПОЗИЦИЯ, КАМЕРА_ОБЩЕЕ,
          ЦВЕТ_ПРИ_СВОЁМ_СВЕТЕ if место_задано else ЦВЕТ,
          КАЧЕСТВО]
    if сем == "i2i":
        куски.append(последнее(текст_сложения))
        # Нагота повторяется САМОЙ ПОСЛЕДНЕЙ строкой — по той же
        # причине, по которой повторяется сложение: модель читает
        # начало и конец. У пары без откровенного действия («рядом»,
        # «лицом к лицу») требование стояло только в начале, и оба
        # выходили одетыми со своих референсов.
        if пара:
            куски.append(ПАРА_ГОЛЫЕ_ХВОСТ)
    return "\n\n".join(куски)


def длина_ок(текст):
    return len(текст) >= МИН_ДЛИНА


# ---------------------------------------------------------------------
# СВОЙ ПРОМПТ
#
# Человек пишет сам — и пишет, как правило, одну строку: «на диване»,
# «в машине». Отправить это модели как есть значит отдать ему кадр,
# собранный из ничего: без сохранения лица, без кожи, без анатомии рук,
# без запретов. Он заплатит коин и получит чужую женщину с шестью
# пальцами.
#
# Поэтому своё описание проходит тем же сборщиком, что и каталог: его
# текст встаёт на место сценария, всё остальное добавляется одинаково.
#
# Плюс ОБЯЗАТЕЛЬНАЯ СТРОКА (требование владельца 21.09.2026): бот
# восемнадцать плюс, и результат без раздевания — это не результат, за
# который платили. Строка правится на странице каталога: ключ
# `_обязательное`, поле «для модели».
# ---------------------------------------------------------------------

ОБЯЗАТЕЛЬНОЕ_КЛЮЧ = "_обязательное"

# ДЛЯ ПАРЫ — СВОЯ СТРОКА, ВО МНОЖЕСТВЕННОМ ЧИСЛЕ. Прогон 22.09.2026.
#
# Служебная строка написана про ОДНОГО человека: «the person from the
# reference is fully nude». В парной сцене модель поняла её буквально и
# раздевала ровно одного: у ЖЖ первая выходила голой, вторая — в белье
# со своего снимка. И так на всех вариантах, где это проверялось.
#
# Единственное число рядом с двумя людьми — прямое указание, какое бы
# «оба голые» ни стояло следом.
ОБЯЗАТЕЛЬНОЕ_ПАРА = (
    "BOTH people from the references are fully nude, every one of them, "
    "wearing no clothing at all. This is an explicit adult scene, "
    "exactly as described above."
)

ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ = (
    "The person from the reference is fully nude, wearing no clothing at "
    "all. This is an explicit adult scene, exactly as described above."
)

# ДЕЙСТВИЕ ПОКАЗЫВАЕТСЯ В КОНЦЕ, А НЕ В НАЧАЛЕ.
#
# Строки владельца часто описывают ДВИЖЕНИЕ: «снимает лифчик»,
# «снимает трусики». Модель честно берёт первый кадр этого движения —
# и возвращает одетую женщину. 22.09.2026 на прогоне Ники так вышло
# дважды подряд: «Снимает трусики» отдала героиню в свитере и юбке.
#
# Одной обязательной строки мало: она говорит «голая», а строка
# владельца тут же говорит «снимает». Поэтому сказано прямо, какой
# момент движения нам нужен.
# У ПАРЫ РАЗДЕВАЮТСЯ ОБА.
#
# Обязательная строка владельца написана про одного: «человек на
# референсе голый». Прогон 22.09.2026 показал, чем это кончается в
# парных сценах: женщина голая, а мужчина в серых шортах — ровно в
# тех, в которых он стоит на своём листе.
# НАЗВАННАЯ ОДЕЖДА ПОЯВЛЯЕТСЯ, ДАЖЕ КОГДА ЕЁ ЗАПРЕЩАЮТ. Замер
# 22.09.2026: здесь стояло «не мужские шорты, не женское бикини» — и на
# кадрах выходили ровно розовое бикини и серые шорты. Диффузионная
# модель рисует названное; отрицание перед словом она держит слабо, а
# само слово — крепко. Поэтому в положительном тексте одежда не
# называется ВООБЩЕ, а запрет живёт только в негативе, где ему и место.
ПАРА_ОБА_ГОЛЫЕ = (
    "BOTH people in the frame are completely bare: skin only, from "
    "shoulders to feet, on both of them. Neither keeps anything they "
    "were wearing in their reference photograph."
)

# То же самое в одну строку, для самого конца промпта. Стоит отдельно,
# а не повтором, потому что после «FINAL CHECK» длинный абзац уже не
# читается — нужна короткая последняя команда.
ПАРА_ГОЛЫЕ_ХВОСТ = (
    "AND BOTH OF THEM ARE NAKED: bare skin on both bodies, nothing worn, "
    "nothing covering anything."
)

# КОРОТКИЙ ЯКОРЬ ЛИЧНОСТИ. Одно предложение в самом начале.
#
# Когда подробный блок внешности уехал вниз (чтобы поза и действие
# наконец слушались), «Интим» развалился: вместо Ники в кадре оказались
# чужие люди, в одном даже мужчина. Прогон 22.09.2026 показал это на
# трёх вариантах подряд.
#
# Разгадка простая: модель слушает начало и конец. Внизу лежит ПОЛНОЕ
# описание внешности, и оно работает как проверка; но пока она дойдёт
# до него, кадр уже собран из откровенной строки, а откровенная строка
# не про эту женщину, а про действие вообще.
#
# Поэтому наверх ставится короткий якорь: одна фраза, кто в кадре. Он
# не заменяет подробный блок, он не даёт начать не с того человека.
ЯКОРЬ_ЛИЧНОСТИ = (
    "The person in the result is THE WOMAN FROM THE REFERENCE "
    "PHOTOGRAPH — her face, her hair, her body, nobody else. Never a "
    "different woman, never a man, never a generic model."
)

ЯКОРЬ_ПАРЫ = (
    "The people in the result are THE TWO PEOPLE FROM THE REFERENCE "
    "PHOTOGRAPHS — their faces, their hair, their bodies, nobody else."
)

ДЕЙСТВИЕ_ЗАВЕРШЕНО = (
    "Any garment named in the action above is ALREADY OFF: the action is "
    "shown at its END, the clothing is discarded and out of the way, and "
    "nothing at all is left on her body. If the action is undressing, "
    "the undressing is finished."
)

# То же самое без «её»: в парной сцене «ничего не осталось на ЕЁ теле»
# — это разрешение оставить что-нибудь на втором. Модель им
# пользовалась: у ЖЖ вторая выходила в белье.
ДЕЙСТВИЕ_ЗАВЕРШЕНО_ПАРА = (
    "Any garment named in the action above is ALREADY OFF: the action is "
    "shown at its END, the clothing is discarded and out of the way, and "
    "nothing at all is left on either body. If the action is undressing, "
    "the undressing is finished."
)

ОБЯЗАТЕЛЬНОЕ_РУС = (
    "Человек на референсе обязательно голый, без одежды; сцена "
    "обязательно интимная, как описано в промпте."
)


def свой(текст, вид, обязательное=None, фон="новый", пара=False,
         сложение=None):
    """Описание человека -> полный промпт по тем же правилам, что каталог.

    Описание уходит в тот же слот, что и строка владельца у сценария:
    вторым блоком, сразу за сохранением лица. Обязательная строка идёт
    СРАЗУ ЗА ним, а не в конец — в конце она проигрывает обстановке и
    свету, и модель выдаёт одетый кадр.
    """
    строка = (текст or "").strip()
    обяз = ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ if обязательное is None else обязательное.strip()
    вместе = "\n\n".join(x for x in (строка, обяз) if x)
    return собрать(вид, Блок(откровенное=вместе), фон=фон, пара=пара,
                   сложение=сложение)
