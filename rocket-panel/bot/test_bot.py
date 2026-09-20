"""Проверки денег. Деньги — единственное, где ошибка стоит дорого."""
import os, time, tempfile, unittest
import pricing
from store import Store, NotEnoughTokens


class Деньги(unittest.TestCase):
    def setUp(self):
        self.f = tempfile.mktemp(suffix=".db")
        self.s = Store(self.f)

    def tearDown(self):
        for suf in ("", "-wal", "-shm"):
            try: os.remove(self.f + suf)
            except OSError: pass

    def test_новичку_дарим_жетоны(self):
        u, new = self.s.ensure_user(1, "vasya", welcome=pricing.WELCOME_TOKENS)
        self.assertTrue(new)
        self.assertEqual(self.s.balance(1), pricing.WELCOME_TOKENS)

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
        with self.assertRaises(NotEnoughTokens) as e:
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
    def test_ни_один_тариф_не_в_минус(self):
        for key, j in pricing.JOBS.items():
            self.assertGreater(j.price_usd, j.cost_usd,
                               f"{key}: цена {j.price_usd} ниже себестоимости {j.cost_usd}")

    def test_пакет_отдаёт_жетоны_с_бонусом(self):
        self.assertEqual(pricing.pack_total("p2"), 700 + 100)

    def test_чем_больше_пакет_тем_дешевле_жетон(self):
        rates = [pricing.pack(p["id"])["usd"] / pricing.pack_total(p["id"])
                 for p in pricing.PACKS]
        self.assertEqual(rates, sorted(rates, reverse=True),
                         "крупный пакет должен быть выгоднее мелкого")

    def test_неизвестный_вид_генерации_падает_явно(self):
        with self.assertRaises(KeyError):
            pricing.job("нет-такого")

    def test_мы_дешевле_рынка_но_не_на_порядок(self):
        """Первая версия тарифов была в 33 раза ниже рынка — это не скидка,
        а подарок. Держимся в коридоре: дешевле, но в разумных пределах."""
        for key, j in pricing.JOBS.items():
            k = j.cheaper_than_market
            self.assertIsNotNone(k, f"{key}: не с чем сравнить рынок")
            self.assertGreater(k, 1.5, f"{key}: мы не дешевле рынка ({k:.1f}x)")
            self.assertLess(k, 6, f"{key}: мы дешевле рынка в {k:.0f} раз — недозарабатываем")

    def test_подписка_не_дешёвый_способ_купить_жетоны(self):
        """Запас жетонов в подписке идёт по курсу ХУЖЕ крупного пакета.
        Иначе подписку начнут брать вместо пакетов, и вторая касса
        (продажа генераций) схлопнется — ровно то, чего конкурент
        избегает, вообще не давая генераций по подписке."""
        лучший_пакет = max(pricing.tokens_per_usd(p) for p in pricing.PACKS)
        for s in pricing.SUBS:
            self.assertLessEqual(
                pricing.tokens_per_usd(s), лучший_пакет,
                f"{s['id']}: жетоны по подписке выгоднее пакета — она съест пакеты")

    def test_мы_дешевле_конкурента_по_каждой_подписке(self):
        """Цены сняты в боте Exclusive AI 20.09.2026. Держимся ниже по
        всей лестнице, но не обваливаемся: его цены рынком приняты."""
        for s in pricing.SUBS:
            доля = pricing.sub_vs_market(s)
            self.assertLess(доля, 1.0, f"{s['id']}: мы не дешевле конкурента")
            self.assertGreater(доля, 0.7,
                               f"{s['id']}: дешевле конкурента на {(1-доля)*100:.0f}% — перебор")

    def test_длинный_срок_дешевле_в_пересчёте_на_день(self):
        for план in pricing.PLANS:
            дни = [pricing.sub_rub_per_day(s) for s in pricing.SUBS if s["план"] == план]
            self.assertEqual(дни, sorted(дни, reverse=True),
                             f"{план}: длинный срок должен быть выгоднее короткого")

    def test_ultra_дороже_pro_на_каждом_сроке(self):
        pro = {s["период"]: s["rub"] for s in pricing.SUBS if s["план"] == "PRO"}
        for s in pricing.SUBS:
            if s["план"] == "ULTRA":
                self.assertGreater(s["rub"], pro[s["период"]],
                                   f"{s['id']}: ULTRA не дороже PRO")

    def test_у_каждой_подписки_есть_что_продавать(self):
        """Подписка продаёт возможности, а не объём: без них она пустая."""
        for s in pricing.SUBS:
            self.assertGreaterEqual(s["параллельно"], 2)
            self.assertGreaterEqual(s["макс_сек"], 15)
            self.assertTrue(s["свой_промпт"])

    def test_подарок_новичку_не_кормит(self):
        """Подарок — попробовать, а не пользоваться бесплатно."""
        self.assertLess(pricing.WELCOME_TOKENS, pricing.job("video_2").tokens,
                        "на подарок не должно хватать ролика")


