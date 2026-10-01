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
    """Тело запроса — то самое, которым проверено на живом сервисе.

    Модель видео закреплена на `minimax-h3-lite` НАРОЧНО: режим «первый
    плюс последний кадр» — её особенность, а умолчание бота с
    01.10.2026 другое (`wan-2.7-i2v-spicy`, у него своё поле одного
    кадра). Без закрепления тест проверял бы не то, что описывает.
    """

    def setUp(self):
        self.а = apimodels.Api(key="k")
        self.а._умолч_видео = "minimax-h3-lite"
        self.а._кэш_настроек = (None, 0.0)

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
        self.assertEqual(тело["model"], "minimax-h3-lite")
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
        # Режим «первый плюс последний кадр» — особенность lite, а
        # умолчание бота с 01.10.2026 другое. Закрепляем явно.
        self.а._умолч_видео = "minimax-h3-lite"
        self.а._кэш_настроек = (None, 0.0)
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

    def _только_lite(self):
        """Режим «первый плюс последний» — особенность lite."""
        self.а._умолч_видео = "minimax-h3-lite"
        self.а._кэш_настроек = (None, 0.0)

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

    def test_повтор_опознания_убирается_ужатием(self):
        """«HER BODY IS COPIED…» повторяет КРАТКО_ЛИЧНОСТЬ в третий раз
        и уходит при ужатии, ещё до всякого выбрасывания."""
        б2 = "HER BODY IS COPIED FROM THE REFERENCE PHOTOGRAPH " + "y" * 400
        дело = "сама работа " + "w" * 2000
        к = self.p.ужать("\n\n".join([дело, б2]))
        self.assertNotIn("y" * 400, к)
        self.assertIn("сама работа", к)

    def test_финальная_проверка_остаётся_но_короткой(self):
        """Она нужна именно в конце: модель внимательна к началу и к
        концу, а провисает в середине."""
        длинная = ("FINAL CHECK, outranking every word above: HER BODY IS "
                   "COPIED FROM THE REFERENCE PHOTOGRAPH " + "z" * 400)
        к = self.p.ужать("дело\n\n" + длинная)
        self.assertIn("FINAL CHECK", к)
        self.assertLess(len(к), len(длинная))

    def test_дубли_схлопываются_когда_ужатия_мало(self):
        б1 = "A 1:1 person resembles the reference. " + "x" * 500
        б3 = ("FINAL CHECK: HER BODY IS COPIED FROM THE REFERENCE "
              "PHOTOGRAPH " + "z" * 500)
        дело = "сама работа " + "w" * 2100
        к = self.p.коротко("\n\n".join([дело, б1, б3]), 3000)
        self.assertNotIn("resembles the reference", к)
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
        """Он дописывается последним и обязан влезать вместе со всем.
        Мерить надо САМЫЙ ДЛИННЫЙ вариант — женский: у него, кроме
        запретов, ещё и требование детализации."""
        пара = self.p.обязательные(
            "one man and one woman, his penis, her thighs")
        одна = self.p.обязательные("a naked woman alone, her thighs")
        самый = max(len(пара), len(одна))
        # Парный вариант самый длинный: запреты и детализация идут за
        # двоих плюс требование плотного кадра. Парные промпты сырыми
        # около 1900 знаков, так что места хватает; предел здесь — чтобы
        # блок не разросся и не начал вытеснять постановку.
        self.assertLess(самый, 1200, "блок съедает место у самой работы")

    def test_плотный_кадр_требуется_всегда(self):
        """Пустое место над головой и под ногами отнимает точки у тела,
        а их и так мало: 1152x2048 на весь кадр."""
        for запрос in ("a naked woman alone, her thighs",
                       "one man and one woman, his penis, her thighs",
                       "Both people are men, one from each reference"):
            о = self.p.обязательные(запрос)
            self.assertIn("FILLS the frame", о)
            self.assertIn("f/8", о)
            self.assertIn("no blurred areas", о)

    def test_детализация_требуется_и_не_режется(self):
        """Владелец 01.10.2026: «генералии — плохо, каша, нету
        детализации». В собранном промпте не оставалось ни одного слова
        про детализацию: блок кожи выбрасывался, а про пах говорилось
        только «кожа ровная и гладкая, как на плечах» — фраза против
        растительности, которую модель читает и как «без подробностей»."""
        одна = self.p.обязательные("a naked woman alone, her thighs")
        self.assertIn("anatomical detail", одна)
        self.assertIn("never a blurred or melted patch", одна)
        мж = self.p.обязательные(
            "one man and one woman, his penis, her thighs")
        self.assertIn("anatomical detail", мж)
        self.assertIn("His penis and scrotum", мж)
        мм = self.p.обязательные("Both people are men, one from each")
        self.assertIn("sharp true detail", мм)
        self.assertNotIn("Her vulva", мм)

    def test_роликовая_сборка_мужчину_называет_иначе(self):
        """Ролик не говорит «the man», он раздаёт референсы. На этом 24
        замера мужских кнопок уходили в женскую ветку и теряли правило
        «у мужчины нет женских органов»."""
        для_мж = self.p.обязательные(
            "The person from the first reference is a man; the person "
            "from the second reference is a woman.")
        self.assertIn("The man has a man's body", для_мж)
        self.assertIn("a woman's body and only a woman's body", для_мж)

    def test_у_мужской_кнопки_женских_строк_нет(self):
        """ММ: женщины в кадре нет, и «у неё тело женщины» привело бы её
        в кадр — та же ошибка, что с мужчиной, только наоборот."""
        мм = self.p.обязательные(
            "Both people are men, one from each reference. They must "
            "stay two clearly different men.")
        self.assertIn("The man has a man's body", мм)
        self.assertNotIn("a woman's body", мм)
        self.assertNotIn("Hair grows on her head only", мм)

    def test_женские_строки_остаются_по_умолчанию(self):
        """У многих женских кнопок слова «woman» в тексте нет вовсе."""
        т = self.p.обязательные(
            "Explicit photograph from the reference, kneeling by the bed.")
        self.assertIn("a woman's body and only a woman's body", т)
        self.assertNotIn("The man has a man's body", т)

    def test_other_не_считается_женщиной(self):
        """«her » — подстрока слова «other», и мужская кнопка ММ ловилась
        на «each other»."""
        self.assertFalse(self.p.женщина_в_кадре("they face each other"))

    def test_все_кнопки_получают_правила_по_полу(self):
        """Сквозной замер: у каждой кнопки каталога ровно те правила,
        которые её полу положены — с выбранным местом и без."""
        import catalog
        места = [м for м in catalog.места.ВСЕ if not catalog.скрыт(м.key)]
        плохо = []
        for сц in catalog.все_сценарии():
            if catalog.скрыт(сц.key):
                continue
            полы = catalog.полы(сц.key) or ("ж",)
            for подпись, место in (("без места", None), ("место", места[0])):
                о = self.p.обязательные(сц.промпт(место=место))
                есть = ("only a woman's body" in о, "only a man's body" in о)
                надо = ("ж" in полы, "м" in полы)
                if есть != надо:
                    плохо.append((сц.key, подпись, полы, есть))
        self.assertEqual(плохо, [])


