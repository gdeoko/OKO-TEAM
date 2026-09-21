"""Каталог сценариев. Второй по важности файл после цен.

## Почему каталог, а не окно ввода

Разбор конкурента 20.09.2026 показал главное: его продукт — не поле для
промпта, а КАТАЛОГ из 232 готовых сценариев по категориям. Человек
ничего не пишет, он тыкает кнопку. Свободный промпт у него заперт за
подпиской и продаётся как апгрейд.

Мы строили промпт-первый интерфейс, и это была ошибка: описывать сцену
словами умеет меньшинство, а платят все.

## Устройство: три раздела

Решение владельца 21.09.2026 — три раздела, и внутри каждого свои
подразделы:

    Раздеть      -> Где сняли · Другое место
    Видео        -> Соло · Пара МЖ · Пара ЖЖ · Пара ММ
    Свой промпт  -> Фото · Видео

«Групповое» не стало отдельным уровнем с тремя кнопками внутри: тогда
до варианта было бы четыре нажатия вместо трёх, а информации ровно
столько же. Составы подняты на уровень подразделов и стоят рядом с
«Соло» — то же дерево, на шаг короче.

Сценарий не хранит текст промпта. Он объявляет, чем отличается
(гардероб, поза, свет, обстановка), а полный промпт от трёх тысяч
знаков собирает `prompts.собрать` — см. там, почему так.

## Два слоя и два хозяина

  * КОД держит то, что делает кадр рабочим: сохранение лица, кожу,
    анатомию, поведение ткани, свет, объектив, композицию, запреты.
  * ВЛАДЕЛЕЦ держит название кнопки и то, что происходит в кадре.

Второй слой лежит в `каталог.json` (см. `данные.py`) и правится
страницей в браузере. Именно поэтому название и промпт здесь —
СВОЙСТВА, а не поля: файл меняется на ходу, и застывший в памяти
каталог означал бы, что правка доезжает до бота только перезапуском.

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
import time

import данные
import язык
import pricing
import prompts

Блок = prompts.Блок


# ---------------------------------------------------------------------
# ПРАВКИ ВЛАДЕЛЬЦА, ПОДХВАТЫВАЕМЫЕ НА ХОДУ
#
# Страница каталога пишет `каталог.json` и на этом заканчивает свою
# работу. Ни перезапуска бота, ни systemctl, ни прав root: бот сам
# замечает, что файл изменился, и берёт новое.
#
# Проверка не чаще раза в секунду. Без этого os.stat вызывался бы по
# пятьдесят раз на отрисовку меню — не смертельно, но бессмысленно.
# Секунда задержки между «Сохранить» и новой кнопкой в боте — ровно то,
# что владелец не успеет заметить, переключаясь из браузера в телеграм.
# ---------------------------------------------------------------------

_КЭШ = {"проверено": 0.0, "метка": None, "правки": {}}
_ИНТЕРВАЛ = 1.0

# Разовый переезд со старого `ОТКРОВЕННОЕ.txt`. Он был заведён накануне
# как временное решение — правка блокнотом на сервере. Если владелец
# успел что-то туда вписать, оно должно переехать само, а не пропасть
# молча вместе с файлом.
ФАЙЛ_ОТКРОВЕННОГО = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                 "ОТКРОВЕННОЕ.txt")
данные.перенести_из_txt(ФАЙЛ_ОТКРОВЕННОГО)


def правки(сейчас=None):
    """Текущее содержимое `каталог.json`, с кэшем по времени правки."""
    сейчас = time.time() if сейчас is None else сейчас
    if сейчас - _КЭШ["проверено"] < _ИНТЕРВАЛ:
        return _КЭШ["правки"]
    _КЭШ["проверено"] = сейчас
    try:
        st = os.stat(данные.ФАЙЛ)
        метка = (st.st_mtime_ns, st.st_size)
    except OSError:
        метка = None
    if метка != _КЭШ["метка"]:
        _КЭШ["метка"] = метка
        _КЭШ["правки"] = данные.загрузить()
    return _КЭШ["правки"]


def перечитать():
    """Забыть кэш и взять файл заново. Для тестов и для страницы сразу
    после записи — там ждать секунду незачем."""
    _КЭШ["проверено"] = 0.0
    _КЭШ["метка"] = None
    return правки()


def подставить(новые):
    """Подменить правки в памяти, не трогая файл.

    Нужно тестам и предпросмотру на странице: показать, как будет
    выглядеть кнопка, ДО того как нажали «Сохранить». `перечитать()`
    возвращает всё к файлу.
    """
    _КЭШ["правки"] = dict(новые or {})
    _КЭШ["метка"] = "подставлено"
    _КЭШ["проверено"] = float("inf")
    return _КЭШ["правки"]


def правка(ключ, поле):
    return (правки().get(ключ) or {}).get(поле, "")


def скрыт(ключ):
    """Владелец убрал пункт из бота.

    Одно поле на три уровня: у раздела, подраздела и сценария ключи
    разные и не пересекаются, поэтому разбирать их по отдельным
    спискам незачем.
    """
    return правка(ключ, "скрыт") == "1"


def обязательная_строка():
    """Строка, которая дописывается к СВОЕМУ промпту (см. prompts.свой).
    Владелец правит её на той же странице, отдельным полем сверху."""
    return правка(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ, "строка") \
        or prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели.

    Название, откровенная строка и промпт — свойства, а не поля: см.
    «Два слоя и два хозяина» в шапке файла.
    """

    def __init__(self, key, title, job, блок, подпись="", фон="новый",
                 место="", пара="", фото_нужно=None, расстановка=""):
        self.key = key
        self._title = title           # умолчание; владелец перебивает
        self.расстановка = расстановка  # ключ геометрии у парных сцен
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        # `фон` — откуда берётся обстановка:
        #   "референс" — та же, что на присланном фото (подраздел «Где сняли»)
        #   "новый"    — сочиняем с нуля (остальные)
        # Без этого различия «Раздеть» и «Обстановка» делали одно и то
        # же разными словами.
        self.фон = фон
        # Сценарий либо задаёт СВОЁ место, либо берёт его с присланного
        # фото. Второе — не поблажка, а факт: у «Где сняли» так
        # задумано, а у оживления первым кадром идёт сам снимок, и
        # обстановка там буквально с него, иначе и быть не может.
        self.своё_место = bool(место)
        self.место = место or "как на твоём фото"
        # Непустое — в кадре ДВОЕ и референсов двое. Строка описывает
        # состав по-русски («мужчина и женщина»), человеку на экран.
        self.пара = пара
        self._фото_нужно = фото_нужно
        self.блок = блок
        self.подпись = подпись        # строка под названием в боте
        self.negative = prompts.НЕГАТИВ
        self.подраздел = None         # проставляется при сборке дерева

    # ---------- то, что правит владелец ----------

    def назв(self, яз="ru"):
        """Подпись кнопки на языке человека.

        Порядок один и тот же у всех надписей: сперва правка владельца
        на нужном языке, потом умолчание кода, потом русское. Пустота
        на кнопке недопустима ни при каком раскладе — лучше не тот
        язык, чем пустой прямоугольник.
        """
        if язык.нормальный(яз) == "en":
            en = правка(self.key, "название_en")
            if en:
                return en
            свои = язык.СЦЕНАРИИ_EN.get(self.key)
            if свои:
                return свои[0]
            если_пара = язык.РАССТАНОВКИ_EN.get(self.расстановка)
            if если_пара:
                return если_пара[0]
        return правка(self.key, "название") or self._title

    @property
    def title(self):
        """Русское название. Оставлено для страницы каталога и тестов —
        там язык всегда один."""
        return self.назв("ru")

    def подп(self, яз="ru"):
        if язык.нормальный(яз) == "en":
            свои = (язык.СЦЕНАРИИ_EN.get(self.key)
                    or язык.РАССТАНОВКИ_EN.get(self.расстановка))
            if свои:
                return свои[1]
        return self.подпись

    def мест(self, яз="ru"):
        if язык.нормальный(яз) == "en":
            return язык.МЕСТА_EN.get(self.место, self.место)
        return self.место

    def состав(self, яз="ru"):
        if язык.нормальный(яз) == "en":
            return язык.СОСТАВЫ_EN.get(self.пара, self.пара)
        return self.пара

    @property
    def откровенное(self):
        """Английская строка для модели. В блоке она сильнее файла:
        так сборку можно проверить тестом, не трогая данные."""
        return self.блок.откровенное or правка(self.key, "строка")

    def действие(self, яз="ru"):
        """Что происходит — человеку на экран сценария, до оплаты.

        Английскому клиенту показывается ТА ЖЕ строка, что уходит
        модели. Это не заглушка вместо перевода, а отказ от лишней
        работы: владелец пишет английский текст в любом случае, для
        модели, — и он описывает ровно то же самое. Заводить под
        английскую подпись третье поле значило бы просить написать одно
        и то же дважды.
        """
        if язык.нормальный(яз) == "en":
            return self.откровенное
        return правка(self.key, "строка_рус")

    @property
    def наполнен(self):
        return bool(self.откровенное)

    @property
    def скрыт(self):
        """Убран владельцем — или убран вместе со своим подразделом.

        Наследование обязательно: иначе спрятанный подраздел исчезал бы
        из меню, но его сценарии оставались бы в «Популярном» и
        открывались по старым кнопкам из переписки.
        """
        if скрыт(self.key):
            return True
        под = self.подраздел
        return bool(под and getattr(под, "скрыт", False))

    # ---------- то, что собирается кодом ----------

    @property
    def prompt(self):
        """Промпт под ОСНОВНОЙ вид работы сценария."""
        return self._собрать(self.job)

    @property
    def prompt_фото(self):
        """Промпт для фото-шага у видео-сценариев.

        Ролик начинается с КАДРА, и раздеть человека видео не умеет:
        `start_image` в панели — буквально первый кадр, а не подсказка.
        Поэтому видео у нас считается в два прохода: сперва фото по
        референсам, потом оно же оживляется. См. `bot.run_job`.
        """
        return self._собрать("i2i")

    def _собрать(self, вид):
        блок = Блок(**{п: getattr(self.блок, п) for п in Блок.__slots__})
        блок.откровенное = self.откровенное
        # Фон референса имеет смысл только для одиночного фото-шага: у
        # пары второй человек всё равно приходит со своего снимка, и
        # «сохрани ту же комнату» превращается в противоречие.
        фон = self.фон if not self.пара else "новый"
        return prompts.собрать(вид, блок, фон=фон, пара=bool(self.пара))

    # ---------- цена и вход ----------

    @property
    def coins(self):
        return pricing.job(self.job).coins

    @property
    def фото_нужно(self):
        """Сколько снимков просить. Обычно берётся из прайса — это
        свойство модели, и двух источников правды тут быть не должно.
        Пара перебивает: ей нужно ровно два, по снимку на человека."""
        return self._фото_нужно or pricing.job(self.job).фото_нужно

    @property
    def двухшаговый(self):
        """Ролик собирается через промежуточное фото.

        Всегда, кроме кнопки «Оживить это»: там кадр уже наш и уже
        раздет, второй проход был бы потраченной минутой карты.
        """
        return prompts.семейство(self.job) == "i2v"

    def button(self, яз="ru"):
        """Подпись кнопки. Цена в ней обязательна — это наше отличие."""
        return f"{self.назв(яз)} · {self.coins} {pricing.СИМВОЛ}"


