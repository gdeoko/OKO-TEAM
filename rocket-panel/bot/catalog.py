"""Каталог сценариев. Второй по важности файл после цен.

## Почему каталог, а не окно ввода

Разбор конкурента 20.09.2026 показал главное: его продукт — не поле для
промпта, а КАТАЛОГ готовых сценариев по категориям. Человек ничего не
пишет, он тыкает кнопку. Свободный промпт у него заперт за подпиской и
продаётся как апгрейд.

Мы строили промпт-первый интерфейс, и это была ошибка: описывать сцену
словами умеет меньшинство, а платят все.

## Дерево (решение владельца 21.09.2026)

    РАЗДЕТЬ (фото)   -> Соло      -> Раздевание · Интим
                     -> Групповое -> МЖ пара · ЖЖ лесби
    ВИДЕО            -> Соло
                     -> Групповое -> МЖ пара · ЖЖ лесби
    СВОЙ ПРОМПТ      -> Фото · Видео

«ММ геи» собраны и лежат в коде, но в боте не показываются — см.
`СНЯТО_ПО_УМОЛЧАНИЮ`.

Уровней четыре, и глубина неровная: у «Видео · Соло» варианты лежат на
третьем, у «Группового» на четвёртом. Поэтому узел дерева один и тот же
класс `Узел`: у него либо дети, либо сценарии. Городить отдельные
«раздел» и «подраздел» с жёсткой глубиной — значит переписывать
навигацию при каждой правке дерева, а дерево за сутки менялось трижды.

## Один текст — две цены

Строку владельца пишут один раз, а работает она дважды: в «Видео ·
Соло» роликом за 5 коинов и в «Раздеть · Соло · Интим» фотографией за 1.
Фото-вариант — ЗЕРКАЛО видео-варианта: он берёт у него название и
откровенную строку (`ключ_правок`), а свой у него только технический
блок — камера у фотографии и у ролика разные, и копировать «медленный
наезд на весь ролик» в неподвижный кадр нельзя.

Поэтому на странице каталога зеркала не показываются: это была бы та же
строка вторым экземпляром, и правка в одной копии расходилась бы с
другой.

## Место — не сценарий, а добавка

См. `места.py`. Обстановка выбирается к ЛЮБОМУ варианту и подставляется
в промпт, только если человек хочет фон не такой, как на его снимке.

## Два слоя и два хозяина

  * КОД держит то, что делает кадр рабочим: соответствие референсу,
    кожу, анатомию, поведение ткани, свет, объектив, композицию,
    запреты.
  * ВЛАДЕЛЕЦ держит название кнопки и то, что происходит в кадре.

Второй слой лежит в `каталог.json` (см. `данные.py`) и правится
страницей в браузере. Именно поэтому название и промпт здесь —
СВОЙСТВА, а не поля: файл меняется на ходу, и застывший в памяти
каталог означал бы, что правка доезжает до бота только перезапуском.
"""

import os
import time

import данные
import места
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
# сотне раз на отрисовку меню — не смертельно, но бессмысленно.
# ---------------------------------------------------------------------

_КЭШ = {"проверено": 0.0, "метка": None, "правки": {}}
_ИНТЕРВАЛ = 1.0

