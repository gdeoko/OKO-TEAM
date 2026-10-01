"""Движок: APIMODELS и переключатель Api/Карта.

Главное, что здесь проверяется, — не арифметика, а два обещания,
которые легко сломать правкой в боте:

1. `Api` отвечает на ТЕ ЖЕ вызовы, что `gpu.Gpu`. Бот обращается к
   движку из тридцати с лишним мест и ни про какой API не знает:
   пропавший метод всплыл бы не тестом, а осечкой у живого человека
   после списания коинов.
2. Движок, выбранный в начале задания, держится до его конца. Имя файла,
   выданное картой, для API ничего не значит: смена движка посреди
   задания означает «файл не найден» за чужие деньги.
"""
import json
import threading
import unittest
from unittest import mock

import apimodels
import gpu as _gpu
import движок as _движок


class ЗеркалоКарты(unittest.TestCase):
    """У API есть всё, чем бот пользуется у карты."""

    НУЖНО = ("карты", "выбрать", "отпустить", "alive", "free_vram",
             "upload", "start", "poll", "wait", "fetch", "лицо", "тело")

    def test_методы_на_месте(self):
        а = apimodels.Api(key="x")
        for имя in self.НУЖНО:
            self.assertTrue(callable(getattr(а, имя, None)),
                            "у Api нет метода %s" % имя)
        self.assertIsInstance(type(а).настроена, property)
        self.assertTrue(hasattr(а, "base"))

    def test_и_у_переключателя_тоже(self):
        в = _движок.Выбор(_gpu.Gpu("", "r", "x"), apimodels.Api(key="x"))
        for имя in self.НУЖНО + ("на_карте", "имя", "желание", "записать"):
            self.assertTrue(callable(getattr(в, имя, None)),
                            "у Выбора нет метода %s" % имя)

    def test_карта_умеет_то_чего_нет_у_api(self):
        """Восстановитель лица и тело возвращают None, а не падают."""
        а = apimodels.Api(key="x")
        self.assertIsNone(а.лицо("к.png", b"1"))
        self.assertIsNone(а.тело("к.png", b"1"))


class Запросы(unittest.TestCase):
    """Тело запроса — то самое, которым проверено на живом сервисе."""

    def setUp(self):
        self.а = apimodels.Api(key="k")

    def test_фото_рефом_двумя_полями(self):
        имя = self.а.upload("своё.png", b"\x89PNG")
        вид, тело = self.а._запрос({"mode": "photo", "prompt": "текст",
                                    "size": "vert", "images": [имя]})
        self.assertEqual(вид, "images")
        self.assertEqual(тело["model"], apimodels.МОДЕЛЬ_ФОТО)
        self.assertEqual(тело["aspect_ratio"], "9:16")
        # Референс уходит и `image`, и `image_urls`, оба списками.
        self.assertEqual(тело["image"], тело["image_urls"])
        self.assertTrue(тело["image"][0].startswith("data:image"))

    def test_горизонталь(self):
        _вид, тело = self.а._запрос({"mode": "photo", "prompt": "т",
                                     "size": "horiz"})
        self.assertEqual(тело["aspect_ratio"], "16:9")

    def test_видео_кадр_только_полем_images(self):
        """Поля image / image_url / first_frame_image сервис молча
        выбрасывает и снимает ролик с нуля — это стоило 0,12."""
        имя = self.а.upload("кадр.png", b"\x89PNG")
        вид, тело = self.а._запрос({"mode": "video", "prompt": "движение",
                                    "size": "vert", "secs": 10,
                                    "images": [имя]})
        self.assertEqual(вид, "video")
        self.assertEqual(тело["model"], apimodels.МОДЕЛЬ_ВИДЕО)
        self.assertEqual(тело["duration"], 10)
        self.assertEqual(тело["resolution"], "768p")
        self.assertEqual(тело["ratio"], "9:16")
        self.assertIn("images", тело)
        for лишнее in ("image", "image_url", "first_frame_image"):
            self.assertNotIn(лишнее, тело)

    def test_негатив_не_уходит(self):
        """Поля негатива в этом API нет, а лишнее поле часть моделей
        отбивает четырёхсотой."""
        _вид, тело = self.а._запрос({"mode": "photo", "prompt": "т",
                                     "neg": "мусор, швы"})
        self.assertNotIn("neg", тело)
        self.assertNotIn("negative_prompt", тело)

    def test_маска_не_для_api(self):
        with self.assertRaises(_gpu.GpuError):
            self.а._запрос({"mode": "inpaint", "prompt": "т"})

    def test_чужого_имени_не_придумываем(self):
        """Снимка нет в памяти — ошибка, а не кадр без референса: иначе
        человек получил бы чужое лицо за свои деньги."""
        with self.assertRaises(_gpu.GpuError):
            self.а._запрос({"mode": "photo", "prompt": "т",
                            "images": ["нет_такого.png"]})