class Подраздел:
    """Список сценариев внутри раздела."""

    def __init__(self, key, title, подзаголовок, scenes, иконка=""):
        self.key = key
        self.title = title
        self.подзаголовок = подзаголовок
        self.scenes = scenes
        self.иконка = иконка          # премиум-эмодзи, см. emoji.py
        self.раздел = None
        for s in scenes:
            s.подраздел = self

    def назв(self, яз="ru"):
        свои = язык.ПОДРАЗДЕЛЫ_EN.get(self.key)
        return свои[0] if (язык.нормальный(яз) == "en" and свои) else self.title

    def подзаг(self, яз="ru"):
        свои = язык.ПОДРАЗДЕЛЫ_EN.get(self.key)
        return свои[1] if (язык.нормальный(яз) == "en" and свои) else self.подзаголовок

    @property
    def скрыт(self):
        """Убран сам или убран вместе со своим разделом."""
        if скрыт(self.key):
            return True
        return bool(self.раздел and self.раздел.скрыт)

    @property
    def видимые(self):
        """Сценарии, которые человек реально увидит."""
        return [s for s in self.scenes if not s.скрыт]

    @property
    def пустой(self):
        """Скрыт сам или в нём не осталось ни одного варианта.

        Подраздел без вариантов в меню не показывается: кнопка, ведущая
        в пустой список, — это нажатие впустую и назад.
        У «Своего промпта» вариантов нет по устройству, и пустым он от
        этого не становится.
        """
        if self.скрыт:
            return True
        if self.раздел and self.раздел.свободный:
            return False
        return not self.видимые

    def button(self, яз="ru"):
        return f"{self.назв(яз)} · {len(self.видимые)}"