# Разовый переезд со старого `ОТКРОВЕННОЕ.txt` — временного решения,
# жившего один день.
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
    после записи — там ждать секунду незачем.

    Метка сбрасывается в объект, которого не бывает у файла, а не в
    None: у ПРОПАВШЕГО файла метка тоже None, и сброс в None означал
    «ничего не изменилось» — старые правки оставались в памяти после
    того, как файл убрали из-под ног.
    """
    _КЭШ["проверено"] = 0.0
    _КЭШ["метка"] = object()
    return правки()


def подставить(новые):
    """Подменить правки в памяти, не трогая файл. Для тестов и для
    проверки перед сохранением; `перечитать()` возвращает всё к файлу."""
    _КЭШ["правки"] = dict(новые or {})
    _КЭШ["метка"] = "подставлено"
    _КЭШ["проверено"] = float("inf")
    return _КЭШ["правки"]


def правка(ключ, поле):
    return (правки().get(ключ) or {}).get(поле, "")


# УБРАНО РЕШЕНИЕМ ВЛАДЕЛЬЦА, а не спрятано им на странице.
#
# «ММ геи» сняты 21.09.2026: «Я не против голубых, мне лично всё равно
# на них. Но это может тригернуть обычного пользователя». ЖЖ при этом
# остаются — «ЖЖ нравится многим».
#
# Не удалены из кода, а спрятаны тем же способом, что и прочее убранное:
# сценарии живут, ключи резолвятся, старые кнопки из переписки вежливо
# отвечают «этого больше нет», а на странице каталога рядом стоит
# «Вернуть». Передумает — одно нажатие, а не новая выкладка.
СНЯТО_ПО_УМОЛЧАНИЮ = {"un_mm", "vi_mm"}


def скрыт(ключ):
    """Убран из бота. Одно поле на все уровни: у узлов, сценариев и мест
    ключи разные и не пересекаются.

    Правка владельца сильнее умолчания в обе стороны: снятое по
    умолчанию он может вернуть со страницы, а не только спрятать ещё.
    """
    своё = правка(ключ, "скрыт")
    if своё:
        # «1» — убрал, «0» — вернул. Пустое поле это НЕ «вернул»: так
        # выглядит пункт, о котором владелец ничего не говорил, и у
        # части пунктов умолчание кода — «убран».
        return своё == "1"
    return ключ in СНЯТО_ПО_УМОЛЧАНИЮ


def имя(ключ, своё, своё_en, яз):
    """Название с правкой владельца поверх умолчания кода.

    Порядок один и тот же везде: правка на нужном языке, потом
    умолчание кода на нём же, потом русское. Пустой кнопки не бывает
    ни при каком раскладе — лучше не тот язык, чем пустой
    прямоугольник.
    """
    if язык.нормальный(яз) == "en":
        return правка(ключ, "название_en") or своё_en or правка(ключ, "название") or своё
    return правка(ключ, "название") or своё


def обязательная_строка(пара=False):
    """Строка «человек голый, сцена интимная» — она дописывается к
    КАЖДОМУ промпту: и к своему (см. `prompts.свой`), и к любому
    варианту каталога (см. `Scene.промпт`).

    Владелец правит её на странице каталога, отдельным полем сверху.

    Почему это оказалось нужно вариантам. Раньше строку получал только
    свой промпт, а варианты полагались на то, что откровенная строка
    владельца сама всё скажет. Она не говорит: «Снимает лифчик» —
    это действие, а не состояние, и модель 21.09.2026 отдала девушку в
    белье. Формально она выполнила написанное. Заплачено было за другое.
    """
    своя = правка(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ, "строка")
    if своя:
        return своя
    # У пары строка своя, во множественном числе: единственное число
    # рядом с двумя людьми модель понимает буквально и раздевает
    # одного. См. `prompts.ОБЯЗАТЕЛЬНОЕ_ПАРА`.
    return prompts.ОБЯЗАТЕЛЬНОЕ_ПАРА if пара \
        else prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ


# ---------------------------------------------------------------------
# МЕСТА
#
# Живут в `места.py`, а здесь — только видимость и названия: они
# правятся владельцем тем же файлом и по тем же правилам, что кнопки.
# ---------------------------------------------------------------------

def порядок_фото(sc, яз="ru"):
    """Кому из двоих идти первым снимком, человеку на экран.

    Узел `TextEncodeQwenImageEditPlus` берёт снимки БЕЗ подписей ролей:
    сказать модели «на первом он, на втором она» нечем, единственная
    зацепка — слова «first reference» в промпте. Значит, порядок должен
    соблюсти человек, и ему надо об этом сказать прямо.

    Прогон 22.09.2026 поймал это на нас самих: в парные сцены МЖ ушёл
    сперва женский снимок при промпте «первый — мужчина», и модель
    вернула двух женщин.

    У ЖЖ и ММ порядок не значит ничего — там оба одного пола.
    """
    if not sc.пара:
        return ""
    состав = sc.key.split("_")[1]
    ключ = "фото.порядок_мж" if состав == "mf" else "фото.порядок_равный"
    return язык.t(ключ, яз)


def место_назв(м, яз="ru"):
    return имя(м.key, м.title, язык.МЕСТА_КНОПКИ_EN.get(м.key, ("", ""))[0], яз)


def место_подпись(м, яз="ru"):
    свои = язык.МЕСТА_КНОПКИ_EN.get(м.key)
    return свои[1] if (язык.нормальный(яз) == "en" and свои) else м.подпись


def видимые_места():
    """«Как на твоём фото» первым и всегда: это не место, а отказ от
    него, и спрятать его значило бы заставить платить за выдуманный фон
    того, кому нужна своя комната."""
    return [места.КАК_НА_ФОТО] + [м for м in места.ВСЕ if not скрыт(м.key)]


class Scene:
    """Готовый сценарий: что покажем человеку и что отправим модели.

    Название, откровенная строка и промпт — свойства, а не поля: см.
    «Два слоя и два хозяина» в шапке файла.
    """

    def __init__(self, key, title, job, блок, подпись="", фон="новый",
                 пара="", фото_нужно=None, расстановка="", зеркало=""):
        self.key = key
        self._title = title           # умолчание; владелец перебивает
        self.расстановка = расстановка  # ключ геометрии у парных сцен
        self.job = job                # ключ из pricing.JOBS — отсюда цена
        # `фон` — откуда берётся обстановка, когда место не выбрано:
        #   "референс" — та же, что на присланном фото;
        #   "новый"    — сочиняем с нуля.
        self.фон = фон
        # Непустое — в кадре ДВОЕ и референсов двое. Строка описывает
        # состав по-русски («мужчина и женщина»), человеку на экран.
        self.пара = пара
        self._фото_нужно = фото_нужно
        self.блок = блок
        self.подпись = подпись        # строка под названием в боте
        self.узел = None              # проставляется при сборке дерева
        # ЗЕРКАЛО. Непустое — правки владельца берутся у другого
        # сценария: название, откровенная строка, подпись. Так одна
        # написанная строка работает и фотографией, и роликом, а
        # владелец пишет её ОДИН раз. Своё у зеркала только техническое
        # — камера у фотографии и у ролика разные.
        self.зеркало = зеркало

    @property
    def negative(self):
        """Негатив выводится из собранного промпта: см. `prompts.негатив`."""
        return prompts.негатив(self.prompt_фото())

    @property
    def ключ_правок(self):
        return self.зеркало or self.key

    # ---------- то, что правит владелец ----------

    def назв(self, яз="ru"):
        англ = (язык.СЦЕНАРИИ_EN.get(self.ключ_правок)
                or язык.РАССТАНОВКИ_EN.get(self.расстановка) or ("", ""))
        return имя(self.ключ_правок, self._title, англ[0], яз)

    @property
    def title(self):
        """Русское название. Для страницы каталога и тестов — там язык
        всегда один."""
        return self.назв("ru")

    def подп(self, яз="ru"):
        if язык.нормальный(яз) == "en":
            свои = (язык.СЦЕНАРИИ_EN.get(self.ключ_правок)
                    or язык.РАССТАНОВКИ_EN.get(self.расстановка))
            if свои:
                return свои[1]
        return self.подпись

    def состав(self, яз="ru"):
        if язык.нормальный(яз) == "en":
            return язык.СОСТАВЫ_EN.get(self.пара, self.пара)
        return self.пара

    @property
    def состав_коротко(self):
        """«МЖ», «ЖЖ», «ММ» — для списка, где имена совпали."""
        return {"mf": "МЖ", "ff": "ЖЖ", "mm": "ММ"}.get(
            self.key.split("_")[1] if self.пара else "", "")

    @property
    def откровенное(self):
        """Английская строка для модели. В блоке она сильнее файла: так
        сборку можно проверить тестом, не трогая данные."""
        return self.блок.откровенное or правка(self.ключ_правок, "строка")

    def действие(self, яз="ru"):
        """Что происходит — человеку на экран сценария, до оплаты.

        Английскому клиенту показывается та же строка, что уходит
        модели: владелец пишет её в любом случае, и она описывает ровно
        то же самое.
        """
        if язык.нормальный(яз) == "en":
            return self.откровенное
        return правка(self.ключ_правок, "строка_рус")

    @property
    def наполнен(self):
        return bool(self.откровенное)

    @property
    def скрыт(self):
        """Убран владельцем — сам, вместе со своим оригиналом или вместе
        с узлом дерева.

        Наследование обязательно: иначе спрятанный подраздел исчезал бы
        из меню, но его сценарии оставались бы в «Популярном» и
        открывались по старым кнопкам из переписки.
        """
        if скрыт(self.ключ_правок):
            return True
        return bool(self.узел and self.узел.скрыт)

    # ---------- промпт ----------

    def промпт(self, вид=None, место=None, сложение=None):
        """Полный текст модели. `место` — добавка обстановки."""
        вид = вид or self.job
        блок = Блок(**{п: getattr(self.блок, п) for п in Блок.__slots__})
        # Откровенная строка владельца ПЛЮС обязательная — ровно в том
        # же слоте и в том же порядке, что и у своего промпта: вторым
        # блоком, сразу за сохранением лица. В конец её уносить нельзя,
        # там она проигрывает обстановке и свету и кадр выходит одетым.
        блок.откровенное = "\n\n".join(
            x for x in (self.откровенное,
                        обязательная_строка(пара=bool(self.пара))) if x)
        # Фон референса имеет смысл только для одиночной сцены без
        # выбранного места: у пары второй человек всё равно приходит со
        # своего снимка, и «сохрани ту же комнату» превращается в
        # противоречие.
        фон = self.фон if not self.пара else "новый"
        if место is not None and not место.референс:
            # Место задаёт ОБСТАНОВКУ и СВЕТ и не трогает позу с
            # объективом: их задал вариант, и перебить их значило бы
            # превратить «Крупный план в душе» в просто «душ».
            блок.обстановка = место.обстановка
            блок.свет = место.свет or блок.свет
            блок.место_кратко = место.кратко
            if место.ещё:
                блок.ещё = "\n\n".join(x for x in (блок.ещё, место.ещё) if x)
            фон = "новый"
        # У сцены из двух мужчин про сложение не говорим ничего:
        # см. `prompts.собрать`.
        if self.пара and self.key.split("_")[1] == "mm":
            сложение = ""
        return prompts.собрать(вид, блок, фон=фон, пара=bool(self.пара),
                               сложение=сложение,
                               # Своя строка — это та, что НАПИСАЛ
                               # владелец, а не служебная про наготу,
                               # которую каталог подклеивает всегда.
                               своя_строка=bool(self.откровенное),
                               состав=(self.key.split("_")[1]
                                       if self.пара else "mf"))

    def фон_с_референса(self, место=None):
        """Обстановку берём с присланного снимка, а не сочиняем?

        Тот же расчёт, что и в `промпт`, но нужен он не промпту, а карте:
        от него зависит `denoise` (см. `gpu/panel.py`). Текст «сохрани ту
        же комнату» модель слушает вполуха — держит комнату стартовый
        латент, а его мы гасим ровно настолько, насколько не жалко.
        """
        if self.пара:
            return False
        if место is not None and not место.референс:
            return False
        return self.фон == "референс"

    @property
    def prompt(self):
        """Промпт под основной вид работы, без выбранного места."""
        return self.промпт()

    def prompt_фото(self, место=None, сложение=None):
        """Промпт для фото-шага у видео-сценариев.

        Ролик начинается с КАДРА, и раздеть человека видео не умеет:
        `start_image` в панели — буквально первый кадр, а не подсказка.
        Поэтому видео у нас считается в два прохода. См. `bot.run_job`.
        """
        return self.промпт("i2i", место, сложение)

    # ---------- цена и вход ----------

    @property
    def coins(self):
        return pricing.job(self.job).coins

    @property
    def фото_нужно(self):
        """Сколько снимков просить. Обычно берётся из прайса — это
        свойство модели. Пара перебивает: ей нужно ровно два, по снимку
        на человека."""
        return self._фото_нужно or pricing.job(self.job).фото_нужно

    @property
    def двухшаговый(self):
        """Ролик собирается через промежуточное фото. Всегда, кроме
        кнопки «Оживить это»: там кадр уже наш и уже раздет."""
        return prompts.семейство(self.job) == "i2v"

    def button(self, яз="ru", уточнить=False):
        """Подпись кнопки — ТОЛЬКО НАЗВАНИЕ.

        Цена отсюда убрана владельцем 21.09.2026. Раньше к каждому
        варианту дописывалось «· 1 💞», и на экране из тринадцати
        вариантов один и тот же хвостик повторялся тринадцать раз: в
        подразделе вид работы один, а значит и цена одна. Она названа
        один раз строкой над списком (`ui.текст_узла`) и ещё раз на
        экране самого варианта, до оплаты.

        `уточнить` — в списке нашлось другое имя, совпадающее с этим.
        Так бывает в «Групповом»: владелец назвал «69» и у МЖ, и у ЖЖ,
        и у ММ. Молча показать три одинаковые кнопки нельзя, а
        переименовывать за него — тем более, поэтому к имени
        приписывается состав.
        """
        имя_ = self.назв(яз)
        if уточнить and self.состав_коротко:
            имя_ = f"{имя_} · {self.состав_коротко}"
        return имя_


class Узел:
    """Ветка меню. Либо дети, либо сценарии — не то и другое сразу.

    Один класс на все уровни: дерево неровное (у «Соло» внутри ещё
    разбивка, у «Группового» нет), и жёсткие «раздел/подраздел»
    пришлось бы переписывать при каждой правке структуры.
    """

    def __init__(self, key, title, подзаголовок, дети=(), scenes=(),
                 иконка="", свободный=False, вид=""):
        self.key = key
        self._title = title
        self.подзаголовок = подзаголовок
        self.дети = list(дети)
        self.scenes = list(scenes)
        self.иконка = иконка          # премиум-эмодзи, см. emoji.py
        # «Свой промпт» устроен иначе: внутри не сценарии, а режимы —
        # человек приносит референс и пишет описание сам.
        self.свободный = свободный
        self.вид = вид                # ключ pricing.JOBS у свободного узла
        self.родитель = None
        for д in self.дети:
            д.родитель = self
        for s in self.scenes:
            s.узел = self

    # ---------- названия ----------

    def назв(self, яз="ru"):
        англ = язык.УЗЛЫ_EN.get(self.key, ("", ""))
        return имя(self.key, self._title, англ[0], яз)

    @property
    def title(self):
        return self.назв("ru")

    def подзаг(self, яз="ru"):
        англ = язык.УЗЛЫ_EN.get(self.key)
        return англ[1] if (язык.нормальный(яз) == "en" and англ) else self.подзаголовок

    # ---------- видимость ----------

    @property
    def скрыт(self):
        return скрыт(self.key) or bool(self.родитель and self.родитель.скрыт)

    @property
    def видимые_дети(self):
        return [д for д in self.дети if not д.пустой]

    @property
    def видимые(self):
        return [s for s in self.scenes if not s.скрыт]

    @property
    def пустой(self):
        """Скрыт сам, или внутри не осталось ничего.

        Кнопка, ведущая в пустой список, — это нажатие впустую и назад.
        У «Своего промпта» вариантов нет по устройству, и пустым он от
        этого не становится.
        """
        if self.скрыт:
            return True
        if self.свободный:
            return False
        return not (self.видимые_дети or self.видимые)

    @property
    def все_сцены(self):
        return list(self.scenes) + [s for д in self.дети for s in д.все_сцены]

    def button(self, яз="ru"):
        n = len(self.видимые)
        return f"{self.назв(яз)} · {n}" if n else self.назв(яз)


# Прежние имена: код и тесты писались, когда уровней было два.
Раздел = Подраздел = Category = Узел




def _СЦ_РАЗДЕТЬ(key, title, подпись, **поля):
    """«Раздевание» — по умолчанию ТА ЖЕ обстановка, что на снимке.

    Меняются только ракурс, план и одежда. Оговорка, которую стоит
    помнить: при смене ракурса фон не остаётся пиксель в пиксель —
    другой угол видит другую часть комнаты, и модель достраивает ту же
    комнату с новой точки. Похоже и узнаваемо, но не идентично.

    Выберет человек место — обстановка заменится на него, см.
    `Scene.промпт`.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, фон="референс")


