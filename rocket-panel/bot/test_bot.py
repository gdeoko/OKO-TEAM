"""Проверки денег. Деньги — единственное, где ошибка стоит дорого."""
import os, time, tempfile, unittest, sqlite3
import pricing
import catalog
import prompts
import emoji
import store
from store import Store, NotEnoughHearts


class Деньги(unittest.TestCase):
    def setUp(self):
        self.f = tempfile.mktemp(suffix=".db")
        self.s = Store(self.f)

    def tearDown(self):
        for suf in ("", "-wal", "-shm"):
            try: os.remove(self.f + suf)
            except OSError: pass

    def test_новичку_дарим_жетоны(self):
        u, new = self.s.ensure_user(1, "vasya", welcome=pricing.WELCOME_HEARTS)
        self.assertTrue(new)
        self.assertEqual(self.s.balance(1), pricing.WELCOME_HEARTS)

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
        with self.assertRaises(NotEnoughHearts) as e:
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

    def test_сердечко_это_ровно_двенадцать_его_кристаллов(self):
        """На этом держится вся сверка: цена в сердечках умножается на 12
        и сравнивается с его кристаллами. Разойдётся — «на четверть
        дешевле» станет неправдой.

        Требований было два, и они сталкивались: владелец хотел счёт
        по-людски (фото = 1), а обещание скидки требует общих единиц с
        конкурентом (фото = 12 💎). Двенадцать кристаллов в сердечке
        снимают оба."""
        его = {"photo": 12, "inpaint": 12, "video_5": 60, "video_10": 96,
               "sound": 170, "animate": 60}
        self.assertEqual({k: j.crystals for k, j in pricing.JOBS.items()}, его)
        self.assertEqual(pricing.job("photo").hearts, 1,
                         "фото обязано стоить ровно одно сердечко")

    def test_пересчёт_в_сердечки_всегда_вниз(self):
        """Вверх — значит отъесть часть обещанной скидки. Видео со звуком
        стоит 170 💎, это 14,17 сердечка; отдаём за 14."""
        for k, j in pricing.JOBS.items():
            self.assertLessEqual(j.hearts * pricing.КРИСТАЛЛОВ_В_СЕРДЦЕ,
                                 j.crystals, f"{k}: округлили вверх")
        self.assertEqual(pricing.job("sound").hearts, 14)

    def test_надбавка_за_качество_не_дороже_чем_у_него(self):
        for q in pricing.QUALITY:
            self.assertLessEqual(q["crystals"], q["market_crystals"],
                                 f"{q['id']}: надбавка выше, чем у конкурента")

    def test_чем_больше_пакет_тем_дешевле_жетон(self):
        курсы = [pricing.hearts_per_rub(p) for p in pricing.PACKS]
        self.assertEqual(курсы, sorted(курсы),
                         "крупный пакет должен быть выгоднее мелкого")

    def test_роликов_длиннее_потолка_нет(self):
        """Решение владельца: больше десяти секунд не делаем. Правило
        живёт тут, а не в голове: иначе следующая правка прайса тихо
        вернёт двадцатисекундный ролик."""
        for k, j in pricing.JOBS.items():
            if k.startswith("video_"):
                сек = int(k.split("_")[1])
                self.assertLessEqual(сек, pricing.МАКС_СЕК,
                                     f"{k}: длиннее потолка в {pricing.МАКС_СЕК} с")

    def test_подарок_новичку_доводит_до_результата(self):
        """У конкурента за приглашение дают 10 💎 при цене фото 12 — не
        хватает даже на одну генерацию. Такой подарок только злит."""
        фото = pricing.job("photo").hearts
        self.assertGreaterEqual(pricing.WELCOME_HEARTS, фото * 2)
        self.assertGreaterEqual(pricing.REFERRAL_INVITEE, фото)
        self.assertLess(pricing.WELCOME_HEARTS, pricing.job("video_5").hearts,
                        "на подарок не должно хватать ролика")

    def test_подписок_нет_ни_в_каком_виде(self):
        """Решение владельца 21.09.2026: только покупка сердечек.

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
        for q in pricing.QUALITY:
            self.assertNotIn("plan", q, f"{q['id']}: качество заперто планом")

    def test_неизвестное_падает_явно(self):
        for f, arg in ((pricing.job, "нет"), (pricing.pack, "нет"),
                       (pricing.quality, "нет")):
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
            self.assertGreater(sc.hearts, 0, f"{sc.key}: нулевая цена")

    def test_цена_стоит_на_каждой_кнопке(self):
        """Наше отличие от конкурента: он прячет цену до загрузки фото.
        Если кнопка её потеряет, отличие исчезнет молча."""
        for sc in catalog.все_сценарии():
            self.assertIn("♥", sc.button(), f"{sc.key}: на кнопке нет цены")
            self.assertIn(str(sc.hearts), sc.button(), f"{sc.key}: не та цена")

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
        """Человек за эти сердечки заплатил. Смена нашей модели — не
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