# Старое имя. Код и тесты писались, когда уровней было два.
Category = Подраздел


class Раздел:
    """Верхний уровень меню. Три штуки, см. шапку файла."""

    def __init__(self, key, title, подзаголовок, подразделы, иконка="",
                 свободный=False):
        self.key = key
        self.title = title
        self.подзаголовок = подзаголовок
        self.подразделы = подразделы
        self.иконка = иконка
        # «Свой промпт» устроен иначе: внутри не сценарии, а режимы —
        # человек приносит референс и пишет описание сам.
        self.свободный = свободный
        for п in подразделы:
            п.раздел = self

    @property
    def scenes(self):
        return [s for п in self.подразделы for s in п.scenes]

    @property
    def скрыт(self):
        return скрыт(self.key)

    @property
    def видимые(self):
        return [п for п in self.подразделы if not п.пустой]

    @property
    def пустой(self):
        """Скрыт сам или внутри не осталось ни одного подраздела."""
        return self.скрыт or not self.видимые

    def назв(self, яз="ru"):
        свои = язык.РАЗДЕЛЫ_EN.get(self.key)
        return свои[0] if (язык.нормальный(яз) == "en" and свои) else self.title

    def подзаг(self, яз="ru"):
        свои = язык.РАЗДЕЛЫ_EN.get(self.key)
        return свои[1] if (язык.нормальный(яз) == "en" and свои) else self.подзаголовок

    def button(self, яз="ru"):
        return self.назв(яз)


