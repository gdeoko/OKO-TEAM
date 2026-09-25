"""Копии ботов у партнёров: автозапуск после оплаты и рубильник.

Проверяем ровно то, что стоит денег и репутации: что копия поднимается
сама, что токен не утекает в журнал, что чужая строка не дописывает
себе переменные в окружение службы, и что владелец может погасить
партнёра одним нажатием.
"""
import os
import stat
import subprocess
import tempfile
import time
import unittest

import партнёры


ЗАГЛУШКА = """#!/usr/bin/env bash
echo "$@" >> "$ЖУРНАЛ"
echo "${ОТВЕТ:-запущено @bot}"
exit ${КОД:-0}
"""


class Прослойка(unittest.TestCase):
    """`партнёры.py` — единственное место, где зовут скрипт."""

    def setUp(self):
        д = tempfile.mkdtemp()
        self.скрипт = os.path.join(д, "amberry-partner")
        self.журнал = os.path.join(д, "звали.txt")
        with open(self.скрипт, "w", encoding="utf-8") as ф:
            ф.write(ЗАГЛУШКА.replace("$ЖУРНАЛ", self.журнал)
                    .replace("${ОТВЕТ:-запущено @bot}", "запущено @bot")
                    .replace("${КОД:-0}", "0"))
        os.chmod(self.скрипт, os.stat(self.скрипт).st_mode | stat.S_IEXEC)
        self.было, партнёры.СКРИПТ = партнёры.СКРИПТ, self.скрипт
        self.sudo = партнёры._позвать

    def tearDown(self):
        партнёры.СКРИПТ = self.было

    def _без_sudo(self, *а, ждём=60):
        """Тот же вызов, но без sudo: в тесте прав не спрашиваем."""
        п = subprocess.run([партнёры.СКРИПТ, *а], capture_output=True,
                           text=True, timeout=ждём)
        return п.returncode == 0, (п.stdout + п.stderr).strip()[-300:]

    def test_нет_скрипта_не_падаем_а_отвечаем(self):
        """Франшиза не имеет права уронить бота, который её продаёт."""
        партнёры.СКРИПТ = "/нет/такого/файла"
        ок, почему = партнёры.пуск(1, "1:" + "a" * 35)
        self.assertFalse(ок)
        self.assertIn("скрипт", почему)

    def test_токен_не_уходит_в_журнал(self):
        """В `print` уходит только номер и итог. Токен — ключ от чужого
        бота, и в журнале сервера ему делать нечего даже в тексте
        чужой жалобы."""
        токен = "8910955200:AAF_secret_tail_ABCDEFGHIJKLMNOP"
        текст = партнёры.почистить("не вышло: " + токен, токен)
        self.assertNotIn(токен, текст)
        self.assertIn("…", текст)

    def test_работает_верит_только_слову_active(self):
        партнёры.СКРИПТ = "/нет/такого/файла"
        self.assertFalse(партнёры.работает(1))


class Скрипт(unittest.TestCase):
    """Проверка аргументов в самом скрипте: его зовут от root с
    данными, которые написал посторонний человек в телеграме."""

    СКРИПТ = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "..", "партнёры", "партнёр.sh")

    def _звать(self, *а):
        # AMBERRY_PARTNER_DIRECT=1 - «уже вне песочницы, работай тут».
        # Без него скрипт первым делом перезапускает себя через
        # systemd-run (иначе root внутри ProtectSystem=strict не может
        # записать /etc), и тест мерил бы не проверку аргументов, а
        # наличие systemd в песочнице сборки.
        сред = dict(os.environ, AMBERRY_PARTNER_DIRECT="1")
        return subprocess.run(["bash", self.СКРИПТ, *а], env=сред,
                              capture_output=True, text=True, timeout=30)

    def test_сам_выходит_из_песочницы_вызывающего(self):
        """Бот и админка работают с ProtectSystem=strict. sudo даёт
        права root, но НЕ выводит из их пространства монтирования, и
        /etc там только для чтения: без этого выхода запуск падал с
        «Read-only file system»."""
        текст = open(self.СКРИПТ, encoding="utf-8").read()
        self.assertIn("systemd-run", текст)
        self.assertIn("AMBERRY_PARTNER_DIRECT", текст)

    def test_синтаксис_цел(self):
        self.assertEqual(
            subprocess.run(["bash", "-n", self.СКРИПТ]).returncode, 0)

    def test_нечисловой_id_отбивается(self):
        п = self._звать("пуск", "1;rm -rf /", "1:" + "a" * 35)
        self.assertEqual(п.returncode, 2)
        self.assertIn("числовой", п.stderr)

    def test_перевод_строки_в_токене_отбивается(self):
        """Иначе «токен» с переводом строки дописал бы в env-файл
        службы любую переменную — от подмены базы до чужого пароля к
        карте."""
        п = self._звать("пуск", "42",
                        "123456:" + "a" * 35 + "\nROCKET_DB=/чужое")
        self.assertEqual(п.returncode, 2)
        self.assertIn("BotFather", п.stderr)

    def test_мусор_вместо_токена_отбивается(self):
        п = self._звать("пуск", "42", "привет")
        self.assertEqual(п.returncode, 2)

    def test_неизвестная_команда_отбивается(self):
        self.assertEqual(self._звать("удалить", "42").returncode, 2)

    def test_в_скрипте_нет_кириллических_переменных(self):
        """bash читает `ОТВЕТ=...` как имя команды и идёт дальше с
        пустой переменной — скрипт при этом не падает. Ловили дважды."""
        import re
        текст = open(self.СКРИПТ, encoding="utf-8").read()
        плохо = re.findall(r"^\s*([А-Яа-яЁё_]+)=", текст, re.M)
        self.assertEqual(плохо, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)


