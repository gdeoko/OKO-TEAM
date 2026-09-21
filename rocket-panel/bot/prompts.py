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
        "Petite and slim, with SMALL NATURAL BREASTS — a small A cup, "
        "high and barely there on a slender chest, never a handful — a "
        "narrow ribcage, a flat stomach and narrow hips."
    ),
    "средняя": (
        "An average, natural build with medium natural breasts — neither "
        "slimmed down nor enlarged."
    ),
    "пышная": (
        "A full, soft, curvy build with large natural breasts, wide hips "
        "and a soft belly."
    ),
}
СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ = "стройная"


ТЕЛО_ПО_ФОТО = (
    "The woman from the supplied reference photograph, reproduced one to on"
    "e. FACE preserved exactly: same bone structure, same jaw and cheekbone"
    "s, same eye shape, spacing and colour, same nose, same lips, same eyeb"
    "rows, same hairline, same individual marks, moles and freckles. Identi"
    "ty must be unmistakable — someone who knows her recognises her instant"
    "ly at a glance. BODY preserved exactly as it is in the reference: the "
    "same build and the same amount of flesh on it. If she is slim in the r"
    "eference she stays slim; if she is full-figured she stays full-figured"
    "; if she is athletic she stays athletic. Same shoulder width, same wai"
    "st, same hips, same thighs, same height and the same proportions betwe"
    "en them. Same breast size and shape, same buttocks, same belly — not o"
    "ne size larger and not one size smaller. Same apparent age. SKIN prese"
    "rved exactly: the same tone and undertone across the whole body, the s"
    "ame tan lines if there are any, the same texture, the same birthmarks "
    "and scars in the same places. HAIR preserved exactly: same colour, sam"
    "e length, same density, same texture, same parting, same hairline. WHA"
    "T IS UNDER THE CLOTHES IS NOT YOURS TO INVENT. The reference usually s"
    "hows her dressed, and the undressed body must be READ OUT of that phot"
    "ograph, not supplied from elsewhere: the breasts are the size the clot"
    "hed silhouette says they are, and small breasts stay small — a flat or"
    " barely-there chest is reproduced flat, not filled in. Same for the wa"
    "ist, the belly and the hips: the clothing shows where the body is narr"
    "ow and where it is soft, and that is the body. Adding a chest she does"
    " not have is the single most common way to ruin this picture, and it r"
    "uins it completely. AGE: she stays the age she is in the reference — a"
    "n adult, and as young an adult as the photograph shows. Youthful skin "
    "stays youthful; do not age her up, do not give her a mature woman's he"
    "avier body, softened jaw, deeper folds or older breasts. This is a pho"
    "tograph of THAT person, not a model who resembles her. Do not beautify"
    ", do not slim, do not enlarge anything, do not symmetrise, do not smoo"
    "th, do not idealise, do not give her a fashion-model or fitness-influe"
    "ncer body she does not have. Any departure from the reference is a def"
    "ect, even a flattering one."
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

КОЖА = (
    "Real skin: visible pores, fine hair, uneven tone, natural blemishes. "
    "No plastic smoothing, no airbrushing."
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

КОМПОЗИЦИЯ = (
    "Whole subject inside the frame, nothing important cropped away."
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
    # БЮСТ И ВОЗРАСТ стоят первыми в этом списке не по алфавиту. Это
    # две единственные поломки, которые владелец назвал сам, глядя на
    # результат: «в референсе маленькая грудь, а на выходе огромные
    # сиськи и тело сорокалетней».
    "large breasts, big breasts, huge breasts, enlarged bust, busty, "
    "voluptuous, curvy, breast implants, boob job, heavy chest, "
    "cleavage added, push-up effect, "
    "mature woman, middle-aged, milf, older woman, aged skin, "
    "sagging skin, deep nasolabial folds, jowls, thickened waist, "
    "different body type, slimmer than reference, thinner waist, "
    "slimmed down, weight loss, fatter than reference, enlarged breasts, "
    "bigger breasts, smaller breasts, enlarged buttocks, wider hips, "
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
    "out of focus, lowres, duplicate, cropped head, floating limbs, mutated"
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
    "i2i_фон": (
        "EDIT THIS PHOTOGRAPH. The clothes come off and the pose follows "
        "the scenario; everything else stays exactly as it is in the "
        "photo — the same room, the same objects, the same light, the "
        "same time of day. This is an edit of that frame, not a new "
        "picture inspired by it. "
        "THE BACKDROP IS COPIED, NOT CHOSEN: whatever is behind her in "
        "the photograph is behind her in the result, in the same colour "
        "and the same material. A plain studio backdrop stays a plain "
        "studio backdrop of the same grey. Do NOT move her to a bedroom, "
        "a bed, a hotel room, a pool, a beach or a sofa — no furniture "
        "appears that was not in the photograph."
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
                 "настроение", "ещё", "откровенное")

    def __init__(self, гардероб="", поза="", обстановка="", свет="",
                 камера="", настроение="", ещё="", откровенное=""):
        self.откровенное = откровенное
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
    "Her own waist, her own hips, her own young face. She is not a porn "
    "model and this is not a glamour shoot; anything added to flatter "
    "her is a defect."
)

# То же самое без «её»: у сцены из двух мужчин женского тела в кадре
# нет, и «her own hips» там читается как указание одного из них
# переделать.
ПОСЛЕДНЕЕ_БЕЗ_ПОЛА = (
    "FINAL CHECK, outranking every word above: these are the bodies and "
    "the faces from the references, unchanged. Nothing is idealised, "
    "nothing is added to flatter them."
)


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


def собрать(вид, блок, фон="новый", пара=False, сложение=None):
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
        куски = [ПО_ВИДУ[сем]]
        if getattr(блок, "откровенное", ""):
            куски.append(блок.откровенное.strip())
        if блок.ещё:
            куски.append(блок.ещё.strip())
        куски.append(ВИДЕО_ДЕРЖАТЬ)
        return "\n\n".join(куски)
    if фон not in ("новый", "референс"):
        raise ValueError(f"фон бывает «новый» или «референс», а не {фон!r}")

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
    если_правка = (ключ == "i2i_фон")
    тело = ТЕЛО_ПАРА if пара else ТЕЛО_ПО_ФОТО
    куски = [ПО_ВИДУ[ключ], тело] if если_правка else [тело, ПО_ВИДУ[ключ]]
    # Сложение идёт СРАЗУ за сохранением человека и до всего остального:
    # это те самые буквальные слова, ради которых заведён `СЛОЖЕНИЕ`, и
    # в хвосте промпта они снова превратятся в пожелание.
    #
    # Пустая строка — НЕ «умолчание», а «не говорить вовсе»: у сцены из
    # двух мужчин слова про грудь и узкие бёдра сделали бы из одного из
    # них женщину.
    текст_сложения = ""
    if сложение != "":
        текст_сложения = СЛОЖЕНИЕ.get(сложение or СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ,
                                      СЛОЖЕНИЕ[СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ])
        # У пары то же самое, но адресно: иначе описание женской фигуры
        # достаётся обоим, и мужчина уезжает в женскую сторону.
        куски.append(f"Each woman in this frame: {текст_сложения}"
                     if пара else текст_сложения)
    # Строка владельца часто задаёт ПОЗУ, а поза есть и у сценария.
    # «Стоит раком» против «повёрнута на сорок градусов, вес на дальней
    # ноге» — прямое противоречие, и модель разрешает его как придётся:
    # то одно, то другое, на одном и том же промпте. Поэтому у строки
    # владельца объявлено старшинство, явно и один раз.
    #
    # Старшинство только над ПОЗОЙ. Ракурс, объектив, свет и обстановка
    # остаются за сценарием: они и есть то, за что человек выбрал именно
    # эту кнопку, и отдавать их одной строке нельзя.
    # Откровенная часть идёт ВТОРЫМ блоком, сразу за сохранением лица.
    # Модели внимательнее к началу промпта: уехав в конец, она начинает
    # проигрывать обстановке и свету — то есть ровно тому, ради чего
    # сценарий и заводили, не случается.
    if getattr(блок, "откровенное", ""):
        куски.append(блок.откровенное.strip())
        # Сразу за действием — в каком его моменте снимаем.
        куски.append(ДЕЙСТВИЕ_ЗАВЕРШЕНО)
        if блок.поза:
            куски.append(СТАРШИНСТВО)
    for поле in ("гардероб", "поза", "обстановка", "свет", "камера",
                 "настроение", "ещё"):
        значение = getattr(блок, поле)
        if значение:
            куски.append(значение.strip())
    куски += [КОЖА, АНАТОМИЯ, ТКАНЬ, КОМПОЗИЦИЯ, КАМЕРА_ОБЩЕЕ, ЦВЕТ, КАЧЕСТВО]
    if сем == "i2i":
        куски.append(последнее(текст_сложения))
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
ДЕЙСТВИЕ_ЗАВЕРШЕНО = (
    "Any garment named in the action above is ALREADY OFF: the action is "
    "shown at its END, the clothing is discarded and out of the way, and "
    "nothing at all is left on her body. If the action is undressing, "
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
