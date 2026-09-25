"""Проверки безлимита, условий и курса.

Здесь всё, что касается денег и очереди: цена в долларах с рублями по
курсу, месяц без коинов, быстрая полоса на сто работ и медленный режим
после неё. Ошибка в любом из этих мест стоит либо денег, либо
клиентов, которые ждут карту.
"""
import os
import tempfile
import time
import unittest

import безлимит
import курс
import store as store_mod
import франшиза


class Курс(unittest.TestCase):
    """Доллары в рубли. Источник может молчать, цена — нет."""

    def setUp(self):
        self.файл = os.path.join(tempfile.mkdtemp(), "курс.json")
        self.старый_файл, курс.ФАЙЛ = курс.ФАЙЛ, self.файл
        self.старая_сеть = курс._из_сети
        курс._память.update(курс=0.0, когда=0.0)

    def tearDown(self):
        курс.ФАЙЛ = self.старый_файл
        курс._из_сети = self.старая_сеть
        курс._память.update(курс=0.0, когда=0.0)

    def test_берёт_из_сети(self):
        курс._из_сети = lambda таймаут=10: 90.0
        self.assertEqual(курс.usd_rub(), 90.0)

    def test_сеть_молчит_берём_вчерашний(self):
        курс._из_сети = lambda таймаут=10: 90.0
        курс.usd_rub()                       # записали на диск
        курс._память.update(курс=0.0, когда=0.0)
        курс._из_сети = lambda таймаут=10: 0.0
        self.assertEqual(курс.usd_rub(), 90.0)

    def test_ни_сети_ни_диска_берём_запас(self):
        """Цена обязана существовать всегда: бот без цены не продаёт."""
        курс._из_сети = lambda таймаут=10: 0.0
        self.assertEqual(курс.usd_rub(), курс.ЗАПАС)

    def test_дикий_курс_не_принимаем(self):
        """Тысяча рублей за доллар — это не курс, это мы читаем не то
        поле. Лучше вчерашний, чем выдуманный."""
        курс._из_сети = self.старая_сеть
        for дичь in (0.0, 5.0, 900.0):
            курс._память.update(курс=0.0, когда=0.0)
            курс._из_сети = lambda таймаут=10, з=дичь: (
                з if 30 < з < 500 else 0.0)
            self.assertNotEqual(курс.usd_rub(), дичь)

    def test_рубли_округляются_вверх_и_кругло(self):
        """Ценник, а не бухгалтерия: «42 500 ₽» читается как цена,
        «42 453 ₽» — как ошибка."""
        курс._из_сети = lambda таймаут=10: 84.9
        # 500 x 84,9 = ровно 42 450 и уже кратно полусотне: округлять
        # нечего. А 84,9057 даёт 42 452,85, и вот его поднимает до
        # 42 500. Проверяем оба, иначе тест не отличит «округлили
        # вверх» от «округлили куда попало».
        self.assertEqual(курс.в_рублях(500), 42450)
        self.assertEqual(курс.в_рублях(1000), 84900)
        курс._память.update(курс=0.0, когда=0.0)
        курс._из_сети = lambda таймаут=10: 84.9057
        self.assertEqual(курс.в_рублях(500), 42500)
        for д in (1, 7, 100, 500, 1000):
            self.assertEqual(курс.в_рублях(д) % 50, 0, д)
            self.assertGreaterEqual(курс.в_рублях(д), д * 84.9)


class Цены(unittest.TestCase):
    """Цены названы владельцем 25.09.2026 в долларах."""

    def test_свой_бот_пятьсот(self):
        self.assertEqual(франшиза.ДОЛЛАРОВ, 500)

    def test_безлимит_тысяча(self):
        self.assertEqual(безлимит.ДОЛЛАРОВ, 1000)

    def test_быстрых_сто(self):
        self.assertEqual(безлимит.БЫСТРЫХ, 100)

    def test_рубли_не_застыли_числом(self):
        """Обе цены обязаны СЧИТАТЬСЯ. Константа в рублях устареет
        молча, и однажды мы продадим бота вдвое дешевле."""
        self.assertFalse(hasattr(франшиза, "РУБЛЕЙ"),
                         "рублёвая константа вернулась — она застынет")
        self.assertTrue(callable(франшиза.рублей))
        self.assertTrue(callable(безлимит.рублей))

    def test_метка_платежа_своя(self):
        self.assertTrue(безлимит.это_безлимит("unlim:1:2"))
        self.assertFalse(безлимит.это_безлимит("fr:1:2"))
        self.assertFalse(безлимит.это_безлимит("pack:p1:2"))


