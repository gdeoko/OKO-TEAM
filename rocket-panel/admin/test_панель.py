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
        # Ссылки на каналы телеграма в разделе «Реклама» - это переход
        # по нажатию, а не загрузка: сами по себе они никуда не ходят, а
        # noreferrer не даёт телеграму узнать адрес панели.
        self.assertIn('rel="noopener noreferrer"', тело)
        чистое = (тело.replace("http://127.0.0.1", "")
                      .replace('"https://t.me/"', "").replace("https://t.me/", ""))
        for чужое in ("http://", "https://", "//cdn", "fonts.googleapis"):
            self.assertNotIn(чужое, чистое, f"в странице осталось {чужое}")

    def test_реклама_отдаёт_каналы(self):
        код, д = зайти("/api/реклама")
        self.assertEqual(код, 200)
        self.assertGreaterEqual(len(д["каналы"]), 50)
        for к in д["каналы"]:
            self.assertGreaterEqual(к["подписчиков"], 50000)
            self.assertIn(к["вердикт"], ("живой", "с оговорками", "рискованный"))

    def test_источники_отдаются(self):
        """Без учёта источников закупка вслепую: непонятно, какой канал
        окупился."""
        код, д = зайти("/api/источники")
        self.assertEqual(код, 200)
        self.assertIsInstance(д["источники"], list)
        for и in д["источники"]:
            self.assertIn("откуда", и)
            self.assertGreaterEqual(и["пришло"], 0)

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
        видел, и следующий разговор идёт мимо. Ответ с сайта уходит от
        бота поддержки и дублируется в ветку клиента."""
        import поддержка
        вызовы = []
        отказ = {"да": True}

        def tg(метод, **поля):
            вызовы.append((метод, поля))
            if метод == "sendMessage" and поля["chat_id"] == self.живой \
                    and отказ["да"]:
                return {"ok": False, "description": "bot was blocked by the user"}
            return {"ok": True, "result": {"message_id": 1}}

        self.store.ветка_записать(self.живой, 42, "Живой", None)
        п = поддержка.Поддержка(self.store, tg, группа=-100123)
        ушло, насмерть = сводка.ответить(self.store, self.живой, "ответ", п=п)
        self.assertFalse(ушло)
        self.assertTrue(насмерть)
        self.assertEqual(self.store.поддержка_диалог(self.живой), [])
        отказ["да"] = False
        вызовы.clear()
        ушло, _ = сводка.ответить(self.store, self.живой, "ответ", п=п)
        self.assertTrue(ушло)
        self.assertEqual(len(self.store.поддержка_диалог(self.живой)), 1)
        в_ветку = [п_ for м, п_ in вызовы if м == "sendMessage"
                   and п_.get("message_thread_id") == 42]
        self.assertIn("ответ", в_ветку[0]["text"])


class ФраншизаВПанели(unittest.TestCase):
    """Самый дорогой товар бота. Здесь важнее всего две вещи: токен
    чужого бота наружу не сыплется, и деньги панель не двигает."""

    @classmethod
    def setUpClass(cls):
        поднять()

    def setUp(self):
        self.store = admin.store
        self.кто = 880_000 + int(time.time() * 1000) % 1000
        self.store.ensure_user(self.кто, "партнёр")
        self.store.партнёр_завести(self.кто, "партнёр", 8000, "RUB")
        self.токен = "1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
        self.store.партнёр_токен(self.кто, self.токен, "@чужойбот")

    def test_в_списке_токена_нет_целиком(self):
        """Общий список уезжает в исходный код страницы. Ключ от чужого
        бота там лежать не должен."""
        код, д = зайти("/api/франшиза")
        self.assertEqual(код, 200)
        self.assertNotIn(self.токен, json.dumps(д, ensure_ascii=False))
        мой = [п for п in д["партнёры"] if п["tg_id"] == self.кто][0]
        self.assertTrue(мой["есть_токен"])
        self.assertTrue(мой["токен_хвост"].endswith(self.токен[-6:]))

    def test_полный_токен_отдельным_запросом(self):
        код, д = зайти(f"/api/франшиза/токен/{self.кто}")
        self.assertEqual(код, 200)
        self.assertEqual(д["токен"], self.токен)

    def test_к_выплате_считается_по_доле(self):
        зайти("/api/франшиза/учёт", {"tg_id": self.кто, "выручка": 10000,
                                     "доля": 50, "выплачено": 1000})
        _, д = зайти("/api/франшиза")
        мой = [п for п in д["партнёры"] if п["tg_id"] == self.кто][0]
        self.assertEqual(мой["к_выплате"], 4000)

    def test_переплату_в_минус_не_уводим(self):
        """Выплатили больше, чем насчитали, - к выплате ноль, а не долг
        партнёра перед нами."""
        зайти("/api/франшиза/учёт", {"tg_id": self.кто, "выручка": 1000,
                                     "доля": 50, "выплачено": 900})
        _, д = зайти("/api/франшиза")
        мой = [п for п in д["партнёры"] if п["tg_id"] == self.кто][0]
        self.assertEqual(мой["к_выплате"], 0)

    def test_кнопки_выплатить_в_панели_нет(self):
        """Перевод необратим, а ошибка в доле или в реквизитах не
        откатывается ничем. Панель только считает."""
        _, тело = зайти("/")
        self.assertNotIn("/api/франшиза/выплатить", тело)
        self.assertIn("Перевод делает владелец руками", тело)

    def test_состояние_меняется(self):
        код, _ = зайти("/api/франшиза/состояние",
                       {"tg_id": self.кто, "состояние": "запущен"})
        self.assertEqual(код, 200)
        self.assertEqual(self.store.партнёр(self.кто)["состояние"], "запущен")
        self.assertIsNotNone(self.store.партнёр(self.кто)["запущен_at"])


class ЗапретВАдминке(unittest.TestCase):
    """Владелец правит список слов сам, из панели, и правит ЦЕЛИКОМ.

    Раньше базовые слова были несносимыми: считалось, что так надёжнее.
    Владелец 24.09.2026 потребовал обратного — «в админке должна быть
    свобода редактирования всего», потому что ложное срабатывание на
    живом клиенте чинится за минуту только тогда, когда слово можно
    просто удалить. Откат к исходному набору остаётся одной кнопкой.
    """

    def setUp(self):
        import tempfile
        self.д = tempfile.mkdtemp()
        os.environ["ROCKET_BAN_FILE"] = os.path.join(self.д, "з.json")
        import importlib
        import запрет
        importlib.reload(запрет)
        self.з = запрет

    def test_без_правок_работает_базовый_список(self):
        self.assertEqual(self.з.слова(), list(self.з.БАЗОВЫЕ))
        self.assertTrue(self.з.состояние()["как_базовые"])
        self.assertTrue(self.з.нельзя("naked child")[0])

    def test_слово_удаляется_насовсем(self):
        """Главное требование владельца: мешает — убрал."""
        без = [с for с in self.з.БАЗОВЫЕ if с != "loli"]
        self.з.записать(слова_=без)
        self.assertFalse(self.з.нельзя("loli")[0])
        self.assertNotIn("loli", self.з.слова())
        self.assertFalse(self.з.состояние()["как_базовые"])
        # остальное на месте
        self.assertTrue(self.з.нельзя("naked child")[0])

    def test_список_можно_опустошить(self):
        """Панель не спорит с владельцем. Он сам сказал, что будет
        следить руками."""
        self.з.записать(слова_=[])
        self.assertFalse(self.з.нельзя("naked child")[0])
        self.assertEqual(self.з.слова(), [])

    def test_своё_слово_запрещает(self):
        self.assertFalse(self.з.нельзя("совсем безобидно")[0])
        self.з.записать(слова_=list(self.з.БАЗОВЫЕ) + ["безобидно"])
        self.assertTrue(self.з.нельзя("совсем безобидно")[0])

    def test_возврат_к_базовым(self):
        self.з.записать(слова_=["только это"])
        self.assertFalse(self.з.нельзя("naked child")[0])
        с = self.з.вернуть_базовые()
        self.assertTrue(с["как_базовые"])
        self.assertTrue(self.з.нельзя("naked child")[0])

    def test_базовые_в_файл_не_переписываются(self):
        """В файле лежат только слова владельца. Иначе правка списка в
        коде никогда бы не доехала до уже работающего бота."""
        self.з.записать(слова_=["своё"], исключения_=[])
        with open(self.з.НАСТРОЙКА, encoding="utf-8") as ф:
            в_файле = json.load(ф)
        self.assertEqual(в_файле.get("слова"), ["своё"])
        self.assertNotIn("базовые", в_файле)
        self.assertIn("child", self.з.состояние()["базовые"])

    def test_исключение_гасит_ложное(self):
        """Второй способ починить ложную придирку — не трогая список."""
        self.assertTrue(self.з.нельзя("малолетка вина")[0])
        self.з.записать(исключения_=["малолетка вина"])
        self.assertFalse(self.з.нельзя("малолетка вина урожая")[0])
        self.assertTrue(self.з.нельзя("малолетка")[0])

    def test_состояние_отдаёт_всё_что_нужно_экрану(self):
        с = self.з.состояние()
        for к in ("слова", "исключения", "базовые", "взрослый_с",
                  "как_базовые"):
            self.assertIn(к, с)
        self.assertEqual(с["взрослый_с"], 18)

    def test_в_панели_есть_раздел_и_ручки(self):
        import панель
        html = панель.страница("data:,")
        self.assertIn('id="р_запрет"', html)
        for ручка in ("/api/запрет/проверить", "/api/запрет/сохранить",
                      "/api/запрет/вернуть"):
            self.assertIn(ручка, html, ручка)


class ЗапретыДобавляютсяИУдаляются(unittest.TestCase):
    """Владелец: «дай возможность удалять и добавлять запреты в
    админке». Списком с кнопкой у каждой строки, а не текстовым полем:
    в поле легко снести всё разом случайным выделением."""

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_есть_добавление_и_удаление(self):
        for кусок in ("зап_добавить", "data-убрать", "Удалить",
                      "зап_добавить_искл", "сохранить_запрет"):
            self.assertIn(кусок, self.html, кусок)

    def test_у_обоих_списков_своё_поле(self):
        self.assertIn("зап_новое", self.html)
        self.assertIn("зап_новое_искл", self.html)

    def test_удаляется_любое_слово_включая_базовое(self):
        """Строку рисует одна функция на весь список — значит кнопка
        «Удалить» есть у каждого слова, без деления на «своё» и
        «базовое». Именно этого деления владелец и просил не делать."""
        i = self.html.index("function рисовать_запрет")
        кусок = self.html[i:i + 900]
        self.assertIn("ЗАП.слова.map(с => строка_запрета(с", кусок)
        self.assertNotIn("зап_базовые", self.html)

    def test_есть_кнопка_отката(self):
        self.assertIn('id="зап_вернуть"', self.html)

    def test_экран_не_зовёт_снесённые_поля(self):
        """Стоит забыть одну строку из старой разметки — раздел
        падает молча и целиком."""
        for снесено in ("зап_возраст", "зап_базовые", "ЗАП.свои"):
            self.assertNotIn(снесено, self.html, снесено)


if __name__ == "__main__":
    unittest.main(verbosity=2)


class ПрайсВАдминке(unittest.TestCase):
    """Владелец: «нужно сделать всё редактируемым… ну и цены менять»."""

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_раздел_и_ручки(self):
        self.assertIn('id="р_прайс"', self.html)
        for ручка in ("/api/прайс/сохранить", "/api/прайс/вернуть"):
            self.assertIn(ручка, self.html, ручка)

    def test_ступени_добавляются_и_удаляются(self):
        for кусок in ("пр_ступень", "data-снять", "Удалить", "пр_вернуть"):
            self.assertIn(кусок, self.html, кусок)

    def test_правятся_все_поля_ступени(self):
        """Поля ступени рисует JS, поэтому проверяем вызовы, а не
        готовую разметку: в исходнике страницы их ещё нет."""
        for поле in ("id", "coins", "rub", "market_rub"):
            self.assertIn('"%s"' % поле, self.html, поле)
        self.assertIn('data-п="${ключ}"', self.html)

    def test_правятся_все_поля_вида(self):
        for поле in ("title", "crystals", "note", "в_продаже"):
            self.assertIn('data-в="%s"' % поле, self.html, поле)

    def test_себестоимость_только_показывается(self):
        """Секунды карты — замер, а не решение: правка сделала бы
        расчёт маржи враньём, которое выглядит как правда."""
        self.assertIn("себестоимость", self.html)
        self.assertNotIn('data-в="seconds"', self.html)
        self.assertNotIn('data-в="секунд_карты"', self.html)


class СвоиКнопкиНаСтраницеКаталога(unittest.TestCase):
    """Владелец: «добавлять какие-то новые промпты и кнопки… полное
    редактирование всего»."""

    def setUp(self):
        import admin
        self.html = admin.страница()

    def test_есть_форма_заведения(self):
        for кусок in ("формаДобавления", "data-завести", "Завести кнопку",
                      "/api/каталог/добавить"):
            self.assertIn(кусок, self.html, кусок)

    def test_есть_все_поля_новой_кнопки(self):
        for поле in ("название", "строка_рус", "строка", "вид"):
            self.assertIn('data-н="%s"' % поле, self.html, поле)

    def test_вид_выбирается_из_прайса(self):
        """Цена у своей кнопки берётся из вида работ, а не пишется
        руками: иначе она разошлась бы с прайсом."""
        for вид in ("i2i", "i2v_5", "i2v_10"):
            self.assertIn('value="%s"' % вид, self.html, вид)

    def test_удаление_только_у_своих(self):
        """У кнопки из кода за спиной три тысячи знаков промпта.
        Стёртая из браузера, она бы не вернулась."""
        self.assertIn("в.свой ?", self.html)
        self.assertIn("data-снести", self.html)
        self.assertIn("/api/каталог/удалить", self.html)

    def test_удаление_спрашивает_подтверждение(self):
        i = self.html.index("async function снести")
        self.assertIn("confirm(", self.html[i:i + 300])

    def test_страница_перерисовывается_после_правки(self):
        """Владелец жмёт «завести» и должен сразу увидеть кнопку."""
        i = self.html.index("async function завести")
        self.assertIn("загрузить()", self.html[i:i + 900])


class РучкиКаталогаВАдминке(unittest.TestCase):

    def setUp(self):
        import tempfile
        import данные
        self.старый = данные.ФАЙЛ
        данные.ФАЙЛ = os.path.join(tempfile.mkdtemp(), "каталог.json")
        import catalog
        catalog.перечитать()
        self.catalog = catalog

    def tearDown(self):
        import данные
        данные.ФАЙЛ = self.старый
        self.catalog.перечитать()

    def test_заведение_и_удаление_через_каталог(self):
        к = self.catalog.добавить_свой(название="Проба", строка="she waves",
                                       вид="i2i", узел_="un_here")
        self.assertIn(к, [с["ключ"] for с in self._варианты()])
        свои = [с for с in self._варианты() if с.get("свой")]
        self.assertEqual([с["ключ"] for с in свои], [к])
        self.assertTrue(self.catalog.убрать_свой(к))
        self.assertNotIn(к, [с["ключ"] for с in self._варианты()])

    def test_кнопки_из_кода_не_помечены_своими(self):
        свои = [с for с in self._варианты() if с.get("свой")]
        self.assertEqual(свои, [])

    def _варианты(self):
        из = []

        def обойти(у):
            из.extend(у.get("варианты") or [])
            for д in (у.get("дети") or []):
                обойти(д)

        for р in self.catalog.дерево()["разделы"]:
            обойти(р)
        return из


class ЖивостьКопий(unittest.TestCase):
    """Колонка «Работает» в разделе «Франшиза».

    Ловим две ошибки, которые уже были сделаны: спрашивать живость по
    полю, которого в списке нет, и верить своей же колонке `состояние`
    вместо системы.
    """

    def setUp(self):
        import сводка
        self.сводка = сводка
        import партнёры
        self.партнёры = партнёры
        self.было = партнёры.работает
        self.спросили = []
        партнёры.работает = lambda кто: (self.спросили.append(кто), True)[1]

    def tearDown(self):
        self.партнёры.работает = self.было

    class _База:
        def __init__(self, строки):
            self.строки = строки

        def партнёры(self):
            return self.строки

    class _Франшиза:
        ДОЛЛАРОВ = 500

        @staticmethod
        def рублей():
            return 42500

    def test_спрашиваем_систему_про_того_у_кого_есть_токен(self):
        """`store.партнёры()` отдаёт токен замаскированным и поле
        `токен` из строки ВЫБРАСЫВАЕТ. Проверка по нему была всегда
        ложной, и все живые копии показывались погашенными."""
        д = self.сводка.партнёры(
            self._База([{"tg_id": 7, "есть_токен": True, "токен_хвост": "…abc",
                         "к_выплате": 0}]),
            self._Франшиза)
        self.assertEqual(self.спросили, [7])
        self.assertTrue(д["партнёры"][0]["жив"])

    def test_без_токена_не_дёргаем_систему(self):
        д = self.сводка.партнёры(
            self._База([{"tg_id": 8, "есть_токен": False, "к_выплате": 0}]),
            self._Франшиза)
        self.assertEqual(self.спросили, [])
        self.assertFalse(д["партнёры"][0]["жив"])

    def test_цена_считается_по_курсу_а_не_хранится(self):
        """Здесь стояла отменённая `франшиза.РУБЛЕЙ`, и раздел падал
        целиком с AttributeError."""
        д = self.сводка.партнёры(self._База([]), self._Франшиза)
        self.assertEqual(д["цена_руб"], 42500)
        self.assertEqual(д["цена_usd"], 500)


class НачислениеРуками(unittest.TestCase):
    """Кнопка «Начислить» в разделе «Люди».

    Владелец дарит коины блогеру, извиняется за осечку, даёт пробу.
    Раньше для этого приходилось лезть в базу руками - а руками в
    боевой базе делают опечатки.
    """

    @classmethod
    def setUpClass(cls):
        поднять()

    def setUp(self):
        self.store = admin.store
        self.кто = 888_000 + int(time.time() * 1000) % 1000
        self.store.ensure_user(self.кто, "gость", welcome=0)

    def test_начисляет_и_отдаёт_новый_баланс(self):
        код, о = зайти("/api/человек/начислить",
                       {"tg_id": self.кто, "сколько": 1000,
                        "почему": "подарок"})
        self.assertEqual(код, 200)
        self.assertTrue(о["ок"])
        self.assertEqual(о["баланс"], 1000)
        self.assertEqual(self.store.balance(self.кто), 1000)

    def test_идёт_в_welcome_а_не_в_выручку(self):
        """В `paid` лежит ВЫРУЧКА: от неё считается половина партнёру и
        вся отчётность. Подаренные коины деньгами не являются, и попав
        туда, раздули бы выручку на ровном месте."""
        зайти("/api/человек/начислить", {"tg_id": self.кто, "сколько": 50})
        ч = self.store.user(self.кто)
        self.assertEqual(ч["welcome"], 50)
        self.assertEqual(ч["paid"], 0)

    def test_причина_попадает_в_журнал(self):
        """Через месяц «откуда у него тысяча коинов» - вопрос без
        ответа, если причину не записать."""
        зайти("/api/человек/начислить",
              {"tg_id": self.кто, "сколько": 7, "почему": "за отзыв"})
        строки = self.store.журнал(self.кто) if hasattr(self.store, "журнал") \
            else None
        if строки is None:
            self.skipTest("журнал читается иначе")
        self.assertTrue(any("за отзыв" in (с.get("reason") or "")
                            for с in строки))

    def test_ноль_и_минус_отбиваются(self):
        for сколько in (0, -5):
            код, _ = зайти("/api/человек/начислить",
                           {"tg_id": self.кто, "сколько": сколько})
            self.assertEqual(код, 400, сколько)
        self.assertEqual(self.store.balance(self.кто), 0)

    def test_слишком_много_отбивается(self):
        """Верхняя граница от опечатки: лишний ноль в поле - и человек
        получает миллион коинов, которые уже не отнять."""
        код, _ = зайти("/api/человек/начислить",
                       {"tg_id": self.кто, "сколько": 100001})
        self.assertEqual(код, 400)

    def test_незнакомцу_не_начисляем(self):
        """Начислить можно только тому, кто нажал «Начать»: до этого
        записи о нём нет, и коины лечь некуда."""
        код, _ = зайти("/api/человек/начислить",
                       {"tg_id": 999_999_999, "сколько": 10})
        self.assertEqual(код, 404)

    def test_мусор_вместо_числа_не_роняет_панель(self):
        код, _ = зайти("/api/человек/начислить",
                       {"tg_id": self.кто, "сколько": "тысячу"})
        self.assertEqual(код, 400)


class ПанельРазговариваетССервером(unittest.TestCase):
    """28.09.2026 админка «легла»: страница отдавалась с кодом 200, шапка
    и меню рисовались, а ни один раздел не грузился.

    Причина: в разметке сорок раз звались `взять`, `послать`, `столбики`
    и `полосы`, а самих функций в файле не было ВОВСЕ. Скрипт падал на
    первом же обращении к серверу. Снаружи панель при этом выглядела
    живой, поэтому поломку никто не мог показать пальцем.

    Файл панели никогда не лежал в гите - он приезжал на сервер мостом,
    мимо истории. Значит пропажу нечем было заметить и неоткуда
    вернуть, и единственное место, где это можно удержать, - здесь.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_все_зовомые_функции_объявлены(self):
        """Ищем имена, которые страница зовёт, но нигде не объявляет."""
        import re
        начало = self.html.find("<script>")
        js = self.html[начало:self.html.rfind("</script>")]
        объявлены = set(re.findall(
            r"(?:function|const|let|var)\s+([A-Za-zА-Яа-я_$][\w$А-Яа-я]*)", js))
        объявлены |= set(re.findall(
            r"async\s+([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\(", js))
        # Чужое и встроенное: его объявлять не нам.
        своё = {"взять", "послать", "столбики", "полосы", "рисовать_запрет",
                "строка_запрета", "сохранить_запрет", "рисовать_фото",
                "рисовать_прайс", "рисовать_рекламу", "рисовать_сервисы",
                "применить_тайны", "открыть", "меню", "эк", "дата"}
        зовутся = set(re.findall(
            r"(?<![.\w$])([A-Za-zА-Яа-я_][\wА-Яа-я]*)\s*\(", js))
        пропали = sorted((зовутся & своё) - объявлены)
        self.assertFalse(пропали, "зовутся, но не объявлены: %s" % пропали)

    def test_взять_и_послать_на_месте(self):
        for имя in ("async function взять", "async function послать"):
            self.assertIn(имя, self.html, имя)

    def test_рисовалки_графиков_на_месте(self):
        """Сводка зовёт их четыре раза. Без них раздел пустой."""
        for имя in ("function столбики", "function полосы"):
            self.assertIn(имя, self.html, имя)