def _СЦ_РАЗДЕТЬ(key, title, подпись, **поля):
    """«Где сняли» — ТА ЖЕ обстановка, что на присланном фото.

    Меняются только ракурс, план и одежда. Оговорка, которую стоит
    помнить: при смене ракурса фон не остаётся пиксель в пиксель —
    другой угол видит другую часть комнаты, и модель достраивает ту же
    комнату с новой точки. Похоже и узнаваемо, но не идентично; чтобы
    было идентично, нужна правка по маске, а рисовать маску в телеграме
    нечем.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, фон="референс")


def _СЦ_ФОТО(key, title, подпись, место="", **поля):
    """«Другое место» — НОВОЕ место, сочиняем с нуля.

    `место` — как это место называется по-русски. Показывается человеку
    на экране сценария до оплаты: он должен понимать, что покупает
    перенос именно в спальню, а не гадать по названию кнопки.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, место=место)


def _СЦ_ОЖИВИТЬ(key, title, подпись, **поля):
    return Scene(key, title, "i2v_5", Блок(**поля), подпись)


# ---------------------------------------------------------------------
# РАЗДЕЛ 1: РАЗДЕТЬ
# ---------------------------------------------------------------------

ГДЕ_СНЯЛИ = [
    # ОБСТАНОВКА БЕРЁТСЯ С ПРИСЛАННОГО ФОТО (фон="референс" в
    # помощнике). Поэтому ни один сценарий здесь не имеет права
    # опираться на мебель: «лёжа на кровати» бессмысленно, если человек
    # прислал фото на улице. Всё, что требует кровати, зеркала или
    # душа, живёт в «Другом месте» — там место наше.
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

    _СЦ_РАЗДЕТЬ("un_lie", "Лёжа",
        "Горизонталь, камера сверху над ней",
        поза="Lying on her back on whatever surface the reference "
             "setting actually offers — read it out of the "
             "photograph rather than inventing one. One knee "
             "raised, the other leg long, one arm above the head, "
             "the other across the ribs. Head turned toward the lens, "
             "hair spread out on the surface under her.",
        камера="35mm at f/2.8, directly above her and square to the "
               "body, so the frame reads as a clean horizontal. Lens "
               "roughly a metre and a half up, held level."),

    _СЦ_РАЗДЕТЬ("un_lean", "Опираясь",
        "Стоя, опираясь на то, что рядом",
        поза="Standing and leaning back against whatever vertical "
             "surface the reference setting offers — a wall, a door "
             "frame, a railing — read out of the photograph, not "
             "invented. Shoulder blades and hips touching it, one "
             "foot flat against it so the knee comes forward, chin "
             "dropped slightly, eyes up to the lens.",
        камера="50mm at f/2, three-quarter length, lens at chest "
               "height and square to the surface she leans on."),
]

