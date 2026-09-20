"""Каталог сценариев. Второй по важности файл после цен.

## Почему каталог, а не окно ввода

Разбор конкурента 20.09.2026 показал главное: его продукт — не поле для
промпта, а КАТАЛОГ из 232 готовых сценариев по категориям. Человек
ничего не пишет, он тыкает кнопку. Свободный промпт у него заперт за
подпиской и продаётся как апгрейд.

Мы строили промпт-первый интерфейс, и это была ошибка: описывать сцену
словами умеет меньшинство, а платят все.

## Устройство

Категория → сценарий. Никаких разделов сверху: решение владельца
21.09.2026 — «4-5 категорий, внутри 5-10 вариантов, не более». Два
уровня вместо трёх, потому что третий заставляет человека угадывать,
в каком разделе искать «переодеть в бельё».

Сценарий не хранит текст промпта. Он объявляет, чем отличается
(гардероб, поза, свет, обстановка), а полный промпт от трёх тысяч
знаков собирает `prompts.собрать` — см. там, почему так.

## Чем отличаемся от конкурента, и всё нарочно

  1. ЦЕНА ВИДНА ВЕЗДЕ. У него цена всплывает единственный раз — после
     того, как человек выбрал сценарий и загрузил фото. Мы пишем цену
     на каждой кнопке, до выбора. Стоит это ноль, а доверия прибавляет.
  2. СВОЙ ПРОМПТ ДОСТУПЕН ВСЕМ. У него это платная функция под замком.
     Подписки у нас нет вовсе, запирать нечем и незачем.
  3. ЛИЦО ДЕРЖИТСЯ. У него лицо героини плывёт от кадра к кадру —
     проверено на его же боте. Это наш главный козырь, и он вшит в
     каждый промпт блоком ТЕЛО.
"""

import pricing
import prompts