class Подписка(unittest.TestCase):
    def setUp(self):
        self.f = tempfile.mktemp(suffix=".db")
        self.s = Store(self.f)
        self.s.ensure_user(1, welcome=0)

    def tearDown(self):
        for suf in ("", "-wal", "-shm"):
            try: os.remove(self.f + suf)
            except OSError: pass

    def test_подписка_начисляет_и_действует(self):
        self.s.subscribe(1, "s3", 3000)
        self.assertEqual(self.s.balance(1), 3000)
        self.assertEqual(self.s.sub_active(1), "s3")

    def test_остаток_месяца_не_переносится(self):
        self.s.subscribe(1, "s2", 1200)
        self.s.spend(1, 200, "фото")
        self.s.subscribe(1, "s2", 1200)      # продлили
        self.assertEqual(self.s.balance(1), 1200)  # а не 2200

    def test_подписочные_сгорают_а_купленные_нет(self):
        self.s.credit(1, 500, "paid", "купил пакет")
        self.s.subscribe(1, "s2", 1200, days=30)
        past = int(time.time()) + 31 * 86400
        burned = self.s.expire_sub(1, now=past)
        self.assertEqual(burned, 1200)
        self.assertEqual(self.s.balance(1), 500)
        self.assertIsNone(self.s.sub_active(1, now=past))

    def test_тратим_сначала_подписочные(self):
        self.s.credit(1, 500, "paid", "купил пакет")
        self.s.ensure_user(1)
        self.s.credit(1, 100, "welcome", "подарок")
        self.s.subscribe(1, "s2", 300)
        self.s.spend(1, 350, "ролик")
        u = self.s.user(1)
        self.assertEqual(u["sub"], 0)        # подписочные ушли целиком
        self.assertEqual(u["welcome"], 50)   # потом подаренные
        self.assertEqual(u["paid"], 500)     # купленные не тронули

    def test_возврат_не_попадает_в_сгорающий_карман(self):
        self.s.subscribe(1, "s2", 300)
        self.s.spend(1, 150, "ролик")
        self.s.refund(1, 150, "у нас упала генерация")
        self.assertEqual(self.s.user(1)["paid"], 150)

    def test_просроченная_подписка_не_висит_на_балансе(self):
        self.s.subscribe(1, "s2", 1200, days=0)
        self.assertEqual(self.s.balance(1), 0)

    def test_старая_база_доживает_до_подписок(self):
        """Боевая база заведена до подписок — миграция обязана пройти
        без потери купленных жетонов."""
        import sqlite3
        self.s.credit(1, 700, "paid", "купил пакет")
        with sqlite3.connect(self.f) as c:   # откатываем схему к прежней
            for col in ("sub", "sub_id", "sub_until"):
                c.execute(f"ALTER TABLE users DROP COLUMN {col}")
        s2 = Store(self.f)
        self.assertEqual(s2.balance(1), 700)
        s2.subscribe(1, "s2", 1200)
        self.assertEqual(s2.balance(1), 1900)


if __name__ == "__main__":
    unittest.main(verbosity=2)