class ДеталиНеТеряются(unittest.TestCase):
    """Владелец 01.10.2026: уложиться в три тысячи знаков, но детали
    сохранить. Прежнее укорачивание выбрасывало блоки целиком — вместе с
    правилами внутри. Теперь у каждого длинного блока есть короткий
    двойник, и сперва идёт замена, а выбрасывание — только если и после
    неё длинно."""

    def setUp(self):
        import prompts
        self.p = prompts

    def test_двойник_заменяет_а_не_выбрасывает(self):
        т = "\n\n".join([self.p.КОЖА, "сцена " + "x" * 2200])
        к = self.p.коротко(т, 3000)
        self.assertIn("one single skin tone", к)
        self.assertNotIn(self.p.КОЖА.strip(), к)

    def test_правила_кожи_пережили_сокращение(self):
        к = self.p.КРАТКО_КОЖА
        for правило in ("even", "mole", "freckle", "matte"):
            self.assertIn(правило, к.lower(), правило)

    def test_правила_личности_пережили_сокращение(self):
        к = self.p.КРАТКО_ЛИЧНОСТЬ.lower()
        for правило in ("reference", "age", "flat chest stays small",
                        "do not beautify"):
            self.assertIn(правило, к, правило)

    def test_правила_фона_пережили_сокращение(self):
        к = self.p.КРАТКО_ФОН.lower()
        for правило in ("keep the place", "not invented", "no new room",
                        "clothes come off", "camera angle"):
            self.assertIn(правило, к, правило)

    def test_целость_тела_пережила_сокращение(self):
        к = self.p.КРАТКО_ТЕЛО_ЦЕЛО.lower()
        for правило in ("one head", "two arms", "two legs", "five fingers"):
            self.assertIn(правило, к, правило)

    def test_блоки_владельца_не_трогаем(self):
        """Сцена, действие и свет описывают саму работу — сокращать их
        не мне."""
        своё = "She lies on her side on the floor, her body along the frame."
        к = self.p.ужать("\n\n".join([self.p.КОЖА, своё]))
        self.assertIn(своё, к)

    def test_ужатие_короче_вдвое(self):
        длинно = "\n\n".join([self.p.ПО_ВИДУ["i2i_фон"], self.p.ЯКОРЬ_ЛИЧНОСТИ,
                              self.p.ТЕЛО, self.p.КОЖА, self.p.ОДНО_ТЕЛО,
                              self.p.АНАТОМИЯ, self.p.КОМПОЗИЦИЯ,
                              self.p.КАМЕРА_ОБЩЕЕ, self.p.ЦВЕТ,
                              self.p.КАЧЕСТВО])
        self.assertLess(len(self.p.ужать(длинно)), len(длинно) / 2)

