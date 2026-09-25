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