class ОплатаСчётом(unittest.TestCase):
    """Касса одна на все копии, и партнёрский env её не перекрывает."""

    СКРИПТ = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "..", "партнёры", "партнёр.sh")

    def test_партнёрский_env_не_трогает_кассу(self):
        """КЛЮЧИ КАССЫ ЖИВУТ В ОБЩЕМ ОКРУЖЕНИИ и достаются копии сами.

        Если бы личный файл партнёра объявлял хоть одну AMBERRY_PAY_*,
        он перекрыл бы общую кассу (его читают вторым), и выручка
        копии ушла бы мимо нас - а её половину мы партнёру уже должны.
        """
        текст = open(self.СКРИПТ, encoding="utf-8").read()
        личные = текст.split("<<EOF", 1)[1].split("\nEOF", 1)[0]
        self.assertNotIn("AMBERRY_PAY", личные)
        self.assertNotIn("STARS", личные)
        # А то, что копии обязано быть своим, там есть.
        for ключ in ("ROCKET_BOT_TOKEN", "ROCKET_DB", "AMBERRY_PARTNER"):
            self.assertIn(ключ, личные, ключ)


class КассаБезКлючей(unittest.TestCase):
    """Пока касса не подключена, бот обязан работать дальше."""

    def setUp(self):
        import счёт
        self.счёт = счёт
        self.было = (счёт.МАГАЗИН, счёт.КЛЮЧ)

    def tearDown(self):
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = self.было

    def test_без_ключей_не_настроена(self):
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = "", ""
        self.assertFalse(self.счёт.настроен())

    def test_с_ключами_настроена(self):
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = "123", "test_ключ"
        self.assertTrue(self.счёт.настроен())

    def test_выставить_без_кассы_не_падает_молча(self):
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = "", ""
        with self.assertRaises(self.счёт.ОшибкаОплаты):
            self.счёт.выставить(100, "проба", "pack:s")

    def test_меню_без_кассы_показывает_прежние_способы(self):
        """Бот без единого способа оплаты не зарабатывает вовсе, а
        касса подключается отдельным днём."""
        import importlib
        import ui
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = "", ""
        importlib.reload(ui)
        кн = [к["callback_data"] for р in ui.меню_способов("s")["inline_keyboard"]
              for к in р]
        self.assertIn("pay:stars:s", кн)
        self.assertNotIn("pay:bill:s", кн)

    def test_меню_с_кассой_оставляет_только_счёт(self):
        """Звёзды приходят ВЛАДЕЛЬЦУ БОТА, а у франшизы боты чужие:
        выручка за наши генерации оседала бы у партнёра."""
        import ui
        self.счёт.МАГАЗИН, self.счёт.КЛЮЧ = "123", "test_ключ"
        кн = [к["callback_data"] for р in ui.меню_способов("s")["inline_keyboard"]
              for к in р]
        self.assertIn("pay:bill:s", кн)
        self.assertNotIn("pay:stars:s", кн)
        self.assertNotIn("pay:crypto:s", кн)


