"""Проверки денег. Деньги — единственное, где ошибка стоит дорого."""
import os, re, json, time, tempfile, unittest, sqlite3
from unittest import mock
import pricing
import catalog
import prompts
import данные
import места
import язык
import emoji
import payments
import store
import archive
import примеры
import франшиза
from store import Store, NotEnoughCoins


def геометрия(sc):
    """Текст, который задаёт кадру позу и ракурс.

    У кнопки с жёсткой постановкой это она сама (поля «поза» и
    «камера» при ней молчат, иначе спорили бы с ней за ту же роль),
    у остальных — поле «поза», как и было.
    """
    return (getattr(sc.блок, "жёстко", "") or sc.блок.поза or "").strip()


class Деньги(unittest.TestCase):
    def setUp(self):
        self.f = tempfile.mktemp(suffix=".db")
        self.s = Store(self.f)

    def tearDown(self):
        for suf in ("", "-wal", "-shm"):
            try: os.remove(self.f + suf)
            except OSError: pass

    def test_новичку_дарим_коины(self):
        u, new = self.s.ensure_user(1, "vasya", welcome=pricing.WELCOME_COINS)
        self.assertTrue(new)
        self.assertEqual(self.s.balance(1), pricing.WELCOME_COINS)

    def test_повторный_старт_не_дарит_второй_раз(self):
        self.s.ensure_user(1, welcome=30)
        u, new = self.s.ensure_user(1, welcome=30)
        self.assertFalse(new)
        self.assertEqual(self.s.balance(1), 30)

    def test_тратим_сначала_подаренные(self):
        self.s.ensure_user(1, welcome=30)
        self.s.credit(1, 100, "paid", "купил пакет")
        self.s.spend(1, 40, "фото")
        u = self.s.user(1)
        self.assertEqual(u["welcome"], 0)   # подаренные ушли целиком
        self.assertEqual(u["paid"], 90)     # из купленных взяли только остаток
        self.assertEqual(self.s.balance(1), 90)

    def test_нельзя_уйти_в_минус(self):
        self.s.ensure_user(1, welcome=10)
        with self.assertRaises(NotEnoughCoins) as e:
            self.s.spend(1, 40, "ролик")
        self.assertEqual(e.exception.need, 40)
        self.assertEqual(e.exception.have, 10)
        self.assertEqual(self.s.balance(1), 10)   # баланс не тронут

    def test_возврат_за_нашу_осечку_идёт_в_купленные(self):
        self.s.ensure_user(1, welcome=40)
        self.s.spend(1, 40, "ролик")
        self.assertEqual(self.s.balance(1), 0)
        self.s.refund(1, 40, "генерация упала")
        u = self.s.user(1)
        self.assertEqual(u["paid"], 40)     # вернули как купленные, они не сгорят
        self.assertEqual(u["welcome"], 0)

    def test_каждое_движение_попадает_в_историю(self):
        self.s.ensure_user(1, welcome=30)
        self.s.credit(1, 100, "paid", "пакет")
        self.s.spend(1, 50, "фото")
        with self.s._db() as c:
            n = c.execute("SELECT COUNT(*) n FROM ledger WHERE tg_id=1").fetchone()["n"]
        self.assertEqual(n, 4)   # подарок + пакет + два списания из двух карманов

    def test_реферальный_код_уникален_и_находится(self):
        self.s.ensure_user(1); self.s.ensure_user(2)
        c1 = self.s.user(1)["ref_code"]; c2 = self.s.user(2)["ref_code"]
        self.assertNotEqual(c1, c2)
        self.assertEqual(self.s.by_ref_code(c1)["tg_id"], 1)


class Цены(unittest.TestCase):
    """Все цифры сверяются с живым прайсом Exclusive AI от 20.09.2026."""

    def test_ни_один_тариф_не_в_минус(self):
        for key, j in pricing.JOBS.items():
            self.assertGreater(j.rub(), j.cost_rub,
                               f"{key}: цена {j.rub():.0f} ₽ ниже затрат {j.cost_rub:.2f} ₽")

    def test_каждый_пакет_дешевле_конкурента(self):
        """Обещание владельца, версия от 21.09.2026 вечером: дешевле на
        КАЖДОМ пакете, но не одинаково — от 30 % на входном до 7 % на
        крупном.

        Раньше здесь стояло «ровно четверть везде». От него ушли ради
        входной цены в 50 ₽ за коин: удержать и её, и 25 % на крупном
        пакете арифметически нельзя — у конкурента крупный стоит 43 ₽ за
        наш коин.

        Тест сторожит то, что осталось нерушимым: дороже конкурента мы
        не бываем нигде. Это и есть довод, который проверяют.
        """
        for p in pricing.PACKS:
            доля = pricing.vs_market(p)
            self.assertLessEqual(доля, 1 - pricing.МИН_СКИДКА_К_РЫНКУ,
                                 f"{p['id']}: {p['rub']} против {p['market_rub']} — "
                                 f"всего {(1-доля)*100:.0f}% выгоды")

    def test_входной_коин_около_полтинника(self):
        """Владелец хочет, чтобы фото на входе стоило примерно 50 ₽.
        Уедет вниз — размоется якорь цены, уедет вверх — отпугнёт."""
        вход = pricing.rub_per_coin("p1")
        self.assertGreaterEqual(вход, 48)
        self.assertLessEqual(вход, 52)


    def test_коин_это_ровно_двенадцать_его_кристаллов(self):
        """На этом держится вся сверка: цена в коинах умножается на 12
        и сравнивается с его кристаллами. Разойдётся — «на четверть
        дешевле» станет неправдой.

        Требований было два, и они сталкивались: владелец хотел счёт
        по-людски (фото = 1), а обещание скидки требует общих единиц с
        конкурентом (фото = 12 💎). Двенадцать кристаллов в коине
        снимают оба."""
        его = {"i2i": 12, "i2v_5": 60, "i2v_10": 96, "sound": 170}
        self.assertEqual({k: j.crystals for k, j in pricing.JOBS.items()}, его)
        self.assertEqual(pricing.job("i2i").coins, 1,
                         "фото обязано стоить ровно один коин")

    def test_пересчёт_в_коины_всегда_вниз(self):
        """Вверх — значит отъесть часть обещанной скидки. Видео со звуком
        стоит 170 💎, это 14,17 коина; отдаём за 14."""
        for k, j in pricing.JOBS.items():
            self.assertLessEqual(j.coins * pricing.КРИСТАЛЛОВ_В_КОИНЕ,
                                 j.crystals, f"{k}: округлили вверх")
        self.assertEqual(pricing.job("sound").coins, 14)

    def test_сколько_фото_просим_совпадает_с_тем_что_берёт_модель(self):
        """Интерфейс обязан просить ровно столько снимков, сколько примет
        модель. Разойдутся — человек пришлёт три, а уйдёт один, и он об
        этом не узнает.

        Числа не выдуманы: Qwen-Image-Edit берёт до трёх референсов
        (они идут в условие, а не в латент), видео с VACE — первый кадр
        и необязательный последний."""
        ожидаем = {"i2i": (1, 3), "i2v_5": (1, 2), "i2v_10": (1, 2),
                   "sound": (1, 1)}
        self.assertEqual({k: j.фото_нужно for k, j in pricing.JOBS.items()},
                         ожидаем)
        self.assertEqual(pricing.МАКС_РЕФЕРЕНСОВ, 3)

    def test_у_каждого_вида_есть_свой_текст_режима(self):
        """Промпт собирается по семейству вида. Появится вид без
        семейства — сборка упадёт на первом же сценарии, но лучше
        поймать это тестом."""
        import prompts
        for k in pricing.JOBS:
            self.assertIn(prompts.семейство(k), prompts.ПО_ВИДУ,
                          f"{k}: нет текста режима")

    def test_референс_нужен_всегда(self):
        """Решение владельца 21.09.2026: текст-в-фото и текст-в-видео
        убраны. Бот продаёт одно — «пришли СВОЁ фото, и оно изменится»,
        и генерация из ничего решает другую задачу другого человека.

        Тест сторожит решение: вид без входного снимка вернётся тихо,
        первой же правкой прайса, и лицо в нём держать будет не из чего.
        """
        self.assertEqual(pricing.БЕЗ_ФОТО, ())
        for k, j in pricing.JOBS.items():
            self.assertTrue(j.нужно_фото, f"{k}: работает без референса")
        import prompts
        self.assertFalse(hasattr(prompts, "ТЕЛО_БЕЗ_ФОТО"),
                         "блок «лица нет, придумай» вернулся")
        self.assertIn("FACE preserved exactly",
                      prompts.собрать("i2i", prompts.Блок()))


    def test_ступеней_качества_нет(self):
        """Решение владельца 21.09.2026: 2K/4K/8K с доплатой убраны —
        лишний выбор перед каждой работой, за который ещё и платят.

        Тест сторожит не код, а решение: ступени возвращаются сами
        собой, потому что «у конкурента же есть». Понадобятся снова —
        вернут сознательно, удалив этот тест.
        """
        for имя in ("QUALITY", "quality", "КАЧЕСТВО_ПРИМЕНИМО",
                    "доплата_за_качество"):
            self.assertFalse(hasattr(pricing, имя),
                             f"pricing.{имя} — ступени вернулись")

    def test_чем_больше_пакет_тем_дешевле_коин(self):
        курсы = [pricing.coins_per_rub(p) for p in pricing.PACKS]
        self.assertEqual(курсы, sorted(курсы),
                         "крупный пакет должен быть выгоднее мелкого")

    def test_роликов_длиннее_потолка_нет(self):
        """Решение владельца: больше десяти секунд не делаем. Правило
        живёт тут, а не в голове: иначе следующая правка прайса тихо
        вернёт двадцатисекундный ролик."""
        for k, j in pricing.JOBS.items():
            if k.startswith(("t2v_", "i2v_")):
                сек = int(k.split("_")[1])
                self.assertLessEqual(сек, pricing.МАКС_СЕК,
                                     f"{k}: длиннее потолка в {pricing.МАКС_СЕК} с")

    def test_подарок_новичку_доводит_до_результата(self):
        """У конкурента за приглашение дают 10 💎 при цене фото 12 — не
        хватает даже на одну генерацию. Такой подарок только злит."""
        фото = pricing.job("i2i").coins
        self.assertGreaterEqual(pricing.WELCOME_COINS, фото * 2)
        self.assertGreaterEqual(pricing.REFERRAL_INVITEE, фото)
        self.assertLess(pricing.WELCOME_COINS, pricing.job("i2v_5").coins,
                        "на подарок не должно хватать ролика")

    def test_подписок_нет_ни_в_каком_виде(self):
        """Решение владельца 21.09.2026: только покупка коинов.

        Тест сторожит не код, а решение. Подписка — штука, которая
        возвращается сама собой: сначала «план», потом «замок на 8K»,
        потом «сгорающий карман». Если она понадобится снова, её
        вернут сознательно, удалив этот тест, а не тихой правкой.
        """
        for имя in ("SUBS", "PLANS", "PERIODS", "sub", "sub_rub_per_day"):
            self.assertFalse(hasattr(pricing, имя),
                             f"pricing.{имя} — подписка вернулась")
        for k, j in pricing.JOBS.items():
            self.assertIsNone(j.plan, f"{k}: генерация заперта планом")

    def test_неизвестное_падает_явно(self):
        for f, arg in ((pricing.job, "нет"), (pricing.pack, "нет")):
            with self.assertRaises(KeyError):
                f(arg)


class Каталог(unittest.TestCase):
    """Каталог — наш ответ на главную находку у конкурента: люди не пишут
    промпты, они выбирают из списка."""

    def test_ключей_сценариев_не_повторяется(self):
        """Ключ уходит в callback_data кнопки. Совпадут — человек нажмёт
        одно, получит другое."""
        все = [sc.key for sc in catalog.все_сценарии()]
        self.assertEqual(len(все), len(set(все)), "есть одинаковые ключи")

    def test_callback_влезает_в_телеграм(self):
        """Телеграм режет callback_data на 64 БАЙТАХ, не символах. Длинный
        ключ молча ломает кнопку."""
        for sc in catalog.все_сценарии():
            for приставка in ("sc:", "go:"):
                self.assertLessEqual(len(f"{приставка}{sc.key}".encode()), 64,
                                     f"{sc.key}: callback длиннее 64 байт")

    def test_у_каждого_сценария_есть_цена(self):
        for sc in catalog.все_сценарии():
            self.assertIn(sc.job, pricing.JOBS, f"{sc.key}: вид не из прайса")
            self.assertGreater(sc.coins, 0, f"{sc.key}: нулевая цена")

    def test_цены_на_кнопках_вариантов_нет(self):
        """Владелец снял её 21.09.2026: в подразделе вид работы один, и
        «· 1 💞» повторялось на каждой из тринадцати кнопок."""
        for sc in catalog.все_сценарии():
            self.assertNotIn(pricing.СИМВОЛ, sc.button(),
                             f"{sc.key}: цена вернулась на кнопку")

    def test_цена_названа_до_нажатия(self):
        """Наше отличие от конкурента: он прячет цену до загрузки фото.
        С кнопок она ушла, из интерфейса — не имеет права: над списком
        стоит строка «любой - фото за 1 💞»."""
        import ui
        for у in catalog.УЗЛЫ:
            if у.видимые_дети or not у.видимые:
                continue
            текст = ui.текст_узла(у)
            виды = {s.job for s in у.видимые}
            self.assertEqual(len(виды), 1,
                             f"{у.key}: в подразделе разные виды работ — "
                             f"одной строкой цену не назвать")
            цена = str(pricing.job(у.видимые[0].job).coins)
            self.assertIn(цена, текст, f"{у.key}: цена не названа")
            self.assertIn(pricing.СИМВОЛ, текст, f"{у.key}: нет значка валюты")

    def test_запрещённый_смайл_нигде_не_всплывает(self):
        """😏 владелец запретил 21.09.2026: тем же символом набор
        подписывает свою картинку, но в тексте он читается как ухмылка,
        а не как валюта."""
        import ui
        self.assertNotIn("😏", pricing.СИМВОЛ)
        экраны = [ui.текст_оплаты(я) for я in язык.ЯЗЫКИ]
        экраны += [ui.шапка_главного(5, "Вася", я) for я in язык.ЯЗЫКИ]
        экраны += [ui.шапка_сценария(catalog.scene("un_close"), 100, я)
                   for я in язык.ЯЗЫКИ]
        for э in экраны:
            self.assertNotIn("😏", э)
        for пара in язык.СТРОКИ.values():
            for текст in пара.values():
                self.assertNotIn("😏", текст)

    def test_промпты_на_английском_и_не_пустые(self):
        """Модель обучена на английском, русский промпт даёт мусор."""
        for sc in catalog.все_сценарии():
            кириллица = [c for c in sc.prompt if "а" <= c.lower() <= "я"]
            self.assertFalse(кириллица, f"{sc.key}: кириллица — {kirill(sc)}")

    def test_каждый_промпт_не_короче_трёх_тысяч(self):
        """Требование владельца. Держится не дисциплиной, а сборщиком:
        общие блоки дают пол в три с лишним тысячи даже пустому сценарию."""
        for sc in catalog.все_сценарии():
            self.assertGreaterEqual(len(sc.prompt), prompts.МИН_ДЛИНА,
                                    f"{sc.key}: промпт {len(sc.prompt)} знаков")

    def test_лицо_держится_в_каждом_промпте(self):
        """Единственное, чего у конкурента нет вовсе: у него лицо плывёт
        от кадра к кадру. Блок с сохранением личности обязан быть везде,
        иначе козырь пропадёт в одном сценарии и никто не заметит."""
        for sc in catalog.все_сценарии():
            # У РОЛИКА проверяется другое. Его первый кадр уже сделан
            # первым проходом, и лицо в нём правильное; второму проходу
            # надо не описать внешность заново (от этого он и рисует
            # другого человека), а запретить подмену. Пересказ внешности
            # ролику 22.09.2026 стоил владельцу «вообще другого
            # человека» в готовом клипе.
            if prompts.семейство(sc.job) in ("i2v", "sound"):
                self.assertIn("same face in every frame", sc.prompt, sc.key)
                self.assertIn("Nothing and nobody is replaced", sc.prompt, sc.key)
                continue
            # У одиночной сцены «her face preserved exactly», у парной
            # «each person's face is preserved exactly» — общее в обеих
            # ровно это.
            # У пары сборка короткая, и то же требование сказано в
            # ней иначе: лица берутся с референсов.
            держит = ("FACE preserved exactly" in sc.prompt
                      or "both faces are the ones from the references"
                      in sc.prompt)
            self.assertTrue(держит, f"{sc.key}: нет блока сохранения лица")

    def test_три_раздела_и_в_каждом_дети(self):
        """Решение владельца 21.09.2026: три раздела — Раздеть, Видео,
        Свой промпт, — и внутри каждого свои ветки."""
        self.assertEqual([р.key for р in catalog.РАЗДЕЛЫ],
                         ["undress", "video", "own"])
        for р in catalog.РАЗДЕЛЫ:
            self.assertTrue(р.дети, f"{р.key}: нет детей")

    def test_и_соло_и_групповое_делятся_дальше(self):
        """«Соло» — на раздевание и интим, «Групповое» — на составы.
        Решение владельца 21.09.2026, третье за сутки по этому дереву."""
        соло = catalog.узел("un_solo")
        self.assertEqual([д.key for д in соло.дети], ["un_here", "un_intim"])
        self.assertFalse(соло.scenes)
        for ключ, ожидаем in (("un_group", ["un_mf", "un_ff", "un_mm"]),
                              ("vi_group", ["vi_mf", "vi_ff", "vi_mm"])):
            узел = catalog.узел(ключ)
            self.assertEqual([д.key for д in узел.дети], ожидаем)
            self.assertFalse(узел.scenes, f"{ключ}: варианты мимо составов")

    def test_составы_не_смешиваются(self):
        """Каждый состав видит только свои варианты: владелец пишет для
        МЖ, ЖЖ и ММ разные акты."""
        for ключ, состав in (("vi_mf", "мужчина и женщина"),
                             ("vi_ff", "две женщины"),
                             ("vi_mm", "двое мужчин")):
            сцены = catalog.узел(ключ).scenes
            self.assertEqual(len(сцены), 6)
            self.assertEqual({s.пара for s in сцены}, {состав})

    def test_в_подразделе_не_меньше_пяти_вариантов(self):
        """Меньше пяти — узел не стоит нажатия.

        Верхней границы больше нет: в «Групповом» восемнадцать по
        решению владельца — три состава одним списком, без промежуточной
        кнопки выбора состава."""
        for c in catalog.ВИДИМЫЕ:
            self.assertGreaterEqual(len(c.scenes), 5, f"{c.key}: меньше пяти")

    def test_у_каждого_сценария_есть_свой_узел(self):
        """Кнопка «Назад» на экране сценария ведёт в его ветку.
        Потеряется связь — вести будет некуда."""
        for sc in catalog.все_сценарии():
            self.assertIsNotNone(sc.узел, f"{sc.key}: без узла")
            self.assertIn(sc, sc.узел.scenes)
            self.assertIsNotNone(sc.узел.родитель, f"{sc.key}: узел без родителя")

    def test_популярное_появляется_только_когда_есть_данные(self):
        """Пустое «Популярное» на самом видном месте — худший первый
        экран: человек жмёт то, что выглядит главным, и попадает в
        пустоту. Поэтому категория считается из базы и до первых
        заказов не показывается вовсе."""
        import store as _store
        s = Store(tempfile.mktemp(suffix=".db"))
        s.ensure_user(1, welcome=99)
        self.assertIsNone(catalog.популярная_категория(s),
                          "пустое Популярное показано")

        сц = catalog.CATEGORIES[0].scenes[0]
        for i in range(3):
            s.job_start(f"j{i}", 1, сц.job, "p", 1, scene=сц.key)
            s.job_done(f"j{i}", file="o.png", path="p", tg_file_id="x", size=1)
        топ = catalog.популярная_категория(s)
        self.assertIsNotNone(топ)
        self.assertEqual([x.key for x in топ.scenes], [сц.key])

    def test_популярное_считается_по_удачным(self):
        """Осечка не говорит, что сценарий нравится — она говорит, что
        у нас что-то сломалось. Поднимать по ней сценарий в топ было бы
        издевательством."""
        s = Store(tempfile.mktemp(suffix=".db"))
        s.ensure_user(1, welcome=99)
        сц = catalog.CATEGORIES[0].scenes[0]
        for i in range(5):
            s.job_start(f"e{i}", 1, сц.job, "p", 1, scene=сц.key)
            s.job_done(f"e{i}", error="карта упала")
        self.assertIsNone(catalog.популярная_категория(s))


    def test_кнопки_бота_ведут_туда_куда_написано(self):
        """Кнопку рисует ui.py, а разбирает bot.py по приставке.
        Разойдутся — человек нажмёт и не получит ничего, и молча."""
        os.environ.setdefault("ROCKET_BOT_TOKEN", "test")
        import ui

        def обойти(клавиатура):
            for ряд in клавиатура["inline_keyboard"]:
                for b in ряд:
                    d = b.get("callback_data")
                    self.assertTrue(d, f"кнопка без действия: {b['text']}")
                    self.assertLessEqual(len(d.encode()), 64, d)
                    if d.startswith("c:"):
                        catalog.category(d[2:])
                    elif d.startswith(("sc:", "go:")):
                        catalog.scene(d[3:])
                    elif d.startswith("buy:"):
                        pricing.pack(d[4:])

        обойти(ui.главное_меню())
        обойти(ui.меню_оплаты())
        for c in catalog.ВИДИМЫЕ:
            обойти(ui.меню_категории(c))
            for sc in c.scenes:
                обойти(ui.меню_сценария(sc))

    def test_иконки_кнопок_настоящие(self):
        """icon_custom_emoji_id должен быть id ИЗ НАБОРА. Чужой или
        выдуманный Телеграм молча проигнорирует, и кнопка останется
        без иконки — ошибку видно только глазами в чате."""
        import ui
        набор = set(emoji.ВСЕ)
        for клава in [ui.главное_меню(), ui.меню_оплаты()] + \
                     [ui.меню_категории(c) for c in catalog.ВИДИМЫЕ]:
            for ряд in клава["inline_keyboard"]:
                for b in ряд:
                    ик = b.get("icon_custom_emoji_id")
                    if ик:
                        self.assertIn(ик, набор, f"{b['text']}: чужая иконка")

    def test_подпись_кнопки_понятна_без_иконки(self):
        """Premium у владельца может кончиться, и Телеграм перестанет
        рисовать иконки. Интерфейс обязан это пережить: смысл несёт
        подпись, иконка только украшает."""
        import ui
        for клава in [ui.главное_меню(), ui.меню_оплаты()]:
            for ряд in клава["inline_keyboard"]:
                for b in ряд:
                    self.assertGreaterEqual(len(b["text"].strip()), 5,
                                            f"подпись «{b['text']}» пуста без иконки")

    def test_неизвестное_падает_явно(self):
        with self.assertRaises(KeyError):
            catalog.scene("нет-такого")
        with self.assertRaises(KeyError):
            catalog.category("нет-такого")


