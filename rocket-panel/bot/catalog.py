"""Каталог готовых сценариев. Второй по важности файл после цен.

Зачем он вообще. Разбор конкурента 20.09.2026 показал главное: его
продукт — это не окно ввода, а КАТАЛОГ из под двух сотен готовых
сценариев по категориям. Человек ничего не пишет, он тыкает кнопку.
Свободный промпт у него заперт за подпиской и продаётся как апгрейд.

Мы строили промпт-первый интерфейс, и это ошибка: описывать сцену
словами умеет меньшинство, а платят все.

Чем отличаемся от него — три вещи, и все три нарочно:

  1. ЦЕНА ВИДНА ВЕЗДЕ. У него цена всплывает единственный раз — после
     того, как человек выбрал сценарий и загрузил фото. Мы пишем цену на
     каждой кнопке, до выбора. Стоит это ноль, а доверия прибавляет.
  2. СВОЙ ПРОМПТ ДОСТУПЕН ВСЕМ. У него это платная функция под замком.
     У нас модель без цензуры своя, и запирать её нет смысла: каталог и
     так удобнее, а «свой промпт бесплатно» — честный довод в нашу
     пользу. Подписка при этом не пустеет: она продаёт скорость,
     параллельность, длину, качество и постоянство лица.
  3. ЛИЦО ДЕРЖИТСЯ. У него лицо героини плывёт от кадра к кадру —
     проверено на его же боте. Это наш главный козырь, и он в ULTRA.

Устройство: раздел → категория → сценарий. Сценарий несёт готовый
промпт и вид генерации, по которому считается цена из pricing.JOBS.
"""

