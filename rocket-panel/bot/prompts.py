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

МИН_ДЛИНА = 3000

# Общее для всех кадров. Один экземпляр: разойдётся по сценариям —
# и правка освещения превратится в сорок правок.
# Два варианта первого блока. Разница не косметическая: у режимов без
# входного фото нет лица, которое надо сохранять, и требование «сохрани
# её черты» для них бессмысленно — модель начинает искать референс,
# которого нет.
ТЕЛО_ПО_ФОТО = (
    "The woman from the supplied reference photograph, reproduced one to "
    "one. "
    "FACE preserved exactly: same bone structure, same jaw and cheekbones, "
    "same eye shape, spacing and colour, same nose, same lips, same "
    "eyebrows, same hairline, same individual marks, moles and freckles. "
    "Identity must be unmistakable — someone who knows her recognises her "
    "instantly at a glance. "
    "BODY preserved exactly as it is in the reference: the same build and "
    "the same amount of flesh on it. If she is slim in the reference she "
    "stays slim; if she is full-figured she stays full-figured; if she is "
    "athletic she stays athletic. Same shoulder width, same waist, same "
    "hips, same thighs, same height and the same proportions between them. "
    "Same breast size and shape, same buttocks, same belly — not one size "
    "larger and not one size smaller. Same apparent age. "
    "SKIN preserved exactly: the same tone and undertone across the whole "
    "body, the same tan lines if there are any, the same texture, the same "
    "birthmarks and scars in the same places. "
    "HAIR preserved exactly: same colour, same length, same density, same "
    "texture, same parting, same hairline. "
    "This is a photograph of THAT person, not a model who resembles her. "
    "Do not beautify, do not slim, do not enlarge anything, do not "
    "symmetrise, do not smooth, do not idealise, do not give her a "
    "fashion-model or fitness-influencer body she does not have. Any "
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
    "TWO different people are shown, and two reference photographs are "
    "supplied — one person per reference. Each person is reproduced one to "
    "one from their OWN reference. "
    "FACE preserved exactly for each: same bone structure, same eye shape "
    "and colour, same nose, same lips, same eyebrows, same hairline, same "
    "individual marks and moles. "
    "BODY preserved exactly for each: the same build and the same amount of "
    "flesh on it — slim stays slim, full-figured stays full-figured, "
    "athletic stays athletic. Same height, same shoulders, waist, hips and "
    "thighs, same breast size and shape, same buttocks, same belly, same "
    "apparent age. SKIN the same tone and texture as in that person's own "
    "reference; HAIR the same colour, length and texture. The two of them "
    "keep whatever difference in height and build the references show — do "
    "not even them out. "
    "The person from the FIRST reference and the person from the SECOND "
    "reference must remain two clearly distinct individuals — never blended "
    "into one face, never duplicated so that both figures share the same "
    "face, never reduced to a single person. Both must be recognisable to "
    "someone who knows them. Do not beautify, do not slim, do not enlarge, "
    "do not idealise either of them. Exactly two people in frame: no third "
    "figure, no reflection read as a third person, no stray limb belonging "
    "to nobody."
)

КОЖА = (
    "Skin rendered as real skin: visible pores across the nose and cheeks, "
    "fine vellus hair catching the light along the jaw and forearms, subtle "
    "unevenness in tone, a faint flush where blood runs close to the "
    "surface at the cheeks, collarbone and knuckles. Natural subsurface "
    "scattering so light passes a millimetre into the flesh and returns "
    "warm, especially at the ears, fingers and the bridge of the nose. "
    "Soft natural shine on the forehead and nose, matte elsewhere. No "
    "airbrushing, no plastic smoothing, no wax finish, no uniform poreless "
    "surface, no beauty-filter skin."
)

АНАТОМИЯ = (
    "Anatomy strictly correct. Exactly five fingers on each hand, thumbs "
    "opposed correctly, knuckles and nail beds clearly formed, fingers of "
    "believable length with natural curl. Both hands fully visible or "
    "deliberately and cleanly out of frame — never a hand merging into "
    "fabric or into the body. Limbs of consistent thickness along their "
    "length, joints bending only where joints bend. Shoulders, clavicles, "
    "ribcage and hips in anatomically sound relation. Teeth, when visible, "
    "individually formed and even in number."
)

ТКАНЬ = (
    "Fabric behaves like real fabric under gravity: it has weight, it "
    "creases where the body bends, it stretches across the widest point "
    "and gathers at the narrowest. Weave and knit visible at close range, "
    "edges hemmed or finished, seams following the body. Where the cloth "
    "touches skin it compresses it slightly. No painted-on clothing, no "
    "texture floating above the surface."
)

СТАРШИНСТВО = (
    "The action described immediately above is what is actually "
    "happening, and it defines the position of the body. A pose is "
    "described further down as well: wherever the two disagree, the "
    "action above wins and the pose below is adjusted to fit it or "
    "dropped. Everything else in that description — the camera angle, "
    "the focal length, the framing and distance, the lighting and the "
    "surroundings — still applies in full and is not overridden."
)

КАМЕРА_ОБЩЕЕ = (
    "Shot on a full-frame camera with a fast prime lens. Focus locked on "
    "the eyes with the nearer eye critically sharp; falloff natural and "
    "progressive, never a uniform blur pasted behind the subject. Gentle "
    "optical vignetting at the corners, faint chromatic aberration at high "
    "contrast edges, fine natural grain consistent across the whole frame. "
    "Correct perspective for the stated focal length: no wide-angle "
    "distortion of the face, no flattening of the body."
)