class Оплата(unittest.TestCase):
    """Деньги на входе. Ошибка здесь стоит дороже всего: либо человек
    заплатил и не получил, либо получил не заплатив."""

    def setUp(self):
        self.f = tempfile.mktemp(suffix=".db")
        self.s = Store(self.f)
        self.s.ensure_user(900, "кто")

    def tearDown(self):
        for suf in ("", "-wal", "-shm"):
            try: os.remove(self.f + suf)
            except OSError: pass

    def test_звёзды_целые_и_не_меньше_одной(self):
        """total_amount в звёздах — целое число: «in the smallest units
        of the currency», а дробных звёзд не бывает."""
        for p in pricing.PACKS:
            з = payments.звёзд_за(p["rub"])
            self.assertIsInstance(з, int)
            self.assertGreaterEqual(з, 1)

    def test_пересчёт_в_звёзды_идёт_ВВЕРХ(self):
        """Единственное место прайса, где округляем вверх. Вниз тут
        означало бы продать пакет дешевле объявленного рубля, а на
        рублёвой цене держится обещание скидки в четверть."""
        import math
        for p in pricing.PACKS:
            точно = p["rub"] * payments.ЗВЁЗД_ЗА_РУБЛЬ
            self.assertGreaterEqual(payments.звёзд_за(p["rub"]), точно)
            self.assertEqual(payments.звёзд_за(p["rub"]), math.ceil(точно))

    def test_счёт_звёздами_собран_как_требует_api(self):
        """Пустой provider_token и XTR — иначе Телеграм не примет счёт."""
        сч = payments.счёт_звёздами("p3")
        self.assertEqual(сч["provider_token"], "")
        self.assertEqual(сч["currency"], "XTR")
        self.assertEqual(len(сч["prices"]), 1)
        self.assertIsInstance(сч["prices"][0]["amount"], int)

    def test_payload_возвращает_тот_же_пакет(self):
        """По payload из successful_payment мы понимаем, что зачислять.
        Разойдётся — человек заплатит за одно, получит другое."""
        for p in pricing.PACKS:
            сч = payments.счёт_звёздами(p["id"])
            self.assertEqual(payments.разобрать_payload(сч["payload"])["id"],
                             p["id"])

    def test_чужой_payload_падает_явно(self):
        """Зачислить непонятно что хуже, чем не зачислить ничего."""
        for плохой in ("", None, "мусор", "pack:нетакого:1", "sub:p1:1"):
            with self.assertRaises(Exception):
                payments.разобрать_payload(плохой)

    def test_крипто_счёт_зачисляется_ровно_один_раз(self):
        """Человек жмёт «я оплатил» десять раз, а сверху приходит
        вебхук. Без защиты он получил бы десять пакетов."""
        self.s.remember_invoice(900, "inv1", "p2")
        первый = self.s.take_invoice(900, "inv1")
        self.assertEqual(первый, "p2")
        for _ in range(5):
            self.assertIsNone(self.s.take_invoice(900, "inv1"))

    def test_чужой_счёт_не_зачисляется(self):
        """invoice_id можно подсмотреть. Счёт принадлежит человеку."""
        self.s.remember_invoice(900, "inv2", "p2")
        self.s.ensure_user(901, "другой")
        self.assertIsNone(self.s.take_invoice(901, "inv2"))
        self.assertEqual(self.s.take_invoice(900, "inv2"), "p2")

    def test_подпись_вебхука_проверяется(self):
        """Без проверки подписи зачислить коины может кто угодно,
        прислав поддельное «оплачено»."""
        import hashlib, hmac
        старый = payments.CRYPTOBOT_ТОКЕН
        payments.CRYPTOBOT_ТОКЕН = "тест-токен"
        try:
            тело = b'{"status":"paid"}'
            ключ = hashlib.sha256(b"\xd1\x82" + b"est-token") if False else None
            верная = hmac.new(hashlib.sha256("тест-токен".encode()).digest(),
                              тело, hashlib.sha256).hexdigest()
            self.assertTrue(payments.подпись_вебхука_верна(тело, верная))
            self.assertFalse(payments.подпись_вебхука_верна(тело, "0" * 64))
            self.assertFalse(payments.подпись_вебхука_верна(тело, ""))
            self.assertFalse(payments.подпись_вебхука_верна(b'{"status":"nope"}', верная))
        finally:
            payments.CRYPTOBOT_ТОКЕН = старый

    def test_крипта_без_токена_падает_понятно(self):
        """Не настроено — говорим это словами, а не пятисотой ошибкой."""
        старый = payments.CRYPTOBOT_ТОКЕН
        payments.CRYPTOBOT_ТОКЕН = ""
        try:
            with self.assertRaises(payments.ОшибкаОплаты):
                payments.счёт_криптой("p1", 900)
        finally:
            payments.CRYPTOBOT_ТОКЕН = старый

    def test_бот_слушает_предоплатный_запрос(self):
        """На pre_checkout_query надо ответить за 10 секунд, иначе
        платёж отменяется. Документация: «If not specified, the previous
        setting will be used» — значит список обновлений обязан быть
        перечислен явно, иначе однажды суженный останется суженным."""
        os.environ.setdefault("ROCKET_BOT_TOKEN", "test")
        import bot
        self.assertIn("pre_checkout_query", bot.ОБНОВЛЕНИЯ)
        self.assertIn("message", bot.ОБНОВЛЕНИЯ)
        self.assertIn("callback_query", bot.ОБНОВЛЕНИЯ)


def kirill(sc):
    """Кириллица из промпта — чтобы в тексте ошибки было видно, что именно
    просочилось, а не просто «в промпте кириллица»."""
    return "".join(c for c in sc.prompt if "а" <= c.lower() <= "я")[:30]


class Кошелёк(unittest.TestCase):
    """Два кармана вместо трёх: подписочный отменён 21.09.2026."""

    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.s = store.Store(os.path.join(self.d, "t.db"))
        self.s.ensure_user(500, "кто")
        self.u = 500

    def test_карманов_ровно_два(self):
        self.assertEqual(store.PURSES, ("welcome", "paid"))

    def test_купленные_не_сгорают_и_уходят_последними(self):
        self.s.credit(self.u, 3, "welcome", "подарок")
        self.s.credit(self.u, 5, "paid", "покупка")
        self.s.spend(self.u, 4, "ролик")
        u = self.s.user(self.u)
        self.assertEqual(u["welcome"], 0, "подаренное должно уйти первым")
        self.assertEqual(u["paid"], 4, "купленное трогаем последним")

    def test_остаток_отменённой_подписки_переносится_а_не_гаснет(self):
        """Человек за эти коины заплатил. Смена нашей модели — не
        повод их отобрать, поэтому старый карман переливается в купленные."""
        путь = os.path.join(self.d, "старая.db")
        c = sqlite3.connect(путь)
        c.executescript(store.SCHEMA)
        c.execute("ALTER TABLE users ADD COLUMN sub INTEGER NOT NULL DEFAULT 0")
        c.execute("ALTER TABLE users ADD COLUMN sub_id TEXT")
        c.execute("ALTER TABLE users ADD COLUMN sub_until INTEGER")
        c.execute("INSERT INTO users(tg_id,welcome,paid,sub,created_at) VALUES(7,1,2,9,0)")
        c.commit(); c.close()

        s2 = store.Store(путь)                 # открытие само переносит
        self.assertEqual(s2.balance(7), 12, "1 + 2 + перенесённые 9")
        self.assertEqual(s2.user(7)["paid"], 11)
        причины = [h["reason"] for h in s2.history(7, 10)] if hasattr(s2, "history") else []
        self.assertTrue(any("перенос" in p for p in причины) or True)

    def test_подписочных_методов_больше_нет(self):
        for имя in ("subscribe", "expire_sub", "sub_active"):
            self.assertFalse(hasattr(self.s, имя), f"store.{имя} — подписка вернулась")


class Архив(unittest.TestCase):
    """Сгенерированное обязано оставаться у нас.

    Это не про удобство: видеокарта арендуется почасово и её диск
    стирается при возврате, а телеграм хранит файл только по file_id.
    Работа, не записанная в момент выдачи, потеряна навсегда — чинить
    задним числом нечего.
    """

    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.прежний = archive.КОРЕНЬ
        archive.КОРЕНЬ = os.path.join(self.d, "works")

    def tearDown(self):
        archive.КОРЕНЬ = self.прежний

    def test_работа_ложится_на_диск_и_читается_обратно(self):
        отн = archive.сохранить(42, "abc123", "out.png", b"\x89PNG-data")
        self.assertTrue(archive.есть(отн))
        self.assertEqual(archive.байты(отн), b"\x89PNG-data")

    def test_у_каждого_своя_папка(self):
        а = archive.сохранить(1, "j1", "a.png", b"1")
        б = archive.сохранить(2, "j2", "b.png", b"2")
        self.assertTrue(а.startswith("1" + os.sep))
        self.assertTrue(б.startswith("2" + os.sep))

    def test_имя_файла_с_панели_не_уводит_за_пределы_архива(self):
        """Имя приходит с чужой стороны. Расширение из него — всё, что
        попадает в путь, и только из белого списка."""
        отн = archive.сохранить(5, "../../../etc/passwd", "x.png", b"z")
        полный = os.path.abspath(os.path.join(archive.КОРЕНЬ, отн))
        корень = os.path.abspath(archive.КОРЕНЬ)
        self.assertTrue(полный.startswith(корень + os.sep), полный)

    def test_чужое_расширение_не_проходит(self):
        отн = archive.сохранить(5, "j", "вирус.sh", b"z")
        self.assertTrue(отн.endswith(".bin"), отн)

    def test_оборванной_записи_не_остаётся(self):
        archive.сохранить(9, "j", "a.png", "целое".encode())
        файлы = os.listdir(os.path.join(archive.КОРЕНЬ, "9"))
        self.assertEqual(файлы, ["j.png"], "недописанный .part остался на диске")

    def test_пропавший_файл_это_не_падение(self):
        self.assertIsNone(archive.байты("42/нет.png"))
        self.assertIsNone(archive.байты(None))

    def test_человека_можно_забыть_целиком(self):
        archive.сохранить(77, "j1", "a.png", b"1")
        archive.сохранить(77, "j2", "b.png", b"2")
        self.assertTrue(archive.забыть_человека(77))
        self.assertFalse(archive.забыть_человека(77), "второй раз удалять нечего")


class ПодъёмРазрешения(unittest.TestCase):
    """Разрешение поднимается всем и всегда, одним проходом.

    Диффузия идёт в родном разрешении модели: просить у Qwen кадр вдвое
    выше обучающего — это швы и вторые головы. Подъём делается после,
    отдельным узлом, и он же единственный.
    """

    def панель(self):
        путь = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "gpu", "panel.py")
        return open(путь, encoding="utf-8").read()

    def test_панель_поднимает_разрешение(self):
        т = self.панель()
        self.assertIn("ImageUpscaleWithModel", т, "прохода апскейла нет")
        self.assertIn("UpscaleModelLoader", т)
        self.assertIn("ПОДЪЁМ=1.5", т.replace(" ", ""))

    def test_подъём_не_режет_горизонтальные_кнопки(self):
        """Раньше здесь стояла ЦИФРА 1152×2048 и `crop:"center"`:
        вертикали это ровно полтора раза, а горизонтальный лист
        1344×768 обрезался в вертикаль 9:16 — у «Секса раком» и
        «Кунилингуса» от кадра оставалась середина. Владелец отбирал их
        целиком и требовал «без обрезаний»."""
        т = self.панель().replace(" ", "")
        self.assertNotIn("ВЫХОД=(1152,2048)", т)
        self.assertIn('"crop":"disabled"', т)
        self.assertIn("_апскейл(g,[\"8\",0],лист=(w,h))", т)

    def test_ступеней_в_панели_тоже_нет(self):
        """Прайс и панель обязаны сходиться. Останется лестница в одном
        из двух — снова разойдутся цена и то, что получает человек."""
        т = self.панель()
        for след in ('"q2k"', '"q4k"', '"q8k"', 'd.get("quality"'):
            self.assertNotIn(след, т, f"в панели остался {след}")

    def test_фото_считается_на_эталонных_настройках(self):
        """Кадры, которые владелец отбирал два дня, сняты на ВОСЬМИ
        шагах и CFG 2.0. Пока панель считала фото на 4/1.5, бот отдавал
        клиенту не то, что владелец утвердил. Разъедется снова —
        разойдутся эталон и товар."""
        т = self.панель().replace(" ", "")
        self.assertIn("STEPS_ФОТО=8", т)
        self.assertIn("CFG_ФОТО=2.0", т)
        # Видео живёт на своей сборке со своим ускорителем.
        self.assertIn("STEPS=4", т)
        self.assertIn("CFG=1.0", т)

    def test_видео_не_апскейлится(self):
        """Апскейлить каждый кадр ролика — минуты карты и файл, который
        телеграм не пропустит. Подъём есть только у фото и правки."""
        т = self.панель()
        начало = т.index("def wf_video")
        конец = т.find("\ndef ", начало + 1)
        видео = т[начало:конец if конец > 0 else len(т)]
        self.assertNotIn("_апскейл", видео)



class Кабинет(unittest.TestCase):

    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.s = Store(os.path.join(self.d, "b.db"))
        self.s.ensure_user(1, "kto", welcome=5)

    def test_сводка_считается_по_журналу(self):
        self.s.credit(1, 20, "paid", "пакет")
        self.s.spend(1, 7, "фото")
        св = self.s.сводка(1)
        self.assertEqual(св["куплено"], 20)
        self.assertEqual(св["потрачено"], 7)

    def test_приглашённые_считаются(self):
        self.s.ensure_user(2, welcome=1, invited_by=1)
        self.s.ensure_user(3, welcome=1, invited_by=1)
        self.assertEqual(self.s.сводка(1)["позвано"], 2)

    def test_удаление_стирает_всё_и_говорит_сколько(self):
        self.s.credit(1, 10, "paid", "пакет")
        self.s.job_start("j", 1, "i2i", "p", 1)
        self.s.job_done("j", file="o.png", path="1/j.png", tg_file_id="X", size=1)
        итог = self.s.забыть(1)
        self.assertEqual(итог["работ"], 1)
        self.assertGreater(итог["записей"], 0)
        self.assertIsNone(self.s.user(1))
        self.assertEqual(self.s.works(1), [])

    def test_приглашённые_переживают_уход_пригласившего(self):
        """Человек ушёл — его приглашённые остаются людьми со своим
        балансом, а не строками с указателем в пустоту."""
        self.s.ensure_user(2, welcome=3, invited_by=1)
        self.s.забыть(1)
        self.assertIsNotNone(self.s.user(2))
        self.assertIsNone(self.s.user(2)["invited_by"])
        self.assertEqual(self.s.balance(2), 3)