ДРУГОЕ_МЕСТО = [
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

    # Владелец переименовал эту кнопку в «Школу», а промпт остался про
    # кабинет с кожаным креслом и жалюзи — кнопка обещала одно, модель
    # рисовала другое. Обстановка переписана под класс: названия кнопок
    # его, а место, свет и объектив мои, и расходиться им нельзя.
    _СЦ_ФОТО("sc_office", "Школа",
        "Пустой класс после уроков, свет из окон", место="школьный класс",
        обстановка="An empty classroom after the school day has ended. "
                   "Rows of plain wooden desks with chairs pushed in, a "
                   "large dark green chalkboard along one wall with "
                   "faint chalk traces left on it, a teacher's desk in "
                   "front of it, tall windows down the opposite side. "
                   "The room is empty of other people.",
        поза="Seated sideways on the teacher's desk at the front of the "
             "room, or leaning back against its edge — read the space "
             "and choose one. Weight settled on one hip, spine long, "
             "head turned toward the lens.",
        свет="Late afternoon sun coming in low and warm through the tall "
             "windows, throwing long window-shaped rectangles across the "
             "floor and the desks. Those rectangles must bend over "
             "whatever they fall on rather than staying flat. The far "
             "side of the room stays in cool shadow.",
        камера="50mm at f/2.8, three-quarter length, camera at standing "
               "eye height, angled down the room so the rows of desks "
               "recede and give the frame depth."),

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
]


# ---------------------------------------------------------------------
# РАЗДЕЛ 2: ВИДЕО
# ---------------------------------------------------------------------

СОЛО = [
    # Разложено по РАКУРСУ И ДВИЖЕНИЮ КАМЕРЫ, а не по действию. Так
    # устроен и каталог конкурента, просто он этого не говорит: восемь
    # его кнопок на одно действие — это одно действие и восемь ракурсов,
    # написанных восемью отдельными текстами.
    #
    # У нас ракурс, свет и объектив собираются кодом, а что происходит в
    # кадре, владелец пишет один раз на сценарий. Те же восемь вариантов
    # без восьми текстов.
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
]


# ---------------------------------------------------------------------
# ПАРЫ
#
# Три состава (МЖ, ЖЖ, ММ) и одинаковая геометрия внутри каждого.
# Написано генератором, а не тридцатью кусками текста: расстановка «один
# позади другого» не зависит от состава, а состав не зависит от
# расстановки. Развернуть это в восемнадцать отдельных сценариев значило
# бы восемнадцать раз править одну и ту же фразу про перспективу.
#
# ПРЕДЕЛ, КОТОРЫЙ СТОИТ ЗНАТЬ ЗАРАНЕЕ: узел `TextEncodeQwenImageEditPlus`
# берёт `image1..image3` БЕЗ подписей ролей — сказать «на первом снимке
# он, на втором она» технически нечем. Слова «first reference» в промпте
# — единственная зацепка, и работает она через раз. Поэтому в тексте
# упор на то, что людей РОВНО ДВОЕ и они РАЗНЫЕ: слипание двух лиц в
# одно — брак дороже перепутанного порядка. Подробно — prompts.ТЕЛО_ПАРА.
# ---------------------------------------------------------------------

СОСТАВЫ = [
    ("mf", "Пара МЖ", "мужчина и женщина",
     "The person from the first reference is a man; the person from "
     "the second reference is a woman."),
    ("ff", "Пара ЖЖ", "две женщины",
     "Both people are women, one from each reference. They must stay "
     "two clearly different women — different faces, different hair, "
     "different bodies."),
    ("mm", "Пара ММ", "двое мужчин",
     "Both people are men, one from each reference. They must stay "
     "two clearly different men — different faces, different hair, "
     "different bodies."),
]