def _СЦ_ОЖИВИТЬ(key, title, подпись, **поля):
    """Ролик — и ТОЖЕ в той обстановке, что на снимке.

    Раньше здесь стоял фон по умолчанию («сочиняем с нуля»), и это была
    ошибка: ролик считается двумя проходами, первый из них — обычная
    фотография по референсу (`prompt_фото`), и место ей задаёт этот
    самый признак. Человек прислал снимок, места не выбирал — а
    возвращался ролик в чужом помещении. Владелец поймал это
    21.09.2026: «фон не выбрал, а она поменяла очень сильно, вообще в
    помещении сделала».

    На сам видео-проход признак не влияет: там кадр уже наш и
    обстановка в нём уже правильная.
    """
    return Scene(key, title, "i2v_5", Блок(**поля), подпись, фон="референс")


def _ФОТО_ЗЕРКАЛО(key, зеркало, title, подпись, **поля):
    """Фотография по тексту, написанному для ролика.

    Название и откровенную строку берёт у `зеркало`; своё здесь только
    техническое. Копировать технический блок ролика нельзя: «медленный
    наезд на весь клип» в неподвижном кадре — мусор, а «замедленно» не
    значит ничего.
    """
    return Scene(key, title, "i2i", Блок(**поля), подпись, фон="референс",
                 зеркало=зеркало)