Блок = prompts.Блок


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели."""

    def __init__(self, key, title, job, блок, подпись=""):
        self.key = key
        self.title = title
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        self.блок = блок
        self.подпись = подпись        # строка под картинкой в боте
        self.prompt = prompts.собрать(job, блок)
        self.negative = prompts.НЕГАТИВ

    @property
    def hearts(self):
        return pricing.job(self.job).hearts

    @property
    def фото_нужно(self):
        """Сколько снимков просить. Берётся из прайса, а не хранится
        рядом: свойство модели, и двух источников правды тут быть не
        должно."""
        return pricing.job(self.job).фото_нужно

    def button(self):
        """Подпись кнопки. Цена в ней обязательна — это наше отличие."""
        return f"{self.title} · {self.hearts} ♥"


class Category:
    def __init__(self, key, title, подзаголовок, scenes, иконка=""):
        self.key = key
        self.title = title
        self.подзаголовок = подзаголовок
        self.scenes = scenes
        self.иконка = иконка          # премиум-эмодзи, см. emoji.py

    def button(self):
        return f"{self.title} · {len(self.scenes)}"


def _сц(key, title, job, подпись, **поля):
    return Scene(key, title, job, Блок(**поля), подпись)


def _СЦ_БЕЛЬЁ(key, title, job, подпись, **поля):
    """Бельё — фото по фото, а не правка по маске: маску человек должен
    обвести руками, а тут менять нужно всю одежду. Референсов до трёх:
    можно приложить фото героини и фото нужного белья."""
    return Scene(key, title, "i2i", Блок(**поля), подпись)


def _СЦ_ФОТО(key, title, job, подпись, **поля):
    """Обстановка меняется целиком, поэтому фото-по-фото, а не правка
    области: у Qwen-Image-Edit референс идёт в условие, и каркас кадра
    строится заново — позу и план можно поменять полностью."""
    return Scene(key, title, "i2i", Блок(**поля), подпись)


def _СЦ_ОЖИВИТЬ(key, title, job, подпись, **поля):
    return Scene(key, title, "i2v_5", Блок(**поля), подпись)


def _СЦ_ЗВУК(key, title, job, подпись, **поля):
    return Scene(key, title, "sound", Блок(**поля), подпись)


# ---------------------------------------------------------------------
# КАТЕГОРИИ
#
# Пять штук. Внутри 5-8 сценариев: больше десяти в одном списке человек
# уже не читает, а листает.
# ---------------------------------------------------------------------

CATEGORIES = [

    # -----------------------------------------------------------------
    Category(
        "lingerie", "Бельё", "Переодеть в то, чего на фото не было",
        иконка="КОРСЕТ",
        scenes=[
            _СЦ_БЕЛЬЁ("lg_satin", "Атласная сорочка", "inpaint",
                "Шёлк по фигуре, свет ловится по краю",
                гардероб="Replace her clothing with a deep magenta satin slip "
                         "nightdress, bias-cut so it falls on the diagonal and "
                         "traces the body without gripping it. Thin spaghetti "
                         "straps, a straight neckline, a hem that ends "
                         "mid-thigh. The satin is heavy and cool, catching a "
                         "long specular highlight down every fold.",
                свет="A single soft key from the side, low and warm, so the "
                     "satin shows one bright ridge per fold and the rest falls "
                     "into shadow."),

            _СЦ_БЕЛЬЁ("lg_lace", "Кружево", "inpaint",
                "Чёрное кружево, кожа читается сквозь рисунок",
                гардероб="Replace her clothing with a black lace bralette and "
                         "matching high-waisted briefs. The lace is fine "
                         "Chantilly with a floral motif, scalloped along every "
                         "edge, semi-sheer so the skin tone shows through the "
                         "open ground of the pattern while the denser motifs "
                         "stay opaque. Delicate elastic at the band, a small "
                         "satin bow at the centre front.",
                свет="Soft frontal light with a second dim light behind, so the "
                     "lace reads as an openwork pattern rather than a flat "
                     "black shape."),

            _СЦ_БЕЛЬЁ("lg_silk_robe", "Шёлковый халат", "inpaint",
                "Наброшен, не запахнут, пояс свободно",
                гардероб="Replace her clothing with a long silk kimono robe in "
                         "deep wine, worn open over matching underwear, the "
                         "sash loose and hanging rather than tied. Wide sleeves "
                         "falling past the wrist, a heavy hem that swings. The "
                         "silk is slightly crushed, showing the soft broken "
                         "sheen of a fabric that has been worn.",
                поза="One shoulder slipped free of the robe, the fabric caught "
                     "at the upper arm."),

            _СЦ_БЕЛЬЁ("lg_sport", "Спортивный комплект", "inpaint",
                "Топ и легинсы, матовая ткань",
                гардероб="Replace her clothing with a fitted matte-black "
                         "sports bra and high-waisted seamless leggings. The "
                         "fabric is technical knit with a soft dry hand, no "
                         "shine, flat-locked seams following the body, a wide "
                         "supportive underband. Subtle compression where the "
                         "band meets skin.",
                свет="Clean even light from the front, the kind used for "
                     "activewear catalogue photography."),

            _СЦ_БЕЛЬЁ("lg_white", "Белый комплект", "inpaint",
                "Простое хлопковое, утренний свет",
                гардероб="Replace her clothing with a simple white cotton "
                         "bralette and briefs, unlined, with a narrow ribbed "
                         "band and no ornament at all. The cotton is soft, "
                         "slightly worn, faintly translucent where it stretches.",
                свет="Cool diffuse morning light from a window, soft shadows, "
                     "everything low in contrast and quiet."),

            _СЦ_БЕЛЬЁ("lg_stockings", "Чулки", "inpaint",
                "Тонкие чулки с кружевной резинкой",
                гардероб="Add sheer black hold-up stockings with a wide "
                         "scalloped lace band at the upper thigh and a fine "
                         "seam running up the back of the leg. The denier is "
                         "low, so the skin tone reads clearly through the "
                         "nylon, darkening slightly at the band and toe.",
                камера="Framed to include the full length of the legs."),
        ],
    ),

    # -----------------------------------------------------------------
    Category(
        "scene", "Обстановка", "Перенести героиню в другое место",
        иконка="КАБЛУК",
        scenes=[
            _СЦ_ФОТО("sc_bed", "Шёлковая постель", "photo",
                "Утро, смятый шёлк, свет из-за штор",
                обстановка="A wide bed dressed in ivory silk, the sheets "
                           "deeply creased from a night of sleep, one pillow "
                           "pushed aside. A bedroom in soft focus behind: a "
                           "low headboard, a lamp switched off, sheer curtains "
                           "moving slightly.",
                поза="Lying on her side across the sheets, propped on one "
                     "forearm, the other hand resting near her face.",
                свет="Morning sun through sheer curtains, diffuse and warm, "
                     "throwing long soft shadows across the bedding."),

            _СЦ_ФОТО("sc_studio", "Чёрная студия", "photo",
                "Один источник, всё остальное в темноте",
                обстановка="A professional photo studio against seamless "
                           "black paper, nothing else in frame.",
                свет="A single large softbox at forty-five degrees camera "
                     "left, feathered so the far side of the body falls into "
                     "deep shadow. A thin rim light from behind separates the "
                     "shoulder and hair from the black.",
                настроение="Severe, controlled, expensive — the register of a "
                           "fashion test shot."),

            _СЦ_ФОТО("sc_bath", "Ванная", "photo",
                "Пар, запотевшее стекло, мокрая кожа",
                обстановка="A dim tiled bathroom, steam hanging in the air, "
                           "a large mirror fogged at the edges, warm water "
                           "still running. Small droplets condensing on every "
                           "cold surface.",
                свет="One warm bulb above and to the side, its light scattered "
                     "by the steam into a soft glow.",
                ещё="Her skin is damp: water beading on the shoulders and "
                    "collarbone, hair heavy and wet at the ends."),

            _СЦ_ФОТО("sc_hotel", "Ночной отель", "photo",
                "Город в окне, лампа у кровати",
                обстановка="A high-floor hotel room at night. A floor-to-"
                           "ceiling window fills one side of the frame with a "
                           "city skyline far below, out of focus into points "
                           "of amber and white. A single bedside lamp is lit.",
                свет="Warm lamplight from inside, cool city light from the "
                     "window, meeting on her face — warm on one cheek, cool on "
                     "the other."),

            _СЦ_ФОТО("sc_pool", "У бассейна", "photo",
                "Вода, отражения, полуденное солнце",
                обстановка="The edge of a swimming pool at midday, turquoise "
                           "water throwing rippling caustic reflections onto "
                           "everything above it. Pale stone, a folded towel, "
                           "nothing else.",
                свет="Hard overhead sun softened by a passing cloud, plus the "
                     "moving reflected light from the water playing across the "
                     "underside of her chin and arms."),

            _СЦ_ФОТО("sc_neon", "Неоновый переулок", "photo",
                "Мокрый асфальт, розовые вывески",
                обстановка="A narrow city alley at night after rain. Wet "
                           "asphalt mirrors a row of neon signs in magenta and "
                           "cold blue. Steam rising from a grate, brick walls "
                           "close on both sides.",
                свет="Hard coloured neon from two directions, magenta from the "
                     "left and cold blue from behind, with deep unlit shadow "
                     "between them.",
                настроение="Cinematic, charged, slightly dangerous."),

            _СЦ_ФОТО("sc_nature", "Поле на закате", "photo",
                "Высокая трава, контровой свет",
                обстановка="An open field of tall dry grass at golden hour, "
                           "the horizon low and distant, a line of trees far "
                           "behind in haze.",
                свет="The sun low and directly behind her, rimming the hair "
                     "and shoulders in gold, the front of the body lit softly "
                     "by bounce from the ground. Visible lens flare and warm "
                     "atmospheric haze."),

            _СЦ_ФОТО("sc_car", "Заднее сиденье", "photo",
                "Салон ночью, свет фонарей по лицу",
                обстановка="The back seat of a car at night, dark leather, "
                           "the city sliding past outside the window.",
                свет="Streetlights passing overhead sweep bands of warm light "
                     "across her face and the seat, leaving everything else "
                     "nearly black.",
                камера="Shot close, from the seat beside her, at eye level."),
        ],
    ),

    # -----------------------------------------------------------------
    Category(
        "animate", "Оживить", "Фото начинает двигаться",
        иконка="БЛЁСТКИ",
        scenes=[
            _СЦ_ОЖИВИТЬ("an_breath", "Дыхание", "animate",
                "Самое спокойное — грудь, ресницы, прядь",
                поза="She holds the pose of the photograph. Only the chest "
                     "rises and falls with slow breathing, the eyelids close "
                     "once in a natural blink, and a single strand of hair "
                     "settles across the cheek.",
                настроение="Calm, unhurried, almost still."),

            _СЦ_ОЖИВИТЬ("an_look", "Взгляд в камеру", "animate",
                "Отводит глаза и возвращает взгляд",
                поза="Her eyes drift away from the lens, linger for a moment, "
                     "then come back and settle directly on the camera. The "
                     "head turns only a few degrees with them.",
                настроение="Direct, unhurried, holding the viewer."),

            _СЦ_ОЖИВИТЬ("an_smile", "Улыбка", "animate",
                "Улыбка рождается медленно и доходит до глаз",
                поза="A smile builds slowly from the corners of the mouth, "
                     "reaching the eyes last so the cheeks lift and the outer "
                     "corners crease. It arrives and stays; it does not flash "
                     "on and off."),

            _СЦ_ОЖИВИТЬ("an_hair", "Поправляет волосы", "animate",
                "Заправляет прядь за ухо",
                поза="She lifts one hand, catches a loose strand of hair and "
                     "tucks it behind her ear, then lowers the hand back. The "
                     "hand must remain anatomically correct throughout the "
                     "movement, fingers never merging with the hair or face."),

            _СЦ_ОЖИВИТЬ("an_turn", "Поворот к камере", "animate",
                "Поворачивается через плечо",
                поза="She begins turned three-quarters away and rotates "
                     "smoothly toward the lens, the shoulders leading and the "
                     "head following, ending looking directly at camera. The "
                     "face must remain the same face through every degree of "
                     "the turn."),

            _СЦ_ОЖИВИТЬ("an_wind", "Ветер", "animate",
                "Волосы и ткань живут от ветра",
                поза="She stays still. A steady breeze lifts and moves her "
                     "hair in continuous strands and stirs the fabric she is "
                     "wearing, which ripples and settles with real weight.",
                ещё="Motion in the hair is strand-level and continuous, never "
                    "a single rigid mass moving as one piece."),

            _СЦ_ОЖИВИТЬ("an_push", "Наезд камеры", "animate",
                "Камера медленно приближается",
                камера="A slow, steady push-in toward her face over the whole "
                       "clip, as if on a dolly — constant speed, no easing at "
                       "the end, no handheld shake. The subject herself moves "
                       "only with breathing and one blink."),
        ],
    ),

    # -----------------------------------------------------------------
    Category(
        "voice", "Со звуком", "Фото заговорит вашим текстом",
        иконка="ЭФИР",
        scenes=[
            _СЦ_ЗВУК("vo_hello", "Приветствие", "sound",
                "Смотрит в камеру и здоровается",
                поза="She looks directly into the lens and speaks the supplied "
                     "line as a greeting, warm and unhurried, with small "
                     "natural head movements on the stressed syllables.",
                настроение="Welcoming, close, as if speaking to one person."),

            _СЦ_ЗВУК("vo_whisper", "Шёпотом", "sound",
                "Близко к камере, вполголоса",
                поза="She leans slightly toward the lens and speaks the "
                     "supplied line quietly, almost under her breath. Lip "
                     "movement is small and precise; the jaw barely opens.",
                камера="Very close framing, the face filling most of the "
                       "vertical frame.",
                настроение="Intimate, confidential, quiet."),

            _СЦ_ЗВУК("vo_invite", "Приглашение", "sound",
                "Зовёт за собой, жест рукой",
                поза="She speaks the supplied line and, on its final words, "
                     "lifts one hand in a small beckoning gesture. The hand "
                     "stays anatomically correct throughout."),

            _СЦ_ЗВУК("vo_laugh", "С улыбкой", "sound",
                "Говорит, улыбаясь, с короткой паузой на смешок",
                поза="She speaks the supplied line with a smile running under "
                     "it, breaking once into a short soft laugh before "
                     "finishing. The laugh moves the shoulders slightly."),

            _СЦ_ЗВУК("vo_story", "Рассказ", "sound",
                "Длиннее, спокойнее, с паузами",
                поза="She delivers the supplied line as a short story: even "
                     "pace, real pauses between sentences where she looks "
                     "briefly away and back, eyebrows moving with the sense of "
                     "the words.",
                настроение="Relaxed, conversational, unperformed."),
        ],
    ),

    # -----------------------------------------------------------------
    # ВАША КАТЕГОРИЯ. Механизм готов, тексты за владельцем.
    #
    # Формулировки откровенных сценариев пишет владелец — я собрала под
    # них всё остальное: категория появится в меню сама, цена встанет на
    # кнопку, промпт соберётся до нужной длины, оплата и возврат уже
    # работают. Добавить сценарий — три строки по образцу выше:
    #
    #     _сц("ключ", "Название", "inpaint", "подпись под картинкой",
    #         гардероб="...", поза="...", свет="..."),
    #
    # Поля любые из prompts.Блок: гардероб, поза, обстановка, свет,
    # камера, настроение, ещё. Текст — по-английски. Пустая категория в
    # меню не показывается, так что до наполнения её никто не увидит.
    Category(
        "own", "Своё", "Сценарии владельца",
        иконка="ОГОНЬ",
        scenes=[],
    ),
]

# Категория без сценариев в меню не показывается.
ВИДИМЫЕ = [c for c in CATEGORIES if c.scenes]

_ПО_КЛЮЧУ = {s.key: s for c in CATEGORIES for s in c.scenes}
_КАТЕГОРИИ = {c.key: c for c in CATEGORIES}


def scene(key):
    if key not in _ПО_КЛЮЧУ:
        raise KeyError(f"неизвестный сценарий: {key}")
    return _ПО_КЛЮЧУ[key]


def category(key):
    if key not in _КАТЕГОРИИ:
        raise KeyError(f"неизвестная категория: {key}")
    return _КАТЕГОРИИ[key]


def все_сценарии():
    return list(_ПО_КЛЮЧУ.values())
