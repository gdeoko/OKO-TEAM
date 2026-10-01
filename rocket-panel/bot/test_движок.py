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

    def test_один_снимок_уходит_референсом(self):
        """Режиму кадров нужны ОБА. С одним сервис не ругается, а молча
        считает текст-в-видео — проба вернула modelType TEXT_TO_VIDEO,
        кадр пропал совсем. Референс хуже первого кадра, но лучше, чем
        ничего: лицо хотя бы своё."""
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
        self.assertNotIn("first_frame_url", тело)
        for лишнее in ("image", "image_url", "first_frame_image"):
            self.assertNotIn(лишнее, тело)

    def test_два_снимка_это_режим_кадров(self):
        """У `i2v` бот принимает 1-2 снимка: «можно задать и последний
        кадр» (pricing.py). Двух хватает на настоящий режим кадров."""
        первый = self.а.upload("a.png", b"\x89PNG-1")
        последний = self.а.upload("b.png", b"\x89PNG-2")
        _вид, тело = self.а._запрос({"mode": "video", "prompt": "т",
                                     "images": [первый, последний]})
        self.assertIn("first_frame_url", тело)
        self.assertIn("last_frame_url", тело)
        self.assertNotEqual(тело["first_frame_url"], тело["last_frame_url"])
        self.assertNotIn("images", тело)

    def test_квадрат_у_видео_выпрямляется(self):
        """У `minimax-h3-lite` только 16:9 и 9:16; квадрат она отобьёт."""
        _вид, тело = self.а._запрос({"mode": "video", "prompt": "т",
                                     "size": "sq"})
        self.assertEqual(тело["ratio"], "9:16")

    def test_видео_без_снимка_это_текст_в_видео(self):
        _вид, тело = self.а._запрос({"mode": "video", "prompt": "т"})
        self.assertNotIn("first_frame_url", тело)
        self.assertNotIn("images", тело)

    def test_негатив_уходит_вместе_с_промптом(self):
        """В негативе кнопки лежит список «не одевай её»: clothed,
        dressed, bra, panties, bikini, swimsuit. Первая версия клиента
        его выбрасывала — и боевые кнопки вернули одетые кадры."""
        _вид, тело = self.а._запрос({"mode": "photo", "prompt": "т",
                                     "neg": "clothed, bra, panties"})
        self.assertEqual(тело["negative_prompt"], "clothed, bra, panties")
        # Имя поля бота наружу не уходит, уходит имя сервиса.
        self.assertNotIn("neg", тело)

    def test_негатив_и_у_видео(self):
        _вид, тело = self.а._запрос({"mode": "video", "prompt": "т",
                                     "neg": "мигание, дрожь"})
        self.assertEqual(тело["negative_prompt"], "мигание, дрожь")

    def test_пустой_негатив_не_шлём(self):
        _вид, тело = self.а._запрос({"mode": "photo", "prompt": "т",
                                     "neg": ""})
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