# Геометрия пары: как двое стоят друг к другу и откуда на это смотрят.
# Ровно тот слой, который собирается кодом.
РАССТАНОВКИ = [
    ("near", "Рядом", "Двое рядом, камера напротив",
     dict(поза="The two of them side by side and touching along the "
               "length of the body, shoulders and hips in contact, "
               "the nearer one half a step forward so neither is "
               "hidden behind the other. Both heads turned toward "
               "the lens.",
          камера="50mm at f/2.8, square to the pair, lens at chest "
                 "height, framed from mid-thigh up with both faces "
                 "fully in frame.")),

    ("face", "Лицом к лицу", "Друг напротив друга, профили",
     dict(поза="The two of them facing each other closely, a hand's "
               "width between them, foreheads at the same height, "
               "each looking at the other rather than at the camera. "
               "Hands in contact where the scenario says so.",
          камера="85mm at f/2, square to the line between them so "
                 "both read in profile. Lens at their eye level, "
                 "framed from the waist up.",
          свет="A single source behind and between them, so the two "
               "profiles are drawn as bright contours against a "
               "darker background and the gap between the faces is "
               "the brightest part of the frame.")),

    ("behind", "Один позади", "Второй сзади, оба к камере",
     dict(поза="One of them in front, the other directly behind and "
               "pressed close along the back, chest to back, the "
               "rear one's chin near the front one's shoulder. Both "
               "faces visible: the front one to the lens, the rear "
               "one turned out from behind the shoulder so it is not "
               "hidden. The rear one's arms come around the front "
               "one where the scenario says so.",
          камера="50mm at f/2.8, square to them, lens at chest "
                 "height, framed from mid-thigh up.")),

    ("above", "Сверху", "Съёмка с высокой точки",
     dict(поза="The two of them arranged horizontally across the "
               "frame, heads at the same end, bodies close and in "
               "contact along their length, both faces turned up "
               "toward the lens.",
          камера="35mm at f/2.8, directly above them and square to "
                 "the line of the bodies, roughly two metres up, "
                 "held level. Both people fully inside the frame.",
          свет="An overhead source just behind the camera so the "
               "light and the lens agree and neither figure throws a "
               "shadow across the other's face.")),

    ("close", "Крупный план", "Два лица во весь кадр",
     dict(поза="Framed so tightly that the two faces fill the frame "
               "and little else is visible. The heads are close, "
               "tilted opposite ways so the features do not collide, "
               "both fully readable.",
          камера="85mm at f/2, very close, lens at their eye level. "
                 "Focus on the nearer eye of the nearer person, the "
                 "second face still clearly resolved.",
          ещё="At this framing the risk is that the two faces drift "
              "toward each other and become one. They must remain "
              "two distinct people with different features, "
              "different skin tone and different hair, sharp enough "
              "to tell apart at a glance.")),

    ("pov", "От первого лица", "Камера на месте одного из двоих",
     dict(поза="The camera occupies the position of one of the two "
               "people: that person is seen only as the arms, hands "
               "and occasionally the chest entering the frame from "
               "below and from the sides, never their face. The "
               "other person is fully in frame and looks into the "
               "lens.",
          камера="28mm wide at head height with a slight hand-held "
                 "drift, so the hands entering the bottom of the "
                 "frame read at natural size and the viewer is in "
                 "the room rather than watching it.",
          ещё="Only the visible person's face is built from a "
              "reference. The hands and arms in the foreground must "
              "still be anatomically perfect — five fingers, correct "
              "thumb, believable length — because they are the "
              "closest thing to the lens and the first place the eye "
              "checks.")),
]


def _пара(состав_key, состав_рус, состав_англ, расст_key, title, подпись, поля):
    ключ = f"pr_{состав_key}_{расст_key}"
    поля = dict(поля)
    # Состав дописывается в «ещё», а не подменяет поля сценария:
    # расстановка одинакова для всех троих, и смешивать её с составом
    # значило бы держать одну и ту же геометрию в трёх экземплярах.
    поля["ещё"] = "\n\n".join(x for x in (состав_англ, поля.get("ещё", "")) if x)
    return Scene(ключ, title, "i2v_5", Блок(**поля), подпись,
                 пара=состав_рус, фото_нужно=(2, 2), расстановка=расст_key)


ПАРЫ = {
    ключ: [_пара(ключ, рус, англ, rk, rt, rp, поля)
           for rk, rt, rp, поля in РАССТАНОВКИ]
    for ключ, _title, рус, англ in СОСТАВЫ
}


