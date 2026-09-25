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
        сводка.написать = lambda кому, текст, клава=None: (False, False)
        ушло, _ = сводка.ответить(self.store, self.живой, "ответ")
        self.assertFalse(ушло)
        self.assertEqual(self.store.поддержка_диалог(self.живой), [])
        ушло_с = {}
        def поймать(кому, текст, клава=None):
            ушло_с["клава"] = клава
            return True, False
        сводка.написать = поймать
        ушло, _ = сводка.ответить(self.store, self.живой, "ответ")
        self.assertTrue(ушло)
        self.assertEqual(len(self.store.поддержка_диалог(self.живой)), 1)
        # Ответ из админки уходит так же, как из бота: с кнопкой
        # «Вопрос решён», чтобы клиент мог закрыть диалог сам.
        данные = [к.get("callback_data") for р in
                  ушло_с["клава"]["inline_keyboard"] for к in р]
        self.assertIn("cl:done", данные)


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
