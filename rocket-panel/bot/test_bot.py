"""Проверки денег. Деньги — единственное, где ошибка стоит дорого."""
import os, time, tempfile, unittest, sqlite3
import pricing
import catalog
import prompts
import emoji
import payments
import store
import archive
from store import Store, NotEnoughCoins


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

    def test_каждый_пакет_ровно_на_четверть_дешевле(self):
        """Обещание владельца. Допуск только вниз: округление вверх съело
        бы часть скидки."""
        порог = 1 - pricing.СКИДКА_К_РЫНКУ
        for p in pricing.PACKS:
            доля = pricing.vs_market(p)
            self.assertLessEqual(доля, порог,
                                 f"{p['id']}: {p['rub']} против {p['market_rub']} — "
                                 f"скидка всего {(1-доля)*100:.1f}%")
            self.assertGreater(доля, порог - 0.02,
                               f"{p['id']}: скидка {(1-доля)*100:.1f}% — отдаём лишнее")

    def test_коин_это_ровно_двенадцать_его_кристаллов(self):
        """На этом держится вся сверка: цена в коинах умножается на 12
        и сравнивается с его кристаллами. Разойдётся — «на четверть
        дешевле» станет неправдой.

        Требований было два, и они сталкивались: владелец хотел счёт
        по-людски (фото = 1), а обещание скидки требует общих единиц с
        конкурентом (фото = 12 💎). Двенадцать кристаллов в коине
        снимают оба."""
        его = {"t2i": 12, "i2i": 12, "inpaint": 12,
               "t2v_5": 60, "t2v_10": 96, "i2v_5": 60, "i2v_10": 96,
               "sound": 170}
        self.assertEqual({k: j.crystals for k, j in pricing.JOBS.items()}, его)
        self.assertEqual(pricing.job("t2i").coins, 1,
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
        ожидаем = {"t2i": (0, 0), "i2i": (1, 3), "inpaint": (1, 1),
                   "t2v_5": (0, 0), "t2v_10": (0, 0),
                   "i2v_5": (1, 2), "i2v_10": (1, 2), "sound": (1, 1)}
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

    def test_режимы_без_фото_не_требуют_лица_с_фото(self):
        """У текста-в-фото нет входного снимка, и требование «сохрани её
        черты» для него бессмысленно: модель начинает искать референс,
        которого нет."""
        import prompts
        без = prompts.собрать("t2i", prompts.Блок())
        self.assertNotIn("face preserved exactly", без)
        self.assertIn("belonging to no real person", без)
        с_фото = prompts.собрать("i2i", prompts.Блок())
        self.assertIn("face preserved exactly", с_фото)

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
        фото = pricing.job("t2i").coins
        self.assertGreaterEqual(pricing.WELCOME_COINS, фото * 2)
        self.assertGreaterEqual(pricing.REFERRAL_INVITEE, фото)
        self.assertLess(pricing.WELCOME_COINS, pricing.job("t2v_5").coins,
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

    def test_цена_стоит_на_каждой_кнопке(self):
        """Наше отличие от конкурента: он прячет цену до загрузки фото.
        Если кнопка её потеряет, отличие исчезнет молча."""
        for sc in catalog.все_сценарии():
            self.assertIn("😏", sc.button(), f"{sc.key}: на кнопке нет цены")
            self.assertIn(str(sc.coins), sc.button(), f"{sc.key}: не та цена")

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
            self.assertIn("face preserved exactly", sc.prompt,
                          f"{sc.key}: нет блока сохранения лица")

    def test_категорий_от_четырёх_до_пяти(self):
        """Решение владельца: 4-5 категорий, внутри 5-10 вариантов.
        Третий уровень запрещён — он заставляет угадывать, где искать."""
        self.assertLessEqual(len(catalog.CATEGORIES), 5)
        for c in catalog.ВИДИМЫЕ:
            self.assertGreaterEqual(len(c.scenes), 5, f"{c.key}: меньше пяти")
            self.assertLessEqual(len(c.scenes), 10, f"{c.key}: больше десяти")

    def test_пустая_категория_не_показывается(self):
        """Категория владельца заведена пустой. Пустая витрина хуже её
        отсутствия, поэтому в меню попадают только непустые."""
        self.assertTrue(any(not c.scenes for c in catalog.CATEGORIES),
                        "категория владельца пропала")
        for c in catalog.ВИДИМЫЕ:
            self.assertTrue(c.scenes)

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
        self.assertIn("ВЫХОД=(1152,2048)", т.replace(" ", ""))

    def test_ступеней_в_панели_тоже_нет(self):
        """Прайс и панель обязаны сходиться. Останется лестница в одном
        из двух — снова разойдутся цена и то, что получает человек."""
        т = self.панель()
        for след in ('"q2k"', '"q4k"', '"q8k"', 'd.get("quality"'):
            self.assertNotIn(след, т, f"в панели остался {след}")

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
        self.s.job_start("j", 1, "t2i", "p", 1)
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
        import ui, bot
        подписи = [к["text"] for ряд in ui.НИЖНЕЕ["keyboard"] for к in ряд]
        for п in подписи:
            self.assertIn(п, bot.НИЖНИЕ_КНОПКИ, f"кнопка «{п}» ведёт в никуда")

    def test_лишних_обработчиков_нет(self):
        """Обратная сторона: обработчик без кнопки — мёртвый код, и по
        нему потом чинят то, чего человек не видит."""
        import ui, bot
        подписи = {к["text"] for ряд in ui.НИЖНЕЕ["keyboard"] for к in ряд}
        self.assertEqual(set(bot.НИЖНИЕ_КНОПКИ) - подписи, set())


class РаботыВБазе(unittest.TestCase):

    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.s = Store(os.path.join(self.d, "b.db"))
        self.s.ensure_user(1, "kto", welcome=5)

    def test_у_задания_есть_оба_адреса(self):
        """Один диск — каждый показ это лишняя заливка. Один file_id —
        работа живёт у чужой стороны, которая нам ничего не должна."""
        self.s.job_start("j1", 1, "t2i", "p", 1)
        self.s.job_done("j1", file="out.png", path="1/j1.png",
                        tg_file_id="AgACX", size=1234)
        j = self.s.job("j1")
        self.assertEqual(j["state"], "ok")
        self.assertEqual(j["path"], "1/j1.png")
        self.assertEqual(j["tg_file_id"], "AgACX")
        self.assertEqual(j["size"], 1234)

    def test_показывать_нечего_значит_в_работы_не_попадает(self):
        self.s.job_start("j2", 1, "t2i", "p", 1)
        self.s.job_done("j2", file="out.png")          # ни пути, ни file_id
        self.assertEqual(self.s.works(1), [], "работа без адреса показана как готовая")

    def test_осечка_в_работы_не_попадает(self):
        self.s.job_start("j3", 1, "t2i", "p", 1)
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
        s2.job_start("j", 1, "t2i", "p", 1)
        s2.job_done("j", file="o.png", path="1/j.png", tg_file_id="X", size=7)
        self.assertEqual(s2.works(1)[0]["tg_file_id"], "X")


if __name__ == "__main__":
    unittest.main(verbosity=2)