class Задача(unittest.TestCase):
    """Полный круг: запуск, ожидание, выдача файла."""

    def setUp(self):
        self.а = apimodels.Api(key="k")
        self.ответы = []
        self.звонки = []

        def зов(путь, тело=None):
            self.звонки.append((путь, тело))
            return self.ответы.pop(0)
        self.а._зов = зов
        def забрать(tid, ссылка):
            self.а._байты["out.png"] = b"GOTOVO"
            return "out.png"
        self.а._забрать = забрать

    def test_круг(self):
        self.ответы = [
            {"taskId": "t1"},
            {"state": "pending"},
            {"state": "processing"},
            {"state": "completed", "resultUrls": ["https://x/y.png"]},
        ]
        задача, _зерно = self.а.start(mode="photo", prompt="т")
        self.assertEqual(задача, "t1")
        with mock.patch.object(apimodels.time, "sleep", lambda _с: None):
            итог = self.а.wait("t1", limit=60)
        self.assertEqual(итог["state"], "ok")
        self.assertEqual(self.а.fetch(итог["files"][0]), b"GOTOVO")

    def test_готово_по_ссылке_без_слова_состояния(self):
        """Имена состояний у моделей разные, ссылка одна и та же."""
        self.ответы = [{"taskId": "t2"},
                       {"state": "", "resultUrls": ["https://x/y.mp4"]}]
        self.а.start(mode="video", prompt="т")
        self.assertEqual(self.а.poll("t2")["state"], "ok")

    def test_отказ_модерации_доносится_словами(self):
        self.ответы = [{"taskId": "t3"},
                       {"state": "failed", "failReason": "content policy"}]
        self.а.start(mode="photo", prompt="т")
        итог = self.а.poll("t3")
        self.assertEqual(итог["state"], "err")
        self.assertIn("content policy", итог["error"])

    def test_повторный_опрос_не_качает_второй_раз(self):
        self.ответы = [{"taskId": "t4"},
                       {"state": "completed", "resultUrls": ["https://x/y.png"]}]
        self.а.start(mode="photo", prompt="т")
        self.а.poll("t4")
        было = len(self.звонки)
        self.а.poll("t4")
        self.assertEqual(len(self.звонки), было)

    def test_чужая_задача(self):
        with self.assertRaises(_gpu.GpuError):
            self.а.poll("не-наша")


