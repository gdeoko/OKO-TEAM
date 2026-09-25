"""Сквозной разговор с поддержкой: клиент и админ, от первого письма до
закрытия.

Юнит-тесты проверяют кирпичи. Этот - что из них складывается разговор:
кому что приходит, с какими кнопками, и что имя админа не уходит
клиенту НИ В ОДНОМ сообщении. Телеграм подменён записью вызовов.
"""
import json
import os
import tempfile
import unittest
from unittest import mock

import bot
import store as store_mod

КЛИЕНТ, АДМИН, ВТОРОЙ = 10, 999, 998
НИК_АДМИНА = "super_secret_admin"


class Разговор(unittest.TestCase):

    def setUp(self):
        self.вызовы = []
        self.номер = 0
        self.база = store_mod.Store(os.path.join(tempfile.mkdtemp(), "d.db"))
        self.база.ensure_user(КЛИЕНТ, "klient", welcome=0)
        self.база.ensure_user(АДМИН, НИК_АДМИНА, welcome=0)
        self.заплатки = [
            mock.patch.object(bot, "tg", self._tg),
            mock.patch.object(bot, "store", self.база),
            mock.patch.object(bot, "ADMINS", {АДМИН, ВТОРОЙ}),
            # Обложка экрана - файл на сервере; в тесте его нет, и экран
            # честно уходит текстом.
            mock.patch.object(bot, "обложка_экрана", lambda к: ""),
        ]
        for з in self.заплатки:
            з.start()
        bot.waiting.clear()

    def tearDown(self):
        for з in self.заплатки:
            з.stop()

    def _tg(self, метод, **п):
        self.вызовы.append((метод, п))
        return {"ok": True, "result": {"message_id": 1}}

    # --- как пишут люди -------------------------------------------------
    def _пишет(self, кто, текст, ник=None):
        self.номер += 1
        bot.on_update({"message": {
            "message_id": self.номер, "chat": {"id": кто},
            "from": {"id": кто, "username": ник or "u%d" % кто,
                     "language_code": "ru"},
            "text": текст}})

    def _жмёт(self, кто, данные):
        bot.on_update({"callback_query": {
            # language_code обязателен: без него бот считает язык
            # английским и записывает его тому, у кого языка ещё нет.
            "id": "c", "data": данные,
            "from": {"id": кто, "language_code": "ru"},
            "message": {"message_id": 5, "chat": {"id": кто}, "text": ""}}})

    def _кому(self, кто):
        return [(м, п) for м, п in self.вызовы if п.get("chat_id") == кто]

    def _тексты(self, кто):
        return [п.get("text") or п.get("caption") or ""
                for _, п in self._кому(кто)]

    def _кнопки(self, кто):
        итог = []
        for _, п in self._кому(кто):
            к = п.get("reply_markup")
            if not к:
                continue
            к = json.loads(к) if isinstance(к, str) else к
            for ряд in к.get("inline_keyboard", []) + к.get("keyboard", []):
                for б in ряд:
                    итог.append(б.get("callback_data") or б.get("text"))
        return итог

    # --- сам разговор ---------------------------------------------------
    def test_от_первого_письма_до_закрытия(self):
        # 1. Клиент открывает поддержку и пишет.
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self.assertIsNotNone(self.база.диалог(КЛИЕНТ))
        self.assertIn("✅ Завершить диалог", self._кнопки(КЛИЕНТ))
        self._пишет(КЛИЕНТ, "не пришла оплата")

        # Оба админа получили карточку с «Взять диалог».
        for а in (АДМИН, ВТОРОЙ):
            self.assertIn("sup:take:%d" % КЛИЕНТ, self._кнопки(а))
            self.assertTrue(any("не пришла оплата" in т for т in self._тексты(а)))

        # 2. Админ берёт диалог - клиенту сообщают без имён.
        self.вызовы.clear()
        self._жмёт(АДМИН, "sup:take:%d" % КЛИЕНТ)
        self.assertEqual(self.база.админ_активный(АДМИН), КЛИЕНТ)
        self.assertTrue(any("подключилась" in т for т in self._тексты(КЛИЕНТ)))
        self.assertIn("✅ Завершить диалог", self._кнопки(АДМИН))
        self.assertIn("↩️ Отойти", self._кнопки(АДМИН))

        # 3. Админ просто пишет - уходит клиенту, без кнопки «Ответить».
        self.вызовы.clear()
        self._пишет(АДМИН, "Проверяем, минуту", ник=НИК_АДМИНА)
        ответы = self._тексты(КЛИЕНТ)
        self.assertTrue(any("Проверяем, минуту" in т for т in ответы))
        self.assertIn("cl:done", self._кнопки(КЛИЕНТ))

        # 4. Клиент отвечает - приходит ТОЛЬКО ведущему и коротко.
        self.вызовы.clear()
        self._пишет(КЛИЕНТ, "жду")
        self.assertTrue(any("жду" in т for т in self._тексты(АДМИН)))
        self.assertFalse(any("жду" in т for т in self._тексты(ВТОРОЙ)),
                         "второму админу каждое сообщение - лишний шум")

        # 5. Клиент закрывает.
        self.вызовы.clear()
        self._жмёт(КЛИЕНТ, "cl:done")
        self.assertIsNone(self.база.диалог(КЛИЕНТ))
        self.assertIsNone(self.база.админ_активный(АДМИН))
        self.assertTrue(any("завершил" in т for т in self._тексты(АДМИН)))
        self.assertIn("💬 Поддержка", self._кнопки(КЛИЕНТ))

        # 6. После закрытия текст админа клиенту НЕ уходит.
        self.вызовы.clear()
        self._пишет(АДМИН, "это уже не ему", ник=НИК_АДМИНА)
        self.assertFalse(any("это уже не ему" in т
                             for т in self._тексты(КЛИЕНТ)))

    def test_имя_админа_не_уходит_клиенту_никогда(self):
        """Главное требование владельца. Проверяем ВСЁ, что ушло
        клиенту за разговор, а не одну строку."""
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self._пишет(КЛИЕНТ, "помогите")
        self._жмёт(АДМИН, "sup:take:%d" % КЛИЕНТ)
        self._пишет(АДМИН, "Сейчас разберёмся", ник=НИК_АДМИНА)
        self._пишет(АДМИН, "✅ Завершить диалог", ник=НИК_АДМИНА)
        всё = json.dumps([п for _, п in self._кому(КЛИЕНТ)], ensure_ascii=False)
        self.assertNotIn(НИК_АДМИНА, всё)
        self.assertNotIn(str(АДМИН), всё)
        # И не пересылкой: forwardMessage показал бы отправителя.
        self.assertNotIn("forwardMessage", [м for м, _ in self._кому(КЛИЕНТ)])

    def test_админ_закрывает_кнопкой_снизу(self):
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self._пишет(КЛИЕНТ, "вопрос")
        self._жмёт(АДМИН, "sup:take:%d" % КЛИЕНТ)
        self.вызовы.clear()
        self._пишет(АДМИН, "✅ Завершить диалог", ник=НИК_АДМИНА)
        self.assertIsNone(self.база.диалог(КЛИЕНТ))
        # «Завершить» не ушло клиенту как ответ.
        self.assertFalse(any("Завершить диалог" in т and "Ответ" in т
                             for т in self._тексты(КЛИЕНТ)))
        self.assertTrue(any("завершён" in т for т in self._тексты(КЛИЕНТ)))

    def test_отойти_оставляет_клиента_ждать(self):
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self._пишет(КЛИЕНТ, "вопрос")
        self._жмёт(АДМИН, "sup:take:%d" % КЛИЕНТ)
        self._пишет(АДМИН, "↩️ Отойти", ник=НИК_АДМИНА)
        self.assertIsNone(self.база.админ_активный(АДМИН))
        self.assertIsNotNone(self.база.диалог(КЛИЕНТ))
        # Следующее письмо клиента приходит с кнопкой вернуться.
        self.вызовы.clear()
        self._пишет(КЛИЕНТ, "ау")
        self.assertIn("sup:take:%d" % КЛИЕНТ, self._кнопки(АДМИН))

    def test_кнопки_нижнего_меню_админа_не_уходят_клиенту(self):
        """Админ - ещё и пользователь бота: «Кабинет» снизу он жмёт для
        себя, а не отвечает им клиенту."""
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self._пишет(КЛИЕНТ, "вопрос")
        self._жмёт(АДМИН, "sup:take:%d" % КЛИЕНТ)
        self.вызовы.clear()
        self._пишет(АДМИН, "🛠️ Кабинет", ник=НИК_АДМИНА)
        self.assertFalse(any("Кабинет" in т for т in self._тексты(КЛИЕНТ)))

    def test_сценарий_важнее_поддержки(self):
        """Человек выбрал «Раздеть» и присылает текст - это промпт, а
        не письмо в поддержку, даже если диалог открыт."""
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        # Нажатие «Поддержка» снимает висящий сценарий.
        bot.waiting[КЛИЕНТ] = {"kind": "x"}
        self._пишет(КЛИЕНТ, "💬 Поддержка")
        self.assertNotIn(КЛИЕНТ, bot.waiting)


if __name__ == "__main__":
    unittest.main(verbosity=2)