class ПроверкаФотоВАдминке(unittest.TestCase):
    """Владелец 28.09.2026: «чтобы там был раздел проверки по фото на
    детское тоже».

    Раздел показывает не настройки ради настроек, а журнал: именно им
    сервис доказывает банку, что заслон работает и работал. Поэтому
    журнал стоит на той же странице, а не в логах сервера.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_раздел_есть_в_меню_и_в_разметке(self):
        self.assertIn('id="р_фото"', self.html)
        self.assertIn('"фото","Проверка фото"', self.html)

    def test_раздел_берёт_состояние_с_сервера(self):
        self.assertIn("/api/фото_возраст", self.html)

    def test_на_экране_есть_журнал_и_счётчики(self):
        for кусок in ("фт_плитки", "фт_журнал", "фт_настройки"):
            self.assertIn(кусок, self.html, кусок)

    def test_выключенный_заслон_виден_красным(self):
        """Выключенный заслон означает, что бот принимает любые снимки.
        Молчать об этом нельзя: на экране всё выглядело бы обычно."""
        self.assertIn("AMBERRY_AGE", self.html)


class МостКЗаслонамНеРоняетПанель(unittest.TestCase):
    """26.09.2026 импорт `запрет` прямо в шапке админки ронял её целиком:
    502 вместо всего кабинета, вместе со сводкой, людьми и оплатами.
    Раздел тогда убрали.

    Мост поднимает чужой модуль лениво и ловит его падение - значит
    беда одного заслона больше не уносит панель.
    """

    def test_заслоны_не_импортируются_в_шапке_админки(self):
        import os
        путь = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "admin.py")
        шапка = open(путь, encoding="utf-8").read().split("class ")[0]
        for плохо in ("\nimport запрет", "\nimport возраст_фото"):
            self.assertNotIn(плохо, шапка, плохо)

    def test_мост_отвечает_и_когда_модуля_нет(self):
        import заслоны
        было = заслоны.БОТ
        try:
            заслоны.БОТ = "/такого/каталога/нет"
            с = заслоны.слова_состояние()
            self.assertFalse(с["есть"])
            self.assertIn("почему", с)
            ф = заслоны.фото_состояние()
            self.assertFalse(ф["есть"])
            # Журнал читается отдельно от модуля: он на диске, а не в коде.
            self.assertIn("журнал", ф)
        finally:
            заслоны.БОТ = было

    def test_журнал_считает_принятые_и_отбитые(self):
        import json
        import tempfile
        import заслоны
        было = заслоны.ЖУРНАЛ
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".jsonl",
                                             delete=False,
                                             encoding="utf-8") as ф:
                for принят in (True, False, False):
                    ф.write(json.dumps({"когда": 1, "кто": 7,
                                        "принят": принят,
                                        "почему": "проба"}) + "\n")
                имя = ф.name
            заслоны.ЖУРНАЛ = имя
            с = заслоны.журнал_срез()
            self.assertEqual((с["всего"], с["принято"], с["отбито"]), (3, 1, 2))
        finally:
            заслоны.ЖУРНАЛ = было

    def test_нет_журнала_это_нули_а_не_ошибка(self):
        """Заслон мог просто ещё ни разу не сработать."""
        import заслоны
        было = заслоны.ЖУРНАЛ
        try:
            заслоны.ЖУРНАЛ = "/нет/такого/журнала.jsonl"
            self.assertEqual(заслоны.журнал_срез()["всего"], 0)
        finally:
            заслоны.ЖУРНАЛ = было


class ПереключательДвижка(unittest.TestCase):
    """Чем считает бот — APIMODELS или своя карта. Тумблер владельца.

    Проверяется не вид, а два обещания: кнопки на странице есть, и
    ключ настройки у панели тот же, что у бота. Разойдутся имена — щелчок
    в панели ничего не переключит, и понять это можно будет только по
    счёту за генерации.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_кнопки_на_странице(self):
        for что in ('id="движок"', 'data-движок="api"',
                    'data-движок="карта"'):
            self.assertIn(что, self.html, что)

    def test_состояние_грузится_со_сводкой(self):
        self.assertIn("движок_состояние()", self.html)
        self.assertIn('взять("/api/движок")', self.html)

    def test_щелчок_уходит_на_сервер(self):
        self.assertIn('послать("/api/движок/выбрать"', self.html)

    def test_ключ_настройки_общий_с_ботом(self):
        """Второго имени не заводить: разойдётся — тумблер онемеет."""
        import admin
        import движок
        self.assertEqual(admin.ДВИЖОК_КЛЮЧ, движок.КЛЮЧ)

    def test_состояние_отдаёт_что_нужно_экрану(self):
        import admin
        д = admin.движок_состояние()
        for поле in ("движок", "остаток", "фото", "видео"):
            self.assertIn(поле, д)
        self.assertIn(д["движок"], ("api", "карта"))

    def test_мусор_в_базе_читается_как_умолчание(self):
        import admin
        было = admin.store.настройка(admin.ДВИЖОК_КЛЮЧ)
        try:
            admin.store.настройка_записать(admin.ДВИЖОК_КЛЮЧ, "абракадабра")
            self.assertIn(admin.движок_состояние()["движок"],
                          ("api", "карта"))
        finally:
            admin.store.настройка_записать(admin.ДВИЖОК_КЛЮЧ, было)