class ВыручкаКопии(unittest.TestCase):
    """Половину денег партнёру не выплатить, не зная его выручки."""

    def setUp(self):
        import store as store_mod
        self.д = tempfile.mkdtemp()
        self.было, партнёры.БАЗЫ = партнёры.БАЗЫ, self.д
        os.makedirs(os.path.join(self.д, "42"))
        self.s = store_mod.Store(os.path.join(self.д, "42", "amberry.db"))
        self.s.ensure_user(1, "kto", welcome=0)

    def tearDown(self):
        партнёры.БАЗЫ = self.было

    def test_копии_нет_значит_ноль_а_не_падение(self):
        """Партнёр может заплатить и прислать токен назавтра."""
        self.assertEqual(партнёры.выручка(999), 0)
        self.assertEqual(партнёры.клиентов(999), 0)

    def test_рубли_из_оплат_складываются(self):
        self.s.credit(1, 30, "paid", "счёт, пакет s", meta={"руб": 490})
        self.s.credit(1, 80, "paid", "счёт, пакет m", meta={"руб": 1190})
        self.assertEqual(партнёры.выручка(42), 1680)

    def test_подарки_в_выручку_не_идут(self):
        """welcome - это наши коины, а не чьи-то деньги."""
        self.s.credit(1, 2, "welcome", "подарок при старте")
        self.assertEqual(партнёры.выручка(42), 0)

    def test_безлимит_считается_хотя_коинов_не_даёт(self):
        """Месяц безлимита баланс не трогает, но деньги за него
        приходят - и половина их партнёрская."""
        self.s.выручка_записать(1, 85000, "безлимит", "inv1")
        self.assertEqual(партнёры.выручка(42), 85000)
        self.assertEqual(self.s.balance(1), 0)

    def test_оплата_без_рублей_не_ломает_счёт(self):
        """Старые записи рублей не содержат: до 25.09 их не писали."""
        self.s.credit(1, 30, "paid", "звёзды, пакет s",
                      meta={"charge": "abc", "stars": 300})
        self.s.credit(1, 30, "paid", "счёт, пакет s", meta={"руб": 490})
        self.assertEqual(партнёры.выручка(42), 490)

    def test_клиенты_считаются(self):
        self.s.ensure_user(2, "kto2", welcome=0)
        self.assertEqual(партнёры.клиентов(42), 2)

    def test_читаем_только_на_чтение(self):
        """Копия работает и пишет в эту же базу прямо сейчас: админка
        не имеет права ни блокировать её, ни что-то в ней менять."""
        текст = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                  "партнёры.py"), encoding="utf-8").read()
        self.assertIn("mode=ro", текст)


class ПоддержкаИПриглашение(unittest.TestCase):
    """Две вещи, которых человек раньше не видел вовсе."""

    def setUp(self):
        import ui
        self.ui = ui

    def _кн(self, клава):
        return [к.get("callback_data") or к.get("url")
                for р in клава["inline_keyboard"] for к in р]

    def test_кнопка_поддержки_есть_в_кабинете(self):
        """Написать было можно и раньше - любой текст вне сценария
        уходил владельцу, - но КНОПКИ не было нигде, и человек об этом
        не знал. Банк требует раздел поддержки как условие
        эквайринга."""
        self.assertIn("m:sup", self._кн(self.ui.меню_кабинета("ru")))

    def test_экран_поддержки_ведёт_назад_в_кабинет(self):
        self.assertIn("m:cab", self._кн(self.ui.меню_поддержки("ru")))

    def test_в_тексте_поддержки_нет_личных_адресов(self):
        """Требование: бот не показывает наши личные страницы. Ответ
        уходит от имени бота, и в самом экране ссылок на людей быть не
        должно."""
        import язык
        for яз_ in ("ru", "en"):
            т = язык.СТРОКИ["подд.экран"][яз_]
            self.assertNotIn("t.me/", т)
            self.assertNotIn("@", т)

    def test_готовое_приглашение_несёт_рабочую_ссылку(self):
        """Кнопка обязана быть URL, а не callback: у друга, который
        получит пересылку, нашего бота ещё нет, и callback ему просто
        не на что отправить."""
        к = self.ui.меню_готового("https://t.me/bot?start=abc", "ru")
        кнопка = к["inline_keyboard"][0][0]
        self.assertEqual(кнопка["url"], "https://t.me/bot?start=abc")
        self.assertNotIn("callback_data", кнопка)

    def test_текст_для_друга_не_говорит_про_реферальную_выгоду(self):
        """Это сообщение читает ДРУГ. То, что приглашающему за него
        что-то начислят, получателя не касается и только снижает
        доверие к совету."""
        import язык
        т = язык.СТРОКИ["пригл.готовое"]["ru"].lower()
        for слово in ("реферал", "бонус мне", "я получу"):
            self.assertNotIn(слово, т)