class ПозаНеСпоритСамаССобой(unittest.TestCase):
    """У кнопки ролика поза написана в ДВУХ местах: в постановке кадра
    (фотография, первый проход) и в движении (второй проход). Если они
    расходятся, человек получает не то, что нажал.

    Отчёт владельца 01.10.2026: «сделал интим раком, не сделала —
    стоит». У «Мастурбация раком» постановка говорила «SHE STANDS ON
    BOTH FEET», а движение той же кнопки — «rocks back and forward ON
    HER KNEES». Фотография ставила на ноги, ролик на колени.

    Своим текстом владелец это починить не мог: жёсткая постановка
    заменяет строку каталога целиком, см. `prompts.собрать`."""

    НА_КОЛЕНЯХ = ("on her knees", "hands and knees", "on all fours",
                  "under her belly")
    НА_НОГАХ = ("stands on both feet", "stands upright on her feet")

    def setUp(self):
        import catalog
        self.c = catalog

    def test_постановка_и_движение_об_одной_позе(self):
        плохо = []
        for сц in self.c.все_сценарии():
            if self.c.скрыт(сц.key):
                continue
            пост = (getattr(сц.блок, "жёстко", "") or "").lower()
            дв = (self.c.движение(сц.key) or "").lower()
            if not пост or not дв:
                continue
            колени = any(с in дв for с in self.НА_КОЛЕНЯХ)
            ноги = any(с in пост for с in self.НА_НОГАХ)
            if колени and ноги:
                плохо.append(сц.key)
        self.assertEqual(плохо, [], "движение на коленях, постановка на ногах")

    def test_раком_поставлено_раком(self):
        """«Мастурбация раком», подпись «Съёмка сверху вниз»."""
        пост = self.c.ЖЁСТКАЯ_ОДИНОЧНАЯ["ph_above"]
        self.assertIn("HANDS AND KNEES", пост)
        self.assertIn("DOGGY STYLE", пост)
        self.assertIn("HIGH ABOVE HER", пост)
        self.assertNotIn("stands on both feet", пост.lower())

    def test_поза_доживает_до_модели(self):
        """Укорачивание до 2900 не имеет права съесть позу — ни у
        фотографии, ни у фотографического прохода ролика."""
        import prompts, места
        for ключ in ("ph_above", "ac_above"):
            сц = [s for s in self.c.все_сценарии() if s.key == ключ][0]
            сырой = (сц.prompt_фото(места.КАК_НА_ФОТО, None)
                     if сц.двухшаговый else сц.промпт(место=места.КАК_НА_ФОТО))
            обяз = prompts.обязательные(сырой)
            готово = prompts.коротко(сырой, 2900 - len(обяз) - 2)
            self.assertIn("HANDS AND KNEES", готово, ключ)
            self.assertIn("HIGH ABOVE HER", готово, ключ)

