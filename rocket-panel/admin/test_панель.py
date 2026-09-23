"""Проверки админ-панели: данные, действия и сама страница.

Браузера здесь нет. Проверяется то, что от браузера не зависит: какие
адреса отвечают, что отдают, что меняется в базе после нажатия и что в
разметку не попало того, чего владелец не хочет видеть.
"""
import base64
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ЗДЕСЬ)
sys.path.insert(0, os.path.join(ЗДЕСЬ, "..", "bot"))
sys.path.insert(0, os.path.join(ЗДЕСЬ, "..", "brand-amberry"))

os.environ.setdefault("AMBERRY_ADMIN_PASS", "проба")
_ВРЕМЕННАЯ = os.path.join(tempfile.mkdtemp(), "панель.db")
os.environ["ROCKET_DB"] = _ВРЕМЕННАЯ

import catalog        # noqa: E402
import pricing        # noqa: E402
import admin          # noqa: E402
import панель         # noqa: E402
import сводка         # noqa: E402

ПОРТ = 8811
АДРЕС = f"http://127.0.0.1:{ПОРТ}"
АВТ = "Basic " + base64.b64encode(b"amberry:" + b"\xd0\xbf\xd1\x80\xd0\xbe"
                                  b"\xd0\xb1\xd0\xb0").decode()


def поднять():
    admin.ПОРТ = ПОРТ
    threading.Thread(target=admin.main, daemon=True).start()
    for _ in range(50):
        try:
            зайти("/api/сводка")
            return
        except Exception:                               # noqa: BLE001
            time.sleep(0.1)
    raise RuntimeError("панель не поднялась")


