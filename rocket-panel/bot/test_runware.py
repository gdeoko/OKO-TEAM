# -*- coding: utf-8 -*-
"""Движок Runware: два прохода, маска паха, развилка с видео.

Сеть здесь не трогается ни разу: подменяется `_зов` и `_скачать`. Тесты
отвечают на вопросы, которые стоили времени живьём, а не на «вызвалась
ли функция»:

- второй проход идёт только там, где пах в кадре крупно;
- второй проход несёт ИМЕННО LUSTIFY, маску и силу 0.85, а не то же
  самое, что первый;
- упавший второй проход не валит задание: первый кадр уже оплачен;
- видео на Runware не уходит никогда, даже когда он выбран движком.
"""
import unittest

import движок as _движок
import runware
from gpu import GpuError

КАДР = b"\x89PNG\r\n\x1a\n" + b"0" * 4000      # «картинка» нужного размера


class Поддельный(runware.Runware):
    """Runware без сети: помнит тела запросов и отдаёт готовый кадр."""

    def __init__(self, падать_на=None, **kw):
        super().__init__(key="x", **kw)
        self.запросы = []
        self.падать_на = падать_на          # номер прохода, который падает

    def _зов(self, задачи):
        self.запросы.append(задачи[0])
        if self.падать_на == len(self.запросы):
            raise GpuError("сервис отказал")
        return [{"imageURL": "https://im.test/%d.png" % len(self.запросы)}]

    def _скачать(self, ссылка):
        return КАДР


def досчитать(рв, **params):
    задача, _ = рв.start(**params)
    return рв.wait(задача, limit=30)


class ДваПрохода(unittest.TestCase):
    """Прежний путь: лицо первым проходом, пах правкой по маске.

    Он остался для кнопок, у которых НЕТ принятого эталона: там нет
    позы, которую надо повторить, и карте глубины взяться неоткуда.
    Кнопки с эталоном давно идут сборкой по карте, поэтому здесь обе
    дороги к ней закрыты - иначе тесты проверяют код, которого на этом
    пути уже нет.
    """

    def setUp(self):
        self._было = (runware.конвейер, runware.сборка_кнопки)
        runware.конвейер = None
        runware.сборка_кнопки = None

    def tearDown(self):
        runware.конвейер, runware.сборка_кнопки = self._было

    def test_откровенная_кнопка_идёт_двумя_проходами(self):
        рв = Поддельный()
        итог = досчитать(рв, mode="photo", prompt="текст кнопки",
                         сцена="un_close", size="vert")
        self.assertEqual(итог["state"], "ok")
        self.assertEqual(len(рв.запросы), 2)
        первый, второй = рв.запросы
        self.assertEqual(первый["model"], runware.МОДЕЛЬ_ЛИЦО)
        self.assertEqual(второй["model"], runware.МОДЕЛЬ_ОРГАН)

    def test_первый_проход_несёт_лору_и_числа_рецепта(self):
        """Лора, шаги и CFG это и есть рецепт. Разъедутся - уйдёт
        схожесть лица, а по кадру это читается как «модель плохая»."""
        рв = Поддельный()
        досчитать(рв, mode="photo", prompt="т", сцена="un_close")
        з = рв.запросы[0]
        self.assertEqual(з["lora"], [{"model": runware.ЛОРА_ЛИЦО,
                                      "weight": runware.ЛОРА_ВЕС}])
        self.assertEqual(з["steps"], 30)
        self.assertEqual(з["CFGScale"], 4.0)
        self.assertEqual((з["width"], з["height"]), (832, 1216))

    def test_второй_проход_идёт_по_маске_а_не_заново(self):
        """Без seedImage и maskImage это не правка паха, а новый кадр:
        лицо клиента пропадёт, и первый проход окажется выброшенным."""
        рв = Поддельный()
        досчитать(рв, mode="photo", prompt="т", сцена="ph_close")
        з = рв.запросы[1]
        self.assertTrue(з["seedImage"].startswith("data:image/png;base64,"))
        self.assertTrue(з["maskImage"].startswith("data:image/png;base64,"))
        self.assertEqual(з["strength"], runware.СИЛА_ОРГАН)
        self.assertNotIn("lora", з)

    def test_ню_в_полный_рост_считается_одним_проходом(self):
        """Правка по маске там, где паха в кадре нет, тратит десять
        секунд и портит то, что уже вышло хорошо."""
        рв = Поддельный()
        итог = досчитать(рв, mode="photo", prompt="т", сцена="un_full")
        self.assertEqual(итог["state"], "ok")
        self.assertEqual(len(рв.запросы), 1)

    def test_кнопки_без_ключа_сцены_идут_одним_проходом(self):
        рв = Поддельный()
        досчитать(рв, mode="photo", prompt="т")
        self.assertEqual(len(рв.запросы), 1)

    def test_пара_получает_свой_текст_про_двоих(self):
        рв = Поддельный()
        досчитать(рв, mode="photo", prompt="т", сцена="pf_mf_close")
        self.assertEqual(рв.запросы[1]["positivePrompt"],
                         runware.ОРГАН_ТЕКСТ_ПАРА)

    def test_упавший_второй_проход_не_валит_задание(self):
        """Кадр с лицом, фигурой и позой уже посчитан и оплачен. Отдать
        его честнее, чем вернуть осечку из-за неудавшейся правки."""
        рв = Поддельный(падать_на=2)
        итог = досчитать(рв, mode="photo", prompt="т", сцена="un_close")
        self.assertEqual(итог["state"], "ok")
        self.assertEqual(рв.fetch(итог["files"][0]), КАДР)

    def test_упавший_первый_проход_это_отказ(self):
        рв = Поддельный(падать_на=1)
        задача, _ = рв.start(mode="photo", prompt="т", сцена="un_close")
        with self.assertRaises(GpuError):
            рв.wait(задача, limit=30)

    def test_видео_на_runware_не_уходит(self):
        with self.assertRaises(GpuError):
            Поддельный().start(mode="video", prompt="т", secs=5)