import pricing


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели."""

    def __init__(self, key, title, job, prompt, negative=""):
        self.key = key
        self.title = title
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        self.prompt = prompt
        self.negative = negative

    @property
    def hearts(self):
        return pricing.job(self.job).hearts

    def button(self):
        """Подпись кнопки. Цена в ней обязательна — это наше отличие."""
        return f"{self.title} · {self.hearts} ♥"


class Category:
    def __init__(self, key, title, scenes):
        self.key = key
        self.title = title
        self.scenes = scenes

    def button(self):
        return f"{self.title} · {len(self.scenes)}"


class Section:
    def __init__(self, key, title, note, cats):
        self.key = key
        self.title = title
        self.note = note
        self.cats = cats

    @property
    def scenes(self):
        return [s for c in self.cats for s in c.scenes]


# Слова, общие для всей съёмки. Держим в одном месте: иначе каждый
# сценарий обрастёт своим хвостом качества, и они разойдутся.
КАЧЕСТВО = ("photorealistic, natural skin texture with pores, soft "
            "cinematic lighting, 85mm lens, shallow depth of field, "
            "sharp focus on eyes, 8k, highly detailed")
НЕГАТИВ = ("cartoon, anime, 3d render, plastic skin, deformed hands, "
           "extra fingers, watermark, text, blurry, lowres")


def _ph(key, title, prompt):
    return Scene(key, title, "photo", f"{prompt}, {КАЧЕСТВО}", НЕГАТИВ)


def _ed(key, title, prompt):
    return Scene(key, title, "inpaint", f"{prompt}, {КАЧЕСТВО}", НЕГАТИВ)


def _an(key, title, prompt):
    return Scene(key, title, "animate", prompt, НЕГАТИВ)


SECTIONS = [
    Section(
        "scene", "Сцена по образцу",
        "Пришли фото — поставим героиню в любую обстановку, лицо останется",
        [
            Category("bedroom", "Спальня", [
                _ph("bed_silk", "Шёлковая постель",
                    "woman lying on white silk bedsheets, morning light "
                    "through sheer curtains, relaxed pose"),
                _ph("bed_window", "У окна на рассвете",
                    "woman sitting on bed by a large window at sunrise, "
                    "warm backlight, silhouette rim light"),
                _ph("bed_mirror", "Перед зеркалом",
                    "woman in front of a full length mirror in a dim "
                    "bedroom, reflection visible, moody lighting"),
            ]),
            Category("studio", "Студия", [
                _ph("st_black", "Чёрный фон",
                    "studio portrait against seamless black backdrop, "
                    "single softbox from the left, deep shadows"),
                _ph("st_white", "Белый циклорама",
                    "full body studio shot on white cyclorama, even "
                    "high key lighting, editorial fashion style"),
                _ph("st_neon", "Неон",
                    "studio shot with magenta and cyan neon tubes, "
                    "wet look skin highlights, cyberpunk mood"),
            ]),
            Category("water", "Вода", [
                _ph("w_shower", "Душ",
                    "woman in a glass shower cabin, water droplets on "
                    "skin and glass, steam, backlit"),
                _ph("w_pool", "Бассейн ночью",
                    "woman at the edge of a lit swimming pool at night, "
                    "water reflections on skin"),
                _ph("w_bath", "Ванна с пеной",
                    "woman in a bathtub with foam, candles around, "
                    "warm low light"),
            ]),
            Category("outdoor", "На улице", [
                _ph("o_beach", "Пляж на закате",
                    "woman on an empty beach at golden hour, wind in "
                    "hair, sun flare"),
                _ph("o_forest", "Лес",
                    "woman in a misty pine forest, soft diffused "
                    "daylight, moss and ferns"),
                _ph("o_roof", "Крыша в городе",
                    "woman on a rooftop at night, city bokeh lights "
                    "behind, cool blue tones"),
            ]),
        ]),

    Section(
        "edit", "Правка фото",
        "Обведи пальцем что поменять — лицо не тронем",
        [
            Category("outfit", "Одежда", [
                _ed("e_swim", "Купальник",
                    "wearing a swimsuit, natural fit and folds"),
                _ed("e_lace", "Кружевное бельё",
                    "wearing white lace lingerie, delicate fabric detail"),
                _ed("e_dress", "Вечернее платье",
                    "wearing an elegant evening dress, silk fabric"),
                _ed("e_sport", "Спортивное",
                    "wearing fitted sportswear, gym setting"),
            ]),
            Category("angle", "Ракурс и поза", [
                _ed("a_side", "Повернуть боком",
                    "turned to the side, three quarter view, same person"),
                _ed("a_back", "Повернуть спиной",
                    "viewed from behind, looking over the shoulder"),
                _ed("a_close", "Крупный план",
                    "close up portrait framing, head and shoulders"),
            ]),
            Category("light", "Свет и стиль", [
                _ed("l_golden", "Тёплый закат",
                    "warm golden hour light on the subject"),
                _ed("l_noir", "Чёрно-белое",
                    "black and white film noir lighting, hard shadows"),
                _ed("l_film", "Плёнка",
                    "35mm film grain, muted colors, analog look"),
            ]),
        ]),

    Section(
        "video", "Оживить фото",
        "Фото оживает: движение, камера, свет",
        [
            Category("soft", "Спокойное", [
                _an("v_breath", "Дыхание и взгляд",
                    "subtle breathing, slow blink, slight head turn "
                    "toward camera, hair moves gently"),
                _an("v_smile", "Улыбка",
                    "slowly breaks into a soft smile, eyes narrow warmly"),
                _an("v_hair", "Поправляет волосы",
                    "raises hand and brushes hair behind the ear, "
                    "natural arm motion"),
            ]),
            Category("camera", "Движение камеры", [
                _an("v_push", "Наезд",
                    "slow dolly push in toward the subject, shallow "
                    "depth of field"),
                _an("v_orbit", "Облёт",
                    "camera orbits slowly around the subject, parallax"),
                _an("v_tilt", "Панорама снизу вверх",
                    "camera tilts up slowly from feet to face, smooth "
                    "steady motion, subject stays still and breathes"),
            ]),
            Category("move", "Движение героини", [
                _an("v_turn", "Поворот к камере",
                    "turns body toward the camera and looks directly "
                    "into the lens"),
                _an("v_walk", "Шаг навстречу",
                    "takes a step toward the camera, confident walk"),
                _an("v_stretch", "Потягивается",
                    "stretches arms slowly above the head, arching back"),
            ]),
        ]),
]

SECTION = {s.key: s for s in SECTIONS}
CATEGORY = {(s.key, c.key): c for s in SECTIONS for c in s.cats}
SCENE = {sc.key: sc for s in SECTIONS for c in s.cats for sc in c.scenes}


def section(key):
    if key not in SECTION:
        raise KeyError(f"неизвестный раздел: {key}")
    return SECTION[key]


def category(section_key, cat_key):
    k = (section_key, cat_key)
    if k not in CATEGORY:
        raise KeyError(f"неизвестная категория: {section_key}/{cat_key}")
    return CATEGORY[k]


def scene(key):
    if key not in SCENE:
        raise KeyError(f"неизвестный сценарий: {key}")
    return SCENE[key]


def count():
    return {"разделов": len(SECTIONS),
            "категорий": len(CATEGORY),
            "сценариев": len(SCENE)}