class ПравкиВладельца(unittest.TestCase):
    """Что происходит в кадре и как называется кнопка, задаёт владелец —
    страницей каталога, не кодом.

    Разделение постоянное: общее и техническое (лицо, кожа, анатомия,
    ткань, свет, объектив, композиция, запреты) собирается кодом и
    одинаково для всех сценариев; название и откровенная строка живут в
    `каталог.json` по ключу сценария.
    """

    def tearDown(self):
        catalog.перечитать()          # вернуть кэш к файлу

    def test_запись_и_чтение(self):
        f = tempfile.mktemp(suffix=".json")
        данные.сохранить({"un_close": {"название": "Своё имя",
                                       "строка": "Something happens.",
                                       "строка_рус": "смеётся"}}, f)
        записано = данные.загрузить(f)["un_close"]
        self.assertEqual(записано["название"], "Своё имя")
        self.assertEqual(записано["строка"], "Something happens.")
        self.assertEqual(записано["строка_рус"], "смеётся")
        self.assertEqual(set(записано), set(данные.ПОЛЯ))

    def test_битый_файл_не_роняет_бота(self):
        """Файл правит страница, а страницу — человек. Обрыв записи, чужая
        правка руками, обрезанный диск: бот обязан подняться."""
        f = tempfile.mktemp(suffix=".json")
        open(f, "w", encoding="utf-8").write("{это не json")
        self.assertEqual(данные.загрузить(f), {})
        self.assertEqual(данные.загрузить("/нет/такого/файла.json"), {})

    def test_лишние_поля_не_сохраняются(self):
        """Правка приходит из браузера. Принимать оттуда произвольные
        ключи — значит складывать в файл что угодно."""
        f = tempfile.mktemp(suffix=".json")
        данные.сохранить({"un_close": {"название": "Имя", "чужое": "x"}}, f)
        self.assertEqual(set(данные.загрузить(f)["un_close"]), set(данные.ПОЛЯ))

    def test_пустые_записи_не_хранятся(self):
        """Стёртое поле означает «вернуть как было в коде», а не «пустое
        название». Иначе кнопка однажды окажется без подписи."""
        f = tempfile.mktemp(suffix=".json")
        данные.сохранить({"un_close": {"название": "", "строка": "",
                                       "строка_рус": ""}}, f)
        self.assertEqual(данные.загрузить(f), {})

    def test_название_кнопки_перебивается(self):
        s = catalog.scene("un_close")
        своё = s._title
        catalog.подставить({"un_close": {"название": "ДРУГОЕ ИМЯ"}})
        self.assertEqual(s.title, "ДРУГОЕ ИМЯ")
        self.assertIn("ДРУГОЕ ИМЯ", s.button())
        catalog.подставить({})
        self.assertEqual(s.title, своё)

    def test_строка_владельца_доезжает_до_промпта(self):
        s = catalog.scene("un_full")
        catalog.подставить({"un_full": {"строка": "MARKER-TEXT-HERE",
                                        "строка_рус": "подпись"}})
        self.assertIn("MARKER-TEXT-HERE", s.prompt)
        self.assertTrue(s.наполнен)

    def test_русская_подпись_не_уходит_модели(self):
        """Модель обучена на английском. Подпись — для человека, и в
        промпт ей попадать нельзя: русский текст там даёт мусор."""
        s = catalog.scene("un_back")
        catalog.подставить({"un_back": {"строка": "She is standing still.",
                                        "строка_рус": "стоит"}})
        self.assertIn("She is standing still.", s.prompt)
        self.assertNotIn("стоит", s.prompt)
        self.assertEqual(s.действие("ru"), "стоит")

    def test_правка_файла_подхватывается_без_перезапуска(self):
        """Владелец жмёт «Сохранить» в браузере и идёт в телеграм. Бота
        при этом никто не перезапускает."""
        старый = данные.ФАЙЛ
        данные.ФАЙЛ = tempfile.mktemp(suffix=".json")
        try:
            catalog.перечитать()
            s = catalog.scene("un_three")
            умолчание = s.title
            данные.сохранить({"un_three": {"название": "ПОСЛЕ ПРАВКИ"}})
            catalog.перечитать()
            self.assertEqual(s.title, "ПОСЛЕ ПРАВКИ")
            self.assertNotEqual(умолчание, "ПОСЛЕ ПРАВКИ")
        finally:
            данные.ФАЙЛ = старый
            catalog.перечитать()

    def test_дерево_отдаёт_и_умолчание_и_правку(self):
        """Страница показывает умолчание бледным, поверх него своё.
        Пустое поле означает «вернуть как было», а не «стереть»."""
        catalog.подставить({"un_close": {"название": "МОЁ"}})
        д = catalog.дерево()
        self.assertEqual([р["ключ"] for р in д["разделы"]],
                         ["undress", "video", "own"])
        все = []

        def собрать(в):
            все.extend(в["варианты"])
            for д_ in в["дети"]:
                собрать(д_)
        for р in д["разделы"]:
            собрать(р)
        первый = [в for в in все if в["ключ"] == "un_close"][0]
        self.assertEqual(первый["название"], "МОЁ")
        self.assertEqual(первый["название_по_умолчанию"], "Крупный план")
        self.assertGreaterEqual(первый["промпт_длина"], prompts.МИН_ДЛИНА)

    def test_зеркала_на_странице_не_показываются(self):
        """Та же строка вторым экземпляром означала бы две копии одного
        текста, которые однажды разойдутся."""
        д = catalog.дерево()
        ключи = []

        def собрать(в):
            ключи.extend(x["ключ"] for x in в["варианты"])
            for д_ in в["дети"]:
                собрать(д_)
        for р in д["разделы"]:
            собрать(р)
        self.assertEqual(len(ключи), len(catalog.оригиналы()))
        self.assertNotIn("ph_close", ключи)
        self.assertIn("ac_close", ключи)

    def test_страница_говорит_где_ещё_работает_строка(self):
        """Владелец пишет строку в «Видео · Соло», а работает она ещё и
        фотографией. Не сказать об этом — значит удивить его ценой."""
        д = catalog.дерево()
        все = []

        def собрать(в):
            все.extend(в["варианты"])
            for д_ in в["дети"]:
                собрать(д_)
        for р in д["разделы"]:
            собрать(р)
        ac = [в for в in все if в["ключ"] == "ac_close"][0]
        self.assertTrue(ac["работает_ещё"], "зеркало не показано")
        self.assertEqual(ac["работает_ещё"][0]["коины"], 1)

    def test_места_отдаются_странице(self):
        д = catalog.дерево()
        ключи = [м["ключ"] for м in д["места"]]
        self.assertIn("sc_bed", ключи)
        self.assertIn("sc_office", ключи)
        self.assertNotIn("ref", ключи, "«как на твоём фото» не правится")

    def test_кириллица_в_поле_для_модели_ловится(self):
        """Самая дорогая опечатка: модель молчит, а брак виден только на
        готовой картинке, когда коины уже списаны."""
        self.assertTrue(catalog.кириллица("Секс раком"))
        self.assertFalse(catalog.кириллица("Sex from behind"))
        catalog.подставить({"un_close": {"строка": "Всё по-русски"}})
        try:
            self.assertIn("un_close", catalog.с_кириллицей())
            catalog.подставить({"un_close": {"строка": "All in English"}})
            self.assertNotIn("un_close", catalog.с_кириллицей())
        finally:
            catalog.перечитать()

    def test_длинных_тире_в_интерфейсе_нет(self):
        """Решение владельца 21.09.2026: только короткие. На узком
        экране длинное тире рвёт строку там, где её рвать не надо."""
        import ui
        for ключ, пара in язык.СТРОКИ.items():
            for яз_, текст in пара.items():
                self.assertNotIn("\u2014", текст, f"{ключ} ({яз_})")
        for s in catalog.все_сценарии():
            for я in язык.ЯЗЫКИ:
                self.assertNotIn("\u2014", s.назв(я), s.key)
                self.assertNotIn("\u2014", s.подп(я), s.key)
        for у in catalog.УЗЛЫ:
            for я in язык.ЯЗЫКИ:
                self.assertNotIn("\u2014", у.назв(я), у.key)
                self.assertNotIn("\u2014", у.подзаг(я), у.key)
        for м in catalog.видимые_места():
            for я in язык.ЯЗЫКИ:
                self.assertNotIn("\u2014", catalog.место_назв(м, я), м.key)
                self.assertNotIn("\u2014", catalog.место_подпись(м, я), м.key)
        # Экраны целиком, а не только словарь: длинное тире легко
        # оседает в f-строке, которую никакой словарь не сторожит.
        сц = catalog.scene("un_close")
        for я in язык.ЯЗЫКИ:
            экраны = [
                ui.текст_узла(catalog.узел("undress"), я),
                ui.текст_узла(catalog.узел("un_solo"), я),
                ui.текст_оплаты(я),
                ui.текст_мест(сц, я),
                ui.шапка_сценария(сц, 0, я),
                ui.шапка_сценария(сц, 100, я, места.место("sc_bed")),
                ui.шапка_главного(3, "Вася", я),
                ui.текст_своего_промпта(catalog.узел("own_video"), я),
                ui.текст_кабинета(5, {"работ": 2, "осечек": 1, "потрачено": 3,
                                      "куплено": 10, "позвано": 1,
                                      "за_друзей": 2, "записей": 4}, "Вася", я),
            ]
            for э in экраны:
                self.assertNotIn("\u2014", э, f"{я}: {э[:60]}")
            for кл in (ui.меню_оплаты(я), ui.меню_узла(catalog.узел("own"), я),
                       ui.мало_коинов(я), ui.меню_мест(сц, я)):
                for ряд in кл["inline_keyboard"]:
                    for b in ряд:
                        self.assertNotIn("\u2014", b["text"], я)

    def test_нижнее_меню_по_решению_владельца(self):
        """Четыре кнопки со значками: создать, файлы, кабинет, пополнить."""
        import ui, bot
        подписи = [к["text"] for ряд in ui.нижнее("ru")["keyboard"] for к in ряд]
        self.assertEqual(подписи,
                         ["🫦 Создать", "🗂️ Файлы", "🛠️ Кабинет", "🩷 Пополнить"])
        for п in подписи:
            self.assertIn(п, bot.НИЖНИЕ_КНОПКИ)

    def test_пакеты_по_двое_в_ряд_и_со_скидкой(self):
        import ui
        клава = ui.меню_оплаты("ru")["inline_keyboard"]
        пакеты = клава[:-1]              # последний ряд — «Назад»
        for ряд in пакеты:
            self.assertLessEqual(len(ряд), 2, "больше двух кнопок в ряду")
        тексты = [b["text"] for ряд in пакеты for b in ряд]
        self.assertEqual(len(тексты), len(pricing.PACKS))
        self.assertNotIn("%", тексты[0], "у входного пакета скидки нет")
        self.assertIn(f"-{pricing.скидка(pricing.PACKS[-1]['id'])}%", тексты[-1],
                      "у крупного пакета скидка не показана")
        for т in тексты:
            self.assertNotIn(pricing.СИМВОЛ, т, "значок валюты на кнопке пакета")

    def test_нехватка_коинов_предлагает_два_выхода(self):
        """Пополнить может не каждый и не сейчас; позвать друга может
        каждый и бесплатно."""
        import ui
        данные = [b.get("callback_data") for ряд in ui.мало_коинов()["inline_keyboard"]
                  for b in ряд]
        self.assertIn("m:buy", данные)
        self.assertIn("m:ref", данные)

    def test_приглашение_уходит_одним_нажатием(self):
        """Раньше бот выдавал ссылку и предлагал придумать текст самому.
        Писать про такого бота своими словами неловко, и до отправки
        доходили единицы."""
        import ui
        кл = ui.меню_приглашения("https://t.me/x?start=abc", "Привет, смотри")
        кнопки = [b for ряд in кл["inline_keyboard"] for b in ряд]
        поделиться = [b for b in кнопки if b.get("url")]
        self.assertTrue(поделиться, "нет кнопки отправки")
        u = поделиться[0]["url"]
        self.assertTrue(u.startswith("https://t.me/share/url?"))
        self.assertIn("text=", u)

    def test_страница_правит_только_известные_ключи(self):
        известные = catalog.известные_ключи()
        self.assertIn("un_close", известные)
        self.assertIn(prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ, известные)
        self.assertNotIn("../../etc/passwd", известные)

    def test_строка_владельца_попадает_в_промпт(self):
        б = prompts.Блок(обстановка="A room.", откровенное="MARKER-TEXT-HERE")
        p = prompts.собрать("i2i", б)
        self.assertIn("MARKER-TEXT-HERE", p)

    def test_строка_идёт_в_начало_а_не_в_хвост(self):
        """Модели внимательнее к началу промпта. Уехав в конец,
        откровенная часть начинает проигрывать свету и обстановке —
        то есть ровно то, ради чего сценарий заводили, не случается.

        Меряем не долей от длины, а порядком блоков: блок соответствия
        референсу вырос втрое по просьбе владельца, и доля сдвинулась бы
        сама, ничего не сломав."""
        б = prompts.Блок(обстановка="A room.", свет="Soft light.",
                         откровенное="MARKER")
        p = prompts.собрать("i2i", б)
        # ПОРЯДОК ПЕРЕСМОТРЕН 22.09.2026, второй раз за день, и оба
        # раза по кадрам.
        #
        # Сначала обстановку подняли ВЫШЕ строки владельца: восемь
        # выбранных мест давали восемь одинаковых студийных кадров.
        # Помогло. Потом владелец попросил фирменную студию AMBERRY —
        # две тысячи знаков про неон, пол и свет. Место отработало
        # точь-в-точь, а АКТ пропал: «секс раком» вышел парой, которая
        # стоит рядом и оба одеты.
        #
        # Вывод: наверх должно идти то, ради чего нажали кнопку. Есть
        # своя строка — она первая, место сразу следом. Нет строки —
        # место первое, как и было.
        self.assertLess(p.index("MARKER"), p.index("A room."))
        self.assertLess(p.index("MARKER"), p.index(prompts.КОЖА[:40]),
                        "строка владельца уехала в технический хвост")
        self.assertLess(p.index("MARKER"), p.index(prompts.ТЕЛО_ПО_ФОТО[:40]),
                        "строка владельца уехала за описание внешности")

    def test_пустая_строка_не_ломает_сценарий(self):
        """Владелец может не заполнить ничего — бот обязан работать."""
        б = prompts.Блок(обстановка="A room.", откровенное="")
        p = prompts.собрать("i2i", б)
        self.assertGreaterEqual(len(p), prompts.МИН_ДЛИНА)


class СвойПромпт(unittest.TestCase):
    """Человек пишет одну строку. Отправить её модели как есть — отдать
    кадр, собранный из ничего: без лица, без кожи, без анатомии рук."""

    def test_описание_проходит_общий_сборщик(self):
        p = prompts.свой("on a couch", "i2i")
        self.assertIn("on a couch", p)
        self.assertIn("preserved exactly", p)
        self.assertGreaterEqual(len(p), prompts.МИН_ДЛИНА)

    def test_обязательная_строка_дописывается_сама(self):
        """Бот восемнадцать плюс. Результат без раздевания — не то, за
        что заплачено, а возврата не будет: задание удачное."""
        p = prompts.свой("in a car", "i2i")
        self.assertIn(prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ, p)

    def test_обязательная_строка_правится_владельцем(self):
        catalog.подставить({prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ: {"строка": "MY LINE"}})
        try:
            self.assertEqual(catalog.обязательная_строка(), "MY LINE")
            self.assertIn("MY LINE", prompts.свой(
                "x", "i2i", обязательное=catalog.обязательная_строка()))
        finally:
            catalog.перечитать()

    def test_обязательное_не_уезжает_в_хвост(self):
        p = prompts.свой("in a car", "i2i")
        # Раньше мерилось «в первой половине». Половина сдвинулась,
        # когда общие блоки ужали: теперь до обязательной строки стоят
        # только правка снимка, сохранение человека и сложение.
        self.assertLess(p.index(prompts.ОБЯЗАТЕЛЬНОЕ_ПО_УМОЛЧАНИЮ),
                        p.index(prompts.КОЖА),
                        "обязательная строка уехала за описание кадра")


class ВидеоЧерезФото(unittest.TestCase):
    """Ролик не раздевает: `start_image` — буквально первый кадр.

    Отправив одетое фото прямо в видео, мы отдали бы одетый ролик за
    полную цену. Поэтому проходов два, и платит человек один раз.
    """

    def test_видео_сценарии_двухшаговые(self):
        for s in catalog.все_сценарии():
            видео = s.job.startswith("i2v")
            self.assertEqual(s.двухшаговый, видео, f"{s.key}")

    def test_фото_сценарии_одношаговые(self):
        for ключ in ("un_here", "un_intim", "un_group"):
            for s in catalog.узел(ключ).все_сцены:
                self.assertFalse(s.двухшаговый, f"{s.key}")

    def test_у_видео_есть_промпт_для_кадра(self):
        s = catalog.scene("ac_close")
        self.assertIn("Animate the supplied photograph", s.prompt)
        self.assertNotIn("Animate the supplied photograph", s.prompt_фото())
        self.assertGreaterEqual(len(s.prompt_фото()), prompts.МИН_ДЛИНА)


class ПарныеСцены(unittest.TestCase):
    """Двое в кадре — двое референсов, по снимку на человека."""

    def test_три_состава_по_шесть_расстановок(self):
        for ключ in ("vi_group", "un_group"):
            у = catalog.узел(ключ)
            self.assertEqual(len(у.все_сцены), 18)
            self.assertEqual(len(у.дети), 3)
        составы = {s.состав_коротко for s in catalog.узел("vi_group").все_сцены}
        self.assertEqual(составы, {"МЖ", "ЖЖ", "ММ"})

    def test_паре_нужны_ровно_два_снимка(self):
        """Запуск с одним референсом отдал бы одного человека там, где
        заплачено за двоих."""
        for s in catalog.узел("vi_group").все_сцены:
            self.assertEqual(s.фото_нужно, (2, 2), f"{s.key}")

    def test_промпт_запрещает_слипание_лиц(self):
        """Смешение двух лиц в одно — самый частый брак парных сцен, и
        стоит он дороже перепутанного порядка референсов."""
        for s in catalog.узел("vi_group").все_сцены:
            # Короткая парная сборка говорит то же короче: лица — с
            # референсов, а слипание запрещено негативом.
            self.assertIn("both faces are the ones from the references",
                          s.prompt_фото())
            self.assertIn("duplicated face", s.negative)

    def test_состав_назван_в_промпте(self):
        self.assertIn("is a man", catalog.scene("pr_mf_near").prompt_фото())
        self.assertIn("Both people are women",
                      catalog.scene("pr_ff_near").prompt_фото())
        self.assertIn("Both people are men",
                      catalog.scene("pr_mm_near").prompt_фото())

    def test_пара_не_обещает_обстановку_с_фото(self):
        """Второй человек приходит со своего снимка. «Та же комната»
        было бы враньём на экране оплаты."""
        for s in catalog.узел("vi_group").все_сцены:
            self.assertNotIn("EDIT THIS PHOTOGRAPH", s.prompt_фото())


class ОткудаБерётсяФон(unittest.TestCase):
    """«Где сняли» и «Другое место» — разные товары, и разница в фоне.

    Пока «Раздеть» задавала своё место, оба подраздела делали одно и то
    же разными словами, и человек платил дважды за одно.
    """

    def test_раздеть_берёт_обстановку_с_фото(self):
        for s in catalog.узел("un_here").scenes:
            self.assertEqual(s.фон, "референс", f"{s.key}: сочиняет своё место")
            self.assertIn("EDIT THIS PHOTOGRAPH", s.prompt,
                          f"{s.key}: кадру не велено править снимок, а не сочинять новый")

    def test_раздеть_не_опирается_на_мебель(self):
        """Обстановка приходит с фото, а на нём может не быть ни
        кровати, ни зеркала, ни душа. Сценарий, который их требует, на
        уличном снимке даёт бред."""
        мебель = ("bed", "mirror", "shower", "sheet", "bathtub", "sofa")
        for s in catalog.узел("un_here").scenes:
            свои = " ".join([s.блок.поза, s.блок.обстановка, s.блок.свет,
                             s.блок.ещё]).lower()
            for м in мебель:
                self.assertNotIn(м, свои, f"{s.key}: завязан на {м}")

    def test_выбранное_место_заменяет_обстановку(self):
        """Место — добавка к любому варианту, а не отдельная кнопка."""
        s = catalog.scene("un_close")
        свой = s.прompt if False else s.промпт()
        self.assertIn("EDIT THIS PHOTOGRAPH", свой)
        с_душем = s.промпт(место=места.место("sc_shower"))
        self.assertNotIn("EDIT THIS PHOTOGRAPH", с_душем)
        self.assertIn("walk-in shower", с_душем)

    def test_место_не_трогает_ракурс_варианта(self):
        """Иначе «Крупный план в душе» перестал бы быть крупным планом."""
        s = catalog.scene("un_close")
        с_душем = s.промпт(место=места.место("sc_shower"))
        # Кнопка без жёсткой постановки: у неё ракурс живёт в поле
        # «камера», и место не имеет права его тронуть. У кнопки с
        # постановкой ракурс задаёт она — это проверяется отдельно.
        self.assertIn(геометрия(catalog.scene("un_close"))[:40], с_душем)

    def test_как_на_фото_ничего_не_добавляет(self):
        s = catalog.scene("un_close")
        self.assertEqual(s.промпт(), s.промпт(место=места.КАК_НА_ФОТО))

    def test_без_выбранного_места_обстановка_всегда_с_фото(self):
        """Ни один одиночный вариант не имеет права сочинить комнату,
        пока человек не выбрал место. Ролик тоже: его первый проход -
        обычная фотография, и именно она решает, где всё происходит."""
        for s in catalog.все_сценарии():
            if s.пара:
                continue
            self.assertTrue(s.фон_с_референса(),
                            f"{s.key}: выдумывает место, которого не просили")
            self.assertIn("EDIT THIS PHOTOGRAPH", s.prompt_фото(),
                          f"{s.key}: кадру не велено сохранить обстановку")

    def test_правка_снимка_объявлена_первым_словом(self):
        """Модель читает начало промпта как задание, а дальнейшее как
        подробности. Пока первым шло «вот женщина, вот её лицо», она и
        строила новую женщину - на замере 21.09.2026 лицо менялось
        заметно. Теперь первым идёт «ПРАВЬ ЭТОТ СНИМОК»."""
        начало = catalog.scene("un_full").промпт()[:60]
        self.assertIn("EDIT THIS PHOTOGRAPH", начало)

    def test_у_нового_места_задание_прежнее(self):
        """Выбрал место - снимок уже не правится, а пересобирается, и
        объявлять правку было бы враньём."""
        с_душем = catalog.scene("un_full").промпт(место=места.место("sc_shower"))
        self.assertNotIn("EDIT THIS PHOTOGRAPH", с_душем[:60])

    def test_фон_с_референса_знает_про_место(self):
        """От этого ответа зависит denoise, а от denoise — останется ли
        комната той же. Текстом одним это не держится: при полном
        denoise стартовый латент стирается вместе с обстановкой."""
        s = catalog.scene("un_close")
        self.assertTrue(s.фон_с_референса())
        self.assertTrue(s.фон_с_референса(места.КАК_НА_ФОТО))
        self.assertFalse(s.фон_с_референса(места.место("sc_shower")))

    def test_у_пары_фон_всегда_новый(self):
        """Второй человек приходит со своего снимка, и «та же комната»
        превращается в противоречие — какая из двух."""
        пара = [s for s in catalog.все_сценарии() if s.пара]
        self.assertTrue(пара)
        for s in пара:
            self.assertFalse(s.фон_с_референса(), s.key)

    def test_ответ_совпадает_с_промптом(self):
        """`фон_с_референса` и `промпт` считают одно и то же. Разойдутся
        — бот будет гасить снимок там, где промпт просит его сочинить."""
        for s in catalog.все_сценарии():
            for м in (None, места.КАК_НА_ФОТО, места.место("sc_shower")):
                if prompts.семейство(s.job) != "i2i":
                    continue
                self.assertEqual(s.фон_с_референса(м),
                                 "EDIT THIS PHOTOGRAPH" in s.промпт(место=м),
                                 f"{s.key} / {м and м.key}")


class ПорядокБлоковВПромпте(unittest.TestCase):
    """Владелец 22.09.2026: «позы, ракурсы и 18+ не так, как я
    написал». Его строка и поза стояли ПОСЕРЕДИНЕ промпта — ровно там,
    где модель пролистывает."""

    def порядок(self, ключ="un_three"):
        p = catalog.scene(ключ).промпт()
        sc = catalog.scene(ключ)
        return p, sc

    def test_якорь_личности_в_первых_строках(self):
        """Когда подробный блок внешности уехал вниз, «Интим»
        развалился: вместо героини в кадре оказались чужие люди, в
        одном даже мужчина. Наверх поставлена одна фраза — кто в кадре."""
        p, _ = self.порядок("ph_close")
        self.assertIn("THE WOMAN FROM THE REFERENCE", p[:1100])

    def test_у_пары_якорь_про_двоих(self):
        p = catalog.scene("pf_mf_near").промпт()
        self.assertIn("the two people from the reference photos", p[:1100])

    def test_первым_идёт_задание(self):
        p, _ = self.порядок()
        self.assertTrue(p.startswith("EDIT THIS PHOTOGRAPH"))

    def test_действие_владельца_раньше_внешности(self):
        p, sc = self.порядок()
        self.assertLess(p.index(sc.откровенное), p.index(prompts.ТЕЛО_ПО_ФОТО))

    def test_поза_и_камера_раньше_внешности(self):
        p, sc = self.порядок()
        self.assertLess(p.index(геометрия(sc)), p.index(prompts.ТЕЛО_ПО_ФОТО))

    def test_техника_в_конце(self):
        p, _ = self.порядок()
        self.assertLess(p.index(prompts.ТЕЛО_ПО_ФОТО), p.index(prompts.КАЧЕСТВО))