class СервисНеЗнаетНегатива(unittest.TestCase):
    """Модель, которая поля не знает, отвечает четырёхсотой. Отказ стоит
    ноль и кадра не тратит, поэтому спросить дешевле, чем решить за
    сервис заранее — ровно на таком «решении за сервис» и вышли одетые
    кадры на боевом."""

    def setUp(self):
        self.а = apimodels.Api(key="k")
        self.звонки = []

    def _зов(self, отказ_на_негатив):
        def зов(путь, тело=None):
            self.звонки.append(dict(тело or {}))
            if тело and "negative_prompt" in тело and отказ_на_негатив:
                raise _gpu.GpuError(
                    "400: {\"msg\":\"Unknown parameter: negative_prompt\"}")
            return {"taskId": "t1"}
        return зов

    def test_повтор_без_негатива(self):
        self.а._зов = self._зов(True)
        задача, _ = self.а.start(mode="photo", prompt="т", neg="clothed")
        self.assertEqual(задача, "t1")
        self.assertIn("negative_prompt", self.звонки[0])
        self.assertNotIn("negative_prompt", self.звонки[1])

    def test_второй_раз_уже_не_предлагаем(self):
        self.а._зов = self._зов(True)
        self.а.start(mode="photo", prompt="т", neg="clothed")
        было = len(self.звонки)
        self.а.start(mode="photo", prompt="т", neg="clothed")
        self.assertEqual(len(self.звонки) - было, 1, "спросили повторно")
        self.assertNotIn("negative_prompt", self.звонки[-1])

    def test_берёт_негатив_значит_шлём(self):
        self.а._зов = self._зов(False)
        self.а.start(mode="photo", prompt="т", neg="clothed")
        self.assertEqual(len(self.звонки), 1)
        self.assertIn("negative_prompt", self.звонки[0])

    def test_нет_первого_кадра_уходим_в_референс(self):
        """Ролик всё равно должен выйти: сцену модель сочинит свою, но
        человек получит работу, а не осечку за свои деньги."""
        def зов(путь, тело=None):
            self.звонки.append(dict(тело or {}))
            if тело and "first_frame_url" in тело:
                raise _gpu.GpuError(
                    "400: {\"msg\":\"Unknown parameter: first_frame_url\"}")
            return {"taskId": "t9"}
        self.а._зов = зов
        a = self.а.upload("a.png", b"\x89PNG-1")
        b = self.а.upload("b.png", b"\x89PNG-2")
        задача, _ = self.а.start(mode="video", prompt="т", images=[a, b])
        self.assertEqual(задача, "t9")
        self.assertIn("first_frame_url", self.звонки[0])
        self.assertIn("images", self.звонки[1])
        self.assertNotIn("first_frame_url", self.звонки[1])

    def test_про_первый_кадр_спрашиваем_один_раз(self):
        def зов(путь, тело=None):
            self.звонки.append(dict(тело or {}))
            if тело and "first_frame_url" in тело:
                raise _gpu.GpuError("400: invalid first_frame_url")
            return {"taskId": "t9"}
        self.а._зов = зов
        a = self.а.upload("a.png", b"\x89PNG-1")
        b = self.а.upload("b.png", b"\x89PNG-2")
        self.а.start(mode="video", prompt="т", images=[a, b])
        было = len(self.звонки)
        self.а.start(mode="video", prompt="т", images=[a, b])
        self.assertEqual(len(self.звонки) - было, 1, "спросили повторно")

    def test_чужой_отказ_не_повторяем(self):
        """На «кончились деньги» повтор без негатива значит заплатить
        второй раз за тот же отказ и получить одетый кадр."""
        def зов(путь, тело=None):
            self.звонки.append(dict(тело or {}))
            raise _gpu.GpuError("402: insufficient balance")
        self.а._зов = зов
        with self.assertRaises(_gpu.GpuError):
            self.а.start(mode="photo", prompt="т", neg="clothed")
        self.assertEqual(len(self.звонки), 1, "повторили чужой отказ")

    def test_модерация_не_путается_с_негативом(self):
        def зов(путь, тело=None):
            self.звонки.append(dict(тело or {}))
            raise _gpu.GpuError("400: content policy violation")
        self.а._зов = зов
        with self.assertRaises(_gpu.GpuError):
            self.а.start(mode="photo", prompt="т", neg="clothed")
        self.assertEqual(len(self.звонки), 1)


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
        """Причина лежит в `failMsg`. Первая версия искала `failReason`,
        которого у сервиса нет, и человек получал голое «failed» —
        сообщение, в котором модерация неотличима от пустого счёта."""
        self.ответы = [{"taskId": "t3"},
                       {"state": "failed", "failMsg": "content policy",
                        "failCode": 451}]
        self.а.start(mode="photo", prompt="т")
        итог = self.а.poll("t3")
        self.assertEqual(итог["state"], "err")
        self.assertIn("content policy", итог["error"])
        self.assertIn("451", итог["error"])
        self.assertIn("t3", итог["error"], "без номера задачи её не найти")

    def test_старое_имя_поля_тоже_читаем(self):
        self.ответы = [{"taskId": "t5"},
                       {"state": "failed", "failReason": "너무 길다"}]
        self.а.start(mode="photo", prompt="т")
        self.assertIn("너무 길다", self.а.poll("t5")["error"])

    def test_сервис_промолчал_остаётся_номер_задачи(self):
        """Даже когда объяснять нечем, задачу должно быть видно в консоли."""
        self.ответы = [{"taskId": "t6"}, {"state": "failed"}]
        self.а.start(mode="photo", prompt="т")
        итог = self.а.poll("t6")
        self.assertIn("t6", итог["error"])
        self.assertIn("failed", итог["error"])

    def test_слово_состояния_не_дублируется(self):
        self.ответы = [{"taskId": "t7"},
                       {"state": "failed", "msg": "failed"}]
        self.а.start(mode="photo", prompt="т")
        итог = self.а.poll("t7")
        self.assertEqual(итог["error"].count("failed"), 1)

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


