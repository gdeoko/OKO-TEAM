"""Бот поддержки и группа с ветками: путь письма целиком, без сети."""

import json
import os
import tempfile
import unittest

from store import Store
from поддержка import Поддержка, ПРАВИЛА, ШАБЛОНЫ

ГРУППА = -1003000000001
ВЛАДЕЛЕЦ = 6547482131
МЕНЕДЖЕР = 555
КЛИЕНТ = 1001


class Телеграм:
    """Запоминает вызовы и отвечает как телеграм."""

    def __init__(self):
        self.вызовы = []
        self.ветка = 100
        self.сообщение = 5000
        self.отказ = {}          # метод -> описание ошибки

    def __call__(self, метод, **поля):
        self.вызовы.append((метод, поля))
        if метод in self.отказ:
            return {"ok": False, "description": self.отказ.pop(метод)}
        if метод == "createForumTopic":
            self.ветка += 1
            return {"ok": True, "result": {"message_thread_id": self.ветка}}
        if метод in ("sendMessage", "copyMessage", "sendPhoto"):
            self.сообщение += 1
            р = {"message_id": self.сообщение}
            if метод == "sendPhoto":
                р["photo"] = [{"file_id": "F"}]
            return {"ok": True, "result": р}
        return {"ok": True, "result": True}

    def где(self, метод):
        return [п for м, п in self.вызовы if м == метод]


def письмо(u, текст=None, mid=1, **ещё):
    м = {"message_id": mid, "chat": {"id": u, "type": "private"},
         "from": {"id": u, "first_name": "Иван", "username": "ivan"}}
    if текст is not None:
        м["text"] = текст
    м.update(ещё)
    return {"message": м}


def в_ветке(ветка, текст=None, mid=9000, кто=МЕНЕДЖЕР, **ещё):
    м = {"message_id": mid, "chat": {"id": ГРУППА, "type": "supergroup",
                                     "is_forum": True},
         "message_thread_id": ветка, "is_topic_message": True,
         "from": {"id": кто, "first_name": "Мария", "username": "manager_m"}}
    if текст is not None:
        м["text"] = текст
    м.update(ещё)
    return {"message": м}


