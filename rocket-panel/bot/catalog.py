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
    """Читает `ключ = английский текст | русская подпись`.

    Два поля, потому что у них разные читатели. Английский уходит
    МОДЕЛИ: она обучена на английском, русский даёт мусор. Русская
    подпись показывается ЧЕЛОВЕКУ на экране сценария, до оплаты — он
    должен понимать, за какое действие платит, а не догадываться по
    названию ракурса.

    Подписи нет — остаётся только английский, и на экране действие не
    называется. Это хуже, но не поломка.

    Пустой файл и отсутствие файла — тоже не ошибка.
    """
    out = {}
    try:
        with open(путь or ФАЙЛ_ОТКРОВЕННОГО, encoding="utf-8") as f:
            for строка in f:
                строка = строка.strip()
                if not строка or строка.startswith("#") or "=" not in строка:
                    continue
                ключ, _, хвост = строка.partition("=")
                англ, _, рус = хвост.partition("|")
                англ, рус = англ.strip(), рус.strip()
                if англ:
                    out[ключ.strip()] = (англ, рус)
    except OSError:
        pass
    return out


ОТКРОВЕННОЕ = _строки_владельца()


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели."""

    def __init__(self, key, title, job, блок, подпись="", фон="новый",
                 место=""):
        self.key = key
        self.title = title
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        # `фон` — откуда берётся обстановка:
        #   "референс" — та же, что на присланном фото (категория «Раздеть»)
        #   "новый"    — сочиняем с нуля (остальные)
        # Без этого различия «Раздеть» и «Обстановка» делали одно и то
        # же разными словами.
        self.фон = фон
        # Сценарий либо задаёт СВОЁ место («Обстановка»), либо берёт его
        # с присланного фото. Второе — не поблажка, а факт: у «Раздеть»
        # так задумано, а у оживления первым кадром идёт сам снимок, и
        # обстановка там буквально с него, иначе и быть не может.
        self.своё_место = bool(место)
        self.место = место or "как на твоём фото"
        # Строка владельца подставляется по ключу сценария. Задана в
        # блоке напрямую — она сильнее: так можно проверить сборку, не
        # трогая файл.
        англ, рус = ОТКРОВЕННОЕ.get(key, ("", ""))
        if not блок.откровенное:
            блок.откровенное = англ
        self.действие = рус           # по-русски, человеку на экран
        self.блок = блок
        self.подпись = подпись        # строка под названием в боте
        self.prompt = prompts.собрать(job, блок, фон=фон)
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
    """«Раздеть» — ТА ЖЕ обстановка, что на присланном фото.

    Меняются только ракурс, план и одежда. Оговорка, которую стоит
    помнить: при смене ракурса фон не остаётся пиксель в пиксель —
    другой угол видит другую часть комнаты, и модель достраивает ту же
    комнату с новой точки. Похоже и узнаваемо, но не идентично; чтобы
    было идентично, нужна правка по маске, а рисовать маску в телеграме
    нечем.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, фон="референс")