class Референсы(unittest.TestCase):
    def setUp(self):
        # Детектор лиц живёт на проде; здесь подменяем сам кроп.
        self.было = runware.кроп_лица_ури
        runware.кроп_лица_ури = lambda ури: "data:image/png;base64,КРОП"

    def tearDown(self):
        runware.кроп_лица_ури = self.было

    def test_снимок_уходит_референсом(self):
        рв = Поддельный()
        имя = рв.upload("лицо.png", КАДР)
        досчитать(рв, mode="photo", prompt="т", images=[имя])
        рефы = рв.запросы[0]["referenceImages"]
        self.assertEqual(len(рефы), 2)          # кроп лица и сам снимок
        self.assertTrue(рефы[-1].startswith("data:image/png;base64,"))

    def test_кроп_лица_идёт_ПЕРВЫМ(self):
        """Энкодер режет каждый снимок до 384 на 384 суммарно: у человека
        в полный рост на лицо остаётся тридцать пикселей. Живая проба
        02.10.2026 без кропа дала чужое лицо старше своего возраста."""
        рв = Поддельный()
        имя = рв.upload("фигура.png", КАДР)
        досчитать(рв, mode="photo", prompt="т", images=[имя])
        self.assertEqual(рв.запросы[0]["referenceImages"][0],
                         "data:image/png;base64,КРОП")

    def test_на_паре_кроп_не_добавляется(self):
        """Лиц двое, и кроп одного перетянул бы на себя обоих."""
        рв = Поддельный()
        а = рв.upload("он.png", КАДР)
        б = рв.upload("она.png", КАДР)
        досчитать(рв, mode="photo", prompt="т", images=[а, б])
        self.assertEqual(len(рв.запросы[0]["referenceImages"]), 2)

    def test_лица_на_снимке_нет_считаем_без_кропа(self):
        """Кадр со спины или предмет вместо человека. Фигура и поза
        перенесутся и так, валить задание не из-за чего."""
        runware.кроп_лица_ури = lambda ури: None
        рв = Поддельный()
        имя = рв.upload("спина.png", КАДР)
        итог = досчитать(рв, mode="photo", prompt="т", images=[имя])
        self.assertEqual(итог["state"], "ok")
        self.assertEqual(len(рв.запросы[0]["referenceImages"]), 1)

    def test_снимка_нет_это_ошибка_а_не_кадр_без_лица(self):
        """Молча посчитать без референса значит отдать человеку чужое
        лицо за его деньги."""
        рв = Поддельный()
        задача, _ = рв.start(mode="photo", prompt="т", images=["нет_такого"])
        with self.assertRaises(GpuError):
            рв.wait(задача, limit=30)


class Маска(unittest.TestCase):
    def test_пятно_в_паху_а_края_чистые(self):
        import cv2
        import numpy as np
        байты = runware.маска_паха(КАДР, 832, 1216)
        м = cv2.imdecode(np.frombuffer(байты, np.uint8), cv2.IMREAD_GRAYSCALE)
        self.assertEqual(м.shape, (1216, 832))
        цх, цу = runware.МАСКА_ЦЕНТР
        self.assertGreater(int(м[int(1216 * цу), int(832 * цх)]), 200)
        self.assertEqual(int(м[5, 5]), 0)
        self.assertEqual(int(м[1210, 826]), 0)

    def test_по_скелету_маска_едет_за_бёдрами(self):
        """Сидящая и лежащая поза: пах лежит не там, где у стоящей.
        Эллипс по долям кадра правил бы бедро или простыню."""
        узлы = {"бедро_л": [0.30, 0.40, 0.9], "бедро_п": [0.44, 0.40, 0.9],
                "колено_л": [0.30, 0.70, 0.9], "колено_п": [0.44, 0.70, 0.9]}
        цх, цу, ох, оу = runware._эллипс_по_скелету(узлы)
        self.assertAlmostEqual(цх, 0.37, places=2)
        self.assertGreater(цу, 0.40)        # ниже линии бёдер
        self.assertLess(цу, 0.50)           # но заметно выше колен
        self.assertGreater(ох, 0.09)

    def test_скелета_нет_работаем_по_долям(self):
        цх, цу, ох, оу = (runware.МАСКА_ЦЕНТР + runware.МАСКА_ОСИ)
        self.assertEqual((цх, цу), (0.50, 0.72))
        self.assertEqual((ох, оу), (0.26, 0.17))