class ЗаборГотовогоФайла(unittest.TestCase):
    """01.10.2026: кадр посчитался за 85 секунд, деньги списаны, а файл
    раздача не отдала - 403 на `Python-urllib/3.12`. Человек получил
    осечку за наши уплаченные деньги.

    Поэтому здесь проверяется не «скачалось», а чем именно мы
    представляемся и что делаем, когда первый способ не прошёл.
    """

    def setUp(self):
        self.а = apimodels.Api(key="k")
        self.а.timeout = 1

    def _открыть(self, данные=b"FILE", ошибка=None):
        """Поддельный urlopen, который запоминает запрос."""
        схвачено = {}

        def открыть(запрос, timeout=None):
            схвачено["заголовки"] = dict(запрос.headers)
            схвачено["url"] = запрос.full_url
            if ошибка:
                raise ошибка
            ответ = mock.MagicMock()
            ответ.__enter__.return_value.read.return_value = данные
            return ответ
        return открыть, схвачено

    def test_представляемся_браузером(self):
        открыть, схвачено = self._открыть()
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть):
            self.assertEqual(self.а._скачать("https://cdn.example/x.png"),
                             b"FILE")
        # Заголовки urllib приводит к Capitalized-Case.
        строкой = " ".join(схвачено["заголовки"]).lower()
        self.assertIn("user-agent", строкой)
        self.assertIn("Mozilla", str(схвачено["заголовки"]))
        self.assertNotIn("python-urllib", str(схвачено["заголовки"]).lower())

    def test_ключ_только_своей_раздаче(self):
        открыть, схвачено = self._открыть()
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть):
            self.а._скачать("https://files.apimodels.app/x.png")
        self.assertIn("Bearer k", str(схвачено["заголовки"]))

    def test_чужой_раздаче_ключ_не_показываем(self):
        открыть, схвачено = self._открыть()
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть):
            self.а._скачать("https://cdn.чужой.net/x.png")
        self.assertNotIn("Bearer", str(схвачено["заголовки"]))

    def test_curl_подхватывает_после_отказа(self):
        """Там, где споткнулся питон, часто проходит curl."""
        открыть, _ = self._открыть(ошибка=OSError("403 Forbidden"))
        готово = mock.MagicMock(returncode=0, stdout=b"CHEREZ-CURL")
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть), \
             mock.patch.object(apimodels.subprocess, "run",
                               return_value=готово) as бег:
            self.assertEqual(self.а._скачать("https://cdn.example/x.png"),
                             готово.stdout)
        позвали = бег.call_args[0][0]
        self.assertEqual(позвали[0], "curl")
        self.assertIn("-A", позвали)

    def test_пустой_ответ_не_считается_файлом(self):
        открыть, _ = self._открыть(данные=b"")
        пусто = mock.MagicMock(returncode=0, stdout=b"")
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть), \
             mock.patch.object(apimodels.subprocess, "run", return_value=пусто), \
             mock.patch.object(apimodels.time, "sleep", lambda _с: None):
            with self.assertRaises(_gpu.GpuError):
                self.а._скачать("https://cdn.example/x.png")

    def test_в_ошибке_хозяин_и_обе_причины(self):
        """«403 от раздачи» и «сеть не пустила» лечатся по-разному."""
        открыть, _ = self._открыть(ошибка=OSError("HTTP Error 403: Forbidden"))
        упал = mock.MagicMock(returncode=22, stdout=b"")
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть), \
             mock.patch.object(apimodels.subprocess, "run", return_value=упал), \
             mock.patch.object(apimodels.time, "sleep", lambda _с: None):
            try:
                self.а._скачать("https://cdn.example/x.png")
                self.fail("ошибки не было")
            except _gpu.GpuError as e:
                текст = str(e)
            self.assertIn("cdn.example", текст)
            self.assertIn("403", текст)
            self.assertIn("curl", текст)

    def test_подписанную_ссылку_целиком_не_тащим(self):
        открыть, _ = self._открыть(ошибка=OSError("403"))
        упал = mock.MagicMock(returncode=22, stdout=b"")
        подпись = "X-Amz-Signature=деадбиф" * 4
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть), \
             mock.patch.object(apimodels.subprocess, "run", return_value=упал), \
             mock.patch.object(apimodels.time, "sleep", lambda _с: None):
            try:
                self.а._скачать("https://cdn.example/x.png?" + подпись)
            except _gpu.GpuError as e:
                self.assertNotIn("X-Amz-Signature", str(e))

    def test_пробуем_не_один_раз(self):
        открыть, _ = self._открыть(ошибка=OSError("403"))
        упал = mock.MagicMock(returncode=22, stdout=b"")
        with mock.patch.object(apimodels.urllib.request, "urlopen", открыть), \
             mock.patch.object(apimodels.subprocess, "run",
                               return_value=упал) as бег, \
             mock.patch.object(apimodels.time, "sleep", lambda _с: None):
            with self.assertRaises(_gpu.GpuError):
                self.а._скачать("https://cdn.example/x.png")
        self.assertEqual(бег.call_count, apimodels.СКАЧАТЬ_ПОПЫТОК)


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