class БургерОткрываетМеню(unittest.TestCase):
    """Владелец 28.09.2026: «бургер не нажимается не работает».

    Пропал только обработчик. Кнопка в разметке была, оформление было,
    класс `меню_открыто` в стилях был и даже снимался при выборе
    раздела - а ставить его было некому. На телефоне меню сдвинуто за
    край экрана и живёт исключительно этим классом, то есть открыть его
    было нельзя вообще ничем.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_кнопка_и_обработчик_на_месте(self):
        self.assertIn('id="бургер"', self.html)
        self.assertIn("function меню_переключить", self.html)
        self.assertIn("#бургер", self.html)

    def test_класс_не_только_снимается_но_и_ставится(self):
        """Снятие без постановки - ровно та поломка, что была."""
        i = self.html.find("function меню_переключить")
        self.assertGreater(i, 0)
        self.assertIn("classList.toggle", self.html[i:i + 400])

    def test_закрывается_тенью_и_клавишей(self):
        self.assertIn("#тень", self.html)
        self.assertIn("Escape", self.html)


class РазделыПереключаются(unittest.TestCase):
    """Владелец 28.09.2026: «ни один из разделов не нажимается».

    `открыть()` звалась ровно один раз, при загрузке страницы, а
    слушателя `hashchange` не было вовсе. Пункты меню - обычные ссылки
    `#люди`, `#оплаты`: нажатие меняло адрес в строке браузера, и на
    этом всё кончалось. Разметка, меню и данные были при этом целы,
    поэтому снаружи поломка выглядела необъяснимо.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_страница_слушает_смену_адреса(self):
        self.assertIn('addEventListener("hashchange"', self.html)

    def test_слушатель_зовёт_открыть(self):
        """Ищем именно код, а не слово: «hashchange» стоит и в
        комментарии рядом, и поиск по слову попадал в него."""
        i = self.html.find('addEventListener("hashchange"')
        self.assertGreater(i, 0)
        self.assertIn("открыть", self.html[i:i + 120])

    def test_пункты_меню_ссылками_а_не_кнопками(self):
        """Ссылка работает и с «назад» браузера, и присланной в чат."""
        self.assertIn('href="#${к}"', self.html)


