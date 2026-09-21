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

import os

import pricing
import prompts

Блок = prompts.Блок


# ---------------------------------------------------------------------
# СТРОКИ ВЛАДЕЛЬЦА
#
# Каждый сценарий состоит из двух частей, и они нарочно разделены:
#
#   * ОБЩЕЕ И ТЕХНИЧЕСКОЕ пишется здесь и собирается автоматически —
#     сохранение лица, кожа, анатомия рук, поведение ткани, свет,
#     объектив, композиция, цвет, запреты. Это то, что отличает рабочий
#     кадр от брака, и оно одинаково для всех сценариев.
#
#   * ЧТО ИМЕННО ПРОИСХОДИТ В КАДРЕ пишет владелец. Одна строка на
#     сценарий в файле `ОТКРОВЕННОЕ.txt` рядом с этим кодом.
#
# Почему отдельным файлом, а не в коде: правка не требует трогать
# программу, ошибка в строке не роняет бота, и видно сразу всё вместе —
# какой сценарий чем наполнен, а какой ещё пуст.
# ---------------------------------------------------------------------

ФАЙЛ_ОТКРОВЕННОГО = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "ОТКРОВЕННОЕ.txt")


def _строки_владельца(путь=None):
    """Читает `ключ = текст` из файла. Пустой файл и отсутствие файла —
    не ошибка: сценарии соберутся без откровенной части."""
    out = {}
    try:
        with open(путь or ФАЙЛ_ОТКРОВЕННОГО, encoding="utf-8") as f:
            for строка in f:
                строка = строка.strip()
                if not строка or строка.startswith("#") or "=" not in строка:
                    continue
                ключ, _, текст = строка.partition("=")
                текст = текст.strip()
                if текст:
                    out[ключ.strip()] = текст
    except OSError:
        pass
    return out