class ПовторНаСбоеКанала(unittest.TestCase):
    """`UPSTREAM_FAILED` — сервис не дождался ответа от провайдера. Наш
    запрос дошёл целиком, денег не списали (у пробы 01.10.2026 ноль
    кредитов), и сам сервис помечает такое `retryable`. Повторять надо
    ровно это и не надо всё остальное: ответ на модерацию и на пустой
    счёт будет тот же, а ожидание вырастет вдвое."""

    def setUp(self):
        self.а = apimodels.Api(key="k")

    def _отказ(self, тело):
        def зов(путь, тело_=None):
            if тело_ is not None:
                return {"taskId": "t1"}
            return dict(тело, state="failed")
        self.а._зов = зов
        self.а.start(mode="photo", prompt="т")
        self.а.poll("t1")

    def test_сбой_канала_повторяем(self):
        self._отказ({"failCode": "UPSTREAM_FAILED", "retryable": True,
                     "failMsg": "upstream request failed (no response)"})
        self.assertTrue(self.а.повторяемый("t1"))

    def test_код_без_пометки_тоже_узнаём(self):
        self._отказ({"failCode": "UPSTREAM_TIMEOUT"})
        self.assertTrue(self.а.повторяемый("t1"))

    def test_модерацию_не_повторяем(self):
        self._отказ({"failCode": "CONTENT_POLICY", "failMsg": "blocked"})
        self.assertFalse(self.а.повторяемый("t1"))

    def test_пустой_счёт_не_повторяем(self):
        self._отказ({"failCode": "INSUFFICIENT_BALANCE"})
        self.assertFalse(self.а.повторяемый("t1"))

    def test_чужую_задачу_не_повторяем(self):
        self.assertFalse(self.а.повторяемый("не-наша"))

    def test_карта_не_повторяет_никогда(self):
        """Её отказы про саму работу, повтор их не лечит."""
        к = _gpu.Gpu("http://карта", "r", "x")
        self.assertFalse(к.повторяемый("любая"))

    def test_движок_передаёт_вопрос_дальше(self):
        в = _движок.Выбор(_gpu.Gpu("", "r", "x"), self.а)
        self.assertTrue(callable(в.повторяемый))


class КороткийПромпт(unittest.TestCase):
    """Владелец 01.10.2026: «длинные как правило дают сбои от 1500 до
    3000 символов». Режем ПОВТОРЫ, не слова: блок либо остаётся целиком,
    либо выбрасывается."""

    def setUp(self):
        import prompts
        self.p = prompts

    def test_короткое_не_трогаем(self):
        т = "одна строка"
        self.assertEqual(self.p.коротко(т, 3000), т)

    def test_дубли_опознания_схлопываются_в_последний(self):
        б1 = "A 1:1 person resembles the reference. " + "x" * 400
        б2 = "HER BODY IS COPIED FROM THE REFERENCE PHOTOGRAPH " + "y" * 400
        б3 = ("FINAL CHECK: HER BODY IS COPIED FROM THE REFERENCE "
              "PHOTOGRAPH " + "z" * 400)
        дело = "сама работа " + "w" * 2000
        т = "\n\n".join([дело, б1, б2, б3])
        к = self.p.коротко(т, 3000)
        self.assertIn("FINAL CHECK", к)
        self.assertNotIn("resembles the reference", к)
        self.assertNotIn("y" * 400, к)
        self.assertIn("сама работа", к)

    def test_наши_общие_блоки_уходят_целиком(self):
        т = "\n\n".join(["дело " + "x" * 3000, self.p.КОЖА, self.p.ЦВЕТ])
        к = self.p.коротко(т, 3000)
        self.assertNotIn(self.p.КОЖА.strip(), к)
        self.assertNotIn(self.p.ЦВЕТ.strip(), к)

    def test_слова_не_переписываются(self):
        """Каждый оставшийся блок обязан совпасть с исходным дословно."""
        блоки = ["дело " + "x" * 2000, self.p.КОЖА, "хвост " + "y" * 900]
        к = self.p.коротко("\n\n".join(блоки), 3000)
        for б in к.split("\n\n"):
            self.assertTrue(any(б == и or и.startswith(б.rstrip(".")[:40])
                                for и in блоки), "блок переписан: %s" % б[:60])

    def test_резать_нечего_всё_равно_укладываемся(self):
        """Здесь раньше стояло «лучше длинный промпт, чем покалеченный».
        Замер 01.10.2026 это опроверг: длинный не хуже, он просто не
        проходит — `UPSTREAM_FAILED`, и человек не получает ничего."""
        т = "неделимое. " + "x" * 5000
        self.assertLessEqual(len(self.p.коротко(т, 3000)), 3000)

    def test_рубим_по_фразе_а_не_посреди_слова(self):
        т = " ".join("Фраза номер %d." % i for i in range(200))
        к = self.p.коротко(т, 200)
        self.assertLessEqual(len(к), 200)
        self.assertTrue(к.endswith("."), к[-40:])

    def test_если_фраза_одна_на_весь_текст_рубим_по_пределу(self):
        """Обрезать по точке в самом начале значит выбросить почти всё
        разрешённое место — тогда лучше ровный край."""
        т = "Короткая. " + "слово " * 900
        к = self.p.коротко(т, 200)
        self.assertLessEqual(len(к), 200)
        self.assertGreater(len(к), 150)