# ---------------------------------------------------------------------
# ДЕРЕВО
# ---------------------------------------------------------------------

РАЗДЕЛЫ = [
    Раздел(
        "undress", "Раздеть", "Твоё фото, без одежды",
        иконка="СТРИНГИ",
        подразделы=[
            Подраздел("un_here", "Где сняли",
                      "Та же обстановка, что на твоём фото", ГДЕ_СНЯЛИ),
            Подраздел("un_place", "Другое место",
                      "Перенести в другую обстановку", ДРУГОЕ_МЕСТО),
        ]),

    Раздел(
        "video", "Видео", "Фото начинает двигаться",
        иконка="ЭФИР",
        подразделы=[
            Подраздел("vi_solo", "Соло", "Одна героиня", СОЛО),
        ] + [
            Подраздел(f"vi_{k}", t, f"Двое: {r}. Нужны два фото — по "
                                   f"снимку на человека", ПАРЫ[k])
            for k, t, r, _ in СОСТАВЫ
        ]),

    Раздел(
        "own", "Свой промпт", "Опиши сам, что сделать",
        иконка="НОУТ", свободный=True,
        подразделы=[
            Подраздел("own_photo", "Фото", "Референс и описание — выйдет фото",
                      []),
            Подраздел("own_video", "Видео",
                      "Референс и описание — выйдет ролик", []),
        ]),
]

# «Со звуком» из дерева убрано вместе со снятием вида с продажи:
# реализации нет, см. большой комментарий в pricing.py. Сценарии
# удалены, а не спрятаны — возвращать их придётся вместе с моделью
# липсинка, и переписывать под неё всё равно с нуля.

# Что означает подраздел «Свой промпт»: какой вид генерации запускать.
# Видео здесь ВСЕГДА двухшаговое (сперва фото, потом ролик по нему) —
# требование владельца и единственный способ отдать раздетый ролик, см.
# Scene.prompt_фото.
СВОБОДНЫЕ = {"own_photo": "i2i", "own_video": "i2v_5"}

# Плоские списки для кода, который писался на двух уровнях.
CATEGORIES = [п for р in РАЗДЕЛЫ for п in р.подразделы]

# Подразделы, у которых вообще есть варианты. Это УСТРОЙСТВО каталога,
# а не то, что видно человеку: спрятанное владельцем сюда не входит,
# потому что оно меняется на ходу и списком быть не может. Живую
# видимость спрашивают у самих объектов — `пустой`, `видимые`.
С_ВАРИАНТАМИ = [п for п in CATEGORIES if п.scenes]
ВИДИМЫЕ = С_ВАРИАНТАМИ          # прежнее имя, чтобы не ломать вызовы

_ПО_КЛЮЧУ = {s.key: s for п in CATEGORIES for s in п.scenes}
_ПОДРАЗДЕЛЫ = {п.key: п for п in CATEGORIES}
_РАЗДЕЛЫ = {р.key: р for р in РАЗДЕЛЫ}


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
    """Подраздел-обёртка. Ведёт себя как обычный, но список сценариев
    берётся из базы и меняется сам."""

    key = "top"
    title = "Популярное"
    подзаголовок = "Что чаще всего заказывают"
    иконка = "ОГОНЬ"
    раздел = None

    def __init__(self, scenes):
        self.scenes = scenes

    назв = Подраздел.назв
    подзаг = Подраздел.подзаг

    def button(self, яз="ru"):
        return f"{self.назв(яз)} · {len(self.scenes)}"


def популярная_категория(store, сколько=ПОПУЛЯРНЫХ):
    """Собирает «Популярное» по статистике. Нет данных — вернёт None, и
    категория просто не появится в меню.

    Спрятанное владельцем отсюда вычищается: «Популярное» считается по
    прошлым заказам, и убранный вчера сценарий иначе остался бы в нём
    ещё месяц — на самом видном месте меню.
    """
    try:
        верх = store.популярное(сколько)
    except Exception:
        return None
    сцены = [_ПО_КЛЮЧУ[к] for к, _ in верх
             if к in _ПО_КЛЮЧУ and not _ПО_КЛЮЧУ[к].скрыт]
    return Популярное(сцены) if сцены else None