ОТКРОВЕННОЕ = _строки_владельца()


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели."""

    def __init__(self, key, title, job, блок, подпись=""):
        self.key = key
        self.title = title
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        # Строка владельца подставляется по ключу сценария. Задана в
        # блоке напрямую — она сильнее: так можно проверить сборку, не
        # трогая файл.
        if not блок.откровенное:
            блок.откровенное = ОТКРОВЕННОЕ.get(key, "")
        self.блок = блок
        self.подпись = подпись        # строка под картинкой в боте
        self.prompt = prompts.собрать(job, блок)
        self.negative = prompts.НЕГАТИВ

    @property
    def наполнен(self):
        """Владелец дописал, что происходит в кадре."""
        return bool(self.блок.откровенное)

    @property
    def coins(self):
        return pricing.job(self.job).coins

    @property
    def фото_нужно(self):
        """Сколько снимков просить. Берётся из прайса, а не хранится
        рядом: свойство модели, и двух источников правды тут быть не
        должно."""
        return pricing.job(self.job).фото_нужно

    def button(self):
        """Подпись кнопки. Цена в ней обязательна — это наше отличие."""
        return f"{self.title} · {self.coins} {pricing.СИМВОЛ}"


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


def _СЦ_РАЗДЕТЬ(key, title, подпись, **поля):
    """Фото по фото, а не правка по маске: маску человек должен обвести
    руками, а здесь меняется состояние целиком. Референсов до трёх."""
    return Scene(key, title, "i2i", Блок(**поля), подпись)


def _СЦ_ФОТО(key, title, подпись, **поля):
    """Обстановка меняется целиком, поэтому фото-по-фото, а не правка
    области: у Qwen-Image-Edit референс идёт в условие, и каркас кадра
    строится заново — позу и план можно поменять полностью."""
    return Scene(key, title, "i2i", Блок(**поля), подпись)


def _СЦ_ОЖИВИТЬ(key, title, подпись, **поля):
    return Scene(key, title, "i2v_5", Блок(**поля), подпись)


def _СЦ_ЗВУК(key, title, подпись, **поля):
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
        "undress", "Раздеть", "Снять с героини то, что на ней надето",
        иконка="СТРИНГИ",
        scenes=[
            # У каждого сценария этой категории свой ПЛАН и свой СВЕТ —
            # то есть то, чем кадр отличается технически. Что именно
            # происходит в кадре, дописывает владелец в ОТКРОВЕННОЕ.txt
            # по ключу сценария. Пустая строка там — не поломка:
            # сценарий соберётся и покажет героиню в заданном плане.
            _СЦ_РАЗДЕТЬ("un_close", "Крупный план",
                "От груди и выше, мягкий боковой свет",
                поза="Head and shoulders turned a few degrees off the lens so "
                     "the neck reads long, chin level, weight settled on one "
                     "side. Shoulders relaxed and down, not braced.",
                свет="One large soft key from camera left at forty-five "
                     "degrees and slightly above the eyeline, a weak fill from "
                     "the right at a quarter of its strength. A narrow rim "
                     "from behind separates the shoulder and the jaw from the "
                     "background.",
                камера="85mm at f/1.8, chest-up, lens at eye level. Shallow "
                       "depth so the background falls away completely.",
                обстановка="Plain deep-grey backdrop two metres behind her, "
                           "unlit and featureless."),

            _СЦ_РАЗДЕТЬ("un_full", "В полный рост",
                "Вся фигура, жёсткий свет, чёткая тень",
                поза="Standing, weight on the back leg so the hips tilt, the "
                     "front knee soft and turned slightly inward. Spine long, "
                     "one shoulder dropped.",
                свет="A single hard source high and to the right, no fill at "
                     "all, so the shadow edge is crisp and the body reads as "
                     "form rather than as a flat shape. The cast shadow falls "
                     "long across the floor into frame.",
                камера="35mm at f/4, full length with a hand of space above "
                       "the head and the floor line visible. Camera at hip "
                       "height so the proportions stay honest.",
                обстановка="Bare concrete floor and a seamless pale wall."),

            _СЦ_РАЗДЕТЬ("un_bed", "Лёжа",
                "Смятая постель, свет из окна сбоку",
                поза="Lying on her side across rumpled sheets, the lower arm "
                     "folded under the head, the upper knee drawn forward. "
                     "The body describes a long S-curve from shoulder to ankle.",
                свет="Cool daylight through a window just out of frame at "
                     "camera left, raking along the body so every fold of the "
                     "sheet casts its own small shadow. Warm bounce from the "
                     "wooden floor fills the underside faintly.",
                камера="50mm at f/2, shot from just above her eye level "
                       "looking slightly down the length of the body.",
                обстановка="A bed with white linen sheets pulled loose, "
                           "pillows pushed aside, a dim room beyond."),

            _СЦ_РАЗДЕТЬ("un_mirror", "У зеркала",
                "Отражение и спина в одном кадре",
                поза="Standing close to a tall mirror, front toward the glass, "
                     "back toward the lens. The face is visible only in the "
                     "reflection and must be the same face there — reflections "
                     "are where identity usually breaks.",
                свет="A warm bulb above the mirror lighting the reflected "
                     "front, and a cooler window light behind the camera "
                     "grazing her back. Two colour temperatures, kept apart.",
                камера="50mm at f/2.8, positioned off-axis so the lens itself "
                       "does not appear in the glass.",
                обстановка="A tall frameless mirror against a bedroom wall, "
                           "the room behind softly out of focus.",
                ещё="The mirror shows a true reflection: the same body, the "
                    "same pose, reversed correctly, with the same lighting "
                    "arriving from the same direction. No second person."),

            _СЦ_РАЗДЕТЬ("un_back", "Со спины",
                "Спина и линия плеч, взгляд через плечо",
                поза="Back to the lens, head turned far enough over the "
                     "shoulder that one eye and the line of the cheek are "
                     "visible. Shoulder blades drawn together, spine defined, "
                     "one hand resting at the nape.",
                свет="A soft key behind and above the camera so the whole "
                     "back is evenly lit, plus a hard kicker from the far side "
                     "drawing a bright line down the outer edge of the arm "
                     "and hip.",
                камера="85mm at f/2, from mid-back up, lens slightly below "
                       "shoulder height.",
                обстановка="Dark room, no visible background detail."),

            _СЦ_РАЗДЕТЬ("un_shower", "Под водой",
                "Мокрая кожа, пар, стекло в каплях",
                поза="Standing under running water, head tipped back, hair "
                     "pushed away from the face by the stream, one hand at the "
                     "back of the neck.",
                свет="A single overhead source through steam, so the light "
                     "arrives soft and volumetric and every droplet on the "
                     "skin carries its own tiny highlight.",
                камера="50mm at f/2.8, waist-up, lens at chest height, "
                       "slightly angled up.",
                обстановка="A walk-in shower with dark stone and a glass "
                           "screen beaded with condensation.",
                ещё="Water behaves as water: it runs in continuous threads "
                    "over the shoulders, pools in the collarbones, and beads "
                    "where it meets skin. Wet hair is heavy, separated into "
                    "ropes, and darker than dry hair. Wet skin is glossier "
                    "but still porous — never plastic."),
        ],
    ),

    # -----------------------------------------------------------------
    Category(
        "scene", "Обстановка", "Перенести героиню в другое место",
        иконка="КАБЛУК",
        scenes=[
            _СЦ_ФОТО("sc_bed", "Шёлковая постель",
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

            _СЦ_ФОТО("sc_studio", "Чёрная студия",
                "Один источник, всё остальное в темноте",
                обстановка="A professional photo studio against seamless "
                           "black paper, nothing else in frame.",
                свет="A single large softbox at forty-five degrees camera "
                     "left, feathered so the far side of the body falls into "
                     "deep shadow. A thin rim light from behind separates the "
                     "shoulder and hair from the black.",
                настроение="Severe, controlled, expensive — the register of a "
                           "fashion test shot."),

            _СЦ_ФОТО("sc_bath", "Ванная",
                "Пар, запотевшее стекло, мокрая кожа",
                обстановка="A dim tiled bathroom, steam hanging in the air, "
                           "a large mirror fogged at the edges, warm water "
                           "still running. Small droplets condensing on every "
                           "cold surface.",
                свет="One warm bulb above and to the side, its light scattered "
                     "by the steam into a soft glow.",
                ещё="Her skin is damp: water beading on the shoulders and "
                    "collarbone, hair heavy and wet at the ends."),

            _СЦ_ФОТО("sc_hotel", "Ночной отель",
                "Город в окне, лампа у кровати",
                обстановка="A high-floor hotel room at night. A floor-to-"
                           "ceiling window fills one side of the frame with a "
                           "city skyline far below, out of focus into points "
                           "of amber and white. A single bedside lamp is lit.",
                свет="Warm lamplight from inside, cool city light from the "
                     "window, meeting on her face — warm on one cheek, cool on "
                     "the other."),

            _СЦ_ФОТО("sc_pool", "У бассейна",
                "Вода, отражения, полуденное солнце",
                обстановка="The edge of a swimming pool at midday, turquoise "
                           "water throwing rippling caustic reflections onto "
                           "everything above it. Pale stone, a folded towel, "
                           "nothing else.",
                свет="Hard overhead sun softened by a passing cloud, plus the "
                     "moving reflected light from the water playing across the "
                     "underside of her chin and arms."),

            _СЦ_ФОТО("sc_neon", "Неоновый переулок",
                "Мокрый асфальт, розовые вывески",
                обстановка="A narrow city alley at night after rain. Wet "
                           "asphalt mirrors a row of neon signs in magenta and "
                           "cold blue. Steam rising from a grate, brick walls "
                           "close on both sides.",
                свет="Hard coloured neon from two directions, magenta from the "
                     "left and cold blue from behind, with deep unlit shadow "
                     "between them.",
                настроение="Cinematic, charged, slightly dangerous."),

            _СЦ_ФОТО("sc_nature", "Поле на закате",
                "Высокая трава, контровой свет",
                обстановка="An open field of tall dry grass at golden hour, "
                           "the horizon low and distant, a line of trees far "
                           "behind in haze.",
                свет="The sun low and directly behind her, rimming the hair "
                     "and shoulders in gold, the front of the body lit softly "
                     "by bounce from the ground. Visible lens flare and warm "
                     "atmospheric haze."),

            _СЦ_ФОТО("sc_car", "Заднее сиденье",
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
            _СЦ_ОЖИВИТЬ("an_breath", "Дыхание",
                "Самое спокойное — грудь, ресницы, прядь",
                поза="She holds the pose of the photograph. Only the chest "
                     "rises and falls with slow breathing, the eyelids close "
                     "once in a natural blink, and a single strand of hair "
                     "settles across the cheek.",
                настроение="Calm, unhurried, almost still."),

            _СЦ_ОЖИВИТЬ("an_look", "Взгляд в камеру",
                "Отводит глаза и возвращает взгляд",
                поза="Her eyes drift away from the lens, linger for a moment, "
                     "then come back and settle directly on the camera. The "
                     "head turns only a few degrees with them.",
                настроение="Direct, unhurried, holding the viewer."),

            _СЦ_ОЖИВИТЬ("an_smile", "Улыбка",
                "Улыбка рождается медленно и доходит до глаз",
                поза="A smile builds slowly from the corners of the mouth, "
                     "reaching the eyes last so the cheeks lift and the outer "
                     "corners crease. It arrives and stays; it does not flash "
                     "on and off."),

            _СЦ_ОЖИВИТЬ("an_hair", "Поправляет волосы",
                "Заправляет прядь за ухо",
                поза="She lifts one hand, catches a loose strand of hair and "
                     "tucks it behind her ear, then lowers the hand back. The "
                     "hand must remain anatomically correct throughout the "
                     "movement, fingers never merging with the hair or face."),

            _СЦ_ОЖИВИТЬ("an_turn", "Поворот к камере",
                "Поворачивается через плечо",
                поза="She begins turned three-quarters away and rotates "
                     "smoothly toward the lens, the shoulders leading and the "
                     "head following, ending looking directly at camera. The "
                     "face must remain the same face through every degree of "
                     "the turn."),

            _СЦ_ОЖИВИТЬ("an_wind", "Ветер",
                "Волосы и ткань живут от ветра",
                поза="She stays still. A steady breeze lifts and moves her "
                     "hair in continuous strands and stirs the fabric she is "
                     "wearing, which ripples and settles with real weight.",
                ещё="Motion in the hair is strand-level and continuous, never "
                    "a single rigid mass moving as one piece."),

            _СЦ_ОЖИВИТЬ("an_push", "Наезд камеры",
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
            _СЦ_ЗВУК("vo_hello", "Приветствие",
                "Смотрит в камеру и здоровается",
                поза="She looks directly into the lens and speaks the supplied "
                     "line as a greeting, warm and unhurried, with small "
                     "natural head movements on the stressed syllables.",
                настроение="Welcoming, close, as if speaking to one person."),

            _СЦ_ЗВУК("vo_whisper", "Шёпотом",
                "Близко к камере, вполголоса",
                поза="She leans slightly toward the lens and speaks the "
                     "supplied line quietly, almost under her breath. Lip "
                     "movement is small and precise; the jaw barely opens.",
                камера="Very close framing, the face filling most of the "
                       "vertical frame.",
                настроение="Intimate, confidential, quiet."),

            _СЦ_ЗВУК("vo_invite", "Приглашение",
                "Зовёт за собой, жест рукой",
                поза="She speaks the supplied line and, on its final words, "
                     "lifts one hand in a small beckoning gesture. The hand "
                     "stays anatomically correct throughout."),

            _СЦ_ЗВУК("vo_laugh", "С улыбкой",
                "Говорит, улыбаясь, с короткой паузой на смешок",
                поза="She speaks the supplied line with a smile running under "
                     "it, breaking once into a short soft laugh before "
                     "finishing. The laugh moves the shoulders slightly."),

            _СЦ_ЗВУК("vo_story", "Рассказ",
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