class РаботаКнопкиНеВыбрасывается(unittest.TestCase):
    """Укорачивание имеет право выбрасывать ТОЛЬКО наши общие блоки.
    Постановка кадра, откровенная строка владельца и свет сцены — это
    сама работа, за которую человек нажал кнопку.

    Отчёт владельца 01.10.2026: «сделал интим раком, не сделала —
    стоит». Набор шёл с начала до первого не влезшего блока и там
    обрывался, а постановка позы (1271 знак) стояла шестой из
    семнадцати: её выкидывало вместе со всем хвостом, и в модель уходило
    1779 знаков при пределе 2614 — место было, позы не было."""

    def setUp(self):
        import prompts
        self.p = prompts

    def _длинный(self, поза):
        return "\n\n".join([
            self.p.ПО_ВИДУ["i2i_фон"].strip() + " THE FRAME TO BUILD IS THIS: x",
            self.p.ЯКОРЬ_ЛИЧНОСТИ.strip(),
            self.p.ОДНО_ТЕЛО.strip(),
            поза,
            self.p.КОЖА.strip(),
            self.p.КОМПОЗИЦИЯ.strip(),
            self.p.КАМЕРА_ОБЩЕЕ.strip(),
            self.p.ЦВЕТ.strip(),
            self.p.КАЧЕСТВО.strip(),
            "FINAL CHECK, outranking every word above: " + self.p.ТЕЛО_ПО_ФОТО.strip(),
        ])

    def test_поза_остаётся_даже_когда_она_самая_большая(self):
        поза = "SHE IS DOWN ON HER HANDS AND KNEES. " + "detail of the pose. " * 60
        к = self.p.коротко(self._длинный(поза), 2600)
        self.assertLessEqual(len(к), 2600)
        self.assertIn("HANDS AND KNEES", к)

    def test_место_не_простаивает(self):
        """Раньше первый не влезший блок обрывал набор: выброшенным
        оказывалось и то, что ещё влезало. Теперь выброшенный блок
        обязан быть таким, что обратно он уже не поместится."""
        поза = "SHE IS DOWN ON HER HANDS AND KNEES. " + "detail. " * 150
        предел = 2600
        сырой = self._длинный(поза)
        к = self.p.коротко(сырой, предел)
        ушли = [б for б in self.p.ужать(сырой).split("\n\n")
                if б.strip() and б.strip() not in к]
        for б in ушли:
            self.assertGreater(len(к) + len(б) + 2, предел,
                               "блок выброшен, хотя влезал: " + б[:60])

    def test_финальная_проверка_на_месте(self):
        поза = "SHE IS DOWN ON HER HANDS AND KNEES. " + "detail. " * 200
        к = self.p.коротко(self._длинный(поза), 2600)
        self.assertLessEqual(len(к), 2600)
        self.assertIn("FINAL CHECK", к)
        self.assertIn("HANDS AND KNEES", к)

    def test_наш_блок_узнаётся_а_чужой_нет(self):
        self.assertTrue(self.p.наш_блок(self.p.КОЖА))
        self.assertTrue(self.p.наш_блок(self.p.КАМЕРА_ОБЩЕЕ))
        self.assertFalse(self.p.наш_блок(
            "She is down on her hands and knees on the floor, doggy style."))
        self.assertFalse(self.p.наш_блок(
            "She masturbates her wet pussy in a doggy style position."))