# ---------------------------------------------------------------------
# РАЗДЕТЬ · СОЛО · РАЗДЕВАНИЕ
#
# Только РАКУРС, ПЛАН И ПОЗА — они работают в любой обстановке. Мебель
# здесь называть нельзя: по умолчанию место берётся с присланного фото,
# а на нём может не быть ни кровати, ни зеркала. Всё, что требует
# конкретной комнаты, приходит выбором места (см. `места.py`).
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




# ---------------------------------------------------------------------
# РАЗДЕТЬ · СОЛО · ИНТИМ  —  фотографии по текстам, написанным для соло-роликов
#
# Ни одной новой строки от владельца: каждый вариант зеркалит свой
# ролик из «Видео · Соло» и берёт у него название и откровенную
# строку. Отличается только техническим блоком — у фотографии нет
# движения, и там, где у ролика был наезд или замедление, здесь просто
# другой кадр.
# ---------------------------------------------------------------------

ФОТО_ИНТИМ = [
    _ФОТО_ЗЕРКАЛО("ph_pov", "ac_pov", "От первого лица",
        "Камера на месте зрителя, руки в кадре",
        камера="Point-of-view: the camera IS the viewer's eyes, held at "
               "head height, 28mm wide so the hands entering the bottom "
               "of the frame read at natural size.",
        ещё="The hands and forearms in the foreground are the closest "
            "thing to the lens and the first place the eye checks: five "
            "fingers, correct thumb, believable length, skin matching "
            "the rest of the body."),

    _ФОТО_ЗЕРКАЛО("ph_close", "ac_close", "Крупный план",
        "Лицо и плечи во весь кадр",
        камера="85mm at f/2, tight on the face and shoulders, lens at "
               "eye level.",
        свет="A soft key close to the lens axis so the face stays open "
             "and readable, with just enough shadow to give the "
             "cheekbones and collarbones shape."),

    _ФОТО_ЗЕРКАЛО("ph_side", "ac_side", "Сбоку",
        "Профиль, силуэт читается по контуру",
        камера="50mm at f/2.8, square to her side so the whole body "
               "reads in profile. Camera at chest height.",
        свет="Strong backlight from behind her so the profile is drawn "
             "as a bright contour against a dark background, with only "
             "a weak fill from the front."),

    _ФОТО_ЗЕРКАЛО("ph_above", "ac_above", "Сверху",
        "Съёмка сверху вниз",
        камера="35mm looking down at roughly sixty degrees from above, "
               "held level.",
        свет="An overhead source just behind the camera, so the light "
             "and the lens agree and there are no shadows thrown toward "
             "the viewer."),

    _ФОТО_ЗЕРКАЛО("ph_below", "ac_below", "Снизу",
        "Съёмка с низкой точки",
        камера="35mm from just above floor level, tilted up. Low angles "
               "exaggerate: keep the focal length at 35mm and the "
               "distance honest so the body does not distort and the "
               "proportions stay those of the reference.",
        свет="A key from above and behind so the underside stays in "
             "shadow and the shoulders and jaw catch the light."),

    _ФОТО_ЗЕРКАЛО("ph_push", "ac_push", "Вплотную",
        "Очень близкий кадр",
        камера="85mm at f/1.8, very close — the frame holds little more "
               "than what the scene is about. Focus critically sharp on "
               "the nearest plane, falloff quick and natural."),

    _ФОТО_ЗЕРКАЛО("ph_pull", "ac_pull", "Общий план",
        "Весь кадр целиком, с обстановкой",
        камера="28mm at f/4, stepped back far enough that the whole "
               "body and a good part of the room are in frame. Camera "
               "at hip height so the proportions stay honest."),

    _ФОТО_ЗЕРКАЛО("ph_back", "ac_back", "Со спины",
        "Спина в кадре, взгляд через плечо",
        камера="85mm at f/2 from behind, framed from mid-back up.",
        поза="Back to the lens, head turned far enough over the "
             "shoulder that one eye and the line of the cheek are "
             "visible."),

    _ФОТО_ЗЕРКАЛО("ph_mirror", "ac_mirror", "В зеркале",
        "Отражение и спина одновременно",
        камера="50mm at f/2.8, off-axis so the lens never appears in "
               "the glass.",
        обстановка="A tall mirror filling most of the frame.",
        ещё="The mirror shows a TRUE reflection: same body, same pose, "
            "reversed correctly, lit from the same direction. "
            "Reflections are where identity usually breaks — the face "
            "in the glass must be the same face. No second person."),

    _ФОТО_ЗЕРКАЛО("ph_slow", "ac_slow", "Вблизи и мягко",
        "Тесный кадр, мягкий свет",
        камера="85mm at f/1.8, tight enough that small details fill the "
               "frame, lens at eye level.",
        свет="One large soft source close by, wrapping around the form "
             "so the shadows have no hard edge anywhere."),
]


# ---------------------------------------------------------------------
# ВИДЕО · СОЛО
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


def _пара(состав_key, состав_рус, состав_англ, расст_key, title, подпись,
          поля, вид="i2v_5", приставка="pr", зеркало=""):
    ключ = f"{приставка}_{состав_key}_{расст_key}"
    поля = dict(поля)
    # Состав дописывается в «ещё», а не подменяет поля сценария:
    # расстановка одинакова для всех троих, и смешивать её с составом
    # значило бы держать одну и ту же геометрию в трёх экземплярах.
    поля["ещё"] = "\n\n".join(x for x in (состав_англ, поля.get("ещё", "")) if x)
    жёстко = ЖЁСТКАЯ_ПОСТАНОВКА.get((состав_key, расст_key))
    if жёстко:
        поля["жёстко"] = жёстко
    if приставка == "pf":
        # У фотографии нет дрожания камеры и нет «в течение клипа».
        поля.pop("камера", None)
        поля["камера"] = КАМЕРА_ФОТО.get(расст_key, ПАРЫ_КАМЕРА_ФОТО)
    return Scene(ключ, title, вид, Блок(**поля), подпись,
                 пара=состав_рус, фото_нужно=(2, 2), расстановка=расст_key,
                 зеркало=зеркало)


# Объектив у парной ФОТОГРАФИИ. Один на все расстановки, кроме «от
# первого лица»: там камера стоит на месте одного из двоих, и это не
# выбор объектива, а точка съёмки.
ПАРЫ_КАМЕРА_ФОТО = (
    "50mm at f/2.8, square to the pair, lens at chest height, framed so "
    "both people are fully inside the frame with both faces readable. "
    "Focus on the nearer person's eye, the second face still clearly "
    "resolved."
)