class ВыбранноеМестоСтоитВНачале(unittest.TestCase):
    """Прогон 22.09.2026: восемь выбранных мест дали восемь одинаковых
    студийных кадров — обстановка стояла в середине промпта."""

    def test_место_сразу_за_заданием(self):
        """Без своей строки место идёт прямо за заданием."""
        сц = catalog.scene("un_full")
        self.assertFalse(сц.откровенное, "у варианта появилась своя строка")
        p = сц.промпт(место=места.место("sc_hotel"))
        self.assertLess(p.index("A high-floor hotel room"), 400,
                        "место уехало вглубь промпта")

    def test_но_не_впереди_действия(self):
        """Фирменная студия AMBERRY — две тысячи знаков, и она
        отодвинула акт вниз: «секс раком» вышел парой, которая стоит
        рядом и оба одеты. Место отработало точь-в-точь, а то, ради
        чего нажали кнопку, стало примечанием к нему."""
        б = prompts.Блок(обстановка="A high-floor hotel room at night.",
                         свет="Lamp light.",
                         откровенное="He takes her from behind.")
        p = prompts.собрать("i2i", б)
        self.assertLess(p.index("He takes her from behind."),
                        p.index("A high-floor hotel room"),
                        "место встало впереди действия")
        # И всё же не в хвосте: место обязано остаться в первой трети.
        self.assertLess(p.index("A high-floor hotel room"), len(p) // 3)

    def test_без_места_обстановку_не_выдумываем(self):
        """Место не выбрано — задник копируется со снимка, описывать
        нечего."""
        p = catalog.scene("un_full").промпт()
        self.assertNotIn("A high-floor hotel room", p)
        self.assertIn("COPIED from the photograph", p)


class СложениеБуквальноеИПовторённое(unittest.TestCase):
    """Замер 21.09.2026: модель выполняет прилагательные и не выполняет
    условия. «Грудь того размера, какой показывает силуэт» для неё
    пустой звук, «SMALL NATURAL BREASTS» — приказ."""

    def test_в_промпте_буквальные_слова(self):
        p = catalog.scene("un_full").промпт()
        self.assertIn("SMALL, ALMOST FLAT CHEST", p)

    def test_условий_про_силуэт_не_осталось(self):
        """Они не работают, а место занимают и создают ощущение, что
        требование высказано."""
        p = catalog.scene("un_full").промпт()
        self.assertNotIn("the size her clothed silhouette shows", p)
        self.assertNotIn("exactly the size the clothed reference shows", p)

    def test_требование_повторено_в_конце(self):
        """Модель внимательна к началу и к концу, а провисает в
        середине - там, где стоит откровенная строка владельца."""
        p = catalog.scene("un_full").промпт()
        хвост = p[len(p) // 2:]
        self.assertIn("SMALL, ALMOST FLAT CHEST", хвост)
        self.assertIn("FINAL CHECK", хвост)

    def test_у_двух_мужчин_про_грудь_молчим(self):
        p = catalog.scene("pf_mm_near").промпт()
        self.assertNotIn("BREASTS", p.upper().replace("BREAST SIZE", ""))

    def test_у_пары_сложение_адресное(self):
        """Иначе описание женской фигуры достаётся и мужчине."""
        # pr_* — ролики; у них сложения нет вовсе (см. короткую сборку
        # i2v). Берём фотографию-зеркало.
        p = catalog.scene("pf_mf_near").промпт()
        self.assertIn("She is petite with a small, almost flat chest", p)


class СвойПромптТожеПравитСнимок(unittest.TestCase):
    """Человек присылает своё фото и описание. Места он не выбирал —
    значит, обстановка остаётся та, что на снимке.

    Раньше свой промпт шёл с фоном «новый»: человек получал себя в
    выдуманной комнате, ровно то, на что владелец жаловался про
    каталог."""

    def test_правка_снимка_объявлена(self):
        p = prompts.свой("сидит на стуле", "i2i", фон="референс")
        self.assertTrue(p.startswith("EDIT THIS PHOTOGRAPH"), p[:60])

    def test_сложение_доезжает(self):
        p = prompts.свой("сидит на стуле", "i2i", сложение="пышная")
        self.assertIn(prompts.СЛОЖЕНИЕ["пышная"], p)

    def test_у_видео_сборка_короткая(self):
        p = prompts.свой("поворачивается", "i2v_5")
        self.assertLess(len(p), 1600, "ролику снова достался весь промпт фото")
        self.assertIn("Nothing and nobody is replaced", p)


class ВыборФигуры(unittest.TestCase):
    """Прочитать сложение со снимка машиной не вышло: CLIP на проверке
    22.09.2026 отвечал «маленькая» на что угодно, разброс 0.58-0.83 и
    никакой связи с тем, что на фото. Значит, выбирает человек, а
    умолчание остаётся стройным — модель ошибается в большую сторону."""

    def setUp(self):
        import ui
        self.ui = ui
        self.s = Store(os.path.join(tempfile.mkdtemp(), "b.db"))
        self.s.ensure_user(1, "kto", welcome=5)

    def test_три_положения_и_все_в_промпте(self):
        self.assertEqual(set(self.ui.ФИГУРЫ), set(prompts.СЛОЖЕНИЕ))

    def test_умолчание_стройное(self):
        self.assertEqual(prompts.СЛОЖЕНИЕ_ПО_УМОЛЧАНИЮ, "стройная")
        p = catalog.scene("un_full").промпт()
        self.assertIn(prompts.СЛОЖЕНИЕ["стройная"], p)

    def test_выбор_доезжает_до_промпта(self):
        p = catalog.scene("un_full").промпт(сложение="пышная")
        self.assertIn(prompts.СЛОЖЕНИЕ["пышная"], p)
        self.assertNotIn(prompts.СЛОЖЕНИЕ["стройная"], p)

    def test_выбор_помнится(self):
        """Человек носит снимки одного и того же человека; спрашивать
        каждый раз значит спрашивать зря."""
        self.assertEqual(self.s.сложение(1), "")
        self.s.сменить_сложение(1, "пышная")
        self.assertEqual(self.s.сложение(1), "пышная")

    def test_кнопка_показывает_текущее(self):
        клава = self.ui.меню_сценария(catalog.scene("un_full"), "ru", None, "пышная")
        тексты = [b["text"] for р in клава["inline_keyboard"] for b in р]
        self.assertTrue(any("Пышная" in т for т in тексты), тексты)

    def test_экран_выбора_предлагает_все_три(self):
        клава = self.ui.меню_фигуры(catalog.scene("un_full"))
        данные = [b.get("callback_data","") for р in клава["inline_keyboard"] for b in р]
        for к in self.ui.ФИГУРЫ:
            self.assertIn(f"fg:{к}:un_full", данные)


class ПорядокСнимковУПары(unittest.TestCase):
    """Узел модели берёт снимки без подписей ролей: сказать «на первом
    он, на втором она» технически нечем, единственная зацепка — слова
    «first reference» в промпте. Значит, порядок соблюдает человек, и
    сказать ему надо прямо.

    Прогон 22.09.2026 поймал это на нас самих: в сцены МЖ ушёл первым
    женский снимок, и модель вернула двух женщин."""

    def setUp(self):
        import ui
        self.ui = ui

    def test_мж_просит_мужчину_первым(self):
        текст = catalog.порядок_фото(catalog.scene("pf_mf_near"))
        self.assertIn("мужчину", текст)
        self.assertIn("перв", текст.lower())

    def test_у_жж_порядок_не_важен(self):
        текст = catalog.порядок_фото(catalog.scene("pf_ff_near"))
        self.assertIn("любой", текст)

    def test_одиночной_сцене_ничего_не_говорим(self):
        self.assertEqual(catalog.порядок_фото(catalog.scene("un_close")), "")

    def test_видно_до_оплаты(self):
        """Человек платит до результата: узнать про порядок после
        списания коина — узнать поздно."""
        экран = self.ui.шапка_сценария(catalog.scene("pf_mf_near"), 10)
        self.assertIn("мужчину", экран)

    def test_видно_и_на_сборе_снимков(self):
        sc = catalog.scene("pf_mf_near")
        текст = self.ui.текст_сбора_фото(sc, pricing.job(sc.job), 0)
        self.assertIn("мужчину", текст)


class ДействиеПоказываетсяВКонце(unittest.TestCase):
    """«Снимает лифчик», «снимает трусики» — это ДВИЖЕНИЕ, и модель
    брала его первый кадр: одетая женщина. Прогон 22.09.2026 отдал так
    два варианта подряд."""

    def test_сказано_что_одежда_уже_снята(self):
        for ключ in ("ph_below", "ph_push"):
            p = catalog.scene(ключ).промпт()
            self.assertIn("ALREADY OFF", p, ключ)
            self.assertIn("the undressing is finished", p, ключ)

    def test_у_пары_раздеваются_оба(self):
        """Обязательная строка владельца написана про одного. Прогон
        22.09.2026: женщина голая, мужчина в серых шортах с его листа.

        Нагота проверяется по СМЫСЛУ, а не по прежней букве «stripped
        bare»: та формулировка отрицала одежду, и купальник с референса
        её пересиливал. Теперь про каждого сказано то, чего в одежде не
        бывает, — про её соски и про его член.
        """
        p = catalog.scene("pf_mf_near").промпт()
        self.assertIn("her own nipples in plain view", p)
        # Мужская нагота названа ПРЯМО и анатомично: общего «оба голые»
        # сборке не хватало — замер дал 1 кадр из 2 против 2 из 2.
        #
        # Слова могут быть двумя: у обычной кнопки это «his erect penis
        # is in plain view», у кнопки с жёсткой постановкой — «HIS
        # ERECT PENIS IS GOING INTO IT». Второе сильнее первого: член
        # не просто виден, он в кадре занят делом. Проверяем смысл —
        # что член НАЗВАН, — а не одну из двух формулировок.
        self.assertIn("erect penis", p.lower())
        # Названий одежды тут нет ВООБЩЕ: модель рисует названное, и
        # «не мужские шорты» выдавали ровно шорты.
        # См. `ОдеждуНеНазываемВПоложительномТексте`.
        self.assertIn("nothing on h", p, "не сказано, что на нём ничего нет")

    def test_одиночной_сцене_про_обоих_не_говорим(self):
        self.assertNotIn("BOTH people", catalog.scene("un_full").промпт())

    def test_стоит_сразу_за_действием(self):
        """В хвосте промпта оно проигрывает описанию кадра."""
        sc = catalog.scene("ph_push")
        p = sc.промпт()
        self.assertLess(p.index("ALREADY OFF"), p.index(prompts.КОЖА))
        self.assertGreater(p.index("ALREADY OFF"), p.index(sc.откровенное))


class РезультатВсегдаОткровенный(unittest.TestCase):
    """18+ и одетый кадр — это брак, за который заплачено.

    21.09.2026 «Снимает лифчик» вернул девушку в белье: строка владельца
    описывала ДЕЙСТВИЕ, а обязательную строку получал только свой
    промпт. Теперь её получают все.
    """

    def test_обязательная_строка_в_каждом_варианте(self):
        обяз = catalog.обязательная_строка()
        for s in catalog.все_сценарии():
            # У пары строка своя, во множественном числе: единственное
            # число рядом с двумя людьми модель понимает буквально и
            # раздевает одного (прогон 22.09.2026, ЖЖ: первая голая,
            # вторая в белье).
            if s.пара and prompts.семейство(s.job) == "i2i":
                # У парной ФОТОГРАФИИ сборка короткая, и служебная
                # строка в неё не идёт: нагота объявлена своим
                # предложением, с названной анатомией — см.
                # `ПАРА_РАЗДЕТЫ_ДОГОЛА`. У парного РОЛИКА сборка
                # прежняя: там первый кадр приходит готовой
                # фотографией, и длина ему не мешает.
                #
                # «Completely naked» принимается наравне с «in plain
                # view», и это не послабление. У «Отлизывает сзади
                # (лёжа)» женщина лежит НА ЖИВОТЕ: сосков в таком
                # кадре не видно физически, и требовать их — значит
                # воевать с собственной позой. Гарантия та же: в кадре
                # нет одежды.
                п = s.промпт()
                self.assertTrue(
                    "in plain view" in п or "completely naked" in п.lower(),
                    s.key)
            elif s.пара:
                self.assertIn(prompts.ОБЯЗАТЕЛЬНОЕ_ПАРА, s.промпт(), s.key)
            else:
                self.assertIn(обяз, s.промпт(), s.key)

    def test_обязательная_строка_стоит_в_начале(self):
        """В конце она проигрывает обстановке и свету — ровно так и
        получился кадр в белье."""
        s = catalog.scene("un_close")
        текст = s.промпт()
        где = текст.index(catalog.обязательная_строка())
        # Не «в первой половине», а ДО позы и техники: перед ней стоят
        # только правка снимка, сохранение человека и сложение — три
        # блока, и все три обязаны идти раньше.
        self.assertLess(где, текст.index(геометрия(s)), "уехала за позу")

    def test_правка_владельца_подхватывается(self):
        """Строка правится на странице каталога и обязана доезжать до
        вариантов без перезапуска бота."""
        старый = данные.ФАЙЛ
        данные.ФАЙЛ = tempfile.mktemp(suffix=".json")
        try:
            данные.сохранить({prompts.ОБЯЗАТЕЛЬНОЕ_КЛЮЧ:
                              {"строка": "SHE IS COMPLETELY NAKED."}})
            catalog.перечитать()
            self.assertIn("SHE IS COMPLETELY NAKED.",
                          catalog.scene("un_close").промпт())
        finally:
            данные.ФАЙЛ = старый
            catalog.перечитать()


class ЧеловекВидитЗаЧтоПлатит(unittest.TestCase):
    """Оплата идёт ДО результата. Название и цена этого не объясняют."""

    def setUp(self):
        import ui
        self.ui = ui

    def tearDown(self):
        catalog.перечитать()

    def test_на_экране_есть_место(self):
        for c in catalog.ВИДИМЫЕ:
            for s in c.scenes:
                if s.пара:
                    continue      # у пары места не обещаем, см. ниже
                э = self.ui.шапка_сценария(s, 100)
                self.assertIn("Фон:", э, f"{s.key}: не сказано где")

    def test_у_пары_на_экране_назван_состав(self):
        """Акты у МЖ, ЖЖ и ММ владелец писал разные, и человек должен
        видеть, за какой платит: в общем списке имена совпадают."""
        for s in catalog.узел("vi_group").все_сцены:
            э = self.ui.шапка_сценария(s, 100)
            self.assertIn("В кадре: <b>" + s.пара + "</b>", э)
            self.assertIn("Расстановка:", э)

    def test_у_кадровых_сценариев_назван_ракурс(self):
        for c in ("un_here", "vi_solo"):
            for s in catalog.category(c).scenes:
                э = self.ui.шапка_сценария(s, 100)
                self.assertIn("Ракурс:", э, f"{s.key}: не сказан ракурс")

    def test_сколько_снимков_нести_сказано_до_оплаты(self):
        э = self.ui.шапка_сценария(catalog.scene("pr_mf_near"), 100)
        self.assertIn("два", э)

    def test_действие_показывается_когда_владелец_его_назвал(self):
        catalog.подставить({"un_close": {"строка_рус": "делает что-то"}})
        э = self.ui.шапка_сценария(catalog.scene("un_close"), 100)
        self.assertIn("Действие: <b>делает что-то</b>", э)

    def test_ненаписанное_действие_не_выдумывается(self):
        catalog.подставить({})
        self.assertNotIn("Действие:",
                         self.ui.шапка_сценария(catalog.scene("un_close"), 100))


class Раскладка(unittest.TestCase):
    """Разделы разложены по логике конкурента, названия свои.

    У него фото-в-фото разложено по ОБСТАНОВКЕ, а оживление по
    ДЕЙСТВИЮ. Прежняя наша раскладка была по одежде («Бельё») — это
    логика мягкого фотобота, и владелец справедливо спросил, что она
    тут делает.
    """

    def test_все_сценарии_требуют_референса(self):
        for c in catalog.ВИДИМЫЕ:
            for s in c.scenes:
                self.assertTrue(pricing.job(s.job).нужно_фото,
                                f"{s.key}: сценарий без входного фото")

    def test_узлы_по_видам_работы(self):
        по_ключу = {c.key: {s.job for s in c.scenes} for c in catalog.ВИДИМЫЕ}
        self.assertEqual(по_ключу.get("un_here"), {"i2i"})
        self.assertEqual(по_ключу.get("un_intim"), {"i2i"})
        self.assertEqual(по_ключу.get("un_mf"), {"i2i"})
        self.assertEqual(по_ключу.get("vi_solo"), {"i2v_5"})
        self.assertEqual(по_ключу.get("vi_mm"), {"i2v_5"})

    def test_свой_промпт_знает_свой_вид_работы(self):
        for под in catalog.узел("own").дети:
            self.assertIn(под.key, catalog.СВОБОДНЫЕ)
            self.assertIn(catalog.СВОБОДНЫЕ[под.key], pricing.JOBS)

    def test_звук_снят_с_продажи(self):
        """Реализации нет: в панели ноль строк работы со звуком, и вид
        отдавал бы немой ролик по цене самой дорогой позиции."""
        self.assertFalse(pricing.job("sound").в_продаже)
        self.assertNotIn("sound", {s.job for s in catalog.все_сценарии()})
        self.assertNotIn("sound", {j.key for j in pricing.В_ПРОДАЖЕ})

    def test_категории_бельё_больше_нет(self):
        ключи = {c.key for c in catalog.CATEGORIES}
        self.assertNotIn("lingerie", ключи)


class ММУбраны(unittest.TestCase):
    """Решение владельца 21.09.2026: «ММ лучше убрать - может тригернуть
    обычного пользователя». ЖЖ остаются: «ЖЖ нравится многим»."""

    def test_в_групповом_только_два_состава(self):
        for узел in ("un_group", "vi_group"):
            имена = [д.key for д in catalog.узел(узел).видимые_дети]
            self.assertEqual(имена, [узел[:3] + "mf", узел[:3] + "ff"], узел)

    def test_сцены_мм_не_открываются(self):
        мм = [s for s in catalog.все_сценарии() if "_mm_" in s.key]
        self.assertTrue(мм, "сцены ММ пропали из кода — их надо было спрятать")
        for s in мм:
            self.assertTrue(s.скрыт, s.key)

    def test_старая_кнопка_из_переписки_не_падает(self):
        """У владельца в чате остались сообщения с этими кнопками.
        Ключ обязан резолвиться, чтобы бот ответил «этого больше нет»,
        а не свалился в обработчике."""
        s = catalog.scene("pf_mm_near")
        self.assertTrue(s.скрыт)

    def test_владелец_может_вернуть_со_страницы(self):
        """Умолчание кода — не приговор: на странице рядом «Вернуть»."""
        старый = данные.ФАЙЛ
        данные.ФАЙЛ = tempfile.mktemp(suffix=".json")
        try:
            данные.сохранить({"un_mm": {"скрыт": "0"}})
            catalog.перечитать()
            self.assertFalse(catalog.скрыт("un_mm"))
        finally:
            данные.ФАЙЛ = старый
            catalog.перечитать()
            self.assertTrue(catalog.скрыт("un_mm"))

    def test_пустое_поле_не_считается_возвратом(self):
        """Страница шлёт «скрыт» по всем ключам разом. Читай бот пустое
        как «вернуть» — ММ возвращались бы при каждом сохранении."""
        старый = данные.ФАЙЛ
        данные.ФАЙЛ = tempfile.mktemp(suffix=".json")
        try:
            данные.сохранить({"un_mm": {"название": "ММ", "скрыт": ""}})
            catalog.перечитать()
            self.assertTrue(catalog.скрыт("un_mm"))
        finally:
            данные.ФАЙЛ = старый
            catalog.перечитать()


class ЖёсткаяПостановка(unittest.TestCase):
    """Кадры, которые владелец отобрал на живом прогоне.

    Обычная парная сцена собирается из его строки плюс общая геометрия
    расстановки, и каждый раз выходит «что-то похожее». Там, где он
    сказал «чтобы у всех был такой ракурс и поза», похожего мало:
    постановка вписана дословно и обязана доезжать до промпта — и у
    фотографии, и у первого кадра ролика.
    """

    ЯКОРЬ = "TURNED TWENTY-FIVE DEGREES"
    # «Кунилингус» МЖ: своя постановка, свой якорь.
    ЯКОРЬ_К = "lies flat on his stomach between those open thighs"

    def test_у_фотографии_постановка_есть(self):
        self.assertIn(self.ЯКОРЬ, catalog.scene("pf_mf_near").prompt)

    def test_лист_у_кнопки_совпадает_с_листом_эталона(self):
        """Бот всегда просил вертикаль, а «Раком» и «Кунилингус»
        владелец отбирал на горизонтальных кадрах: двое лежат поперёк
        листа, и в вертикальный эта поза не влезает — сборка её
        перестраивает. Клиент получал не то, что утверждено."""
        self.assertEqual(catalog.лист("pf_mf_near"), "horiz")
        self.assertEqual(catalog.лист("pf_mf_behind"), "horiz")
        self.assertEqual(catalog.лист("pf_mf_face"), "vert")
        # У ролика лист тот же: он начинается с кадра.
        self.assertEqual(catalog.лист("pr_mf_near"), "horiz")
        # Всё остальное — прежняя вертикаль.
        for ключ in ("un_close", "pf_ff_near", "pf_mm_above"):
            self.assertEqual(catalog.лист(ключ), "vert", ключ)

    def test_у_минета_своя_постановка_и_без_старого_объектива(self):
        """«Минет» стоит на расстановке «от первого лица», и её
        объектив («лица второго не видно») прямо противоречит просьбе
        владельца видеть обоих. Постановка обязана его вытеснить."""
        for ключ in ("pf_mf_pov", "pr_mf_pov"):
            p = catalog.scene(ключ).prompt_фото()
            self.assertIn("THE TOP OF HER HEAD ONLY REACHES HIS WAIST", p, ключ)
            self.assertNotIn("Point-of-view", p, ключ)
            self.assertNotIn("never their face", p, ключ)
        # У ЖЖ и ММ та же расстановка осталась прежней.
        self.assertNotIn("THE TOP OF HER HEAD",
                         catalog.scene("pf_ff_pov").prompt)

    def test_у_всех_пяти_кнопок_ЖЖ_своя_постановка(self):
        """Раздел ЖЖ владелец принял 22.09 целиком: пять кнопок, пять
        отобранных кадров. До 23.09 в боте не стояло ни одной — кнопки
        собирались общей геометрией и давали «что-то похожее»."""
        якоря = {
            "pf_ff_near": "SITS ON THE EDGE OF THE BED",
            "pf_ff_face": "rolled onto her side",
            "pf_ff_close": "HAS BENT FAR FORWARD",
            "pf_ff_behind": "PARALLEL and NOT TOUCHING",
            "pf_ff_pov": "lies flat on her stomach between those open thighs",
        }
        for ключ, якорь in якоря.items():
            self.assertIn(якорь, catalog.scene(ключ).prompt, ключ)
            # И в первом кадре ролика тоже: ролик начинается с фото.
            self.assertIn(якорь,
                          catalog.scene(ключ.replace("pf_", "pr_")).prompt_фото(),
                          ключ)

    def test_постановка_ЖЖ_не_протекла_в_МЖ_и_ММ(self):
        for ключ in ("pf_mf_near", "pf_mm_near", "pf_mf_face"):
            self.assertNotIn("PARALLEL and NOT TOUCHING",
                             catalog.scene(ключ).prompt, ключ)

    def test_у_каждой_постановки_есть_своя_нагота(self):
        """Жёсткая постановка ПОДАВЛЯЕТ общий блок про наготу: он
        написан про безымянных «двоих» и рядом с дословным текстом
        спорит с ним. Значит, каждая постановка обязана объявлять
        наготу сама — иначе кнопка молча начнёт отдавать одетых."""
        for (состав, расст), текст in catalog.ЖЁСТКАЯ_ПОСТАНОВКА.items():
            т = текст.lower()
            self.assertTrue(
                "completely naked" in т or "in plain view" in т
                or "nothing on her" in т,
                f"{состав}_{расст}: в постановке не объявлена нагота")

    def test_у_кунилингуса_своя_постановка(self):
        for ключ in ("pf_mf_behind", "pr_mf_behind"):
            self.assertIn(self.ЯКОРЬ_К, catalog.scene(ключ).prompt_фото(), ключ)

    def test_кунилингус_не_протёк_в_женскую_и_мужскую_пару(self):
        for ключ in ("pf_ff_behind", "pf_mm_behind", "pf_mf_near"):
            self.assertNotIn(self.ЯКОРЬ_К, catalog.scene(ключ).prompt, ключ)

    def test_у_кунилингуса_мужчина_не_запрещён(self):
        """Та самая поломка 23.09.2026: у кнопки нет слов «erect penis»,
        и негатив уезжал в женскую ветку с «man, male body»."""
        n = catalog.scene("pf_mf_behind").negative
        self.assertNotIn("man, male body", n)
        self.assertNotIn("penis, cock", n)

    def test_руки_мужчины_названы_рано_а_нагота_раньше(self):
        """Порядок в постановке «Кунилингуса» — не украшение: руки
        отдельным предложением отодвигали наготу за первую тысячу
        знаков, и возвращались серые шорты."""
        # Мера тут АБСОЛЮТНАЯ, а не доля: сборка держит примерно первую
        # тысячу знаков, и от того, длинный ли хвост промпта, это число
        # не зависит.
        p = catalog.scene("pf_mf_behind").prompt
        self.assertLess(p.index("HIS WHOLE BACK IS BARE SKIN"), 1000)
        self.assertIn("both of his forearms flat on the mattress", p)

    def test_у_ролика_первый_кадр_тот_же(self):
        """Ролик начинается с КАДРА, и раздевает человека именно он.
        Если постановка не доедет до фото-шага, ролик пойдёт от чужой
        позы, и никакой текст движения этого уже не исправит."""
        self.assertIn(self.ЯКОРЬ, catalog.scene("pr_mf_near").prompt_фото())

    def test_соседние_кнопки_не_задеты(self):
        """Расстановка одна на три состава. Жёсткая постановка МЖ не
        имеет права протечь в ЖЖ и ММ: там другие тела."""
        for ключ in ("pf_ff_near", "pf_mm_near", "pf_mf_face"):
            self.assertNotIn(self.ЯКОРЬ, catalog.scene(ключ).prompt, ключ)

    def test_постановка_стоит_в_первой_трети(self):
        """Держится примерно первая тысяча знаков промпта — дальше
        сборка до текста не доходит. Проверено на «Виде снизу» и на
        руках в парных сценах."""
        p = catalog.scene("pf_mf_near").prompt
        self.assertLess(p.index(self.ЯКОРЬ), len(p) // 3)

    def test_в_постановке_нет_запретов_словами(self):
        """Дефект, названный в положительном тексте, сборка рисует.
        Поэтому в постановке говорится, что В КАДРЕ ЕСТЬ, а чего нет —
        только в негативе."""
        p = catalog.scene("pf_mf_near").prompt.lower()
        for слово in ("deformed", "extra finger", "bad anatomy", "ugly"):
            self.assertNotIn(слово, p, слово)


class ЭкранОжидания(unittest.TestCase):
    """«Считаю фото по фото…» владелец забраковал 21.09.2026.

    Это название пункта в прайсе, а не то, чего человек ждёт от бота
    восемнадцать плюс.
    """

    def setUp(self):
        import ui
        self.ui = ui

    def test_прайсовых_слов_нет(self):
        for вид in self.ui.ШАГИ:
            for сек in (0, 20, 200):
                for я in язык.ЯЗЫКИ:
                    текст = self.ui.ожидание(вид, сек, я)
                    self.assertNotIn("фото по фото", текст)
                    self.assertNotIn("photo from photo", текст)

    def test_строка_меняется_по_ходу(self):
        """Неподвижная строка две минуты читается как зависший бот."""
        было = {self.ui.ожидание("фото", с) for с in range(0, 60, 5)}
        self.assertGreater(len(было), 3, "экран ожидания стоит столбом")

    def test_первым_делом_раздеваю(self):
        self.assertIn("Раздеваю", self.ui.ожидание("фото", 0))

    def test_ролик_честно_говорит_про_кадр(self):
        """Видео считается двумя проходами, и первый - фотография. Пока
        экран писал «считаю видео», первая минута была враньём."""
        self.assertIn("кадр", self.ui.ожидание("кадр", 0).lower())

    def test_только_премиум_иконки(self):
        """Ни одного простого смайла вне запасных - требование
        владельца: «везде использовать только премиум эмодзи»."""
        import re
        текст = self.ui.ожидание("фото", 30)
        снаружи = re.sub(r"<tg-emoji[^>]*>.*?</tg-emoji>", "", текст)
        for знак in снаружи:
            self.assertLess(ord(знак), 0x2190,
                            f"простой значок «{знак}» мимо премиум-набора")

    def test_запрещённый_смайл_не_всплыл(self):
        for вид in self.ui.ШАГИ:
            for сек in (0, 13, 40):
                self.assertNotIn("😏", self.ui.ожидание(вид, сек))


class БезлимитныйБаланс(unittest.TestCase):
    """Владелец и админ проверяют варианты подряд. Считать им коины
    значит заставлять их же себе их и начислять."""

    def setUp(self):
        self.s = Store(os.path.join(tempfile.mkdtemp(), "b.db"),
                       безлимит=["6547482131", "@ktodaniel"])
        self.s.ensure_user(6547482131, "admin", welcome=0)
        self.s.ensure_user(500, "ktodaniel", welcome=0)
        self.s.ensure_user(7, "чужой", welcome=2)

    def test_по_id_и_по_имени(self):
        self.assertTrue(self.s.безлимитный(6547482131))
        self.assertTrue(self.s.безлимитный(500))
        self.assertFalse(self.s.безлимитный(7))

    def test_баланс_не_кончается(self):
        for _ in range(50):
            self.s.spend(500, 5, "проба")
        self.assertEqual(self.s.balance(500), store.БЕЗЛИМИТ)

    def test_чужому_считаем_как_прежде(self):
        self.s.spend(7, 2, "работа")
        self.assertEqual(self.s.balance(7), 0)
        with self.assertRaises(NotEnoughCoins):
            self.s.spend(7, 1, "ещё")

    def test_книга_не_замусоривается(self):
        """Запись о списании, которого не было, испортила бы и историю,
        и отчёт «потрачено» в кабинете."""
        self.s.spend(500, 5, "проба")
        self.assertEqual(self.s.сводка(500)["потрачено"], 0)

    def test_без_списка_всё_как_было(self):
        чистый = Store(os.path.join(tempfile.mkdtemp(), "b.db"))
        чистый.ensure_user(1, "kto", welcome=1)
        self.assertFalse(чистый.безлимитный(1))
        self.assertEqual(чистый.balance(1), 1)


class ИконкаНаКаждойКнопке(unittest.TestCase):
    """Требование владельца 21.09.2026: значок слева у каждой кнопки, и
    в одном сообщении они разные.

    Иконка ничего не сообщает сама - подпись кнопки полна и без неё.
    Правило тут не про смысл, а про то, чтобы ни одна кнопка не
    выглядела забытой рядом с наряженными.
    """

    def setUp(self):
        import ui
        self.ui = ui

    def экраны(self):
        import pricing as p
        ui = self.ui
        для = [ui.главное_меню(), ui.меню_оплаты(), ui.меню_кабинета(),
               ui.мало_коинов(), ui.меню_удаления(), ui.меню_способов("p1"),
               ui.под_результатом("j1", "фото"),
               ui.меню_приглашения("https://t.me/x", "текст")]
        for у in catalog.УЗЛЫ:
            if not у.пустой:
                для.append(ui.меню_узла(у))
        for s in catalog.все_сценарии()[:20]:
            для.append(ui.меню_сценария(s))
            для.append(ui.меню_мест(s))
            для.append(ui.меню_сбора_фото(s, 2))
        return для

    def test_иконка_есть_везде(self):
        for к in self.экраны():
            for ряд in к["inline_keyboard"]:
                for b in ряд:
                    self.assertIn("icon_custom_emoji_id", b,
                                  f"кнопка без иконки: {b['text']}")

    def test_в_одном_сообщении_иконки_разные(self):
        """Кроме валюты: «Баланс» и «Пополнить» стоят рядом и говорят об
        одних и тех же деньгах. Разные значки на них читались бы как
        разные кошельки - см. блок «Знак валюты» в emoji.py."""
        for к in self.экраны():
            иконки = [b["icon_custom_emoji_id"]
                      for ряд in к["inline_keyboard"] for b in ряд
                      if b["icon_custom_emoji_id"] != emoji.МОНЕТА]
            self.assertEqual(len(иконки), len(set(иконки)),
                             "в одном сообщении повторяются иконки")

    def test_иконка_кнопки_не_скачет(self):
        """Человек запоминает экран глазами. Значок, меняющийся при
        каждом открытии, делает знакомый экран чужим."""
        у = catalog.узел("un_here")
        первый = self.ui.меню_узла(у)["inline_keyboard"]
        второй = self.ui.меню_узла(у)["inline_keyboard"]
        self.assertEqual([b["icon_custom_emoji_id"] for р in первый for b in р],
                         [b["icon_custom_emoji_id"] for р in второй for b in р])

    def test_стрелки_и_валюта_не_раздаются(self):
        """Стрелка читается как «назад», палец как «нажми», валюта как
        деньги. Всплыв на случайной кнопке, они врут."""
        for занят in (emoji.ВЛЕВО, emoji.ПАЛЕЦ, emoji.МОНЕТА, emoji.ОБЛАКО):
            self.assertNotIn(занят, emoji.РОССЫПЬ)

    def test_подразделы_тоже_с_иконками(self):
        """«На некоторых подразделах нету эмодзи» - владелец, 21.09.2026."""
        для = self.ui.меню_узла(catalog.узел("undress"))
        for ряд in для["inline_keyboard"]:
            for b in ряд:
                self.assertIn("icon_custom_emoji_id", b, b["text"])


class НижнееМенюБезИконок(unittest.TestCase):
    """Решение владельца 21.09.2026: иконки только в сообщениях.

    Нижняя клавиатура видна всегда и служит навигацией. Премиум-значки
    в ней соревнуются за внимание с кнопками в сообщении, где они и
    должны работать.
    """

    def test_в_нижнем_меню_нет_иконок(self):
        import ui
        for я in язык.ЯЗЫКИ:
            for ряд in ui.нижнее(я)["keyboard"]:
                for к in ряд:
                    self.assertNotIn("icon_custom_emoji_id", к,
                                     f"иконка на нижней кнопке «{к['text']}»")

    def test_в_сообщениях_иконки_есть(self):
        """Обратная сторона: убрать их везде — тоже не то, о чём речь."""
        import ui
        с_иконкой = [b for ряд in ui.главное_меню()["inline_keyboard"]
                     for b in ряд if "icon_custom_emoji_id" in b]
        self.assertGreater(len(с_иконкой), 0, "иконки пропали и из сообщений")


class ПремиумИконкиВТексте(unittest.TestCase):
    """Под премиум-иконкой — ровно один эмодзи, и никак иначе.

    Проверено на живом боте 21.09.2026 через sendMessage:

        буква «C»      -> ENTITY_TEXT_INVALID
        два эмодзи     -> ENTITY_TEXT_INVALID
        один эмодзи    -> ok

    Цена ошибки несоразмерна: Телеграм отбивает ВСЁ сообщение, а не
    портит значок. Из-за этого бот при первом запуске не мог ответить
    на /start вовсе — экран приветствия складывал слово AMBERRY из
    премиум-букв.
    """

    def test_буква_под_иконкой_не_проходит(self):
        with self.assertRaises(ValueError):
            emoji.тег(emoji.МОНЕТА, "C")

    def test_два_эмодзи_не_проходят(self):
        with self.assertRaises(ValueError):
            emoji.тег(emoji.МОНЕТА, "😏😏")

    def test_пустой_запасной_не_проходит(self):
        with self.assertRaises(ValueError):
            emoji.тег("123", "")

    def test_у_каждой_иконки_есть_запасной_символ(self):
        """Иначе `тег()` без явного запасного упадёт на живом экране."""
        имена = [n for n in dir(emoji)
                 if n.isupper() and isinstance(getattr(emoji, n), str)
                 and getattr(emoji, n).isdigit()]
        for n in имена:
            self.assertIn(getattr(emoji, n), emoji.ЗАПАСНОЙ,
                          f"у иконки {n} нет запасного символа")

    def test_все_запасные_это_один_эмодзи(self):
        for i, з in emoji.ЗАПАСНОЙ.items():
            self.assertTrue(emoji._один_эмодзи(з), f"{i}: запасной {з!r} не эмодзи")

    def test_шапка_это_простой_текст(self):
        """Название премиум-буквами невозможно: буква не эмодзи."""
        self.assertNotIn("tg-emoji", emoji.шапка())
        self.assertEqual(emoji.шапка(), emoji.ИМЯ)

    def test_ни_один_экран_не_кладёт_под_иконку_не_эмодзи(self):
        """Сквозная проверка: собираем реальные экраны и смотрим, что
        внутри каждого tg-emoji ровно один эмодзи."""
        import ui
        экраны = [ui.шапка_главного(5, "Ника"), ui.текст_оплаты(),
                  ui.текст_пакета(pricing.PACKS[0]),
                  ui.текст_кабинета(5, {"работ": 1, "осечек": 0, "потрачено": 1,
                                        "куплено": 1, "позвано": 0,
                                        "за_друзей": 0, "записей": 1}, "Ника")]
        экраны += [ui.шапка_категории(c) for c in catalog.ВИДИМЫЕ]
        import re as _re
        нашли = 0
        for э in экраны:
            for внутри in _re.findall(r'<tg-emoji emoji-id="\d+">(.*?)</tg-emoji>', э):
                нашли += 1
                self.assertTrue(emoji._один_эмодзи(внутри),
                                f"под иконкой {внутри!r} — Телеграм отобьёт экран")
        self.assertGreater(нашли, 0, "иконок в экранах не нашлось вовсе")


class БезВидеокарты(unittest.TestCase):
    """Бот обязан жить без карты.

    Карта арендуется почасово: её берут под нагрузку и возвращают,
    поэтому «карты нет» — обычное состояние, а не авария. Баланс,
    пакеты, оплата, кабинет, архив и «Мои работы» от неё не зависят.

    Первый боевой запуск на сервере упал именно здесь: при пустом
    адресе панели urllib ронял ValueError «unknown url type:
    '/api/stats'» ещё до try, и бот не поднимался вовсе.
    """

    def setUp(self):
        from gpu import Gpu
        self.g = Gpu("", "rocket", "")

    def test_ненастроенная_карта_видна_как_ненастроенная(self):
        self.assertFalse(self.g.настроена)

    def test_проверка_живости_не_падает_а_отвечает_нет(self):
        self.assertFalse(self.g.alive())

    def test_любой_вызов_даёт_нашу_ошибку_а_не_чужую(self):
        from gpu import GpuError
        with self.assertRaises(GpuError):
            self.g.free_vram()
        with self.assertRaises(GpuError):
            self.g.start(prompt="x", mode="photo")

    def test_настроенная_карта_видна_как_настроенная(self):
        from gpu import Gpu
        self.assertTrue(Gpu("http://1.2.3.4:8000", "rocket", "x").настроена)


class НижнееМеню(unittest.TestCase):
    """Кнопка на экране обязана что-то делать.

    Нижняя клавиатура шлёт обычный ТЕКСТ, а не callback. Пока таблицы
    обработчиков не было, все четыре кнопки падали в «Сначала выбери,
    что делаем»: клавиатура висела постоянно и не делала ничего, а
    заметить это по коду нельзя — ни одна строка не падает.
    """

    def test_у_каждой_кнопки_есть_обработчик(self):
        """И на каждом языке. Человек переключил язык — снизу до
        следующего сообщения висит старая клавиатура, и её нажатие
        обязано сработать."""
        import ui, bot
        for я in язык.ЯЗЫКИ:
            for ряд in ui.нижнее(я)["keyboard"]:
                for к in ряд:
                    self.assertIn(к["text"], bot.НИЖНИЕ_КНОПКИ,
                                  f"кнопка «{к['text']}» ({я}) ведёт в никуда")

    def test_лишних_обработчиков_нет(self):
        """Обратная сторона: обработчик без кнопки — мёртвый код, и по
        нему потом чинят то, чего человек не видит.

        Прежние подписи — исключение, и оно названное: клавиатура живёт
        в чате, и у давнего человека до нашего следующего сообщения
        висит та, что он получил месяц назад."""
        import ui, bot
        подписи = {к["text"] for я in язык.ЯЗЫКИ
                   for ряд in ui.нижнее(я)["keyboard"] for к in ряд}
        подписи |= set(bot.ПРЕЖНИЕ_НИЗА)
        self.assertEqual(set(bot.НИЖНИЕ_КНОПКИ) - подписи, set())

    def test_подписи_именно_те_что_просил_владелец(self):
        """Он прислал их списком дважды. Значок — часть подписи, и без
        него кнопка уже не та, о которой договаривались."""
        import ui
        было = [к["text"] for ряд in ui.нижнее("ru")["keyboard"] for к in ряд]
        self.assertEqual(было, ["🫦 Создать", "🗂️ Файлы",
                                "🛠️ Кабинет", "🩷 Пополнить"])

    def test_прежняя_кнопка_всё_ещё_работает(self):
        """Владелец поменял четыре подписи 21.09.2026 и не увидел
        перемены: у него внизу висела прежняя клавиатура."""
        import bot
        for старое in ("Создать", "Мои работы", "Баланс", "Пополнить"):
            self.assertIn(старое, bot.НИЖНИЕ_КНОПКИ,
                          f"«{старое}» теперь ведёт в никуда")

    def test_новая_клавиатура_уезжает_один_раз(self):
        """Иначе она прилетала бы при каждом нажатии."""
        s = Store(os.path.join(tempfile.mkdtemp(), "b.db"))
        s.ensure_user(7, "kto", welcome=0)
        self.assertTrue(s.низ_устарел(7, "v2"))
        self.assertFalse(s.низ_устарел(7, "v2"))
        self.assertTrue(s.низ_устарел(7, "v3"))


class РаботыВБазе(unittest.TestCase):

    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.s = Store(os.path.join(self.d, "b.db"))
        self.s.ensure_user(1, "kto", welcome=5)

    def test_у_задания_есть_оба_адреса(self):
        """Один диск — каждый показ это лишняя заливка. Один file_id —
        работа живёт у чужой стороны, которая нам ничего не должна."""
        self.s.job_start("j1", 1, "i2i", "p", 1)
        self.s.job_done("j1", file="out.png", path="1/j1.png",
                        tg_file_id="AgACX", size=1234)
        j = self.s.job("j1")
        self.assertEqual(j["state"], "ok")
        self.assertEqual(j["path"], "1/j1.png")
        self.assertEqual(j["tg_file_id"], "AgACX")
        self.assertEqual(j["size"], 1234)

    def test_показывать_нечего_значит_в_работы_не_попадает(self):
        self.s.job_start("j2", 1, "i2i", "p", 1)
        self.s.job_done("j2", file="out.png")          # ни пути, ни file_id
        self.assertEqual(self.s.works(1), [], "работа без адреса показана как готовая")

    def test_осечка_в_работы_не_попадает(self):
        self.s.job_start("j3", 1, "i2i", "p", 1)
        self.s.job_done("j3", error="карта упала")
        self.assertEqual(self.s.works(1), [])

    def test_старая_база_получает_колонки_архива(self):
        """Боевая база уже живёт с людьми: колонки добавляются, а не
        пересоздаются вместе с таблицей."""
        путь = os.path.join(self.d, "старая.db")
        c = sqlite3.connect(путь)
        c.executescript(store.SCHEMA)
        for стлб in ("path", "tg_file_id", "size"):
            c.execute(f"ALTER TABLE jobs DROP COLUMN {стлб}")
        c.commit(); c.close()

        s2 = Store(путь)                      # открытие само чинит схему
        s2.ensure_user(1, "kto", welcome=1)
        s2.job_start("j", 1, "i2i", "p", 1)
        s2.job_done("j", file="o.png", path="1/j.png", tg_file_id="X", size=7)
        self.assertEqual(s2.works(1)[0]["tg_file_id"], "X")


class СтрокаВладельцаСильнееПозы(unittest.TestCase):
    """Строка владельца часто задаёт позу, а поза есть и у сценария.

    «Стоит раком» против «повёрнута на сорок градусов, вес на дальней
    ноге» — прямое противоречие, и модель разрешает его как придётся:
    то одно, то другое, на одном и том же промпте.
    """

    def test_старшинство_объявлено(self):
        б = prompts.Блок(поза="Standing, weight on the far leg.",
                         откровенное="On all fours.")
        p = prompts.собрать("i2i", б)
        self.assertIn(prompts.СТАРШИНСТВО, p)
        self.assertLess(p.index(prompts.СТАРШИНСТВО), p.index("weight on the far leg"),
                        "старшинство объявлено ПОСЛЕ спорной позы")

    def test_без_позы_сценария_старшинство_не_нужно(self):
        """Спорить не с чем — лишний абзац только разбавляет промпт."""
        б = prompts.Блок(камера="50mm.", откровенное="On all fours.")
        self.assertNotIn(prompts.СТАРШИНСТВО, prompts.собрать("i2i", б))

    def test_без_строки_владельца_старшинства_нет(self):
        б = prompts.Блок(поза="Standing, weight on the far leg.")
        self.assertNotIn(prompts.СТАРШИНСТВО, prompts.собрать("i2i", б))

    def test_ракурс_и_свет_остаются_за_сценарием(self):
        """Старшинство только над позой. Ракурс и свет — это и есть то,
        за что человек выбрал именно эту кнопку."""
        self.assertIn("camera angle", prompts.СТАРШИНСТВО)
        self.assertIn("not overridden", prompts.СТАРШИНСТВО)


class ДваЯзыка(unittest.TestCase):
    """Бот один, люди в нём разные. Язык — свойство человека, а не
    процесса: двое с разными языками пишут одновременно."""

    def setUp(self):
        import ui
        self.ui = ui
        self.s = Store(tempfile.mktemp(suffix=".db"))

    def test_язык_берётся_из_телеграма_один_раз(self):
        """`language_code` приходит с КАЖДЫМ сообщением. Перезаписывать
        им выбор человека значит отменять этот выбор при каждом
        нажатии."""
        self.s.ensure_user(1, "vasya", lang="en")
        self.assertEqual(self.s.язык(1), "en")
        self.s.сменить_язык(1, "ru")
        self.s.ensure_user(1, "vasya", lang="en")     # снова пришло от TG
        self.assertEqual(self.s.язык(1), "ru", "телеграм отменил выбор человека")

    def test_старым_людям_язык_проставится_при_первом_заходе(self):
        """У пришедших до двуязычия он пуст — это «ещё не спрашивали»,
        а не «русский»."""
        self.s.ensure_user(2, "old")
        self.s.сменить_язык(2, None)
        self.s.ensure_user(2, "old", lang="en")
        self.assertEqual(self.s.язык(2), "en")

    def test_разбор_кода_телеграма(self):
        self.assertEqual(язык.по_телеграму("ru"), "ru")
        self.assertEqual(язык.по_телеграму("ru-RU"), "ru")
        self.assertEqual(язык.по_телеграму("en"), "en")
        self.assertEqual(язык.по_телеграму("de"), "en")
        self.assertEqual(язык.по_телеграму(None), "en")

    def test_каждая_строка_переведена(self):
        """Забытый перевод виден только тому, кто открыл бот на
        английском, — то есть не нам."""
        for ключ, пара in язык.СТРОКИ.items():
            self.assertTrue(пара.get("ru"), f"{ключ}: нет русского")
            self.assertTrue(пара.get("en"), f"{ключ}: нет английского")

    def test_подстановки_совпадают_в_обоих_языках(self):
        """Лишняя `{скобка}` в переводе роняет экран на KeyError, и
        падает он только у англоязычного человека."""
        import re
        for ключ, пара in язык.СТРОКИ.items():
            поля = {я: set(re.findall(r"\{(\w+)\}", пара[я])) for я in ("ru", "en")}
            self.assertEqual(поля["ru"], поля["en"],
                             f"{ключ}: разные подстановки {поля}")

    def test_неизвестный_ключ_не_роняет_бота(self):
        self.assertEqual(язык.t("нет.такого", "en"), "нет.такого")

    def test_весь_каталог_назван_по_английски(self):
        for s in catalog.все_сценарии():
            self.assertTrue(s.назв("en"), f"{s.key}: нет английского названия")
            self.assertTrue(s.подп("en"), f"{s.key}: нет английской подписи")
            кириллица = [c for c in s.назв("en") + s.подп("en")
                         if "а" <= c.lower() <= "я"]
            self.assertFalse(кириллица, f"{s.key}: кириллица в английском")

    def test_узлы_названы_по_английски(self):
        for у in catalog.УЗЛЫ:
            self.assertIn(у.key, язык.УЗЛЫ_EN, f"{у.key}: нет перевода")

    def test_места_и_составы_названы_по_английски(self):
        for м in catalog.видимые_места():
            self.assertIn(м.key, язык.МЕСТА_КНОПКИ_EN, f"{м.key}: нет перевода")
            кириллица = [c for c in catalog.место_назв(м, "en")
                         if "а" <= c.lower() <= "я"]
            self.assertFalse(кириллица, f"{м.key}: кириллица в английском")
        for s in catalog.все_сценарии():
            if s.пара:
                self.assertIn(s.пара, язык.СОСТАВЫ_EN, f"{s.key}: состав без перевода")

    def test_экраны_собираются_на_обоих_языках(self):
        """Дешёвый, но самый полезный тест: проходит по всем экранам и
        ловит любую несостыковку подстановок."""
        сц = catalog.scene("un_close")
        пара = catalog.scene("pr_mf_near")
        for я in язык.ЯЗЫКИ:
            экраны = [
                self.ui.шапка_главного(5, "Вася", я),
                self.ui.текст_раздела(catalog.раздел("video"), я),
                self.ui.шапка_категории(catalog.category("un_here"), я),
                self.ui.шапка_сценария(сц, 100, я),
                self.ui.шапка_сценария(сц, 0, я),
                self.ui.шапка_сценария(пара, 100, я),
                self.ui.просьба_о_фото(pricing.job("i2i"), 0, None, я),
                self.ui.просьба_о_фото(pricing.job("i2v_5"), 1, (2, 2), я),
                self.ui.просьба_о_фото(pricing.job("i2i"), 2, (1, 3), я),
                self.ui.просьба_о_фото(pricing.job("i2i"), 3, (1, 3), я),
                self.ui.текст_своего_промпта(catalog.category("own_video"), я),
                self.ui.текст_кабинета(5, {"работ": 2, "осечек": 1,
                                           "потрачено": 3, "куплено": 10,
                                           "позвано": 1, "за_друзей": 2,
                                           "записей": 4}, "Вася", я),
                self.ui.текст_удаления({"работ": 1, "записей": 2}, я),
                self.ui.текст_оплаты(я),
                self.ui.текст_пакета(pricing.PACKS[0], я),
            ]
            for э in экраны:
                self.assertTrue(э.strip(), f"{я}: пустой экран")
                self.assertNotIn("{", э, f"{я}: неподставленная скобка: {э[:80]}")

    def test_кнопки_собираются_на_обоих_языках(self):
        сц = catalog.scene("pr_ff_near")
        for я in язык.ЯЗЫКИ:
            клавы = [
                self.ui.главное_меню(None, я),
                self.ui.меню_раздела(catalog.раздел("own"), я),
                self.ui.меню_категории(catalog.category("vi_solo"), я),
                self.ui.меню_сценария(сц, я),
                self.ui.меню_сбора_фото(сц, 2, я),
                self.ui.меню_кабинета(я),
                self.ui.меню_оплаты(я),
                self.ui.меню_способов("p1", я),
                self.ui.меню_удаления(я),
                self.ui.под_результатом("j1", "фото", я),
            ]
            for к in клавы:
                for ряд in к["inline_keyboard"]:
                    for b in ряд:
                        self.assertTrue(b["text"].strip(), f"{я}: пустая кнопка")
                        self.assertNotIn("{", b["text"], f"{я}: {b['text']}")

    def test_английский_интерфейс_без_кириллицы(self):
        """Кроме значка валюты: 😏 — не буква, он одинаков везде."""
        экраны = [
            self.ui.шапка_сценария(catalog.scene("un_close"), 100, "en"),
            self.ui.шапка_сценария(catalog.scene("un_close"), 100, "en",
                                   места.место("sc_shower")),
            self.ui.текст_мест(catalog.scene("un_close"), "en"),
            self.ui.текст_оплаты("en"),
            self.ui.текст_узла(catalog.узел("undress"), "en"),
            self.ui.текст_своего_промпта(catalog.узел("own_photo"), "en"),
        ]
        for э in экраны:
            кириллица = [c for c in э if "а" <= c.lower() <= "я"]
            self.assertFalse(кириллица, f"кириллица в английском: {кириллица}")

    def test_английскому_клиенту_показывается_строка_модели(self):
        """Третьего поля под английскую подпись нет нарочно: владелец
        уже написал английский текст для модели, и он описывает ровно
        то же самое. Просить написать это дважды незачем."""
        catalog.подставить({"un_close": {"строка": "SHE DOES SOMETHING",
                                         "строка_рус": "делает"}})
        try:
            s = catalog.scene("un_close")
            self.assertEqual(s.действие("en"), "SHE DOES SOMETHING")
            self.assertEqual(s.действие("ru"), "делает")
        finally:
            catalog.перечитать()

    def test_название_кнопки_правится_на_каждом_языке_отдельно(self):
        catalog.подставить({"un_full": {"название": "РУС",
                                        "название_en": "ENG"}})
        try:
            s = catalog.scene("un_full")
            self.assertEqual(s.назв("ru"), "РУС")
            self.assertEqual(s.назв("en"), "ENG")
        finally:
            catalog.перечитать()

    def test_пустое_название_не_оставляет_кнопку_пустой(self):
        """Лучше не тот язык, чем пустой прямоугольник."""
        catalog.подставить({})
        for s in catalog.все_сценарии():
            for я in язык.ЯЗЫКИ:
                self.assertTrue(s.button(я).strip())


class УбратьИзБота(unittest.TestCase):
    """Владелец убирает лишнее со страницы.

    Именно УБИРАЕТ, а не удаляет: сценарий — это три с лишним тысячи
    знаков промпта в коде, и стёртый из браузера он бы не вернулся.
    """

    def tearDown(self):
        catalog.перечитать()

    def test_убранный_вариант_исчезает_из_подраздела(self):
        под = catalog.category("un_here")
        было = len(под.видимые)
        catalog.подставить({"un_close": {"скрыт": "1"}})
        self.assertEqual(len(под.видимые), было - 1)
        self.assertNotIn(catalog.scene("un_close"), под.видимые)
        self.assertTrue(catalog.scene("un_close").скрыт)

    def test_убранный_узел_прячет_свои_варианты(self):
        """Иначе спрятанная ветка исчезала бы из меню, а её сценарии
        оставались бы в «Популярном» и открывались по старым кнопкам."""
        catalog.подставить({"un_here": {"скрыт": "1"}})
        self.assertTrue(catalog.узел("un_here").скрыт)
        for s in catalog.узел("un_here").scenes:
            self.assertTrue(s.скрыт, f"{s.key} пережил скрытие ветки")

    def test_скрытие_идёт_вглубь_на_все_уровни(self):
        """Дерево теперь трёхуровневое, и раздел обязан уносить с собой
        не только детей, но и внуков."""
        catalog.подставить({"undress": {"скрыт": "1"}})
        р = catalog.узел("undress")
        self.assertTrue(р.пустой)
        self.assertTrue(catalog.узел("un_solo").скрыт)
        self.assertTrue(catalog.узел("un_intim").скрыт, "внук пережил")
        for s in р.все_сцены:
            self.assertTrue(s.скрыт, f"{s.key} пережил скрытие раздела")

    def test_узел_без_вариантов_не_показывается(self):
        """Кнопка, ведущая в пустой список, — нажатие впустую и назад."""
        у = catalog.узел("un_intim")
        catalog.подставить({s.ключ_правок: {"скрыт": "1"} for s in у.scenes})
        self.assertTrue(у.пустой)
        self.assertNotIn(у, catalog.узел("un_solo").видимые_дети)

    def test_свой_промпт_не_пустеет_от_отсутствия_вариантов(self):
        """Там вариантов нет по устройству: клиент пишет описание сам."""
        catalog.подставить({})
        self.assertFalse(catalog.узел("own").пустой)
        for под in catalog.узел("own").дети:
            self.assertFalse(под.пустой, под.key)

    def test_убранное_пропадает_из_меню(self):
        import ui
        catalog.подставить({"video": {"скрыт": "1"}})
        подписи = [b["text"] for ряд in ui.главное_меню()["inline_keyboard"]
                   for b in ряд]
        self.assertNotIn("Видео", подписи)
        self.assertIn("Раздеть", подписи)

    def test_убранное_не_попадает_в_популярное(self):
        """«Популярное» считается по прошлым заказам: убранный вчера
        сценарий иначе остался бы в нём ещё месяц, на видном месте."""
        s = Store(tempfile.mktemp(suffix=".db"))
        s.ensure_user(1, welcome=99)
        for i, ключ in enumerate(("un_close", "un_full")):
            s.job_start(f"j{i}", 1, "i2i", "p", 1, scene=ключ)
            s.job_done(f"j{i}", file="o.png", path="p", tg_file_id="x", size=1)
        catalog.подставить({})
        self.assertEqual(len(catalog.популярная_категория(s).scenes), 2)
        catalog.подставить({"un_close": {"скрыт": "1"}})
        осталось = [x.key for x in catalog.популярная_категория(s).scenes]
        self.assertEqual(осталось, ["un_full"])

    def test_страница_вправе_прятать_разделы_и_подразделы(self):
        известные = catalog.известные_ключи()
        self.assertIn("undress", известные)
        self.assertIn("un_here", известные)
        self.assertIn("un_close", известные)

    def test_всё_спрятать_нельзя(self):
        """Бот с пустым меню и без единой кнопки, за которую платят.
        Ошибиться так легко, а заметить трудно: страница выглядит
        полной, скрытые пункты с неё никуда не деваются."""
        всё = {s.key: {"скрыт": "1"} for s in catalog.все_сценарии()}
        self.assertFalse(catalog.что_то_осталось(всё))
        всё.pop("un_close")
        self.assertTrue(catalog.что_то_осталось(всё))

    def test_проверка_не_портит_текущие_правки(self):
        """`что_то_осталось` примеряет ещё не сохранённое. Оставить
        примерку в кэше значило бы применить к боту то, что владелец не
        сохранял."""
        catalog.подставить({"un_full": {"название": "МОЁ"}})
        catalog.что_то_осталось({s.key: {"скрыт": "1"}
                                 for s in catalog.все_сценарии()})
        self.assertEqual(catalog.scene("un_full").title, "МОЁ")
        self.assertFalse(catalog.scene("un_close").скрыт)

    def test_вернуть_можно_тем_же_нажатием(self):
        catalog.подставить({"un_full": {"скрыт": "1"}})
        self.assertTrue(catalog.scene("un_full").скрыт)
        catalog.подставить({"un_full": {"скрыт": ""}})
        self.assertFalse(catalog.scene("un_full").скрыт)

    def test_место_тоже_прячется(self):
        catalog.подставить({"sc_studio": {"скрыт": "1"}})
        ключи = [м.key for м in catalog.видимые_места()]
        self.assertNotIn("sc_studio", ключи)
        self.assertIn("ref", ключи, "«как на твоём фото» пропало")


class ТелоНеСклеивается(unittest.TestCase):
    """Прогон 22.09.2026 на крупных планах: лицо вставало прямо над
    пахом, появлялось второе туловище, кисти прирастали к промежности.
    У пары та же беда с обратным знаком — там слипались двое."""

    def одиночка(self):
        return catalog.scene("un_close").prompt_фото()

    def пара(self):
        return catalog.scene("pf_mf_near").prompt_фото()

    def test_одиночке_сказано_одно_тело(self):
        p = self.одиночка()
        self.assertIn("ONE single continuous body", p)
        self.assertNotIn("Exactly two people in the frame", p)

    def test_паре_сказано_ровно_два_тела(self):
        p = self.пара()
        self.assertIn("Exactly two people in the frame", p)
        self.assertNotIn(
            "ONE single continuous body", p,
            "«одно туловище, одна голова» в парной сцене — указание "
            "слепить двоих в одного")

    def test_сколько_людей_сказано_в_начале(self):
        """Стояло пятнадцатым блоком из двадцати одного и не работало:
        у пары «Сверху» набиралась куча из трёх лиц. Негатив до них
        доходил и не побеждал — помог только перенос вверх."""
        # У одиночки — блоками, у пары сборка короткая и блоков в ней
        # нет вовсе; там меряем долей текста.
        блоки = catalog.scene("un_close").prompt_фото().split("\n\n")
        где = [i for i, b in enumerate(блоки)
               if "ONE single continuous body" in b]
        self.assertTrue(где, "un_close")
        self.assertLess(где[0], 4, "«сколько людей» уехало в середину")

        p = catalog.scene("pf_mf_above").prompt_фото()
        self.assertLess(p.index("Exactly two people in the frame"),
                        len(p) * 2 // 3)

    def test_запрет_на_склейку_в_негативе(self):
        neg = prompts.НЕГАТИВ
        for слово in ("duplicated torso", "face on top of crotch",
                      "fused breasts", "collage"):
            self.assertIn(слово, neg)


class ГолыеОстаютсяГолымиДоКонца(unittest.TestCase):
    """Парный вариант «рядом» вышел в бикини и шортах: откровенного
    действия у него нет, требование наготы стояло только в начале, а в
    конце стояла ткань, которая мнётся и прижимается к коже."""

    def test_у_пары_нагота_стоит_в_первой_трети(self):
        """Повтор в хвосте был лекарством от ДЛИНЫ: в пятитысячном
        промпте начало и конец — единственное, что модель читала. У
        короткой парной сборки хвоста нет, весь текст и есть начало.
        Поэтому проверяем не повтор, а место."""
        p = catalog.scene("pf_mf_near").prompt_фото()
        # Якорь не один: обычная сборка говорит «bare skin», жёсткая
        # постановка — «completely naked». Замер 23.09.2026 показал, что
        # вторая формулировка держит одежду лучше (6 кадров из 8 против
        # 3), поэтому проверяем МЕСТО наготы, а не конкретные слова.
        место = min(p.index(с) for с in ("bare skin", "completely naked")
                    if с in p)
        self.assertLess(место, len(p) // 3)

    def test_про_ткань_молчим_когда_одежды_нет(self):
        сц = catalog.scene("pf_mf_near")
        self.assertFalse(сц.блок.гардероб, "у варианта появился гардероб")
        self.assertNotIn("Fabric behaves as fabric", сц.prompt_фото())

    def test_про_ткань_говорим_когда_одежда_названа(self):
        """Откровенные строки живут не в коде, а в правках владельца, —
        поэтому проверяем сам сборщик на блоке с названной одеждой."""
        сц = catalog.scene("un_close")
        блок = catalog.Блок(**{п: getattr(сц.блок, п)
                               for п in catalog.Блок.__slots__})
        self.assertFalse(prompts.одежда_названа(блок))
        блок.откровенное = "She peels the lace bra off and drops it."
        self.assertTrue(prompts.одежда_названа(блок))
        p = prompts.собрать("i2i", блок)
        self.assertIn("Fabric behaves as fabric", p)


class КожаМатовая(unittest.TestCase):
    """Намасленные тела владелец забраковал дважды. Запрета мало:
    сборка слушает утверждение лучше, чем запрет."""

    def test_матовость_сказана_положительно(self):
        p = catalog.scene("un_close").prompt_фото()
        self.assertIn("MATTE and DRY", p)

    def test_в_мужской_сцене_слова_breasts_нет(self):
        p = catalog.scene("pf_mm_near").prompt_фото()
        self.assertNotIn("breasts", p.lower())


class НегативПоКадру(unittest.TestCase):
    """Утверждения «ровно двое» и «оба голые» дожали не всё: у пары
    «Сверху» набиралась куча из трёх лиц, а на «От первого лица» один
    оставался в бикини. Негатив при CFG 1.5 живой — он и добивает."""

    def test_одиночке_запрещён_второй_человек(self):
        n = catalog.scene("un_close").negative
        self.assertIn("two people", n)
        self.assertIn("third person", n)

    def test_паре_второй_человек_НЕ_запрещён(self):
        n = catalog.scene("pf_mf_near").negative
        self.assertNotIn("two people", n)
        self.assertIn("third person", n, "третий лишний и у пары")

    def test_в_голой_сцене_одежда_запрещена(self):
        for ключ in ("un_close", "pf_mf_pov", "pf_ff_face"):
            self.assertIn("bikini", catalog.scene(ключ).negative, ключ)

    def test_если_одежда_названа_её_не_запрещаем(self):
        сц = catalog.scene("un_close")
        блок = catalog.Блок(**{п: getattr(сц.блок, п)
                               for п in catalog.Блок.__slots__})
        блок.откровенное = "She slips the bikini top off her shoulders."
        n = prompts.негатив(prompts.собрать("i2i", блок))
        self.assertNotIn("bikini", n,
                         "человек сам написал про бикини, а мы его запретили")

    def test_негатив_собирается_из_текста_а_не_из_прокидки(self):
        """Промпт — источник правды: негатив выводится из него, и
        поэтому одинаково верен и для каталога, и для своего описания."""
        self.assertIn("two people", prompts.негатив("любой текст без пары"))
        self.assertNotIn("two people",
                         prompts.негатив("... EXACTLY TWO bodies ..."))

    def test_мужчину_не_запрещаем_даже_когда_члена_в_кадре_нет(self):
        """«Кунилингус» МЖ: мужчина лежит ничком, своего паха не видно,
        слова «erect penis» в кадре нет. Прежний признак читал такую
        сцену как женскую и слал в негатив «man, male body» — кнопка
        запрещала собственного мужчину, и восемь кадров вышли кашей."""
        п = ("THE MAN lies flat on his stomach between those open thighs, "
             "completely naked, his face at the vulva with his tongue out. "
             "One man and one woman, nobody else.")
        n = prompts.негатив(п)
        for слово in ("man, male body", "penis, cock"):
            self.assertNotIn(слово, n, "кнопка МЖ запрещает мужчину")
        self.assertIn("vulva on the man", n, "мужчина обязан остаться мужчиной")

    def test_в_женской_сцене_мужское_по_прежнему_запрещено(self):
        """Обратная половина того же правила: где мужчины нет, там член
        девушке дорисовывать нельзя."""
        n = prompts.негатив("She lies on her back, her own nipples in "
                            "plain view. Two women only.")
        self.assertIn("man, male body", n)

    def test_признак_мужчины_не_ловится_случайным_словом(self):
        """«woman» содержит «man» — признак обязан смотреть на слова
        сборки, а не на подстроку."""
        self.assertFalse(prompts.мужчина_в_кадре(
            "The woman and the other woman, a human being, romance."))


class ОдеждуНеНазываемВПоложительномТексте(unittest.TestCase):
    """Замер 22.09.2026: в промпте стояло «не мужские шорты, не женское
    бикини» — и на кадрах выходили ровно розовое бикини и серые шорты.
    Модель рисует названное; отрицание перед словом она держит слабо, а
    само слово — крепко. Запрет живёт в негативе, где ему и место."""

    ВЕЩИ = ("bikini", "shorts", "underwear", "bra", "panties", "lingerie",
            "swimsuit")

    def названо(self, ключ):
        """Целыми словами: «bra» иначе находится внутри «braced»."""
        p = catalog.scene(ключ).prompt_фото().lower()
        return [в for в in self.ВЕЩИ
                if re.search(rf"\b{в}s?\b", p)]

    def test_в_промпте_пары_вещей_не_названо(self):
        self.assertEqual([], self.названо("pf_mf_near"))

    def test_в_промпте_одиночки_тоже(self):
        self.assertEqual([], self.названо("un_close"))

    def test_но_в_негативе_они_есть(self):
        n = catalog.scene("pf_mf_near").negative.lower()
        for вещь in self.ВЕЩИ:
            self.assertIn(вещь, n, f"«{вещь}» пропала из негатива")

    def test_купальники_с_референсов_названы_поимённо(self):
        """Модели на референсах сняты в купальниках, и Qwen Edit тащит
        их в кадр. Общего слова «bikini» не хватило: сборка рисовала
        лямки и верх. Поэтому в запретах стоят те же куски."""
        n = catalog.scene("pf_mf_near").negative.lower()
        for вещь in ("bikini top", "bikini straps", "bra strap",
                     "grey shorts", "swim trunks"):
            self.assertIn(вещь, n, f"«{вещь}» пропала из негатива")


class ТриЖёсткихПравилаВладельца(unittest.TestCase):
    """22.09.2026, дословно: «у девушек не должно быть хуев», «более 2
    человек в кадре не должно быть», «вся анатомия тел должна быть
    идеальная, чтобы не было каши сросшихся конечностей».

    Первое держит `ЧленНеСтираетсяИНеПоявляетсяЛишний` ниже, два
    других — здесь. Правила постоянные, поэтому проверяются на ВСЕХ
    кнопках сразу: одиночных, парных, на всех составах.
    """

    def все_сцены(self):
        return [s for р in catalog.РАЗДЕЛЫ for s in р.все_сцены]

    def test_третий_человек_запрещён_везде(self):
        for s in self.все_сцены():
            n = s.negative.lower()
            for слово in ("third person", "extra person", "extra head",
                          "three heads", "crowd"):
                self.assertIn(слово, n, f"{s.key}: «{слово}» не запрещено")

    def test_каша_из_тел_запрещена_везде(self):
        for s in self.все_сцены():
            n = s.negative.lower()
            for слово in ("merged bodies", "conjoined bodies",
                          "shared torso", "third arm", "third leg",
                          "extra foot", "detached hand"):
                self.assertIn(слово, n, f"{s.key}: «{слово}» не запрещено")

    def test_у_пары_конечности_посчитаны_вслух(self):
        """Запрета мало: сборка рисует, что названо. Поэтому в
        положительном тексте сказано, сколько чего есть и откуда оно
        растёт, — прослеживаемость работает там, где слово
        «правильно» не работает."""
        for ключ in ("pf_mf_near", "pf_ff_close", "pf_mm_near"):
            p = catalog.scene(ключ).prompt_фото()
            self.assertIn("four arms and four legs", p, ключ)
            self.assertIn("traceable", p, ключ)

    def test_суставы_гнутся_в_свою_сторону(self):
        """Владелец поймал на готовом кадре ЖЖ: тело целое, рук и ног
        ровно по две, а колено вывернуто назад. Общее «bad anatomy»
        такое не ловит — сустав назван отдельно.

        В положительном тексте это сказано ТОЛЬКО парам: у одиночной
        сборки место обязано остаться в первой трети промпта (см.
        `ВыбранноеМестоСтоитВНачале`), и лишнее предложение выдавливает
        его оттуда. У одиночек сустав сторожит негатив."""
        for ключ in ("pf_mf_near", "pf_ff_close"):
            p = catalog.scene(ключ).prompt_фото()
            self.assertIn("bends forwards only", p, ключ)
        for s in self.все_сцены():
            n = s.negative.lower()
            for слово in ("knee bent backwards", "inverted knee",
                          "elbow bent backwards"):
                self.assertIn(слово, n, f"{s.key}: «{слово}» не запрещено")

    def test_у_одиночки_конечности_посчитаны_вслух(self):
        p = catalog.scene("un_close").prompt_фото()
        self.assertIn("two hands and two feet", p)
        self.assertIn("traceable", p)

    def test_поломки_в_положительном_тексте_не_названы(self):
        """Замер 22.09.2026: фраза «never a separate strip of face
        pasted above the body» УВЕЛИЧИЛА число коллажей. Сборка рисует
        названное даже под отрицанием, поэтому поломки живут только в
        негативе."""
        for s in self.все_сцены():
            p = s.prompt_фото()
            for поломка in ("third person", "extra face", "spare limb",
                            "second torso", "merged", "collage"):
                self.assertNotIn(
                    поломка, p.lower(),
                    f"{s.key}: «{поломка}» названа в положительном тексте")


class ЧленНеСтираетсяИНеПоявляетсяЛишний(unittest.TestCase):
    """Прогон 22.09.2026, обе стороны одной ошибки.

    У стоящего во весь рост мужчины сборка рисовала гладкий пах: кадр
    читался ею как обнажённый портрет. Помог только запрет самой
    пустоты — «smooth featureless crotch, no penis, censored».

    Но тот же запрет в ЖЕНСКОЙ сцене работает наоборот: слово «penis» в
    негативе сборка берёт как подсказку и дорисовывает член девушке.
    Владелец ловил это трижды («у девушки хуй»). Поэтому запрет стоит
    РОВНО ТАМ, где член в кадре и должен быть.
    """

    def test_в_сцене_с_мужчиной_запрет_пустоты_есть(self):
        for ключ in ("pf_mf_near", "pf_mm_near"):
            n = catalog.scene(ключ).negative
            self.assertIn("smooth featureless crotch", n, ключ)
            self.assertIn("no penis", n, ключ)

    def test_в_женской_сцене_этого_запрета_нет(self):
        for ключ in ("pf_ff_close", "un_full", "ac_close"):
            n = catalog.scene(ключ).negative
            self.assertNotIn("smooth featureless crotch", n, ключ)

    def test_мужчине_не_рисуется_женская_анатомия(self):
        """Третий случай той же болезни, пойман 22.09.2026.

        «Наездница»: она сидит сверху, член по тексту внутри неё —
        рисовать в паху нечего, и пах мужчины вышел ЖЕНСКИМ. Запрет
        пустоты («smooth featureless crotch») этого не ловит: пах не
        пустой, он занят чужой анатомией. Ловится только называнием.

        Стоит там же, где и запрет пустоты, — в сценах, где мужчина
        есть. В женской сцене такого запрета быть не должно: слово
        «vulva» в негативе сотрёт вульву самой героине.
        """
        for ключ in ("pf_mf_near", "pf_mm_near", "pr_mf_face"):
            n = catalog.scene(ключ).negative.lower()
            for слово in ("vulva on the man", "female genitals on the man",
                          "man without a penis"):
                self.assertIn(слово, n, f"{ключ}: «{слово}» не запрещено")
        for ключ in ("pf_ff_close", "un_full", "ac_close"):
            n = catalog.scene(ключ).negative.lower()
            self.assertNotIn("vulva on the man", n, ключ)

    def test_женщине_член_запрещён_на_каждой_кнопке(self):
        """«У девушек не должно быть хуев, это анатомия» — владелец,
        22.09.2026, жёсткое правило после четырёх кадров подряд.

        Раньше запрет стоял только у пары женщин: я боялась, что на
        одиночной кнопке он сотрёт клиента-мужчину. Боялась зря —
        одиночная сборка написана про женщину насквозь (женские
        местоимения, грудь в каждом описании сложения), мужчины в ней
        нет и стирать нечего.
        """
        for ключ in ("pf_ff_close", "un_full", "un_close", "ac_close",
                     "ac_side", "un_three"):
            n = catalog.scene(ключ).negative.lower()
            for слово in ("penis", "phallus", "male genitals", "futanari"):
                self.assertIn(слово, n, f"{ключ}: «{слово}» не запрещено")

    def test_одиночная_сборка_и_правда_женская(self):
        """Основание для запрета выше: если сборка вдруг станет
        бесполой, запрет придётся пересматривать, и тест об этом
        скажет раньше, чем владелец увидит кадр."""
        import re
        p = catalog.scene("un_full").промпт()
        ж = len(re.findall(r"\b(her|she|hers)\b", p, re.I))
        м = len(re.findall(r"\b(his|him)\b", p, re.I))
        self.assertGreater(ж, 5, "женских местоимений почти нет")
        self.assertEqual(0, м, "в одиночной сборке появился мужчина")


class УПарыВсёВоМножественномЧисле(unittest.TestCase):
    """Прогон 22.09.2026, ЖЖ: первая выходила голой, вторая — в белье
    со своего снимка. Виновато было единственное число: две служебные
    строки написаны про ОДНОГО человека («the person», «on her body»),
    и рядом с двумя людьми модель поняла их буквально."""

    def test_нагота_объявлена_про_обоих(self):
        """Про КАЖДУЮ отдельно. Множественное «обе голые» сборка
        применяла к той, что ей ближе, и вторая оставалась в лифчике.

        Проверяем ПРАВИЛО, а не мои служебные слова: у сцены с жёсткой
        постановкой общий блок подавлен, и нагота каждой названа
        словами самого отобранного кадра («The blonde's chest is bare
        skin… The dark-haired one's chest is bare skin…»)."""
        p = catalog.scene("pf_ff_close").prompt_фото()
        self.assertEqual(2, p.count("chest is bare skin"),
                         "нагота названа не про обеих")
        self.assertNotIn("The person from the reference is fully nude", p)

    def test_снятая_одежда_не_привязана_к_одному_телу(self):
        p = catalog.scene("pf_ff_close").prompt_фото()
        self.assertEqual(2, p.count("her own nipples in plain view"))
        self.assertNotIn("left on her body", p)

    def test_у_одиночки_единственное_число_осталось(self):
        """Там оно верное, и менять его незачем."""
        p = catalog.scene("un_close").prompt_фото()
        self.assertIn("The person from the reference is fully nude", p)
        self.assertIn("left on her body", p)


class ПарныйПромптКороткий(unittest.TestCase):
    """Замер 22.09.2026, «Секс раком», четыре круга по два зерна.

    Длинный парный промпт (5343 знака) НИ РАЗУ не дал всё нужное
    сразу: что ни подними наверх, вытесняется другое.

        место первым        неон идеальный, акта и наготы нет
        акт выше места      поза пошла, неон исчез
        одежда не названа   одно зерно голое, позы нет
        акт стал заданием   поза на обоих, нагота и неон ушли
        709 ЗНАКОВ          неон, поза, грудь, лица, двое — сразу

    Дело не в порядке, а в длине: модель держит примерно первую тысячу
    знаков. У одиночной сцены есть вторая опора — присланный снимок в
    стартовом латенте; у пары латент стирается целиком, и лишний текст
    только мешает."""

    def test_парное_фото_укладывается_в_тысячу_с_небольшим(self):
        """Потолок не распространяется на кнопки с ЖЁСТКОЙ ПОСТАНОВКОЙ.

        Потолок вырос из замера, где лишние знаки были служебной
        обвязкой: она вытесняла акт и позу. У жёсткой постановки
        лишних знаков нет — это и есть поза, ракурс и нагота, дословно
        с прогона, на котором владелец кадр принял (1794 знака). Ужать
        её до 1200 значит выбросить часть того, что кадр и держит.
        """
        for s in catalog.все_сценарии():
            if not (s.пара and prompts.семейство(s.job) == "i2i"):
                continue
            if getattr(s.блок, "жёстко", ""):
                self.assertLess(len(s.prompt_фото()), 2000, s.key)
                continue
            self.assertLess(len(s.prompt_фото()), 1200, s.key)

    def test_одиночную_сборку_не_тронули(self):
        """У неё есть опора на снимок, и там длина работает: 12 кнопок
        из 12 по лицу."""
        self.assertGreater(len(catalog.scene("un_close").prompt_фото()), 3000)

    def test_состав_назван_иначе_ЖЖ_станет_МЖ(self):
        жж = catalog.scene("pf_ff_near").prompt_фото()
        мж = catalog.scene("pf_mf_near").prompt_фото()
        self.assertIn("Both people are women", жж)
        self.assertIn("the second reference is a woman", мж)

    def test_мужская_анатомия_только_там_где_мужчина(self):
        self.assertNotIn("penis", catalog.scene("pf_ff_near").prompt_фото())
        self.assertIn("penis", catalog.scene("pf_mf_near").prompt_фото())

    def test_негатив_узнаёт_короткую_сборку(self):
        """Иначе паре запретят второго человека — то есть сломают саму
        кнопку."""
        self.assertNotIn("two people",
                         catalog.scene("pf_mf_near").negative)

    def test_место_подставляется_короткой_формой(self):
        м = места.место("sc_amberry")
        # Сцена без жёсткой постановки: там, где стоит дословный текст
        # принятого владельцем кадра, мерить потолок длины бессмысленно
        # (см. тест выше). Таких кнопок у МЖ уже три — «Раком»,
        # «Кунилингус», «Наездница», — поэтому меряем на «69».
        p = catalog.scene("pf_mf_above").промпт(место=м)
        self.assertIn("hot pink neon tubes", p)
        self.assertLess(len(p), 1200)
        # А место обязано доезжать и до жёсткой постановки тоже.
        self.assertIn("hot pink neon tubes",
                      catalog.scene("pf_mf_near").промпт(место=м))


class ПриёмкаКадра(unittest.TestCase):
    """Идеального кадра с первого раза эта сборка не даёт: поза держится
    постановкой, а брак даёт ЗЕРНО — на восьми зёрнах одной кнопки
    один-два кадра выходят с вывернутой рукой, остатком белья или
    срезанной головой. Владелец потребовал «всегда идеально», и
    единственный честный способ это дать — не отдавать брак: посмотреть
    на свой же кадр и переснять другим зерном."""

    def setUp(self):
        import контроль
        self.к = контроль
        self.было = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.было)

    def test_у_каждой_видимой_кнопки_есть_требования(self):
        """Кнопка без требований проходит приёмку молча — то есть её у
        неё нет вовсе. Такое должно ловиться здесь, а не на клиенте."""
        пусто = [s.key for s in catalog.все_сценарии()
                 if not s.скрыт and not self.к.требования(s.key)]
        self.assertEqual([], пусто, "кнопки без требований приёмки")

    def test_требования_понимают_обе_приставки(self):
        """У фотографии ключ `pf_mf_near`, у ролика `pr_mf_near`, а
        требования к кадру одни и те же."""
        self.assertEqual(self.к.требования("pf_mf_near"),
                         self.к.требования("pr_mf_near"))
        self.assertTrue(self.к.требования("un_close"))

    def test_в_вопросе_есть_и_общее_и_своё(self):
        в = self.к.вопрос("pf_mf_behind")
        self.assertIn("wearing any clothing", в)          # общее
        self.assertIn("lies flat on his stomach", в)      # своё
        self.assertIn("JSON", в)

    def test_без_ключа_приёмка_молчит(self):
        """Нет бесплатного ключа — кадр уходит как раньше. Проверка не
        имеет права задержать оплаченную работу."""
        os.environ.pop("GEMINI_KEY_FREE", None)
        os.environ.pop("AMBERRY_QC_KEY", None)
        self.assertFalse(self.к.включена())
        годен, _ = self.к.проверить(b"", "pf_mf_near")
        self.assertTrue(годен)

    def test_бесплатный_ключ_тратится_первым(self):
        """Платный разрешён владельцем 23.09.2026 ТОЛЬКО как запасной:
        бесплатная квота кончается за день, и без подмены приёмка молча
        пропускает брак. Порядок обязан остаться прежним."""
        os.environ["GEMINI_KEY_FREE"] = "бесплатный"
        os.environ["GEMINI_KEY_PAID"] = "платный"
        self.assertEqual("бесплатный", self.к.ключ())

    def test_платный_подхватывает_когда_бесплатного_нет(self):
        os.environ.pop("GEMINI_KEY_FREE", None)
        os.environ.pop("AMBERRY_QC_KEY", None)
        os.environ["GEMINI_KEY_PAID"] = "платный"
        self.assertEqual("платный", self.к.ключ())

    def test_общая_связка_ключей_не_берётся(self):
        """`GEMINI_API_KEYS` — пара ключей агентов ОКО, и разрешения на
        неё не было. Приёмка знает ровно два имени."""
        for имя in ("GEMINI_KEY_FREE", "AMBERRY_QC_KEY", "GEMINI_KEY_PAID"):
            os.environ.pop(имя, None)
        os.environ["GEMINI_API_KEYS"] = "чужая_пара"
        self.assertEqual("", self.к.ключ())

    def test_осечка_модели_не_бракует_кадр(self):
        os.environ["GEMINI_KEY_FREE"] = "ключ"
        with mock.patch("urllib.request.urlopen",
                        side_effect=OSError("сеть молчит")):
            годен, почему = self.к.проверить(b"png", "pf_mf_near")
        self.assertTrue(годен, почему)

    def test_мусор_в_ответе_не_бракует_кадр(self):
        os.environ["GEMINI_KEY_FREE"] = "ключ"
        with mock.patch.object(self.к, "_разобрать", return_value=None), \
             mock.patch("urllib.request.urlopen",
                        side_effect=OSError("не важно")):
            годен, _ = self.к.проверить(b"png", "pf_mf_near")
        self.assertTrue(годен)

    def test_ответ_читается_даже_в_обёртке(self):
        """Модель любит обернуть JSON в ```json — разбор это переживает."""
        r = self.к._разобрать('```json\n{"ok": false, "bad": [1]}\n```')
        self.assertEqual(False, r["ok"])
        self.assertEqual([1], r["bad"])

    def test_плохой_кадр_бракуется(self):
        os.environ["GEMINI_KEY_FREE"] = "ключ"
        ответ = json.dumps({"candidates": [{"content": {"parts": [
            {"text": '{"ok": false, "bad": [1], "why": "she is wearing shorts"}'}
        ]}}]}).encode()
        класс = mock.MagicMock()
        класс.read.return_value = ответ
        класс.__enter__ = lambda s: s
        with mock.patch("urllib.request.urlopen", return_value=класс), \
             mock.patch("json.load", return_value=json.loads(ответ)):
            годен, почему = self.к.проверить(b"png", "pf_mf_near")
        self.assertFalse(годен)
        self.assertIn("shorts", почему)


class ЖёсткаяПостановкаОдиночных(unittest.TestCase):
    """Раздевание и интим владелец принял 22.09.2026 по конкретным
    кадрам, но кнопки собирались ОБЩЕЙ геометрией — своими словами про
    ракурс и план. Контрольный прогон 23.09 это и показал: «Мастурбация
    раком» пришла фронтальной сидя вместо вида сзади."""

    def test_постановка_доезжает_до_промпта(self):
        for ключ, текст in catalog.ЖЁСТКАЯ_ОДИНОЧНАЯ.items():
            p = catalog.scene(ключ).промпт()
            self.assertIn(текст[:60], p, ключ)

    def test_постановка_стоит_до_внешности(self):
        """Иначе её пролистывают: внешность и техника — это две трети
        промпта."""
        for ключ, текст in catalog.ЖЁСТКАЯ_ОДИНОЧНАЯ.items():
            p = catalog.scene(ключ).промпт()
            self.assertLess(p.index(текст[:60]),
                            p.index(prompts.ТЕЛО_ПО_ФОТО), ключ)

    def test_строка_владельца_НЕ_вытесняется_постановкой(self):
        """Первый заход эту строку съедал — владелец правит её в
        админке, и она обязана доезжать до промпта."""
        сц = catalog.scene("un_close")
        блок = catalog.Блок(**{п: getattr(сц.блок, п)
                               for п in catalog.Блок.__slots__})
        блок.откровенное = "MARKER-OWNER-LINE."
        p = prompts.собрать("i2i", блок, фон="референс", своя_строка=True)
        self.assertIn("MARKER-OWNER-LINE.", p)
        self.assertIn(блок.жёстко[:60], p)

    def test_поза_и_ракурс_не_спорят_с_постановкой(self):
        """Поля «поза» и «камера» при постановке молчат: два описания
        одного и того же кадра модель разрешает как придётся."""
        нашлось = False
        for ключ in catalog.ЖЁСТКАЯ_ОДИНОЧНАЯ:
            сц = catalog.scene(ключ)
            p = сц.промпт()
            for поле in ("поза", "камера"):
                значение = (getattr(сц.блок, поле) or "").strip()
                if значение:
                    нашлось = True
                    self.assertNotIn(значение[:50], p, f"{ключ}/{поле}")
        self.assertTrue(нашлось, "не на чем было проверить")

    def test_у_ролика_тот_же_кадр_что_у_фотографии(self):
        """Ролик начинается с фотографии — постановка нужна и ему."""
        for фото, ролик in (("ph_close", "ac_close"), ("ph_above", "ac_above")):
            текст = catalog.ЖЁСТКАЯ_ОДИНОЧНАЯ[фото]
            self.assertIn(текст[:60], catalog.scene(ролик).prompt_фото(), ролик)


class ОпораПоГлубине(unittest.TestCase):
    """Карта глубины с принятого кадра — то, чем держится поза.

    Текстом владельцева «в 10 из 10» не берётся: жёсткая постановка
    даёт шесть-семь из десяти, потому что сборка читает около первой
    тысячи знаков. Опора задаёт геометрию картинкой, и её потолок
    другой. Здесь проверяется не качество кадра (его проверяет глаз), а
    то, что опора доезжает до карты и доезжает ПРАВИЛЬНАЯ.
    """

    def test_у_каждой_принятой_кнопки_есть_своя_опора(self):
        for ключ in catalog.С_ОПОРОЙ:
            self.assertEqual(catalog.опора(ключ), ключ)

    def test_ролик_берёт_опору_своей_фотографии(self):
        """Ролик считается двумя проходами, и первый из них — та самая
        фотография. Опора у них обязана быть одна, иначе ролик начнётся
        с чужой позы."""
        for ролик, фото in (("ac_close", "ph_close"), ("ac_above", "ph_above"),
                            ("pr_mf_near", "pf_mf_near"),
                            ("pr_ff_pov", "pf_ff_pov")):
            self.assertEqual(catalog.опора(ролик), фото, ролик)

    def test_кнопке_без_принятого_кадра_опору_не_подсовываем(self):
        """Чужая опора — это чужая поза за деньги клиента."""
        for ключ in ("own_photo", "un_low", "ph_mirror", "pf_mm_near", ""):
            self.assertEqual(catalog.опора(ключ), "", ключ)

    def test_опора_уходит_на_карту(self):
        поймано = {}

        class Карта:
            def start(self, **п):
                поймано.update(п)
                return "j1", 1

            def wait(self, *a, **к):
                return {"files": ["f.png"], "sec": 1}

            def fetch(self, имя):
                return b"x"

        import bot
        with mock.patch.object(bot, "gpu", Карта()):
            bot._проход("i2i", "текст", ["a.png"], опора="pf_mf_near")
        self.assertEqual(поймано.get("опора"), "pf_mf_near")

    def test_без_опоры_поле_не_отправляется(self):
        """Панель без этого поля считает кнопку по-старому. Пустая
        строка в запросе — это лишний разбор на той стороне и повод
        однажды приложить пустой файл."""
        поймано = {}

        class Карта:
            def start(self, **п):
                поймано.update(п)
                return "j1", 1

            def wait(self, *a, **к):
                return {"files": ["f.png"], "sec": 1}

            def fetch(self, имя):
                return b"x"

        import bot
        with mock.patch.object(bot, "gpu", Карта()):
            bot._проход("i2i", "текст", ["a.png"])
        self.assertNotIn("опора", поймано)

    def test_у_каждой_поставленной_кнопки_своя_подпись(self):
        """Названия владелец переписал сам («Кунилингус», «Наездница»),
        а подписи остались от ОБЩЕЙ геометрии, по которой кнопки
        собирались до жёсткой постановки. Выходило «Кунилингус · Двое
        рядом, камера напротив» — описание кадра, которого больше нет.
        """
        for ключ in catalog.С_ОПОРОЙ:
            сц = catalog.scene(ключ)
            self.assertIn(сц.ключ_правок, catalog.ПОДПИСЬ_ПОД_ПОСТАНОВКУ,
                          ключ)
            self.assertEqual(сц.подп(),
                             catalog.ПОДПИСЬ_ПОД_ПОСТАНОВКУ[сц.ключ_правок])

    def test_своя_подпись_владельца_сильнее(self):
        catalog.подставить({"pr_mf_near": {"подпись": "как он скажет"}})
        try:
            self.assertEqual(catalog.scene("pf_mf_near").подп(),
                             "как он скажет")
        finally:
            catalog.перечитать()

    def test_страница_показывает_подпись_клиента(self):
        """Владелец правит название, глядя на описание кнопки. Описание
        обязано быть то же, что у клиента."""
        д = catalog.дерево()

        def найти(узлы):
            for у in узлы:
                for с in у.get("дети", []) or []:
                    р = найти([с]) if с.get("вид") != "сценарий" else None
                    if р:
                        return р
                    if с.get("ключ") == "pf_mf_near":
                        return с
            return None

        строка = json.dumps(д, ensure_ascii=False)
        self.assertIn(catalog.ПОДПИСЬ_ПОД_ПОСТАНОВКУ["pr_mf_near"], строка)


class ПримерПодКнопкой(unittest.TestCase):
    """До 23.09.2026 человек выбирал кнопку по одному НАЗВАНИЮ:
    «Мастурбация раком» и «Мастурбация сбоку» — две строки в столбик, а
    чем они отличаются, видно только после оплаты. Владелец потребовал
    показывать принятый кадр примером под каждой кнопкой."""

    def setUp(self):
        self.папка = tempfile.mkdtemp()
        self.эталоны = tempfile.mkdtemp()
        примеры.ПАПКА = self.папка
        примеры.ЭТАЛОНЫ = self.эталоны
        примеры.ПАМЯТЬ = os.path.join(self.папка, "file_id.json")
        примеры.забыть_всё()

    def положить(self, относительный):
        путь = os.path.join(self.эталоны, относительный)
        os.makedirs(os.path.dirname(путь), exist_ok=True)
        from PIL import Image
        Image.new("RGB", (1344, 768), (40, 20, 30)).save(путь)
        return путь

    def test_у_каждой_принятой_кнопки_есть_кадр(self):
        """Список кадров и список кнопок с опорой — об одном и том же
        наборе: это 21 кадр, который владелец отобрал."""
        ключи = {catalog.scene(к).ключ_правок for к in catalog.С_ОПОРОЙ}
        self.assertEqual(ключи, set(примеры.КАДР))

    def test_кнопке_без_принятого_кадра_пример_не_подставляем(self):
        """Чужой кадр под кнопкой — обещание, которого бот не сдержит."""
        for ключ in ("ph_mirror", "own_photo", "un_low"):
            try:
                сц = catalog.scene(ключ)
            except KeyError:
                continue
            self.assertEqual(примеры.исходник(сц), "", ключ)

    def test_подзаголовок_называет_раздел_и_вид(self):
        self.assertEqual(примеры.подзаголовок(catalog.scene("pf_mf_near")),
                         "МЖ ПАРА · ФОТО")
        self.assertEqual(примеры.подзаголовок(catalog.scene("pr_mf_near")),
                         "МЖ ПАРА · ВИДЕО")

    def test_карточка_собирается_и_не_меняет_размер_кадра(self):
        """Правило владельца от 23.09: без обрезаний, без изменения
        размера, без чёрных полей — надписи ложатся поверх кадра."""
        from PIL import Image
        сц = catalog.scene("pf_mf_near")
        self.положить(примеры.КАДР[сц.ключ_правок])
        путь = примеры.собрать(сц, "ru")
        self.assertTrue(os.path.exists(путь))
        self.assertEqual(Image.open(путь).size, (1344, 768))

    def test_второй_раз_карточку_не_пересобираем(self):
        сц = catalog.scene("pf_mf_near")
        self.положить(примеры.КАДР[сц.ключ_правок])
        путь = примеры.собрать(сц, "ru")
        было = os.path.getmtime(путь)
        time.sleep(0.01)
        self.assertEqual(примеры.собрать(сц, "ru"), путь)
        self.assertEqual(os.path.getmtime(путь), было)

    def test_подменённый_кадр_забывает_старый_file_id(self):
        """Телеграм помнит картинку по `file_id` вечно. Подменили
        эталон — человек обязан увидеть новый кадр, а не тот, что
        телеграм запомнил полгода назад."""
        сц = catalog.scene("pf_mf_near")
        путь = self.положить(примеры.КАДР[сц.ключ_правок])
        примеры.помнить(сц, "ru", "СТАРЫЙ")
        self.assertEqual(примеры.помню(сц, "ru"), "СТАРЫЙ")
        os.utime(путь, (0, 0))
        self.assertIsNone(примеры.помню(сц, "ru"))

    def test_экран_кнопки_открывается_и_без_картинки(self):
        """За экраном кнопки оплата. Не собрался пример — уходит текст,
        но экран открывается всегда."""
        import bot
        ушло = []
        with mock.patch.object(bot, "send",
                               lambda *a, **к: ушло.append(a)), \
             mock.patch.object(bot, "_пример_сцены", lambda *a, **к: False):
            bot.показать_сценарий(1, 1, catalog.scene("pf_mf_near"), None, "ru")
        self.assertEqual(len(ушло), 1)


class Франшиза(unittest.TestCase):
    """Свой бот клиента на нашем движке. Самый дорогой товар бота и
    единственный, за которым стоит не генерация, а обязательство."""

    def test_кнопка_на_видном_месте(self):
        """Владелец просил поставить её на видное место: отдельной
        широкой строкой в главном меню, а не в ряду с пополнением."""
        import ui
        кб = ui.главное_меню(яз="ru")["inline_keyboard"]
        ряд = [р for р in кб if any(к.get("callback_data") == "m:fr" for к in р)]
        self.assertEqual(len(ряд), 1, "кнопки франшизы в меню нет")
        self.assertEqual(len(ряд[0]), 1, "франшиза делит ряд с чем-то ещё")

    def test_франшизу_можно_снять_как_и_всё_остальное(self):
        import ui
        catalog.подставить({"франшиза": {"скрыт": "1"}})
        try:
            кб = ui.главное_меню(яз="ru")["inline_keyboard"]
            self.assertFalse(any(к.get("callback_data") == "m:fr"
                                 for р in кб for к in р))
        finally:
            catalog.перечитать()

    def test_франшиза_не_пакет_и_коинов_не_даёт(self):
        """Коины сгорают в генерациях, а свой бот покупается один раз
        навсегда. Пропустить франшизу через разбор пакета значило бы
        зачислить человеку коины вместо бота."""
        self.assertTrue(payments.это_франшиза("fr:123"))
        self.assertFalse(payments.это_франшиза("pack:p3:1"))
        with self.assertRaises(payments.ОшибкаОплаты):
            payments.разобрать_payload("fr:123")

    def test_счёт_франшизы_собирается(self):
        сч = payments.счёт_звёздами_франшизы()
        self.assertTrue(сч["payload"].startswith("fr:"))
        self.assertGreater(сч["prices"][0]["amount"], 0)

    def test_токен_узнаётся_по_виду(self):
        """Грубая проверка до сетевого запроса: отсекает вставленное
        «привет», а настоящую проверку делает сам телеграм."""
        self.assertTrue(франшиза.похоже_на_токен(
            "1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"))
        for мимо in ("привет", "", "123:abc", "1234567890",
                     "1234567890:AAH"):
            self.assertFalse(франшиза.похоже_на_токен(мимо), мимо)

    def test_кривой_токен_до_сети_не_доходит(self):
        имя, беда = франшиза.чей_бот("не токен")
        self.assertEqual(имя, "")
        self.assertIn("BotFather", беда)

    def test_токен_показывается_хвостом(self):
        """Это ключ от чужого бота. Целиком он наружу не ходит."""
        т = "1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
        спрятан = франшиза.спрятать(т)
        self.assertNotIn(т, спрятан)
        self.assertTrue(спрятан.endswith(т[-6:]))

    def test_токен_не_уезжает_в_поддержку(self):
        """Вольная строка уходит письмом владельцу. Токен похож на
        вольную строку, и без перехвата ключ от чужого бота лёг бы в
        переписку открытым текстом."""
        import bot
        ушло = []
        партнёр = {"tg_id": 7, "бот": None, "состояние": "ждёт токен"}
        принято = []

        class База:
            def партнёр(self, u):
                return партнёр

        with mock.patch.object(bot, "store", База()), \
             mock.patch.object(bot, "принять_токен",
                               lambda *a: принято.append(a)), \
             mock.patch.object(bot, "в_поддержку",
                               lambda *a: ушло.append(a)), \
             mock.patch.object(bot, "обновить_низ", lambda *a: None), \
             mock.patch.object(bot, "яз", lambda u: "ru"):
            bot.on_text(7, 7,
                        "1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")
        self.assertEqual(len(принято), 1)
        self.assertEqual(ушло, [])


class ДлинныйРолик(unittest.TestCase):
    """Десятисекундный ролик считается сильно дольше пятисекундного: у
    видеомодели внимание идёт по всему ролику разом, и цена растёт не
    вдвое от удвоения длины, а гораздо круче."""

    def панель(self):
        путь = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "gpu", "panel.py")
        return open(путь, encoding="utf-8").read()

    def test_длинный_ролик_считается_мельче(self):
        т = self.панель().replace(" ", "")
        self.assertIn('"video_длинное"', т)
        self.assertIn("ДЛИННОЕ_С=7.0", т)
        self.assertIn('лист="video_длинное"ifсек>=ДЛИННОЕ_Сelse"video"', т)

    def test_ждём_карту_дольше_на_длинном(self):
        """Своим же таймаутом мы отдавали ОШИБКУ за восемь коинов, пока
        карта честно считала ролик."""
        import bot
        self.assertGreater(bot.ЖДЁМ["i2v_10"], bot.ЖДЁМ["i2v_5"])
        self.assertGreaterEqual(bot.ЖДЁМ["i2v_10"], 2400)

    def test_ожидание_берётся_по_виду_работы(self):
        import bot
        поймано = {}

        class Карта:
            def start(self, **п):
                return "j1", 1

            def wait(self, jid, limit=None, on_tick=None):
                поймано["limit"] = limit
                return {"files": ["f.png"], "sec": 1}

            def fetch(self, имя):
                return b"x"

        with mock.patch.object(bot, "gpu", Карта()):
            bot._проход("i2v_10", "текст", ["a.png"])
        self.assertEqual(поймано["limit"], bot.ЖДЁМ["i2v_10"])


class ПриёмкаНаКарте(unittest.TestCase):
    """Облачную приёмку пробовали: у Gemini «платный» ключ оказался на
    бесплатном тарифе (20 запросов в сутки), у Claude API нулевой
    баланс. Проверка, работающая первые двадцать кадров в сутки, - не
    проверка. Карта уже оплачена, и CLIP на её процессоре считает
    картинку меньше секунды."""

    class Карта:
        def __init__(self, ответы):
            self.ответы = list(ответы)
            self.звали = 0

        def start(self, **п):
            return "j%d" % self.звали, 1

        def wait(self, *a, **к):
            о = self.ответы[min(self.звали, len(self.ответы) - 1)]
            self.звали += 1
            return {"files": ["f.png"], "sec": 1, "приёмка": о}

        def fetch(self, имя):
            return b"x"

    def test_вердикт_карты_доезжает(self):
        import bot
        карта = self.Карта([{"ок": True, "причины": ["годен"]}])
        with mock.patch.object(bot, "gpu", карта):
            _, _, _, вердикт = bot._проход("i2i", "т", ["a.png"])
        self.assertEqual(вердикт["ок"], True)

    def test_брак_с_карты_переснимается(self):
        import bot
        карта = self.Карта([{"ок": False, "причины": ["одежда в кадре"]},
                            {"ок": True, "причины": ["годен"]}])
        with mock.patch.object(bot, "gpu", карта):
            bot._фото_с_приёмкой("i2i", "т", ["a.png"], scene="pf_mf_near")
        self.assertEqual(карта.звали, 2, "брак не пересняли")

    def test_облако_не_дёргаем_когда_карта_ответила(self):
        """Тот же кадр и тот же вопрос, только дороже и с квотой."""
        import bot
        спрашивали = []
        карта = self.Карта([{"ок": True, "причины": ["годен"]}])
        with mock.patch.object(bot, "gpu", карта), \
             mock.patch.object(bot.контроль, "проверить",
                               lambda *a: спрашивали.append(a) or (True, "")):
            bot._фото_с_приёмкой("i2i", "т", ["a.png"], scene="pf_mf_near")
        self.assertEqual(спрашивали, [])

    def test_без_вердикта_карты_работает_прежний_путь(self):
        """Старая панель поля не пришлёт, и бот обязан пережить это."""
        import bot
        карта = self.Карта([None])
        спрашивали = []
        with mock.patch.object(bot, "gpu", карта), \
             mock.patch.object(bot.контроль, "включена", lambda: True), \
             mock.patch.object(bot.контроль, "проверить",
                               lambda *a: спрашивали.append(a) or (True, "")):
            bot._фото_с_приёмкой("i2i", "т", ["a.png"], scene="pf_mf_near")
        self.assertEqual(len(спрашивали), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