class ИконкаВкладкиОтдаётся(unittest.TestCase):
    """Браузер просит `/favicon.ico` сам, при каждой загрузке. Без
    ответа он писал 404 в консоль, и эта строка мозолила глаза среди
    настоящих ошибок."""

    def test_маршрут_есть(self):
        import os
        путь = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "admin.py")
        self.assertIn('"/favicon.ico"', open(путь, encoding="utf-8").read())


class МодерацияПоДетскимСнимкам(unittest.TestCase):
    """Решение владельца и сетевого администратора 28.09.2026.

        Даниэль:  Или автоматически поставить блокировку? 3 = блок
        Админ:    ну так то лучше автоматом
        Даниэль:  Иногда просто в 18 лет даже молодо выглядит
        Админ:    или после 3 предупреждений чтобы нам саппорт приходил
                  запрос на ручную блокировку (модерацию)
        Даниэль:  даже человек по фото не поймет 17 или 18
        Админ:    согласен

    Автоблокировки нет. Три отказа поднимают заявку, блокирует человек.
    """

    def setUp(self):
        import панель
        self.html = панель.страница("data:,")

    def test_на_экране_есть_список_и_обе_кнопки(self):
        for кусок in ("фт_модерация", "data-блок", "снять-пред"):
            self.assertIn(кусок, self.html, кусок)

    def test_сказано_что_бот_не_блокирует_сам(self):
        """Иначе менеджер решит, что бот уже заблокировал, и не сделает
        ничего."""
        self.assertIn("автоматически бот никого не блокирует",
                      self.html.lower())

    def test_ручка_снятия_есть(self):
        self.assertIn("/api/возраст/снять", self.html)


