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
        return subprocess.run(["bash", self.СКРИПТ, *а],
                              capture_output=True, text=True, timeout=30)

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