def зайти(путь, тело=None):
    адрес = АДРЕС + urllib.parse.quote(путь, safe="/?=&")
    данные = json.dumps(тело).encode() if тело is not None else None
    з = urllib.request.Request(адрес, data=данные,
                               headers={"Authorization": АВТ,
                                        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(з, timeout=10) as о:
            сырое = о.read()
            return о.status, (json.loads(сырое)
                              if о.headers.get("Content-Type", "").startswith(
                                  "application/json") else сырое.decode())
    except urllib.error.HTTPError as e:
        сырое = e.read()
        try:
            return e.code, json.loads(сырое)
        except Exception:                               # noqa: BLE001
            return e.code, сырое.decode("utf-8", "replace")


class Панель(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        поднять()

    def setUp(self):
        self.store = admin.store
        self.кто = 777_000 + int(time.time() * 1000) % 1000

    # ---------- страница ----------

    def test_страница_отдаётся_целиком_и_без_чужих_ссылок(self):
        """Панель стоит за паролем и туннелем. Ссылка на чужой шрифт или
        библиотеку сообщала бы тому сайту адрес панели и время каждого
        захода владельца."""
        код, тело = зайти("/")
        self.assertEqual(код, 200)
        self.assertIn("AMBERRY", тело)
        for чужое in ("http://", "https://", "//cdn", "fonts.googleapis"):
            self.assertNotIn(чужое, тело.replace("http://127.0.0.1", ""),
                             f"в странице осталось {чужое}")

    def test_в_панели_нет_эмодзи(self):
        """Правило владельца: только SVG-значки."""
        _, тело = зайти("/")
        for знак in тело:
            self.assertFalse(0x1F300 <= ord(знак) <= 0x1FAFF,
                             f"эмодзи в панели: {знак!r}")

    def test_прежняя_страница_каталога_цела(self):
        """Ею владелец пользуется каждый день. Панель её не заменяет, а
        показывает разделом."""
        код, тело = зайти("/каталог")
        self.assertEqual(код, 200)
        self.assertIn("/api/дерево", тело)

    def test_без_пароля_не_пускает(self):
        з = urllib.request.Request(АДРЕС + "/api/%D1%81%D0%B2%D0%BE%D0%B4"
                                           "%D0%BA%D0%B0")
        with self.assertRaises(urllib.error.HTTPError) as п:
            urllib.request.urlopen(з, timeout=10)
        self.assertEqual(п.exception.code, 401)

    # ---------- данные ----------

    def test_все_разделы_отвечают(self):
        for путь in ("/api/сводка", "/api/люди", "/api/оплаты", "/api/работы",
                     "/api/поддержка", "/api/рассылки", "/api/рассылка/ход",
                     "/api/услуги"):
            код, _ = зайти(путь)
            self.assertEqual(код, 200, путь)

    def test_ряд_по_дням_без_дырок(self):
        """База отдаёт только дни, в которые что-то было. График по
        дырявому ряду врёт дважды: пустой день исчезает, а «вчера» и
        «месяц назад» встают рядом."""
        сегодня = time.strftime("%Y-%m-%d", time.gmtime())
        ряд = сводка.по_дням([(сегодня, 5)], 30)
        self.assertEqual(len(ряд), 30)
        self.assertEqual(ряд[-1], (сегодня, 5))
        self.assertEqual(ряд[0][1], 0)

    def test_имя_кнопки_человеческое(self):
        """В следе лежит сырое `data` нажатия, владельцу оно ничего не
        говорит."""
        self.assertEqual(сводка._имя_кнопки(catalog, "m:menu"),
                         "Главное меню")
        self.assertEqual(сводка._имя_кнопки(catalog, "sc:un_three"),
                         catalog.scene("un_three").title)
        self.assertEqual(сводка._имя_кнопки(catalog, "buy:p3"), "покупка p3")

    # ---------- действия ----------

    def test_блокировка_и_снятие(self):
        self.store.ensure_user(self.кто, "проба")
        код, _ = зайти("/api/человек/блок", {"tg_id": self.кто, "блок": True})
        self.assertEqual(код, 200)
        self.assertEqual(self.store.user(self.кто)["blocked"], 1)
        зайти("/api/человек/блок", {"tg_id": self.кто, "блок": False})
        self.assertEqual(self.store.user(self.кто)["blocked"], 0)

    def test_удаление_стирает_и_переписку_и_след(self):
        """«Удалить» обещает «всё, что о нём известно». Письма человека
        и его след — тоже о нём."""
        self.store.ensure_user(self.кто, "проба")
        self.store.поддержка_записать(self.кто, "человек", "верните деньги")
        self.store.событие(self.кто, "вход")
        код, _ = зайти("/api/человек/удалить", {"tg_id": self.кто})
        self.assertEqual(код, 200)
        self.assertIsNone(self.store.user(self.кто))
        self.assertEqual(
            [д for д in self.store.поддержка_диалоги()
             if д["tg_id"] == self.кто], [])

    def test_ступень_прячется_и_возвращается(self):
        try:
            код, _ = зайти("/api/услуги/спрятать", {"ид": "p1", "скрыт": True})
            self.assertEqual(код, 200)
            _, у = зайти("/api/услуги")
            п1 = [п for п in у["пакеты"] if п["ид"] == "p1"][0]
            self.assertTrue(п1["скрыт"])
        finally:
            зайти("/api/услуги/спрятать", {"ид": "p1", "скрыт": False})
        _, у = зайти("/api/услуги")
        self.assertFalse([п for п in у["пакеты"] if п["ид"] == "p1"][0]["скрыт"])

    def test_выдуманную_ступень_не_прячем(self):
        """Ключ приходит из браузера. Принимать оттуда любой значило бы
        складывать в файл правок мусор, который бот никогда не прочтёт."""
        код, _ = зайти("/api/услуги/спрятать", {"ид": "p999", "скрыт": True})
        self.assertEqual(код, 400)

    def test_пустое_письмо_не_рассылается(self):
        код, _ = зайти("/api/рассылка", {"текст": "   ", "кому": "всем"})
        self.assertEqual(код, 400)

    def test_пустой_ответ_поддержке_не_уходит(self):
        код, _ = зайти("/api/поддержка/ответ", {"tg_id": 1, "текст": ""})
        self.assertEqual(код, 400)

    def test_две_рассылки_разом_не_заводятся(self):
        """Две очереди на один токен — это удвоенный темп и мгновенный
        запрет на посылки."""
        сводка._ИДЁТ["ид"] = 42
        try:
            код, _ = зайти("/api/рассылка", {"текст": "привет"})
            self.assertEqual(код, 400)
        finally:
            сводка._ИДЁТ["ид"] = None

    def test_неизвестное_действие_это_404(self):
        код, _ = зайти("/api/чего-нибудь", {"а": 1})
        self.assertEqual(код, 404)


class Рассылка(unittest.TestCase):
    """Отправка наружу подменяется: настоящий телеграм в тестах не
    трогаем, а проверить надо именно поведение — кого считаем дошедшим,
    кого снимаем с рассылок и что остаётся в базе."""

    def setUp(self):
        self.store = admin.store
        self.живой = 900_001
        self.мёртвый = 900_002
        for кто in (self.живой, self.мёртвый):
            self.store.ensure_user(кто, f"ч{кто}")
            self.store.заблокировать(кто, False)
        self.было = сводка.написать

    def tearDown(self):
        сводка.написать = self.было
        сводка._ИДЁТ["ид"] = None

    def test_выгнавший_бота_снимается_с_рассылок(self):
        """Иначе каждая следующая рассылка бьётся о него снова, тратя
        темп, которого у нас четыре сообщения в секунду."""
        мёртвый = self.мёртвый

        def подделка(кому, текст):
            return (False, True) if кому == мёртвый else (True, False)

        сводка.написать = подделка
        сводка.В_СЕКУНДУ = 1000.0
        ид, сколько = сводка.разослать(self.store, "письмо", "всем")
        self.assertGreaterEqual(сколько, 2)
        for _ in range(100):
            if сводка.состояние()["ид"] is None:
                break
            time.sleep(0.05)
        self.assertEqual(self.store.user(мёртвый)["blocked"], 1)
        self.assertEqual(self.store.user(self.живой)["blocked"], 0)
        итог = [р for р in self.store.рассылки() if р["id"] == ид][0]
        self.assertEqual(итог["состояние"], "готова")
        self.assertEqual(итог["отказ"], 1)

    def test_недошедший_ответ_в_переписку_не_пишется(self):
        """Иначе в переписке остаются наши реплики, которых человек не
        видел, и следующий разговор идёт мимо."""
        сводка.написать = lambda кому, текст: (False, False)
        ушло, _ = сводка.ответить(self.store, self.живой, "ответ")
        self.assertFalse(ушло)
        self.assertEqual(self.store.поддержка_диалог(self.живой), [])
        сводка.написать = lambda кому, текст: (True, False)
        ушло, _ = сводка.ответить(self.store, self.живой, "ответ")
        self.assertTrue(ушло)
        self.assertEqual(len(self.store.поддержка_диалог(self.живой)), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