class ОтветАдминаВБоте(unittest.TestCase):
    """Админ отвечает прямо в боте, и клиент не узнаёт, кто это был.

    Требование владельца прямое: наши контакты не светятся нигде.
    Здесь оно проверяется, а не подразумевается.
    """

    def setUp(self):
        import ui
        self.ui = ui

    def _кн(self, клава):
        return [(к.get("text"), к.get("callback_data") or к.get("url"))
                for р in клава["inline_keyboard"] for к in р]

    def test_под_обращением_есть_ответить_и_закрыть(self):
        кн = self._кн(self.ui.меню_обращения(777))
        данные = [д for _, д in кн]
        self.assertIn("sup:rep:777", данные)
        self.assertIn("sup:done:777", данные)

    def test_кнопки_написать_в_личку_нет(self):
        """Она открыла бы приватный чат админа с клиентом - то есть
        показала бы имя, фамилию и @ник того, кто отвечает."""
        кн = self._кн(self.ui.меню_обращения(777))
        for текст, д in кн:
            self.assertNotIn("личк", (текст or "").lower())
            self.assertNotIn("t.me/", (д or ""))

    def test_у_закрытого_обращения_действий_нет(self):
        """Иначе на одно обращение уходит два ответа от разных людей."""
        к = self.ui.меню_обращения(777, закрыто=True)
        данные = [д for _, д in self._кн(к)] if к else []
        self.assertNotIn("sup:rep:777", данные)
        self.assertNotIn("sup:done:777", данные)

    def test_ответ_клиенту_не_содержит_данных_админа(self):
        """Подпись у ответа одна на всех - «Ответ поддержки»."""
        import язык
        for яз_ in ("ru", "en"):
            т = язык.СТРОКИ["подд.ответ"][яз_]
            self.assertNotIn("@", т)
            self.assertNotIn("t.me", т)

    def test_чужой_не_может_ответить_за_админа(self):
        """Кнопка приходит в личный чат админа, но callback подделать
        можно - код обязан проверять, а не верить кнопке."""
        текст = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                  "bot.py"), encoding="utf-8").read()
        кусок = текст.split('if data.startswith("sup:"):', 1)[1][:400]
        self.assertIn("u not in ADMINS", кусок)


class ОбращенияВАдминке(unittest.TestCase):
    """Кто ждёт ответа - по последнему письму, а не по флагу."""

    def setUp(self):
        import store as store_mod
        self.s = store_mod.Store(os.path.join(tempfile.mkdtemp(), "t.db"))
        for кто in (1, 2):
            self.s.ensure_user(кто, "u%d" % кто, welcome=0)

    def _статус(self):
        return {д["tg_id"]: д for д in self.s.поддержка_диалоги()}

    def test_прочитал_но_не_ответил_значит_ждёт(self):
        """Прочитать и не ответить - самое частое, что случается с
        обращением, и именно такие флаг «прочитано» и прятал: открыл
        на телефоне, счётчик погас, человек ждёт третий день."""
        self.s.поддержка_записать(1, "человек", "не пришла оплата")
        self.s.поддержка_диалог(1)                 # «прочитали»
        self.assertTrue(self._статус()[1]["ждёт"])

    def test_ответили_значит_не_ждёт(self):
        self.s.поддержка_записать(1, "человек", "вопрос")
        self.s.поддержка_записать(1, "мы", "ответ")
        self.assertFalse(self._статус()[1]["ждёт"])

    def test_закрыли_без_ответа(self):
        self.s.поддержка_записать(1, "человек", "спасибо")
        self.s.поддержка_закрыть(1)
        с = self._статус()[1]
        self.assertFalse(с["ждёт"])
        self.assertTrue(с["закрыто"])

    def test_новое_письмо_открывает_закрытое_само(self):
        """Иначе второй вопрос того же человека тонул бы под старой
        отметкой «закрыто», и никто бы его не увидел."""
        self.s.поддержка_записать(1, "человек", "первое")
        self.s.поддержка_закрыть(1)
        time.sleep(1.1)
        self.s.поддержка_записать(1, "человек", "второе")
        с = self._статус()[1]
        self.assertTrue(с["ждёт"])
        self.assertFalse(с["закрыто"])

    def test_ждущие_стоят_первыми(self):
        self.s.поддержка_записать(1, "человек", "старый вопрос")
        time.sleep(1.1)
        self.s.поддержка_записать(2, "человек", "свежий")
        self.s.поддержка_записать(2, "мы", "ответили")
        порядок = [д["tg_id"] for д in self.s.поддержка_диалоги()]
        self.assertEqual(порядок[0], 1)

    def test_превью_короткое(self):
        self.s.поддержка_записать(1, "человек", "а" * 500)
        self.assertLessEqual(len(self._статус()[1]["последнее"]), 140)