class Скачивание(unittest.TestCase):
    def test_страница_ошибки_не_принимается_за_кадр(self):
        """Раздача иногда отдаёт 502 от прокси: ответ в сто байт это
        HTML, а не PNG. Записать его в кадр значит отдать человеку
        битый файл за посчитанную генерацию."""
        рв = runware.Runware(key="x")
        рв._скачать.__func__          # берём настоящий, не подделку
        коротко = []

        class Ответ:
            def __enter__(self_):
                return self_

            def __exit__(self_, *а):
                return False

            def read(self_):
                коротко.append(1)
                return b"<html>502 Bad Gateway</html>"

        import urllib.request
        было = urllib.request.urlopen
        urllib.request.urlopen = lambda *а, **к: Ответ()
        try:
            with self.assertRaises(GpuError):
                рв._скачать("https://im.test/1.png")
        finally:
            urllib.request.urlopen = было
        self.assertEqual(len(коротко), runware.СКАЧАТЬ_ПОВТОРОВ)


class Интерфейс(unittest.TestCase):
    НУЖНО = ("карты", "выбрать", "отпустить", "alive", "free_vram",
             "upload", "start", "poll", "wait", "fetch", "лицо", "тело",
             "повторяемый", "настроена", "base")

    def test_отвечает_на_всё_что_зовёт_бот(self):
        рв = runware.Runware(key="x")
        for имя in self.НУЖНО:
            self.assertTrue(hasattr(рв, имя), имя)

    def test_очередь_ноль_и_остаток_неизвестен(self):
        """Ноль вместо остатка бот прочитал бы как «денег нет», а сервис
        остатка не отдаёт вовсе: `cost` приходит `null`."""
        рв = runware.Runware(key="x")
        остаток, всего, очередь = рв.free_vram()
        self.assertIsNone(остаток)
        self.assertIsNone(всего)
        self.assertEqual(очередь, 0)

    def test_без_ключа_не_настроен(self):
        self.assertFalse(runware.Runware(key="").настроена)


class Развилка(unittest.TestCase):
    """Переключатель: кому достаётся работа."""

    class Апи:
        настроена = True
        base = "апи"

        def alive(self):
            return True

        def выбрать(self, род=None):
            return self.base

        def отпустить(self):
            return None

    class Карта:
        настроена = False
        base = "карта"

        def выбрать(self, род=None):
            return self.base

        def отпустить(self):
            return None

    class Хранилище:
        def __init__(self, знач="runware"):
            self.знач = знач

        def настройка(self, ключ, умолч=None):
            return self.знач

        def настройка_записать(self, ключ, знач):
            self.знач = знач

    def выбор(self, рв=None, знач="runware"):
        return _движок.Выбор(self.Карта(), self.Апи(),
                             self.Хранилище(знач), рв=рв or Поддельный())

    def test_фото_уходит_на_runware(self):
        в = self.выбор()
        в.выбрать("фото")
        self.assertEqual(в.имя(), "runware")

    def test_видео_остаётся_на_апи(self):
        """Видео на Runware не проверяли вовсе. Отдать туда ролик значит
        поставить опыт на человеке, который уже заплатил."""
        в = self.выбор()
        в.выбрать("видео")
        self.assertEqual(в.имя(), "api")

    def test_без_ключа_runware_работу_не_берёт(self):
        в = self.выбор(рв=runware.Runware(key=""))
        в.выбрать("фото")
        self.assertEqual(в.имя(), "api")

    def test_движок_не_подключён_вовсе(self):
        в = _движок.Выбор(self.Карта(), self.Апи(), self.Хранилище())
        в.выбрать("фото")
        self.assertEqual(в.имя(), "api")

    def test_runware_это_не_карта(self):
        """Доработки карты (восстановитель лица, тело от SDXL, правка по
        маске) на Runware звать нельзя: их там нет."""
        в = self.выбор()
        в.выбрать("фото")
        self.assertFalse(в.на_карте())

    def test_род_отпускается_вместе_с_заданием(self):
        """Иначе следующее задание в том же потоке унаследует чужой род
        и уедет не на тот движок."""
        в = self.выбор()
        в.выбрать("видео")
        в.отпустить()
        в.выбрать("фото")
        self.assertEqual(в.имя(), "runware")

    def test_runware_в_списке_значений(self):
        self.assertIn("runware", _движок.ЗНАЧЕНИЯ)


if __name__ == "__main__":
    unittest.main()