class ОпознаниеНеЗапрещаетДетализацию(unittest.TestCase):
    """Промпт говорил «что под одеждой — не выдумывай, это читается с
    фотографии». Для РАЗМЕРА груди это верно, а для самих мест —
    невыполнимо: на присланном фото человек одет, читать там нечего.
    Самая громкая строка промпта («FINAL CHECK, outranking everything
    above») требовала того же. Модель слушалась и рисовала размытое.

    Теперь разделено: пропорции — с фотографии, закрытое одеждой —
    рисуется целиком и подробно, в тех же пропорциях."""

    def setUp(self):
        import prompts
        self.p = prompts

    def test_пропорции_с_фото_а_закрытое_рисуется(self):
        for блок in (self.p.ТЕЛО_ПО_ФОТО, self.p.КРАТКО_ЛИЧНОСТЬ):
            низ = блок.lower()
            self.assertIn("not in that photo", низ)
            self.assertIn("detail", низ)
            self.assertNotIn("what is under the clothes is not yours", низ)

    def test_финальная_проверка_не_запрещает_рисовать(self):
        замена = dict((н, з) for н, з in self.p.ПО_НАЧАЛУ if з)
        финал = замена["FINAL CHECK, outranking every word above"]
        self.assertIn("proportions", финал)
        self.assertIn("full sharp detail", финал)

    def test_всё_доживает_до_модели(self):
        """Сквозной прогон по каталогу: у каждой кнопки в итоговом
        промпте есть и требование детализации, и разрешение рисовать
        закрытое одеждой; и всё это укладывается в предел."""
        import catalog, места
        места_ = [м for м in catalog.места.ВСЕ if not catalog.скрыт(м.key)]
        плохо = []
        for сц in catalog.все_сценарии():
            if catalog.скрыт(сц.key):
                continue
            for м in (None, места_[0]):
                сырой = (сц.prompt_фото(м or места.КАК_НА_ФОТО, None)
                         if сц.двухшаговый else сц.промпт(место=м))
                обяз = self.p.обязательные(сырой)
                готово = (self.p.коротко(сырой, 2900 - len(обяз) - 2)
                          + "\n\n" + обяз)
                if len(готово) > 2900:
                    плохо.append((сц.key, "длинно %d" % len(готово)))
                if ("anatomical detail" not in готово
                        and "sharp true detail" not in готово):
                    плохо.append((сц.key, "нет детализации"))
        self.assertEqual(плохо, [])

