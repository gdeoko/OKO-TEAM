"""Проверки денег. Деньги — единственное, где ошибка стоит дорого."""
import os, tempfile, unittest
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