class Основа(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(os.path.join(self.tmp.name, "b.db"))
        self.tg = Телеграм()
        self.п = Поддержка(self.store, self.tg, группа=ГРУППА,
                           админы={ВЛАДЕЛЕЦ})

    def tearDown(self):
        self.tmp.cleanup()


class ПутьПисьма(Основа):

    def test_первое_письмо_заводит_ветку_с_карточкой(self):
        self.store.ensure_user(КЛИЕНТ, "ivan", welcome=10)
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "не пришли коины")["message"])
        создана = self.tg.где("createForumTopic")[0]
        self.assertEqual(создана["name"], "Иван · @ivan")
        self.assertEqual(создана["icon_custom_emoji_id"], "5379748062124056162")
        карточка = self.tg.где("sendMessage")[0]
        self.assertEqual(карточка["message_thread_id"], ветка)
        self.assertIn("Баланс", карточка["text"])
        копия = self.tg.где("copyMessage")[0]
        self.assertEqual((копия["chat_id"], копия["message_thread_id"]),
                         (ГРУППА, ветка))
        # клиенту - «приняли», в «Новые» - строка со ссылкой
        self.assertTrue(any(п["chat_id"] == КЛИЕНТ for п in self.tg.где("sendMessage")))
        self.assertEqual(self.store.поддержка_диалог(КЛИЕНТ)[0]["текст"],
                         "не пришли коины")

    def test_второе_письмо_в_ту_же_ветку_без_новой(self):
        self.п.от_клиента(письмо(КЛИЕНТ, "раз")["message"])
        self.п.от_клиента(письмо(КЛИЕНТ, "два", mid=2)["message"])
        self.assertEqual(len(self.tg.где("createForumTopic")), 1)
        self.assertEqual(len(self.tg.где("setMessageReaction")), 1)

    def test_ответ_менеджера_уходит_клиенту_без_его_имени(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.вызовы.clear()
        self.п.обновление(в_ветке(ветка, "ответ"))
        копия = self.tg.где("copyMessage")[0]
        self.assertEqual(копия["chat_id"], КЛИЕНТ)
        self.assertEqual(копия["from_chat_id"], ГРУППА)
        # copyMessage не несёт автора; пересылки быть не должно
        self.assertEqual(self.tg.где("forwardMessage"), [])
        self.assertEqual(self.store.ветка(КЛИЕНТ)["состояние"], "work")
        self.assertEqual(self.tg.где("editForumTopic")[0]["icon_custom_emoji_id"],
                         "5417915203100613993")

    def test_реплай_менеджера_становится_цитатой_у_клиента(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос", mid=77)["message"])
        в_группе = self.tg.где("copyMessage")[0]
        г_ид = self.store.связь_в_группе(КЛИЕНТ, 77)   # копия письма в группе
        self.п.обновление(в_ветке(ветка, "ответ",
                                  reply_to_message={"message_id": г_ид}))
        копия = self.tg.где("copyMessage")[-1]
        self.assertEqual(json.loads(копия["reply_parameters"])["message_id"], 77)
        self.assertEqual(в_группе["message_thread_id"], ветка)

    def test_заметка_и_служебные_клиенту_не_уходят(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.вызовы.clear()
        self.п.обновление(в_ветке(ветка, "// не отвечать, ждём оплату"))
        self.п.обновление(в_ветке(ветка, forum_topic_edited={"name": "x"}))
        self.assertEqual(self.tg.где("copyMessage"), [])

    def test_сообщения_ботов_в_ветке_не_пересылаются(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.вызовы.clear()
        м = в_ветке(ветка, "эхо")
        м["message"]["from"]["is_bot"] = True
        self.п.обновление(м)
        self.assertEqual(self.tg.где("copyMessage"), [])

    def test_служебная_ветка_не_клиентская(self):
        self.tg.вызовы.clear()
        self.п.обновление(в_ветке(3, "привет коллеги"))
        self.assertEqual(self.tg.где("copyMessage"), [])

    def test_шаблон_командой(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.вызовы.clear()
        self.п.обновление(в_ветке(ветка, "/t 2"))
        клиенту = [п for п in self.tg.где("sendMessage") if п["chat_id"] == КЛИЕНТ]
        self.assertEqual(клиенту[0]["text"], ШАБЛОНЫ[1][1])
        эхо = [п for п in self.tg.где("sendMessage") if п["chat_id"] == ГРУППА]
        self.assertIn("Ушло клиенту", эхо[0]["text"])

    def test_закрытие_и_повторное_открытие(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.п.обновление(в_ветке(ветка, "/close"))
        self.assertEqual(self.store.ветка(КЛИЕНТ)["состояние"], "closed")
        self.assertTrue(self.tg.где("closeForumTopic"))
        self.tg.вызовы.clear()
        снова = self.п.от_клиента(письмо(КЛИЕНТ, "ещё вопрос", mid=3)["message"])
        self.assertEqual(снова, ветка)                  # та же ветка
        self.assertTrue(self.tg.где("reopenForumTopic"))
        self.assertEqual(self.tg.где("createForumTopic"), [])
        self.assertEqual(self.store.ветка(КЛИЕНТ)["состояние"], "wait")

    def test_кнопка_закрыть_под_карточкой(self):
        self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.п.обновление({"callback_query": {
            "id": "c", "data": "sp:close:%d" % КЛИЕНТ,
            "from": {"id": МЕНЕДЖЕР},
            "message": {"message_id": 1, "chat": {"id": ГРУППА}}}})
        self.assertEqual(self.store.ветка(КЛИЕНТ)["состояние"], "closed")

    def test_кнопку_из_чужого_чата_не_слушаем(self):
        self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.п.обновление({"callback_query": {
            "id": "c", "data": "sp:close:%d" % КЛИЕНТ, "from": {"id": 9},
            "message": {"message_id": 1, "chat": {"id": 9}}}})
        self.assertEqual(self.store.ветка(КЛИЕНТ)["состояние"], "wait")

    def test_удалённую_ветку_заводим_заново(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.отказ["copyMessage"] = "Bad Request: message thread not found"
        новая = self.п.от_клиента(письмо(КЛИЕНТ, "ау", mid=2)["message"])
        self.assertNotEqual(новая, ветка)
        self.assertEqual(self.store.ветка_чья(новая), КЛИЕНТ)

    def test_заблокировал_бота_менеджер_узнаёт(self):
        ветка = self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        self.tg.отказ["copyMessage"] = "Forbidden: bot was blocked by the user"
        self.п.обновление(в_ветке(ветка, "ответ"))
        последнее = self.tg.где("sendMessage")[-1]
        self.assertIn("заблокировал", последнее["text"])
        self.assertEqual([п for п in self.store.поддержка_диалог(КЛИЕНТ)
                          if п["откого"] == "мы"], [])

    def test_напоминание_о_долгом_ожидании_один_раз(self):
        self.store.настройка_записать("ветка.новые", 3)
        self.п.от_клиента(письмо(КЛИЕНТ, "вопрос")["message"])
        with self.store._db() as c:
            c.execute("UPDATE support_topics SET last_at=last_at-3600")
        self.tg.вызовы.clear()
        self.п.напомнить()
        self.п.напомнить()
        self.assertEqual(len(self.tg.где("sendMessage")), 1)
        self.assertIn("Ждёт ответа", self.tg.где("sendMessage")[0]["text"])


class Группа(Основа):

    def setUp(self):
        super().setUp()
        self.п = Поддержка(self.store, self.tg, группа=None,
                           админы={ВЛАДЕЛЕЦ})

    def _сообщение(self, кто, чат):
        return {"message": {"message_id": 1, "text": "старт", "chat": чат,
                            "from": {"id": кто}}}

    def test_группу_назначает_только_владелец(self):
        форум = {"id": ГРУППА, "type": "supergroup", "is_forum": True}
        self.п.обновление(self._сообщение(12345, форум))
        self.assertIsNone(self.п.группа)
        self.п.обновление(self._сообщение(ВЛАДЕЛЕЦ, форум))
        self.assertEqual(self.п.группа, ГРУППА)

    def test_настройка_ветки_и_закрепы_без_дублей(self):
        форум = {"id": ГРУППА, "type": "supergroup", "is_forum": True}
        self.п.обновление(self._сообщение(ВЛАДЕЛЕЦ, форум))
        имена = [п["name"] for п in self.tg.где("createForumTopic")]
        self.assertEqual(имена, ["Как отвечать", "Шаблоны ответов",
                                 "Новые обращения"])
        self.assertTrue(all(п.get("icon_custom_emoji_id")
                            for п in self.tg.где("createForumTopic")))
        self.assertEqual(len(self.tg.где("pinChatMessage")), 3)
        self.assertEqual(self.tg.где("editGeneralForumTopic")[0]["name"],
                         "Общий чат")
        self.п.настроить()
        self.assertEqual(len(self.tg.где("createForumTopic")), 3)

    def test_из_чужой_группы_бот_уходит(self):
        форум = {"id": ГРУППА, "type": "supergroup", "is_forum": True}
        self.п.обновление(self._сообщение(ВЛАДЕЛЕЦ, форум))
        чужая = {"id": -100777, "type": "supergroup", "is_forum": True}
        self.п.обновление(self._сообщение(ВЛАДЕЛЕЦ, чужая))
        self.assertEqual(self.tg.где("leaveChat")[0]["chat_id"], -100777)


class Клиент(Основа):

    def test_старт_показывает_приветствие_и_не_открывает_ветку(self):
        self.п.обновление(письмо(КЛИЕНТ, "/start m"))
        self.assertEqual(self.tg.где("createForumTopic"), [])
        т = (self.tg.где("sendMessage") or self.tg.где("sendPhoto"))[0]
        self.assertIn("15 минут", т.get("text") or т.get("caption"))

    def test_метка_партнёра_видна_в_карточке(self):
        self.п.обновление(письмо(КЛИЕНТ, "/start p777"))
        self.п.от_клиента(письмо(КЛИЕНТ, "вопрос", mid=2)["message"])
        карточка = [п["text"] for п in self.tg.где("sendMessage")
                    if п["chat_id"] == ГРУППА and "id <code>" in п["text"]]
        self.assertIn("партнёра 777", карточка[0])

    def test_в_текстах_нет_контактов_менеджеров(self):
        for текст in [ПРАВИЛА] + [т for _, т in ШАБЛОНЫ]:
            self.assertNotIn("ktodaniel", текст)
            self.assertNotIn("t.me/", текст)


if __name__ == "__main__":
    unittest.main()