class МесяцБезлимита(unittest.TestCase):
    """Купленный месяц: коины не списываются, срок идёт сам."""

    def setUp(self):
        self.путь = os.path.join(tempfile.mkdtemp(), "b.db")
        self.s = store_mod.Store(self.путь)
        self.s.ensure_user(1, "kto", welcome=3)

    def test_без_покупки_коины_списываются(self):
        self.assertFalse(self.s.безлимитный(1))
        self.s.spend(1, 1, "фото")
        self.assertEqual(self.s.balance(1), 2)

    def test_купленный_месяц_коины_не_трогает(self):
        self.s.безлимит_дать(1, безлимит.СЕКУНД, безлимит.БЫСТРЫХ)
        self.assertTrue(self.s.безлимитный(1))
        self.s.spend(1, 5, "ролик")
        self.assertEqual(self.s.balance(1), store_mod.БЕЗЛИМИТ)

    def test_месяц_кончается_сам(self):
        """Автопродления нет нарочно: молча списывать за следующий
        месяц с того, кто забыл, мы не будем."""
        self.s.безлимит_дать(1, безлимит.СЕКУНД, безлимит.БЫСТРЫХ)
        with self.s._db() as c:
            c.execute("UPDATE users SET unlim_until=? WHERE tg_id=1",
                      (int(time.time()) - 1,))
        self.assertFalse(self.s.безлимитный(1))
        self.assertEqual(self.s.безлимит_быстрых(1), 0)

    def test_докупил_раньше_срока_сроки_складываются(self):
        до1 = self.s.безлимит_дать(1, 1000, 10)
        до2 = self.s.безлимит_дать(1, 1000, 10)
        self.assertGreaterEqual(до2, до1 + 999)

    def test_докупил_быструю_полосу_налили_заново(self):
        """Он заплатил за неё второй раз — значит получает её снова."""
        self.s.безлимит_дать(1, 1000, 3)
        self.s.безлимит_быстрая(1)
        self.assertEqual(self.s.безлимит_быстрых(1), 2)
        self.s.безлимит_дать(1, 1000, 3)
        self.assertEqual(self.s.безлимит_быстрых(1), 3)


class БыстраяПолоса(unittest.TestCase):
    """Сто работ вперёд очереди, дальше медленно и бесконечно."""

    def setUp(self):
        self.путь = os.path.join(tempfile.mkdtemp(), "b.db")
        self.s = store_mod.Store(self.путь)
        self.s.ensure_user(1, "kto", welcome=0)
        self.s.безлимит_дать(1, безлимит.СЕКУНД, 3)

    def test_тратится_по_одной(self):
        self.assertEqual(self.s.безлимит_быстрых(1), 3)
        for осталось in (2, 1, 0):
            self.assertTrue(self.s.безлимит_быстрая(1))
            self.assertEqual(self.s.безлимит_быстрых(1), осталось)

    def test_кончилась_но_работать_можно(self):
        """Главное отличие от коинов: ноль в быстрой полосе — это
        «подожди», а не «заплати». Человек остаётся безлимитным."""
        for _ in range(3):
            self.s.безлимит_быстрая(1)
        self.assertFalse(self.s.безлимит_быстрая(1))
        self.assertTrue(self.s.безлимитный(1))
        self.s.spend(1, 5, "ролик")          # не падает и не списывает
        self.assertEqual(self.s.balance(1), store_mod.БЕЗЛИМИТ)

    def test_без_подписки_полосы_нет(self):
        self.s.ensure_user(2, "другой", welcome=1)
        self.assertFalse(self.s.безлимит_быстрая(2))
        self.assertEqual(self.s.безлимит_быстрых(2), 0)

    def test_истёкший_месяц_полосу_не_даёт(self):
        """Срок правим прямо в базе, а не отрицательным `безлимит_дать`:
        тот складывает сроки и месяц бы не отменил. Ровно так время и
        кончается в жизни - само, а не вызовом."""
        with self.s._db() as c:
            c.execute("UPDATE users SET unlim_until=? WHERE tg_id=1",
                      (int(time.time()) - 10,))
        self.assertFalse(self.s.безлимит_быстрая(1))
        self.assertFalse(self.s.безлимитный(1))


class Условия(unittest.TestCase):
    """Показываются один раз и запоминаются."""

    def setUp(self):
        self.путь = os.path.join(tempfile.mkdtemp(), "b.db")
        self.s = store_mod.Store(self.путь)
        self.s.ensure_user(1, "kto", welcome=0)

    def test_первый_раз_показываем(self):
        self.assertTrue(self.s.условия_показать(1))

    def test_второй_раз_уже_нет(self):
        """Иначе условия прилетали бы при каждом /start, а /start жмут,
        когда «всё пропало»."""
        self.s.условия_показать(1)
        self.assertFalse(self.s.условия_показать(1))
        self.assertFalse(self.s.условия_показать(1))

    def test_запоминается_время_а_не_флаг(self):
        """Условия однажды изменятся, и понадобится знать, кто видел
        какую редакцию. Флаг такого не расскажет."""
        было = int(time.time())
        self.s.условия_показать(1)
        когда = self.s.условия_когда(1)
        self.assertGreaterEqual(когда, было)
        self.assertLessEqual(когда, int(time.time()) + 1)

    def test_у_незнакомца_не_падает(self):
        self.assertFalse(self.s.условия_показать(999))
        self.assertEqual(self.s.условия_когда(999), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