class Переключатель(unittest.TestCase):
    class Хранилище:
        def __init__(self):
            self.знач = {}

        def настройка(self, ключ, умолч=None):
            return self.знач.get(ключ, умолч)

        def настройка_записать(self, ключ, знач):
            self.знач[ключ] = знач

    def выбор(self, карта_жива=True, баланс=10.0):
        карта = _gpu.Gpu("http://карта", "r", "x")
        карта.alive = lambda: карта_жива
        апи = apimodels.Api(key="k")
        апи.баланс = lambda свежий=False: баланс
        в = _движок.Выбор(карта, апи, self.Хранилище())
        return в, карта, апи

    def test_по_умолчанию_api(self):
        в, _к, апи = self.выбор()
        self.assertEqual(в.желание(), "api")
        self.assertIs(в._кем(), апи)
        self.assertFalse(в.на_карте())

    def test_переключение_на_карту(self):
        в, карта, _а = self.выбор()
        в.записать("карта")
        self.assertIs(в._кем(), карта)
        self.assertTrue(в.на_карте())
        self.assertEqual(в.имя(), "карта")

    def test_мусор_в_настройке_читается_как_умолчание(self):
        в, _к, апи = self.выбор()
        в.store.настройка_записать("движок", "абракадабра")
        в._кэш = (None, 0.0)
        self.assertIs(в._кем(), апи)

    def test_пустой_счёт_уводит_на_карту(self):
        """Карта на запас ровно для этого случая."""
        в, карта, _а = self.выбор(баланс=0.0)
        self.assertIs(в._кем(), карта)

    def test_нет_ключа_api_уводит_на_карту(self):
        карта = _gpu.Gpu("http://карта", "r", "x")
        в = _движок.Выбор(карта, apimodels.Api(key=""), self.Хранилище())
        self.assertIs(в._кем(), карта)

    def test_движок_держится_на_всё_задание(self):
        """Владелец щёлкнул тумблером посреди чужой генерации — задание
        обязано досчитаться там, где начиналось."""
        в, карта, апи = self.выбор()
        в.выбрать("фото")
        self.assertIs(в._кем(), апи)
        в.записать("карта")
        self.assertIs(в._кем(), апи, "движок сменился посреди задания")
        в.отпустить()
        self.assertIs(в._кем(), карта)

    def test_у_каждого_потока_свой(self):
        в, карта, апи = self.выбор()
        в.записать("карта")
        в.выбрать("фото")
        чужой = []

        def поток():
            в.записать("api")
            в.выбрать("видео")
            чужой.append(в._кем())
            в.отпустить()
        т = threading.Thread(target=поток)
        т.start(); т.join()
        self.assertIs(чужой[0], апи)
        self.assertIs(в._кем(), карта, "чужой поток увёл наше задание")

    def test_вызовы_уходят_выбранному(self):
        в, _к, апи = self.выбор()
        апи.upload = lambda имя, байты: "им"
        апи.start = lambda **п: ("t", 0)
        апи.fetch = lambda имя: b"dan"
        self.assertEqual(в.upload("a.png", b"1"), "им")
        self.assertEqual(в.start(mode="photo"), ("t", 0))
        self.assertEqual(в.fetch("им"), b"dan")
        self.assertEqual(в.free_vram()[2], 0)


class Разбор(unittest.TestCase):
    """Ответ сервиса приходит обёрнутым: {"code":200,"data":{...}}."""

    def test_обёртка_снимается(self):
        а = apimodels.Api(key="k")
        with mock.patch.object(apimodels.urllib.request, "urlopen") as о:
            о.return_value.__enter__.return_value.read.return_value = \
                json.dumps({"code": 200, "data": {"balance": 3.5}}).encode()
            self.assertEqual(а.баланс(свежий=True), 3.5)

    def test_чужой_код_это_ошибка(self):
        а = apimodels.Api(key="k")
        with mock.patch.object(apimodels.urllib.request, "urlopen") as о:
            о.return_value.__enter__.return_value.read.return_value = \
                json.dumps({"code": 401, "msg": "Invalid key"}).encode()
            with self.assertRaises(_gpu.GpuError):
                а.баланс(свежий=True)

    def test_без_ключа_не_звоним(self):
        with self.assertRaises(_gpu.GpuError):
            apimodels.Api(key="")._зов("/balance")


if __name__ == "__main__":
    unittest.main()