def _СЦ_ФОТО(key, title, подпись, место="", **поля):
    """«Обстановка» — НОВОЕ место, сочиняем с нуля.

    `место` — как это место называется по-русски. Показывается человеку
    на экране сценария до оплаты: он должен понимать, что покупает
    перенос именно в спальню, а не гадать по названию кнопки.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, место=место)


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
        "undress", "Раздеть", "Та же обстановка, что на твоём фото",
        иконка="СТРИНГИ",
        scenes=[
            # ОБСТАНОВКА БЕРЁТСЯ С ПРИСЛАННОГО ФОТО (фон="референс" в
            # помощнике). Поэтому ни один сценарий здесь не имеет права
            # опираться на мебель: «лёжа на кровати» бессмысленно, если
            # человек прислал фото на улице. Всё, что требует кровати,
            # зеркала или душа, живёт в «Обстановке» — там место наше.
            #
            # Здесь только РАКУРС, ПЛАН И ПОЗА — они работают где угодно.
            _СЦ_РАЗДЕТЬ("un_close", "Крупный план",
                "От груди и выше",
                поза="Head and shoulders turned a few degrees off the lens so "
                     "the neck reads long, chin level, weight settled on one "
                     "side. Shoulders relaxed and down, not braced.",
                камера="85mm at f/1.8, chest-up, lens at eye level. Shallow "
                       "depth so the room behind her falls away softly — it "
                       "stays the same room, just out of focus."),

            _СЦ_РАЗДЕТЬ("un_full", "В полный рост",
                "Вся фигура целиком",
                поза="Standing, weight on the back leg so the hips tilt, the "
                     "front knee soft and turned slightly inward. Spine long, "
                     "one shoulder dropped.",
                камера="35mm at f/4, full length with a hand of space above "
                       "the head. Camera at hip height so the proportions "
                       "stay honest. Enough of the room is in frame to read "
                       "where she is."),

            _СЦ_РАЗДЕТЬ("un_back", "Со спины",
                "Спина и линия плеч, взгляд через плечо",
                поза="Back to the lens, head turned far enough over the "
                     "shoulder that one eye and the line of the cheek are "
                     "visible. Shoulder blades drawn together, spine defined.",
                камера="85mm at f/2, from mid-back up, lens slightly below "
                       "shoulder height."),

            _СЦ_РАЗДЕТЬ("un_three", "В три четверти",
                "Вполоборота, самый выгодный разворот",
                поза="Turned about forty degrees away from the lens with the "
                     "head brought back toward it — the angle that shows both "
                     "the line of the waist and the front at once. Weight on "
                     "the far leg.",
                камера="50mm at f/2, three-quarter length, lens at chest "
                       "height."),

            _СЦ_РАЗДЕТЬ("un_sit", "Сидя",
                "Сидит на том, что есть в месте съёмки",
                поза="Seated on whatever the reference setting offers to sit "
                     "on — read it out of the photograph rather than "
                     "inventing furniture. Feet down, weight on one hip so "
                     "the spine curves, forearms resting on the thighs, head "
                     "lowered a little and turned toward the lens.",
                камера="50mm at f/2, lens at her eye level, three-quarter "
                       "length."),

            _СЦ_РАЗДЕТЬ("un_kneel", "На коленях",
                "Низкая точка, свет сверху",
                поза="Kneeling, sitting back on the heels, spine long, "
                     "shoulders open, hands resting on the thighs. Chin "
                     "level, eyes to the lens.",
                камера="50mm at f/2.8, lens at her chest height so the angle "
                       "is level with her rather than looking down at her."),

            _СЦ_РАЗДЕТЬ("un_low", "Снизу вверх",
                "Съёмка с низкой точки",
                поза="Standing, seen from below. Chin level — a low angle "
                     "with a raised chin reads as posing; level reads as "
                     "presence.",
                камера="35mm from just above knee height, tilted up. Keep the "
                       "focal length at 35mm and the distance honest so the "
                       "body does not distort; low angles exaggerate on their "
                       "own."),

            _СЦ_РАЗДЕТЬ("un_over", "Сверху вниз",
                "Съёмка с высокой точки",
                поза="Seen from above, face turned up to the lens, one "
                     "shoulder forward.",
                камера="35mm at roughly sixty degrees above her, held steady. "
                       "The height is the point, not movement of the rig."),
        ],
    ),

    Category(
        "scene", "Обстановка", "Перенести героиню в другое место",
        иконка="КАБЛУК",
        scenes=[
            _СЦ_ФОТО("sc_bed", "Шёлковая постель",
                "Утро, смятый шёлк, свет из-за штор", место="спальня",
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
                "Один источник, всё остальное в темноте", место="фотостудия",
                обстановка="A professional photo studio against seamless "
                           "black paper, nothing else in frame.",
                свет="A single large softbox at forty-five degrees camera "
                     "left, feathered so the far side of the body falls into "
                     "deep shadow. A thin rim light from behind separates the "
                     "shoulder and hair from the black.",
                настроение="Severe, controlled, expensive — the register of a "
                           "fashion test shot."),

            _СЦ_ФОТО("sc_hotel", "Ночной отель",
                "Город в окне, лампа у кровати", место="номер отеля",
                обстановка="A high-floor hotel room at night. A floor-to-"
                           "ceiling window fills one side of the frame with a "
                           "city skyline far below, out of focus into points "
                           "of amber and white. A single bedside lamp is lit.",
                свет="Warm lamplight from inside, cool city light from the "
                     "window, meeting on her face — warm on one cheek, cool on "
                     "the other."),

            _СЦ_ФОТО("sc_pool", "У бассейна",
                "Вода, отражения, полуденное солнце", место="у бассейна",
                обстановка="The edge of a swimming pool at midday, turquoise "
                           "water throwing rippling caustic reflections onto "
                           "everything above it. Pale stone, a folded towel, "
                           "nothing else.",
                свет="Hard overhead sun softened by a passing cloud, plus the "
                     "moving reflected light from the water playing across the "
                     "underside of her chin and arms."),

            _СЦ_ФОТО("sc_neon", "Неоновый переулок",
                "Мокрый асфальт, розовые вывески", место="ночная улица",
                обстановка="A narrow city alley at night after rain. Wet "
                           "asphalt mirrors a row of neon signs in magenta and "
                           "cold blue. Steam rising from a grate, brick walls "
                           "close on both sides.",
                свет="Hard coloured neon from two directions, magenta from the "
                     "left and cold blue from behind, with deep unlit shadow "
                     "between them.",
                настроение="Cinematic, charged, slightly dangerous."),

            _СЦ_ФОТО("sc_nature", "Поле на закате",
                "Высокая трава, контровой свет", место="поле на закате",
                обстановка="An open field of tall dry grass at golden hour, "
                           "the horizon low and distant, a line of trees far "
                           "behind in haze.",
                свет="The sun low and directly behind her, rimming the hair "
                     "and shoulders in gold, the front of the body lit softly "
                     "by bounce from the ground. Visible lens flare and warm "
                     "atmospheric haze."),

            _СЦ_ФОТО("sc_office", "Кабинет",
                "Стол, жалюзи, полосы света", место="кабинет",
                обстановка="A private office after hours: a heavy desk, a "
                           "leather chair, shelves in shadow, venetian blinds "
                           "across one whole wall.",
                свет="Hard light through the blinds laying parallel bars "
                     "across the room, across the desk and across her body. "
                     "The bars must follow the form they fall on, bending "
                     "over curves rather than staying straight.",
                камера="50mm at f/2.8, waist-up, camera at standing eye "
                       "height."),

            _СЦ_ФОТО("sc_mirror", "У зеркала",
                "Отражение и спина в одном кадре", место="комната с зеркалом",
                обстановка="A tall frameless mirror against a bedroom wall, "
                           "the room behind it softly out of focus.",
                поза="Standing close to the mirror, front toward the glass, "
                     "back toward the lens. The face is visible only in the "
                     "reflection.",
                свет="A warm bulb above the mirror lighting the reflected "
                     "front, a cooler window light behind the camera grazing "
                     "her back. Two colour temperatures, kept apart.",
                камера="50mm at f/2.8, off-axis so the lens never appears in "
                       "the glass.",
                ещё="The mirror shows a true reflection: same body, same "
                    "pose, reversed correctly, lit from the same direction. "
                    "Reflections are where identity usually breaks — the face "
                    "in the glass must be the same face. No second person."),

            _СЦ_ФОТО("sc_shower", "Под душем",
                "Мокрая кожа, пар, стекло в каплях", место="душевая",
                обстановка="A walk-in shower with dark stone and a glass "
                           "screen beaded with condensation.",
                поза="Standing under running water, head tipped back, hair "
                     "pushed away from the face by the stream, one hand at "
                     "the back of the neck.",
                свет="A single overhead source through steam, so the light "
                     "arrives soft and volumetric and every droplet carries "
                     "its own tiny highlight.",
                камера="50mm at f/2.8, waist-up, lens at chest height.",
                ещё="Water behaves as water: it runs in continuous threads "
                    "over the shoulders, pools in the collarbones, beads "
                    "where it meets skin. Wet hair is heavy, separated into "
                    "ropes, darker than dry hair. Wet skin is glossier but "
                    "still porous — never plastic."),

            _СЦ_ФОТО("sc_car", "Заднее сиденье",
                "Салон ночью, свет фонарей по лицу", место="салон машины",
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
        "animate", "Действие", "Фото начинает двигаться",
        иконка="БЛЁСТКИ",
        scenes=[
            # Разложено по РАКУРСУ И ДВИЖЕНИЮ КАМЕРЫ, а не по действию.
            # Так устроен и каталог конкурента, просто он этого не
            # говорит: «Минет 1/2/3 / в профиль / крупным планом /
            # глубокий / горловой / грубый» — это одно действие и восемь
            # ракурсов, написанных восемью отдельными текстами.
            #
            # У нас ракурс, свет и объектив собираются кодом, а что
            # происходит в кадре, владелец пишет один раз на сценарий в
            # ОТКРОВЕННОЕ.txt. Те же восемь вариантов без восьми текстов.
            _СЦ_ОЖИВИТЬ("ac_pov", "От первого лица",
                "Камера на месте зрителя, руки в кадре",
                камера="Point-of-view: the camera IS the viewer's eyes, held "
                       "at head height, 28mm wide so the hands entering the "
                       "bottom of the frame read at natural size. Slight "
                       "hand-held drift, never a tripod-locked stillness.",
                настроение="Intimate and immediate, as if the viewer is in "
                           "the room rather than watching a screen."),

            _СЦ_ОЖИВИТЬ("ac_close", "Крупный план",
                "Лицо и плечи во весь кадр",
                камера="85mm at f/2, tight on the face and shoulders. The "
                       "camera holds still and lets the movement happen "
                       "inside the frame rather than chasing it.",
                свет="A soft key close to the lens axis so the face stays "
                     "open and readable throughout."),

            _СЦ_ОЖИВИТЬ("ac_side", "Сбоку",
                "Профиль, силуэт читается по контуру",
                камера="50mm at f/2.8, square to her side so the whole body "
                       "reads in profile. Camera at chest height, static.",
                свет="Strong backlight from behind her so the profile is "
                     "drawn as a bright contour against a dark background, "
                     "with only a weak fill from the front."),

            _СЦ_ОЖИВИТЬ("ac_above", "Сверху",
                "Съёмка сверху вниз",
                камера="35mm looking down at roughly sixty degrees from "
                       "above. Held steady; the height is the point, not the "
                       "movement of the rig.",
                свет="An overhead source just behind the camera, so the light "
                     "and the lens agree and there are no shadows thrown "
                     "toward the viewer."),

            _СЦ_ОЖИВИТЬ("ac_below", "Снизу",
                "Съёмка с низкой точки",
                камера="35mm from just above floor level, tilted up. Low "
                       "angles exaggerate: keep the lens at 35mm and the "
                       "distance honest so the body does not distort.",
                свет="A key from above and behind so the underside stays in "
                     "shadow and the shoulders and jaw catch the light."),

            _СЦ_ОЖИВИТЬ("ac_push", "Наезд",
                "Камера медленно приближается",
                камера="A slow, continuous dolly-in over the whole clip — the "
                       "frame tightens by about a third from first to last. "
                       "Constant speed, no easing at the end, no zoom: the "
                       "perspective must change as a real camera moving "
                       "forward, not as a crop."),

            _СЦ_ОЖИВИТЬ("ac_pull", "Отъезд",
                "Камера отъезжает, открывая сцену",
                камера="A slow dolly-out: the clip opens tight and widens to "
                       "reveal the surroundings. Constant speed, the subject "
                       "staying centred as the frame grows."),

            _СЦ_ОЖИВИТЬ("ac_back", "Со спины",
                "Спина в кадре, взгляд через плечо",
                камера="85mm at f/2 from behind, framed from mid-back up. "
                       "Static camera.",
                поза="Back to the lens throughout; at some point the head "
                     "turns far enough over the shoulder that one eye meets "
                     "the camera, then returns."),

            _СЦ_ОЖИВИТЬ("ac_mirror", "В зеркале",
                "Отражение и спина одновременно",
                камера="50mm, off-axis so the lens never appears in the "
                       "glass. Static.",
                обстановка="A tall mirror filling most of the frame.",
                ещё="The reflection stays a true reflection for every frame: "
                    "same body, same motion, correctly reversed, lit from the "
                    "same direction. Reflections are where identity usually "
                    "breaks — the face in the glass must be the same face."),

            _СЦ_ОЖИВИТЬ("ac_slow", "Замедленно",
                "Движение вдвое медленнее обычного",
                камера="85mm at f/1.8, static, tight enough that small "
                       "movements fill the frame.",
                ещё="Everything moves at roughly half speed: hair settles "
                    "slowly, fabric falls slowly, a blink takes twice as "
                    "long. Motion blur stays consistent with that slowness "
                    "rather than being frozen sharp."),
        ],
    ),

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
]

# Категории «Своё» здесь нет, и это не забывчивость. Она была заведена
# пустой под сценарии владельца — до того, как появился
# `ОТКРОВЕННОЕ.txt`. Теперь владелец наполняет ЛЮБОЙ сценарий любой
# категории, а отдельная пустая категория только дублировала бы и файл,
# и кнопку «Свой промпт».
#
# «Популярное» тоже не здесь: оно не список, а запрос к базе —
# `популярная_категория()` ниже.

# Категория без сценариев в меню не показывается.
ВИДИМЫЕ = [c for c in CATEGORIES if c.scenes]

_ПО_КЛЮЧУ = {s.key: s for c in CATEGORIES for s in c.scenes}
_КАТЕГОРИИ = {c.key: c for c in CATEGORIES}


# ---------------------------------------------------------------------
# ПОПУЛЯРНОЕ
#
# Не список, а запрос к базе. У конкурента такая категория есть в обоих
# разделах, и это единственная его категория, которая не стоит труда:
# она считается из статистики, а не пишется руками.
#
# Показывается только когда есть из чего считать. Пустое «Популярное» на
# старте — худший первый экран: человек жмёт то, что выглядит главным,
# и попадает в пустоту.
# ---------------------------------------------------------------------

ПОПУЛЯРНЫХ = 8


class Популярное:
    """Категория-обёртка. Ведёт себя как обычная, но список сценариев
    берётся из базы и меняется сам."""

    key = "top"
    title = "Популярное"
    подзаголовок = "Что чаще всего заказывают"
    иконка = "ОГОНЬ"

    def __init__(self, scenes):
        self.scenes = scenes

    def button(self):
        return f"{self.title} · {len(self.scenes)}"


def популярная_категория(store, сколько=ПОПУЛЯРНЫХ):
    """Собирает «Популярное» по статистике. Нет данных — вернёт None, и
    категория просто не появится в меню."""
    try:
        верх = store.популярное(сколько)
    except Exception:
        return None
    сцены = [_ПО_КЛЮЧУ[к] for к, _ in верх if к in _ПО_КЛЮЧУ]
    return Популярное(сцены) if сцены else None


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