# ЖЁСТКАЯ ПОСТАНОВКА ОТДЕЛЬНЫХ КНОПОК.
#
# Обычная парная сцена собирается из строки владельца плюс общая
# геометрия расстановки — и каждый раз выходит «что-то похожее».
# Там, где владелец отобрал конкретный кадр на живом прогоне и сказал
# «чтобы у всех был такой ракурс и поза», похожего мало: ракурс и поза
# вписываются дословно и уезжают в промпт сразу за актом.
#
# Ключ — состав плюс расстановка. Текст — тот самый, на котором кадр и
# вышел; переписывать его «покрасивее» нельзя: сборка чувствительна к
# каждому слову (проверено девятью кругами на «Раком» — стоило
# заменить «completely naked» на более сильную формулировку, и на
# мужчине три круга подряд возвращались серые шорты с референса).
ЖЁСТКАЯ_ПОСТАНОВКА = {
    # «Секс раком», МЖ. Отобрано владельцем 23.09.2026 (кадр
    # pRK9_rk9__777). Три его требования, все три здесь: рука не
    # закрывает место соединения, лицо мужчины в кадре, вход виден.
    ("mf", "near"): (
        # Текст слово в слово с прогона RK9, зерно 777 — включая
        # наготу обоих: в проверенном кадре она названа ЗДЕСЬ, а не
        # общим блоком ниже, и порядок слов сборка чувствует.
        "Camera at the side of the bed and TURNED TWENTY-FIVE DEGREES "
        "AROUND TOWARD HER BACK, low. Both of their heads are fully "
        "inside the frame. THE WOMAN is on all fours on the bed facing "
        "LEFT, her back arched and her bare buttocks raised toward the "
        "man; she is completely naked, her own nipples in plain view and "
        "nothing on her chest at all, and she looks back over "
        "her shoulder at the camera. THE MAN KNEELS UPRIGHT BEHIND "
        # «completely naked» и ничего больше. Замер 23.09.2026 по
        # восемь зёрен: эта дословная фраза — 6 кадров из 8 без
        # одежды; мои «усиления» («ничего на нём нет», «голые
        # бёдра», «голые ягодицы», веса в скобках) давали 2–4 из 8.
        # Шорты лезут с референса, и чем длиннее объяснение, тем
        # слабее утверждение.
        "HER, completely naked, HIS WHOLE FACE IS "
        "INSIDE THE FRAME and he "
        "is looking down at her. HER OWN VULVA IS SEEN FROM BEHIND "
        "between her open thighs AND HIS ERECT PENIS IS GOING INTO IT "
        "\u2014 a real grown man\u2019s penis, full adult size, made of his "
        "own bare skin and the same colour as his body, never an "
        "object \u2014 that place is at the CENTRE of the picture, open to "
        "the camera, with nothing in front of it. BOTH OF HIS HANDS "
        "ARE HIGH UP ON HER BACK, far away from her hips: one lies "
        "flat BETWEEN HER SHOULDER BLADES, the other holds her WAIST "
        "just under her ribs. Neither of his hands is on her buttocks, "
        "on her hips or anywhere near where their bodies join. BOTH OF "
        "HER ARMS run from her own shoulders to her two hands flat on "
        "the mattress under her chest."),

    # «Кунилингус», МЖ. Отобрано владельцем 23.09.2026 (кадр
    # pMP2_mp__33). Геометрия взята 1:1 у принятого кадра ЖЖ, как он и
    # просил: она полусидит на подушках слева, он лежит ничком между её
    # раздвинутыми бёдрами лицом у вульвы.
    #
    # Два места здесь нельзя трогать, оба выстраданы:
    #
    #   1. РУКИ МУЖЧИНЫ названы ВНУТРИ его же предложения, шестью
    #      словами. Отдельным предложением они тоже рисуются — но
    #      отодвигают «HIS WHOLE BACK IS BARE SKIN» за первую тысячу
    #      знаков, и с референса возвращаются серые шорты (два круга
    #      подряд, по восемь зёрен). Без рук вовсе торс без плеч
    #      достраивается вывернутой рукой — владелец это и поймал.
    #   2. Порядок: нагота обоих утверждается ДО описания рук и ног.
    ("mf", "behind"): (
        "Explicit photograph, camera at the side of the bed. THE WOMAN "
        "HALF-SITS leaning back against a pile of pillows at the LEFT "
        "of the frame. SHE HAS NOTHING ON HER BODY AT ALL: her chest "
        "is bare skin and her own nipples are in plain view, her belly "
        "and hips are bare skin, and her own bare wet vulva is "
        "uncovered between her open thighs. BOTH OF HER LEGS LIE ON "
        "THE MATTRESS, spread wide apart from each other, knees down "
        "and only slightly bent — neither leg is lifted into the air. "
        "THE MAN lies flat on his stomach between those open thighs, "
        "completely naked, his body stretched straight out to the "
        "RIGHT, both of his forearms flat on the mattress alongside "
        "her thighs with an open hand at the end of each, his face at "
        "the vulva with his tongue out and licking it, seen in "
        "profile. HIS WHOLE BACK IS BARE SKIN from his shoulders down "
        "to his waist, and his bare buttocks are uncovered too. THE "
        "WOMAN IS PROPPED UP ON BOTH OF HER ELBOWS: each arm runs from "
        "her own shoulder down to its elbow on the mattress behind her "
        "and on to its one hand flat on the bed, and both arms are "
        "plainly visible. She looks down at him with her lips parted."),

    # «Наездница», МЖ. Отобрано владельцем 23.09.2026 (кадр
    # pNZ_nzd__55). Кнопка живёт на расстановке «лицом к лицу»: сама
    # поза «лицом к лицу» с этой сборки не снимается (тела лежат одно
    # на другом по всей длине, тазы слипаются в одну массу, а на
    # попытку вытащить член сборка рисует его ЕЙ), и владелец её снял.
    #
    # Здесь работает обратное: тела встречаются в ОДНОЙ точке и на
    # разной высоте — он лежит, она сидит. Этим же держатся «Раком» и
    # «Кунилингус».
    #
    # Нельзя убирать утверждение мужской анатомии («HE IS A MAN AND HIS
    # ANATOMY IS MALE ONLY»): член по тексту внутри неё, снаружи его
    # почти нет — рисовать в паху нечего, и 22.09.2026 сборка залила
    # мужской пах женской анатомией.
    ("mf", "face"): (
        "Explicit photograph, TALL VERTICAL FRAME, camera at the foot "
        "of the bed. THE MAN LIES FLAT ON HIS BACK on the bed with his "
        "head on a pillow at the far end AND HIS FACE INSIDE THE "
        "FRAME, completely naked. HE IS A MAN AND HIS ANATOMY IS MALE "
        "ONLY: between his legs there are his own male genitals — his "
        "erect penis growing from his own hips, of an ordinary human "
        "size — and nothing else at all. THE WOMAN SITS ASTRIDE HIS "
        "HIPS facing the camera, upright and completely naked, her own "
        "nipples in plain view, her knees down on the mattress on "
        "either side of him. SHE IS SITTING DOWN ON HIS ERECT PENIS: "
        "it goes up into her from below and the place where their two "
        "bodies join is plainly visible, his own bare hips and the "
        "base of his penis in view beneath her, her vulva wet around "
        "it. BOTH OF HER HANDS lie flat on his chest, BOTH OF HIS "
        "HANDS hold her hips — every arm runs from its own shoulder "
        "through its elbow to its one hand."),

    # «Минет», МЖ. Снято 23.09.2026 (прогон BJ, все восемь зёрен
    # держат позу). Три прежних круга владелец забраковал: он просил
    # видеть обоих целиком, а сборка ставила двоих в полный рост
    # лицами на одной высоте — минета в кадре не было вовсе.
    #
    # Разницу роста сборка слышит НЕ ПРИЛАГАТЕЛЬНЫМИ («он выше»), а
    # отношением частей тел друг к другу. Отсюда фраза про макушку у
    # его пояса и бёдра на уровне её лица — трогать её нельзя, на ней
    # всё и держится.
    #
    # Лист вертикальный (умолчание): стоящий во весь рост человек в
    # горизонтальный лист не влезает, на нём три круга подряд срезало
    # голову.
    ("mf", "pov"): (
        "Explicit photograph, TALL VERTICAL FRAME, camera at the side "
        "of them and at the height of her face, far enough back that "
        "BOTH OF THEIR FACES AND BOTH WHOLE BODIES ARE INSIDE THE "
        "FRAME. THE MAN STANDS UPRIGHT on the floor at the RIGHT, "
        "completely naked, both feet on the floor and his whole body "
        "from his head to his feet inside the picture; his face is "
        "turned down toward her. THE WOMAN KNEELS ON THE FLOOR IN "
        "FRONT OF HIM at the LEFT, completely naked, sitting back on "
        "her heels; her own nipples are in plain view and her bare "
        "thighs and hips are uncovered. BECAUSE HE STANDS AND SHE "
        "KNEELS, THE TOP OF HER HEAD ONLY REACHES HIS WAIST, AND HIS "
        "HIPS ARE EXACTLY LEVEL WITH HER FACE. HIS ERECT PENIS GOES "
        "STRAIGHT FROM HIS OWN HIPS INTO HER OPEN MOUTH — a real "
        "grown man's penis, full adult size, made of his own bare skin "
        "and the same colour as his body, never an object — her lips "
        "are closed around it and her cheeks are drawn in. THAT PLACE "
        "IS AT THE CENTRE OF THE PICTURE with nothing in front of it. "
        "HER OWN HAND is closed around it near his hips and her other "
        "arm hangs down to her thigh; ONE OF HIS HANDS rests in her "
        "hair, the other hangs down at his own side — every arm runs "
        "from its own shoulder through its elbow to its one hand. She "
        "looks up at his face."),

    # «Кунилингус», ЖЖ. Принято владельцем 22.09.2026 (кадр
    # pPU_puL__1337). Она сидит на краю кровати, вторая на коленях на полу между её
    # коленями. Механика разницы высот — ни одна нога не висит,
    # колени гнутся вперёд просто потому, что человек сидит.
    ("ff", "near"): (
        "Explicit photograph, camera in front of them. THE BLONDE SITS "
        "ON THE EDGE OF THE BED facing the camera, both feet flat on "
        "the floor and her knees wide apart; she has nothing on her at "
        "all, her own nipples are in plain view and her own bare wet "
        "vulva is uncovered between her knees. BOTH OF HER ARMS ARE IN "
        "THE PICTURE: each one runs from her own shoulder through its "
        "elbow to its one hand flat on the mattress beside her own hip. "
        "THE DARK-HAIRED ONE KNEELS ON THE FLOOR between the blonde's "
        "knees with her back to the camera, her head at the vulva, her "
        "tongue out and licking it, her face turned to the side so it "
        "can be seen; her whole back is bare skin with no strap and no "
        "band anywhere on it. BOTH OF HER ARMS ARE IN THE PICTURE TOO: "
        "each one runs from her own shoulder through its elbow to its "
        "one hand resting on the blonde's thigh."),

    # «Отлизывает сзади (лёжа)», ЖЖ. Принято владельцем 22.09.2026 (кадр
    # pK4_k_lying__33). Обе головы низко у разных краёв кадра, бёдра между ними, тела
    # не накладываются. Наготу здесь утверждает одна фраза
    # «Both completely naked» — убрать её нельзя, другой в кадре нет.
    ("ff", "face"): (
        "THE BLONDE lies on her front at the LEFT of the frame, rolled "
        "onto her side so that her hip and buttocks turn up toward the "
        "camera: her head rests low at the left edge, her face turned "
        "to the lens and clearly visible, and one of her own hands "
        "reaches back to spread her buttock open. Her raised buttocks "
        "and her vulva between them are at the centre of the picture. "
        "THE DARK-HAIRED ONE comes in from the RIGHT with her upper "
        "body low and her head at the same height, her face in profile "
        "pressed between the blonde's buttocks from behind, her tongue "
        "on the blonde's vulva. Both heads are low, one at each end of "
        "the frame, the hips between them; the two bodies do not "
        "overlap. Side view from the level of the mattress, wide "
        "horizontal frame, both whole bodies inside it from head to "
        "foot. Both completely naked, bare skin."),

    # «Отлизывает раком (стоя)», ЖЖ. Принято владельцем 22.09.2026 (кадр
    # pK4_k_stand__2024). Разница высот: одна стоит согнувшись, вторая на коленях на полу.
    # Ключ — рост: на четвереньках таз низко, и стоящая на коленях
    # до него не достаёт, отсюда «лицо в пояснице» на ранних кругах.
    ("ff", "close"): (
        "SIDE VIEW — the camera is beside them, not behind them. THE "
        "BLONDE STANDS on the floor at the LEFT with her legs apart and "
        "HAS BENT FAR FORWARD from the hips, her hands on her own "
        "knees, her back horizontal and her buttocks raised high at the "
        "RIGHT, her head turned back over her shoulder so her whole "
        "face is to the lens and her own bare breasts hang free below "
        "her chest. THE DARK-HAIRED ONE IS DOWN ON THE FLOOR BEHIND HER "
        "at the RIGHT, sitting back on her heels and crouched low with "
        "her head below the blonde's raised buttocks and tilted up into "
        "them: HER MOUTH IS PRESSED ON THE BLONDE'S VULVA from behind, "
        "her own face seen in profile. One woman stands high, the other "
        "is low on the floor. The blonde's chest is bare skin with her "
        "own nipples in plain view, her hips are bare skin and her back "
        "is bare skin with no strap and no band on it. The dark-haired "
        "one's chest is bare skin with her own nipples in plain view "
        "and her hips are bare skin."),

    # «Вдвоём раком», ЖЖ. Принято владельцем 22.09.2026 (кадр
    # pK4_k_two__33). Контакта нет вовсе: обе на четвереньках рядом, параллельно, с
    # просветом между телами. Самая устойчивая механика раздела —
    # пересечения нет, ломаться нечему.
    ("ff", "behind"): (
        "THE CAMERA IS BEHIND THEM, low down. TWO NAKED WOMEN ARE ON "
        "ALL FOURS SIDE BY SIDE on the bed, both facing away from the "
        "camera, their bodies PARALLEL and NOT TOUCHING each other at "
        "all, with dark bedding visible in the gap between them. THE "
        "BLONDE is on the LEFT and THE DARK-HAIRED ONE is on the RIGHT. "
        "Both have their knees apart, their backs arched down and their "
        "bare buttocks raised toward the lens, so that BOTH OF THEIR "
        "BARE VULVAS SHOW BETWEEN THEIR THIGHS FROM BEHIND, side by "
        "side across the middle of the picture. Each has turned her "
        "head back over her own shoulder and both faces are to the "
        "camera, smiling. THE BLONDE has nothing on her: her chest is "
        "bare skin with her own nipples in plain view and her hips are "
        "bare skin. THE DARK-HAIRED ONE has nothing on her either: her "
        "chest is bare skin with her own nipples in plain view, and HER "
        "HIPS AND BUTTOCKS ARE BARE SKIN — no panties on her."),

    # «Кунилингус лёжа», ЖЖ. Принято владельцем 22.09.2026 (кадр
    # pPR_prE__1337). Торцами в линию. Кадр владелец показал сам и переснимать
    # запретил: «зачем ты что-то меняешь, я же показал какой».
    ("ff", "pov"): (
        "Explicit photograph, camera at the side of the bed. THE BLONDE "
        "HALF-SITS leaning back against a pile of pillows at the LEFT "
        "of the frame. SHE HAS NOTHING ON HER BODY AT ALL: her chest is "
        "bare skin and her own nipples are in plain view, her belly and "
        "hips are bare skin, and her own bare wet vulva is uncovered "
        "between her open thighs. BOTH OF HER LEGS LIE ON THE MATTRESS, "
        "spread wide apart from each other, knees down and only "
        "slightly bent — neither leg is lifted into the air. THE DARK- "
        "HAIRED ONE lies flat on her stomach between those open thighs, "
        "her body stretched straight out to the RIGHT, her face at the "
        "vulva with her tongue out and licking it, seen in profile. HER "
        "WHOLE BACK IS BARE SKIN from her shoulders down to her waist, "
        "with no strap and no band anywhere on it, and her bare "
        "buttocks are uncovered too. THE BLONDE IS PROPPED UP ON BOTH "
        "OF HER ELBOWS: each arm runs from her own shoulder down to its "
        "elbow on the mattress behind her and on to its one hand flat "
        "on the bed, and both arms are plainly visible. She looks down "
        "at her with her lips parted."),
}