class ПределСоблюдаетсяВсегда(unittest.TestCase):
    """Замер 01.10.2026 на живом сервисе: 2915 знаков проходят, 3756
    отбиты `UPSTREAM_FAILED`. Первая версия укорачивания выбрасывала
    дубли и на этом останавливалась — у кнопки «в полный рост» остаток
    вышел 3756, и человек снова получил осечку."""

    def setUp(self):
        import prompts
        self.p = prompts

    def test_длинный_без_дублей_всё_равно_режется(self):
        блоки = ["дело " + "x" * 1400, "ещё " + "y" * 1400, "хвост " + "z" * 1400]
        к = self.p.коротко("\n\n".join(блоки), 2900)
        self.assertLessEqual(len(к), 2900)

    def test_последний_блок_остаётся_всегда(self):
        """Финальная проверка «тело скопировано с фотографии» старше
        всего текста; без неё модель рисует чужое тело."""
        блоки = ["первый " + "x" * 2000, "средний " + "y" * 2000,
                 "FINAL CHECK: HER BODY IS COPIED FROM THE REFERENCE"]
        к = self.p.коротко("\n\n".join(блоки), 2900)
        self.assertTrue(к.endswith("FINAL CHECK: HER BODY IS COPIED "
                                   "FROM THE REFERENCE"))
        self.assertLessEqual(len(к), 2900)

    def test_один_огромный_блок_обрезается_по_пределу(self):
        к = self.p.коротко("неделимое " + "x" * 5000, 2900)
        self.assertLessEqual(len(к), 2900)

    def test_уложившееся_не_трогаем(self):
        т = "раз\n\nдва\n\nтри"
        self.assertEqual(self.p.коротко(т, 2900), т)


class ОбязательноеНеТеряется(unittest.TestCase):
    """У qwen3 нет негатива: поле принимают и молча выбрасывают. Три
    жёстких правила владельца жили именно там — волосы только на голове,
    у женщины нет мужских органов, у мужчины нет женских. Первое было
    продублировано утверждением в блоке КОЖА, но КОЖА выбрасывается при
    укорачивании: обе половины правила пропали разом."""

    def setUp(self):
        import prompts
        self.p = prompts

    def test_волосы_и_женское_тело_всегда(self):
        т = self.p.обязательные("a naked woman alone in a room")
        self.assertIn("Hair grows on her head only", т)
        self.assertIn("a woman's body and only a woman's body", т)

    def test_мужская_строка_только_когда_мужчина_есть(self):
        одна = self.p.обязательные("a naked woman alone")
        пара = self.p.обязательные("one man and one woman, his penis")
        self.assertNotIn("The man has a man's body", одна)
        self.assertIn("The man has a man's body", пара)

    def test_запретных_слов_не_употребляем(self):
        """«pubic» и «hairless» сборка слышит существительным и почти не
        слышит приставку -less: от такой формулировки лобок выходил
        засеянным щетиной (разбор владельца 28.09.2026)."""
        т = self.p.обязательные("one man and one woman, his penis")
        for слово in ("pubic", "hairless"):
            self.assertNotIn(слово, т.lower())

    def test_блок_короткий(self):
        """Он дописывается последним и обязан влезать вместе со всем."""
        пара = self.p.обязательные("one man and one woman, his penis")
        self.assertLess(len(пара), 500)