ЦВЕТ = (
    "Colour graded like a magazine editorial: deep but open shadows that "
    "keep detail, highlights that roll off instead of clipping to white, "
    "believable warm-to-cool separation between key light and shadow. "
    "White balance consistent across the frame."
)

КОМПОЗИЦИЯ = (
    "Vertical 9:16 frame, composed for a phone screen held upright. The "
    "subject occupies the frame decisively: no dead space above the head, "
    "no accidental amputation at a joint — crop through the thigh or the "
    "upper arm, never at the wrist, knee or ankle. Eyeline placed near the "
    "upper third. The body reads as a clear silhouette against the "
    "background at a glance, before any detail is examined. Background "
    "elements arranged so that nothing sprouts from behind the head. "
    "Horizon, wall lines and furniture edges level unless the scenario "
    "asks otherwise."
)

КАЧЕСТВО = (
    "A real photograph taken with a real camera of a real person in a real "
    "room. Photorealistic to the point of being indistinguishable from an "
    "ordinary photo: ultra sharp where focus lands, 8K detail, high dynamic "
    "range, professional retouching standard — the level of a paid "
    "editorial shoot, not a snapshot and not a render. Nothing stylised, "
    "nothing illustrated, nothing computer-generated in its look."
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
        "Reference photographs are supplied. Take the person from them and "
        "rebuild the frame completely around her according to this "
        "scenario: the pose, the framing, the distance, the surroundings "
        "and the clothing are all yours to compose from scratch. You are "
        "NOT retouching the original frame and NOT bound by its "
        "composition — only the person must survive it unchanged. Where "
        "several references are supplied, they show the same person from "
        "different angles or show garments to be used; read them together "
        "rather than averaging them into a blur."
    ),
    "i2i_фон": (
        "Reference photographs are supplied. KEEP THE SETTING OF THE "
        "REFERENCE: the same room or place, the same furniture and "
        "objects, the same wall and floor materials, the same time of day, "
        "the same light sources in the same positions and of the same "
        "colour temperature. Read the surroundings out of the reference "
        "and rebuild THAT place — do not invent a different one and do not "
        "fall back to a studio backdrop. "
        "What DOES change is the camera and the clothing: the viewpoint, "
        "the focal length, the distance and the crop are set by this "
        "scenario, so the room is seen from a new angle. Reconstruct what "
        "that new angle would reveal of the same room, consistent with "
        "what the reference shows. The light must arrive from the same "
        "real sources, which means highlights and shadows fall differently "
        "than in the reference while still coming from the same windows "
        "and lamps. "
        "Where several references are supplied, they show the same person "
        "and the same place from different angles; read them together."
    ),
    "i2i_пара": (
        "Two reference photographs are supplied, one person in each. Build "
        "a single new frame containing BOTH of them together, according to "
        "this scenario: the pose of each, how they are arranged relative to "
        "one another, the distance, the framing, the surroundings and the "
        "clothing are all yours to compose from scratch. You are NOT "
        "retouching either original frame and NOT bound by either "
        "composition — only the two people must survive unchanged. "
        "They must occupy the same physical space consistently: one light, "
        "one floor plane, one perspective, contact between them where the "
        "scenario says there is contact, with the skin compressing where it "
        "presses. Scale them honestly against each other — a head is a head "
        "height, an arm reaches as far as an arm reaches. No collage, no "
        "two photographs pasted side by side, no floating second figure."
    ),
    "inpaint": (
        "Change ONLY the region marked in the supplied mask. Everything "
        "outside it stays byte-for-byte as it was: the face, the hair, the "
        "pose, the background, the light direction, the grain. The edited "
        "region must match the surrounding frame in colour temperature, "
        "noise and sharpness so the seam is invisible at full resolution."
    ),
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


def собрать(вид, блок, фон="новый", пара=False):
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
    if фон not in ("новый", "референс"):
        raise ValueError(f"фон бывает «новый» или «референс», а не {фон!r}")

    if сем == "i2i" and пара:
        ключ = "i2i_пара"
    elif сем == "i2i" and фон == "референс":
        ключ = "i2i_фон"
    else:
        ключ = сем
    куски = [ТЕЛО_ПАРА if пара else ТЕЛО_ПО_ФОТО, ПО_ВИДУ[ключ]]
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
        if блок.поза:
            куски.append(СТАРШИНСТВО)
    for поле in ("гардероб", "поза", "обстановка", "свет", "камера",
                 "настроение", "ещё"):
        значение = getattr(блок, поле)
        if значение:
            куски.append(значение.strip())
    куски += [КОЖА, АНАТОМИЯ, ТКАНЬ, КОМПОЗИЦИЯ, КАМЕРА_ОБЩЕЕ, ЦВЕТ, КАЧЕСТВО]
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

ОБЯЗАТЕЛЬНОЕ_РУС = (
    "Человек на референсе обязательно голый, без одежды; сцена "
    "обязательно интимная, как описано в промпте."
)


def свой(текст, вид, обязательное=None, фон="новый", пара=False):
    """Описание человека -> полный промпт по тем же правилам, что каталог.

    Описание уходит в тот же слот, что и строка владельца у сценария:
    вторым блоком, сразу за сохранением лица. Обязательная строка идёт
    СРАЗУ ЗА ним, а не в конец — в конце она проигрывает обстановке и
    свету, и модель выдаёт одетый кадр.
    """
    строка = (текст or "").strip()
    обяз = ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ if обязательное is None else обязательное.strip()
    вместе = "\n\n".join(x for x in (строка, обяз) if x)
    return собрать(вид, Блок(откровенное=вместе), фон=фон, пара=пара)