КАМЕРА_ФОТО = {
    "pov": "Point-of-view: 28mm wide at head height, the camera standing "
           "where one of the two people is. Their arms and hands enter "
           "the frame from below and from the sides at natural size; "
           "their face is never seen.",
    "close": "85mm at f/2, very close, lens at their eye level, the two "
             "faces filling the frame. Focus on the nearer eye.",
    "above": "35mm at f/2.8, directly above them and square to the line "
             "of the bodies, roughly two metres up, held level.",
}


# ВИДЕО: три состава по шесть расстановок, восемнадцать роликов.
# Разложены ПО СОСТАВАМ, а не одной кучей: владелец пишет для МЖ, ЖЖ и
# ММ РАЗНЫЕ акты, и в общем списке имена начинают совпадать — «69» у
# всех троих. Три одинаковые кнопки подряд человек читает как ошибку.
ПАРЫ_ВИДЕО = {
    ключ: [_пара(ключ, рус, англ, rk, rt, rp, поля)
           for rk, rt, rp, поля in РАССТАНОВКИ]
    for ключ, _t, рус, англ in СОСТАВЫ
}

# ФОТО: те же восемнадцать, зеркалящие свои ролики. Ни одной новой
# строки от владельца — название и текст берутся у ролика.
ПАРЫ_ФОТО = {
    ключ: [_пара(ключ, рус, англ, rk, rt, rp, поля, вид="i2i",
                 приставка="pf", зеркало=f"pr_{ключ}_{rk}")
           for rk, rt, rp, поля in РАССТАНОВКИ]
    for ключ, _t, рус, англ in СОСТАВЫ
}

