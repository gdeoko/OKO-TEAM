"""Раздача заданий между несколькими картами (gpu.выбрать)."""
import os, tempfile, threading, unittest
from unittest import mock
import gpu


class НесколькоКарт(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.файл = os.path.join(self.tmp.name, "адреса.txt")
        self.п = mock.patch.object(gpu, "ФАЙЛ_АДРЕСА", self.файл); self.п.start()
        self.г = gpu.Gpu("", "rocket", "x")
        self.очереди = {}
        self.мёртвые = set()

        def req(path, data=None, files=None, method=None, адрес=None, timeout=None):
            адрес = адрес or self.г.base
            if адрес in self.мёртвые:
                raise gpu.GpuError("нет связи")
            if path == "api/stats":
                return {"queue": self.очереди.get(адрес, 0), "total": 96}
            return {"адрес": адрес, "path": path}
        self.г._req = req

    def tearDown(self):
        self.п.stop(); self.tmp.cleanup()

    def карты(self, *адреса):
        open(self.файл, "w").write("\n".join(адреса) + "\n")

    def test_одна_карта_без_опросов(self):
        self.карты("https://a")
        self.г._req = mock.Mock(side_effect=AssertionError("опрос не нужен"))
        self.assertEqual(self.г.выбрать("фото"), "https://a")

    def test_короткая_очередь_и_пропуск_мёртвой(self):
        self.карты("https://a", "https://b", "https://c")
        self.очереди = {"https://a": 3, "https://b": 1, "https://c": 0}
        self.мёртвые = {"https://c"}
        self.assertEqual(self.г.выбрать("фото"), "https://b")

    def test_задание_держится_за_свою_карту(self):
        self.карты("https://a", "https://b")
        self.очереди = {"https://a": 5, "https://b": 0}
        self.г.выбрать("видео")
        self.assertEqual(self.г.poll("1")["адрес"], "https://b")
        self.г.отпустить()
        self.assertEqual(self.г.base, "https://a")      # без выбора - основная

    def test_у_каждого_потока_своя_карта(self):
        self.карты("https://a", "https://b")
        видел = {}
        def задание(имя, род):
            self.г.выбрать(род)
            видел[имя] = self.г.base
        т = threading.Thread(target=задание, args=("т1", "видео")); т.start(); т.join()
        # первая карта теперь «занята видео» у нас - фото уйдёт на вторую
        задание("т2", "фото")
        self.assertNotEqual(видел["т1"], видел["т2"])

    def test_род_разводит_фото_и_видео(self):
        self.карты("https://a", "https://b")
        self.г.выбрать("фото"); self.г.отпустить()          # a считала фото
        self.assertEqual(self.г.выбрать("видео"), "https://b")
        self.г.отпустить()
        self.assertEqual(self.г.выбрать("фото"), "https://a")

    def test_жива_любая_карта_а_не_только_первая(self):
        """Встала основная - бот обязан работать на запасной, а не
        отказывать всем: деньги на Vast кончаются буднично."""
        self.карты("https://a", "https://b")
        self.мёртвые = {"https://a"}
        self.assertTrue(self.г.alive())
        self.мёртвые = {"https://a", "https://b"}
        self.assertFalse(self.г.alive())

    def test_взятая_карта_проверяется_своя(self):
        """Задание уже на карте - спрашиваем именно её: соседняя живая
        не делает живым мёртвое задание."""
        self.карты("https://a", "https://b")
        self.очереди = {"https://a": 0, "https://b": 9}
        self.г.выбрать("фото")                      # уйдёт на a
        self.мёртвые = {"https://a"}
        self.assertFalse(self.г.alive())

    def test_осечка_освобождает_карту(self):
        self.карты("https://a", "https://b")
        import bot
        with mock.patch.object(bot, "gpu", self.г), \
             mock.patch.object(bot, "run_job", side_effect=RuntimeError("осечка")):
            with self.assertRaises(RuntimeError):
                bot.на_своей_карте(1, 1, "i2i", "x", [], None)
        self.assertEqual(sum(self.г._занято.values()), 0)


if __name__ == "__main__":
    unittest.main()


class Источники(unittest.TestCase):
    """Откуда пришёл человек: метка закупки в ссылке ?start=ad_<канал>."""

    def setUp(self):
        import tempfile, os
        from store import Store
        self.tmp = tempfile.TemporaryDirectory()
        self.s = Store(os.path.join(self.tmp.name, "t.db"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_метка_пишется_новичку_и_не_затирается(self):
        """Человек пришёл по рекламе одного канала и сто раз жал /start:
        приписать его последней ссылке значило бы соврать про закупку."""
        self.s.ensure_user(1, "a", welcome=2, источник="ad_dvachannel")
        self.s.ensure_user(1, "a", welcome=2, источник="ad_другой")
        self.assertEqual(self.s.user(1)["источник"], "ad_dvachannel")

    def test_сводка_считает_оплативших_и_рубли(self):
        self.s.ensure_user(1, "a", welcome=2, источник="ad_kanal")
        self.s.ensure_user(2, "b", welcome=2, источник="ad_kanal")
        self.s.ensure_user(3, "c", welcome=2)
        self.s.credit(2, 10, "paid", "пакет", meta={"руб": 480})
        по = {x["откуда"]: x for x in self.s.источники()}
        self.assertEqual((по["ad_kanal"]["пришло"], по["ad_kanal"]["оплатили"],
                          по["ad_kanal"]["рублей"]), (2, 1, 480))
        self.assertEqual(по["сам нашёл"]["пришло"], 1)

    def test_реферальный_код_не_путается_с_меткой(self):
        import bot
        from unittest import mock
        кого = {}
        with mock.patch.object(bot, "store", self.s), \
             mock.patch.object(bot, "send", lambda *a, **к: {"ok": True, "result": {}}), \
             mock.patch.object(bot, "экран", lambda *a, **к: None), \
             mock.patch.object(bot, "в_меню", lambda *a, **к: None), \
             mock.patch.object(bot, "показать_условия", lambda *a, **к: None,
                               create=True):
            self.s.ensure_user(77, "друг", welcome=2)
            код = self.s.user(77)["ref_code"]
            bot.on_start(5, 5, "новый", код)
            bot.on_start(6, 6, "рекламный", "ad_toporlive")
        self.assertEqual(self.s.user(5)["invited_by"], 77)
        self.assertIsNone(self.s.user(5)["источник"])
        self.assertEqual(self.s.user(6)["источник"], "ad_toporlive")
        self.assertIsNone(self.s.user(6)["invited_by"])