class ВыборМоделиВАдминке(unittest.TestCase):
    """Качество кадра — решение про деньги: кадр на `pro` дороже вдвое,
    ролик на 2K в семь раз. Поэтому модель и качество лежат настройкой
    в базе и переключаются владельцем, а не правкой кода."""

    class Склад:
        def __init__(self):
            self.д = {}

        def настройка(self, ключ, умолч=None):
            return self.д.get(ключ, умолч)

        def настройка_записать(self, ключ, знач):
            self.д[ключ] = знач

    def setUp(self):
        import apimodels
        self.m = apimodels
        self.склад = self.Склад()
        self.api = apimodels.Api(key="x", store=self.склад)

    def test_умолчания_не_меняются_сами(self):
        в = self.api.выбор()
        # Умолчания с 01.10.2026 выбраны замером, а не вкусом: pro
        # детальнее базовой на 37-51%, wan берёт наш кадр почти
        # дословно (отклонение 3.8 против 10.2) и втрое быстрее.
        self.assertEqual(в["фото"], "qwen3-image-pro")
        self.assertEqual(в["видео"], "wan-2.7-i2v-spicy")
        self.assertEqual(в["качество"], "720p")

    def test_выбор_владельца_запоминается(self):
        self.api.выбрать_модель(фото="qwen3-image")
        self.assertEqual(self.api.модель_фото, "qwen3-image")

    def test_чужая_модель_не_принимается(self):
        self.api.выбрать_модель(фото="z-image-spicy")
        # У spicy нет входа для референса вовсе: лицо клиента ей не
        # передать. Такую модель принимать нельзя.
        self.assertEqual(self.api.модель_фото, "qwen3-image-pro")

    def test_у_каждой_модели_своё_поле_кадра(self):
        """Чужое поле сервис молча выбрасывает: ответ 200, задача
        принята, ролик снят с нуля — другая женщина, другая комната,
        деньги списаны. Проба 01.10.2026: `lite` берёт кадр полем
        `images`, `wan-2.7-i2v-spicy` — полем `image`."""
        self.api._байты["к"] = b"x"
        self.api.выбрать_модель(видео="wan-2.7-i2v-spicy", качество="720p")
        _, тело = self.api._запрос(
            {"mode": "video", "prompt": "p", "size": "vert", "secs": 5,
             "images": ["к"]})
        self.assertIn("image", тело)
        self.assertNotIn("images", тело)
        self.api.выбрать_модель(видео="minimax-h3-lite", качество="768p")
        _, тело = self.api._запрос(
            {"mode": "video", "prompt": "p", "size": "vert", "secs": 5,
             "images": ["к"]})
        self.assertIn("images", тело)

    def test_модель_с_модерацией_в_список_не_берём(self):
        """`minimax-h3` (та, что умеет 2K) отбила наш контент обоими
        полями кадра: «Content did not pass the safety review». Дать её
        владельцу кнопкой значило бы сломать каждую кнопку бота."""
        self.assertNotIn("minimax-h3", self.m.ВИДЕО_МОДЕЛИ)
        self.api.выбрать_модель(видео="minimax-h3")
        self.assertEqual(self.api.модель_видео, "wan-2.7-i2v-spicy")

    def test_качество_переезжает_вместе_с_моделью(self):
        """768p есть у lite и нет у wan: оставить чужое слово значит
        получить отказ за наши деньги."""
        self.api.выбрать_модель(видео="minimax-h3-lite")
        self.assertEqual(self.api.модель_видео, "minimax-h3-lite")
        self.assertIn(self.api.качество_видео, ("480p", "768p"))

    def test_качество_только_своё(self):
        self.api.выбрать_модель(видео="minimax-h3-lite")
        self.api.выбрать_модель(качество="1080p")   # у lite такого нет
        self.assertIn(self.api.качество_видео, ("480p", "768p"))
        self.api.выбрать_модель(качество="480p")
        self.assertEqual(self.api.качество_видео, "480p")

    def test_качество_уходит_в_запрос(self):
        self.api.выбрать_модель(видео="wan-2.7-i2v-spicy", качество="1080p")
        вид, тело = self.api._запрос(
            {"mode": "video", "prompt": "p", "size": "vert", "secs": 5})
        self.assertEqual(вид, "video")
        self.assertEqual(тело["model"], "wan-2.7-i2v-spicy")
        self.assertEqual(тело["resolution"], "1080p")

    def test_без_склада_работают_умолчания(self):
        а = self.m.Api(key="x")
        self.assertEqual(а.модель_фото, "qwen3-image-pro")
        self.assertEqual(а.выбрать_модель(фото="qwen3-image")["фото"],
                         "qwen3-image-pro")