# Подписи составов для кнопок: «Пара МЖ» из СОСТАВЫ длинновато там, где
# состав и так стоит заголовком раздела.
# Названия от владельца 21.09.2026: «МЖ» в один ряд с «ЖЖ» человек
# читает не сразу, а «пара», «лесби», «геи» — сразу.
СОСТАВ_КНОПКА = {"mf": ("МЖ пара", "мужчина и женщина"),
                 "ff": ("ЖЖ лесби", "две женщины"),
                 "mm": ("ММ геи", "двое мужчин")}




# ---------------------------------------------------------------------
# ДЕРЕВО
# ---------------------------------------------------------------------

РАЗДЕЛЫ = [
    Узел("undress", "Раздеть", "Твоё фото, без одежды", иконка="СТРИНГИ",
         дети=[
             Узел("un_solo", "Соло", "Одна героиня", дети=[
                 Узел("un_here", "Раздевание",
                      "Ракурс, план, поза - без одежды", scenes=ГДЕ_СНЯЛИ),
                 Узел("un_intim", "Интим",
                      "То же, что в роликах, - фотографией",
                      scenes=ФОТО_ИНТИМ),
             ]),
             Узел("un_group", "Групповое",
                  "Двое в кадре. Нужны два фото - по снимку на человека",
                  дети=[
                      Узел(f"un_{к}", СОСТАВ_КНОПКА[к][0], СОСТАВ_КНОПКА[к][1],
                           scenes=ПАРЫ_ФОТО[к])
                      for к, _t, _р, _а in СОСТАВЫ
                  ]),
         ]),

    Узел("video", "Видео", "Фото начинает двигаться", иконка="ЭФИР",
         дети=[
             Узел("vi_solo", "Соло", "Одна героиня", scenes=СОЛО),
             Узел("vi_group", "Групповое",
                  "Двое в кадре. Нужны два фото - по снимку на человека",
                  дети=[
                      Узел(f"vi_{к}", СОСТАВ_КНОПКА[к][0], СОСТАВ_КНОПКА[к][1],
                           scenes=ПАРЫ_ВИДЕО[к])
                      for к, _t, _р, _а in СОСТАВЫ
                  ]),
         ]),

    Узел("own", "Свой промпт", "Опиши сам, что сделать", иконка="НОУТ",
         дети=[
             Узел("own_photo", "Фото", "Референс и описание - выйдет фото",
                  свободный=True, вид="i2i"),
             Узел("own_video", "Видео", "Референс и описание - выйдет ролик",
                  свободный=True, вид="i2v_5"),
         ]),
]

# «Со звуком» из дерева убрано вместе со снятием вида с продажи:
# реализации нет, см. большой комментарий в pricing.py.

# Какой вид генерации запускает свободный узел. Видео здесь ВСЕГДА
# двухшаговое (сперва фото, потом ролик по нему) — требование владельца
# и единственный способ отдать раздетый ролик, см. Scene.prompt_фото.
СВОБОДНЫЕ = {у.key: у.вид for р in РАЗДЕЛЫ for у in р.дети if у.свободный}


def _все_узлы(узлы=None):
    out = []
    for у in (РАЗДЕЛЫ if узлы is None else узлы):
        out.append(у)
        out += _все_узлы(у.дети)
    return out


УЗЛЫ = _все_узлы()

# Плоские списки для кода, который писался на двух уровнях.
CATEGORIES = [у for у in УЗЛЫ if у.scenes or у.свободный]
С_ВАРИАНТАМИ = [у for у in УЗЛЫ if у.scenes]
ВИДИМЫЕ = С_ВАРИАНТАМИ          # прежнее имя, чтобы не ломать вызовы

_ПО_КЛЮЧУ = {s.key: s for у in УЗЛЫ for s in у.scenes}
_УЗЛЫ = {у.key: у for у in УЗЛЫ}
_РАЗДЕЛЫ = {р.key: р for р in РАЗДЕЛЫ}




# ---------------------------------------------------------------------
# ПОПУЛЯРНОЕ
#
# Не список, а запрос к базе. У конкурента такая категория есть, и это
# единственная его категория, которая не стоит труда: она считается из
# статистики, а не пишется руками.
#
# Показывается только когда есть из чего считать. Пустое «Популярное» на
# старте — худший первый экран: человек жмёт то, что выглядит главным,
# и попадает в пустоту.
# ---------------------------------------------------------------------

ПОПУЛЯРНЫХ = 8