class СчётПредупреждений(unittest.TestCase):
    """Считает `предупреждения`, а не админка: счёт обязан совпадать с
    журналом, по которому потом объясняются с человеком."""

    def setUp(self):
        import importlib
        import os
        import sys
        бот = os.path.join(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__))), "bot")
        if бот not in sys.path:
            sys.path.insert(0, бот)
        import предупреждения
        importlib.reload(предупреждения)
        self.п = предупреждения
        import store as _s
        import tempfile
        self.файл = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
        self.store = _s.Store(self.файл)
        self.store.ensure_user(777, username="кто")

    def test_порог_три(self):
        self.assertEqual(self.п.ПОРОГ, 3)

    def test_заявка_поднимается_на_третьем_и_один_раз(self):
        подъёмы = []
        for i in range(5):
            сколько, нужна = self.п.засчитать(
                self.store, 777, "на снимке несовершеннолетний",
                {"отпечаток": f"кадр{i}"})
            подъёмы.append(нужна)
        self.assertEqual(подъёмы, [False, False, True, False, False],
                         "заявка обязана подняться ровно на третьем")

    def test_один_и_тот_же_снимок_это_одно_предупреждение(self):
        """Люди пересылают фото повторно, когда не поняли отказ. Это не
        новая попытка, и считать её за новую нельзя."""
        for _ in range(4):
            self.п.засчитать(self.store, 777, "отказ", {"отпечаток": "один"})
        self.assertEqual(self.п.счёт(self.store, 777), 1)

    def test_снятие_очищает_счёт(self):
        for i in range(3):
            self.п.засчитать(self.store, 777, "отказ", {"отпечаток": f"к{i}"})
        self.assertEqual(self.п.счёт(self.store, 777), 3)
        self.п.снять(self.store, 777)
        self.assertEqual(self.п.счёт(self.store, 777), 0)

    def test_в_списке_модерации_видно_счёт_и_состояние(self):
        for i in range(3):
            self.п.засчитать(self.store, 777, "отказ", {"отпечаток": f"к{i}"})
        сп = self.п.на_модерации(self.store)
        свой = [ч for ч in сп if ч["tg_id"] == 777]
        self.assertTrue(свой)
        self.assertEqual(свой[0]["предупреждений"], 3)
        self.assertTrue(свой[0]["на_модерации"])

    def test_письмо_говорит_что_решает_человек(self):
        т = self.п.письмо_модератору(777, "кто", 3, "оценка 15")
        self.assertIn("НЕ заблокирован", т)
        self.assertIn("решение за человеком", т)