def scene(key):
    if key not in _ПО_КЛЮЧУ:
        raise KeyError(f"неизвестный сценарий: {key}")
    return _ПО_КЛЮЧУ[key]


def category(key):
    if key not in _ПОДРАЗДЕЛЫ:
        raise KeyError(f"неизвестный подраздел: {key}")
    return _ПОДРАЗДЕЛЫ[key]


def раздел(key):
    if key not in _РАЗДЕЛЫ:
        raise KeyError(f"неизвестный раздел: {key}")
    return _РАЗДЕЛЫ[key]


def все_сценарии():
    return list(_ПО_КЛЮЧУ.values())


def дерево():
    """Каталог в виде обычных словарей — для страницы редактирования.

    Отдаёт и умолчания кода, и текущие правки владельца, раздельно:
    страница показывает умолчание бледным, поверх него своё значение, и
    пустое поле означает «вернуть как было», а не «стереть название».
    """
    п = правки()

    def сцена(s):
        своё = п.get(s.key) or {}
        # Умолчания отдаются на обоих языках: страница ставит их
        # подсказкой в пустое поле, и владелец видит, что получит
        # клиент, если он ничего не впишет.
        англ = (язык.СЦЕНАРИИ_EN.get(s.key)
                or язык.РАССТАНОВКИ_EN.get(s.расстановка) or ("", ""))
        return {
            "ключ": s.key,
            "название_по_умолчанию": s._title,
            "название_en_по_умолчанию": англ[0],
            "название": своё.get("название", ""),
            "название_en": своё.get("название_en", ""),
            "подпись": s.подпись,
            "место": s.место if s.своё_место else "",
            "пара": s.пара,
            "коины": s.coins,
            "фото": list(s.фото_нужно),
            "строка": своё.get("строка", ""),
            "строка_рус": своё.get("строка_рус", ""),
            "скрыт": скрыт(s.key),
            "промпт_длина": len(s.prompt),
        }

    разделы = []
    for р in РАЗДЕЛЫ:
        разделы.append({
            "ключ": р.key, "название": р.title,
            "название_en": р.назв("en"),
            "подзаголовок": р.подзаголовок, "свободный": р.свободный,
            "скрыт": скрыт(р.key),
            "подразделы": [
                {"ключ": под.key, "название": под.title,
                 "название_en": под.назв("en"),
                 "подзаголовок": под.подзаголовок,
                 "скрыт": скрыт(под.key),
                 "варианты": [сцена(s) for s in под.scenes]}
                for под in р.подразделы
            ],
        })
    return {
        "разделы": разделы,
        "обязательное": {
            "ключ": prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ,
            "строка": (п.get(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ) or {}).get("строка", ""),
            "строка_рус": (п.get(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ) or {}).get("строка_рус", ""),
            "по_умолчанию": prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ,
            "по_умолчанию_рус": prompts.ОБЯЗАТЕЛЬНОЕ_РУС,
        },
        "всего": len(_ПО_КЛЮЧУ),
        "наполнено": sum(1 for s in _ПО_КЛЮЧУ.values() if s.наполнен),
        "видно": sum(1 for s in _ПО_КЛЮЧУ.values() if not s.скрыт),
    }


def известные_ключи():
    """Что страница вправе править. Всё остальное в присланном JSON
    отбрасывается: правка приходит из браузера, и принимать оттуда
    произвольные ключи означало бы складывать в файл что угодно.

    Разделы и подразделы тоже здесь: им правится `скрыт`.
    """
    return (set(_ПО_КЛЮЧУ) | set(_ПОДРАЗДЕЛЫ) | set(_РАЗДЕЛЫ)
            | {prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ})


def что_то_осталось(проба=None):
    """Хоть один вариант в боте виден.

    Проверка перед сохранением: спрятать всё до последнего — это бот с
    пустым меню и без единой кнопки, за которую платят. Ошибиться так
    легко (жмёшь «убрать» подряд), а заметить трудно: страница-то
    выглядит полной, скрытые пункты на ней остаются.

    `проба` — ещё не сохранённые правки: считаем по ним, а не по файлу.
    """
    старое = None
    try:
        if проба is not None:
            старое = dict(правки())
            подставить(проба)
        return any(not s.скрыт for s in _ПО_КЛЮЧУ.values())
    finally:
        if проба is not None:
            подставить(старое)