class Популярное(Узел):
    """Узел-обёртка. Ведёт себя как обычный, но список сценариев
    берётся из базы и меняется сам."""

    def __init__(self, scenes):
        # Сцены уже принадлежат своим узлам дерева, а `Узел.__init__`
        # переписывает `scene.узел` на себя. Для «Популярного» это
        # недопустимо: по `узел` считается наследование скрытия и
        # строится кнопка «Назад», и сценарий, попавший в топ, иначе
        # терял бы свою ветку НАВСЕГДА — для всех, а не только внутри
        # этого экрана.
        родные = [(s, s.узел) for s in scenes]
        super().__init__("top", "Популярное", "Что чаще всего заказывают",
                         scenes=scenes, иконка="ОГОНЬ")
        for s, у in родные:
            s.узел = у


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


# КАКОЙ ЛИСТ У КНОПКИ — ЭТО ЧАСТЬ ПОСТАНОВКИ, А НЕ НАСТРОЙКА.
#
# Бот всегда просил вертикаль 768×1344. Между тем «Раком» и
# «Кунилингус» владелец отбирал на ГОРИЗОНТАЛЬНЫХ кадрах 1344×768 —
# в них двое лежат поперёк листа, и в вертикальный лист эта же поза
# просто не влезает: сборка её перестраивает. То есть клиент получал
# не то, что утверждено.
#
# Поэтому лист теперь называет сама кнопка, рядом с её постановкой.
# Умолчание прежнее — вертикаль: так сняты все одиночные кадры и
# «Наездница».
ЖЁСТКИЙ_ЛИСТ = {
    "mf_near": "horiz",      # Секс раком
    "mf_behind": "horiz",    # Кунилингус
    "mf_face": "vert",       # Наездница
    "mf_pov": "vert",        # Минет — стоящий человек в горизонталь не влезает
    "ff_near": "vert",       # Кунилингус
    "ff_face": "horiz",      # Отлизывает сзади (лёжа) — тела поперёк листа
    "ff_close": "vert",      # Отлизывает раком (стоя)
    "ff_behind": "horiz",    # Вдвоём раком — обе поперёк листа
    "ff_pov": "horiz",       # Кунилингус лёжа — тела торцами в линию
}


def лист(ключ_сцены):
    """«vert» или «horiz» для сценария. Понимает и фото, и ролик:
    ролик начинается с кадра, и лист у них обязан быть один."""
    if not ключ_сцены:
        return "vert"
    хвост = "_".join(str(ключ_сцены).split("_")[1:])
    return ЖЁСТКИЙ_ЛИСТ.get(хвост, "vert")


def узел(key):
    if key not in _УЗЛЫ:
        raise KeyError(f"неизвестный узел: {key}")
    return _УЗЛЫ[key]


# Прежние имена.
category = раздел = узел


def все_сценарии():
    return list(_ПО_КЛЮЧУ.values())


def оригиналы():
    """Сценарии, которые владелец правит. Зеркала сюда не входят: у них
    та же строка, и показывать её второй раз значило бы завести две
    копии одного текста."""
    return [s for s in _ПО_КЛЮЧУ.values() if not s.зеркало]


def зеркала(ключ):
    """Кто повторяет этот сценарий. Страница говорит владельцу, что
    строка работает не только там, где он её пишет."""
    return [s for s in _ПО_КЛЮЧУ.values() if s.зеркало == ключ]


def дерево():
    """Каталог в виде обычных словарей — для страницы редактирования.

    Отдаёт и умолчания кода, и текущие правки владельца, раздельно:
    страница показывает умолчание бледным, поверх него своё значение, и
    пустое поле означает «вернуть как было», а не «стереть название».
    """
    п = правки()

    def сцена(s):
        своё = п.get(s.key) or {}
        англ = (язык.СЦЕНАРИИ_EN.get(s.key)
                or язык.РАССТАНОВКИ_EN.get(s.расстановка) or ("", ""))
        где = зеркала(s.key)
        return {
            "ключ": s.key,
            "вид": "сценарий",
            "название_по_умолчанию": s._title,
            "название_en_по_умолчанию": англ[0],
            "название": своё.get("название", ""),
            "название_en": своё.get("название_en", ""),
            "подпись": s.подпись,
            "пара": s.пара,
            "коины": s.coins,
            "фото": list(s.фото_нужно),
            "строка": своё.get("строка", ""),
            "строка_рус": своё.get("строка_рус", ""),
            "скрыт": скрыт(s.key),
            "кириллица": кириллица(s.откровенное),
            "работает_ещё": [{"коины": z.coins, "узел": z.узел.назв("ru")}
                             for z in где if z.узел],
            "промпт_длина": len(s.prompt),
        }

    def место_(м):
        своё = п.get(м.key) or {}
        англ = язык.МЕСТА_КНОПКИ_EN.get(м.key, ("", ""))
        return {
            "ключ": м.key,
            "вид": "место",
            "название_по_умолчанию": м.title,
            "название_en_по_умолчанию": англ[0],
            "название": своё.get("название", ""),
            "название_en": своё.get("название_en", ""),
            "подпись": м.подпись,
            "скрыт": скрыт(м.key),
        }

    def ветка(у):
        своё = п.get(у.key) or {}
        англ = язык.УЗЛЫ_EN.get(у.key, ("", ""))
        д = {
            "ключ": у.key,
            "вид": "узел",
            "название_по_умолчанию": у._title,
            "название_en_по_умолчанию": англ[0],
            "название": своё.get("название", ""),
            "название_en": своё.get("название_en", ""),
            "подзаголовок": у.подзаголовок,
            "свободный": у.свободный,
            "скрыт": скрыт(у.key),
            "дети": [ветка(д) for д in у.дети],
            # Зеркала на странице не показываются: та же строка вторым
            # экземпляром означала бы две копии одного текста, которые
            # однажды разойдутся.
            "варианты": [сцена(s) for s in у.scenes if not s.зеркало],
        }
        return д

    ор = оригиналы()
    return {
        "разделы": [ветка(р) for р in РАЗДЕЛЫ],
        "места": [место_(м) for м in места.ВСЕ],
        "обязательное": {
            "ключ": prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ,
            "строка": (п.get(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ) or {}).get("строка", ""),
            "строка_рус": (п.get(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ) or {}).get("строка_рус", ""),
            "по_умолчанию": prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ,
            "по_умолчанию_рус": prompts.ОБЯЗАТЕЛЬНОЕ_РУС,
        },
        "всего": len(ор),
        "наполнено": sum(1 for s in ор if s.наполнен),
        "видно": sum(1 for s in _ПО_КЛЮЧУ.values() if not s.скрыт),
        "кириллица": с_кириллицей(),
    }


def кириллица(текст):
    """Есть ли в строке русские буквы.

    Нужно ровно в одном месте — сторожить поле «для модели». Модель
    обучена на английском, и русский там даёт мусор МОЛЧА: ошибку видно
    только на готовой картинке, когда коины уже списаны. Поймать это
    можно лишь глазами, поэтому страница смотрит за владельцем сама.
    """
    return any("а" <= c.lower() <= "я" or c in "ёЁ" for c in текст or "")


def с_кириллицей():
    """Ключи, у которых в английском поле русский текст."""
    return [s.key for s in оригиналы() if кириллица(s.откровенное)]


def известные_ключи():
    """Что страница вправе править. Всё остальное в присланном JSON
    отбрасывается: правка приходит из браузера, и принимать оттуда
    произвольные ключи означало бы складывать в файл что угодно.

    Зеркал здесь нет: их правки живут на оригинале.
    """
    return (set(s.key for s in оригиналы()) | set(_УЗЛЫ)
            | set(м.key for м in места.ВСЕ)
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


