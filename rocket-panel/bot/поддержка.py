"""Поддержка AMBERRY: отдельный бот и группа менеджеров с ветками.

Схема руководителя (25.09.2026), классическая:

    клиент  ->  @AMBERRYsupport_bot  ->  группа «AMBERRY • support group»
                                         ветка на каждого клиента

Клиент пишет боту поддержки. Бот сам заводит ему ветку (тему форума) в
группе менеджеров и кладёт туда карточку: баланс, покупки, работы. Всё,
что клиент пишет, копируется в его ветку. Любой менеджер группы отвечает
прямо в ветке - бот передаёт ответ клиенту ОТ СВОЕГО ИМЕНИ, копией, а не
пересылкой: имени, ника и номера менеджера клиент не видит никогда.

Одна ветка на клиента, а не на каждое обращение: вернулся через месяц -
открывается его прежняя ветка, и вся история перед глазами.

Статус - ИКОНКОЙ ветки (премиум-эмодзи телеграма), её видно в списке
без открытия:  ❗ ждёт ответа   💬 ответили   ✅ закрыто.
Иконкой, а не значком в названии: иначе в списке рядом стояли бы два
значка - иконка ветки и эмодзи в имени (владелец 25.09.2026).

Модуль не ходит в телеграм сам: `tg(метод, **поля) -> dict` дают снаружи.
Так его можно проверить без сети (`test_поддержка.py`), и им же
пользуется админка для ответа с сайта.
"""

import html
import json
import os
import sys
import time

# АДРЕСА БОТОВ - ИЗ БРЕНДА, А НЕ СТРОКАМИ ЗДЕСЬ. Они попадают в
# закреплённые правила группы менеджеров, и стоявшая тут строка
# `AMBERRYsupport_bot` разошлась с `brand.SUPPORT`
# (`@amberry_support_bot`): один из двух адресов был чужим, а правила
# отправляли менеджеров писать именно по нему.
#
# Модуль от этого не перестаёт проверяться без сети: `brand` - одни
# константы и пути к файлам, ни одного обращения наружу.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "brand-amberry"))
import brand

# ИКОНКИ ВЕТОК. Боту можно ставить только эмодзи из списка
# getForumTopicIconStickers - номера оттуда.
ИКОНКА = {
    "wait":    "5379748062124056162",   # ❗ ждёт ответа
    "work":    "5417915203100613993",   # 💬 ответили
    "closed":  "5237699328843200968",   # ✅ закрыто
    "правила": "5312536423851630001",   # 💡
    "шаблоны": "5373251851074415873",   # 📝
    "новые":   "5309984423003823246",   # 📣
}

# Через сколько неотвеченное обращение напоминает о себе в «Новых».
НОРМА_ОТВЕТА = 15 * 60

# Заметка для своих: с этого начинается - клиенту не уходит.
ЗАМЕТКА = "//"

# Что считаем письмом. Служебные сообщения форума (ветку создали,
# переименовали, закрепили) - не письма, и клиенту их слать нельзя.
МЕДИА = ("photo", "document", "video", "voice", "video_note", "audio",
         "animation", "sticker")
ВИДЫ = {"photo": "фото", "document": "файл", "video": "видео",
        "voice": "голосовое", "video_note": "кружок", "audio": "аудио",
        "animation": "гифка", "sticker": "стикер"}

# Служебные ветки группы: ключ настройки, название, что внутри.
СЛУЖЕБНЫЕ = (
    ("ветка.правила", "Как отвечать", ИКОНКА["правила"]),
    ("ветка.шаблоны", "Шаблоны ответов", ИКОНКА["шаблоны"]),
    ("ветка.новые", "Новые обращения", ИКОНКА["новые"]),
)
# У общей ветки иконку не сменить - телеграм держит у неё «#».
ОБЩИЙ = "Общий чат"

# ШАБЛОНЫ. Номер - для команды /t N в ветке клиента. Про деньги шаблон
# один - «передали ответственному»: возвраты и начисления делает только
# владелец (правило 8а), менеджер их не обещает.
ШАБЛОНЫ = (
    ("Приветствие",
     "Здравствуйте! Уже разбираемся с вашим вопросом - ответим здесь "
     "в течение нескольких минут."),
    ("Оплата: нужен чек",
     "Пришлите, пожалуйста, скриншот чека или квитанции об оплате и "
     "укажите время платежа - проверим и начислим коины."),
    ("Коины начислены",
     "Коины начислены, баланс обновлён. Проверить можно в разделе "
     "«Кабинет» в @{бот}."),
    ("Генерация не удалась",
     "Если генерация не удалась, коины за неё возвращаются на баланс "
     "автоматически. Попробуйте другое фото: человек в кадре целиком, "
     "лицом к камере, при хорошем свете."),
    ("Деньги, возврат",
     "Передали ваш запрос ответственному. Ответ придёт сюда, в этот чат."),
    ("Как пользоваться",
     "Откройте @{бот} → «Создать» → выберите, что сделать, и пришлите "
     "фото. Готовая работа придёт в тот же чат и сохранится в «Мои "
     "работы»."),
    ("Свой бот (франшиза)",
     "Свой бот AMBERRY: в @{бот} откройте «Кабинет» → «Свой бот». "
     "Присылаете токен от @BotFather, оплачиваете - бот запускается "
     "автоматически, половина выручки ваша. Выплату запрашивайте здесь, "
     "в поддержке."),
    ("Правила 18+",
     "Сервис работает только с фото совершеннолетних и только с их "
     "согласия. Фото несовершеннолетних и публичных людей бот не "
     "обрабатывает - это правило сервиса."),
    ("Закрытие",
     "Рады были помочь! Если появятся вопросы - пишите сюда в любое "
     "время."),
)

ПРАВИЛА = """<b>Как работает поддержка AMBERRY</b>

<b>1.</b> Клиент пишет боту @{подд}. Бот сам создаёт ему ветку «Имя · @ник», в начале ветки - карточка: баланс, покупки, работы.

<b>2.</b> Отвечайте <b>прямо в ветке клиента</b> - текстом, фото, файлом, голосом. Бот передаёт от своего имени: ваших имён и ников клиент не видит.

<b>3.</b> Ответ реплаем на сообщение клиента придёт ему цитатой к этому сообщению.

<b>4.</b> Заметка для коллег - начните с <code>//</code>, клиенту не уйдёт.

<b>5.</b> Шаблон: <code>/t 2</code> - отправит клиенту шаблон №2. Список - <code>/t</code> или ветка «Шаблоны ответов».

<b>6.</b> Вопрос решён - кнопка «✅ Закрыть» под карточкой или <code>/close</code>. Клиент напишет снова - ветка откроется сама.

<b>7.</b> <code>/info</code> - свежая карточка клиента.

<b>Статус - иконкой ветки</b>
❗ ждёт ответа · 💬 ответили · ✅ закрыто

<b>Норма ответа - до 15 минут.</b> Дольше - бот напомнит в «Новые обращения».

<b>Деньги.</b> Возвраты, начисления и компенсации делает только владелец. Клиенту их не обещаем - отвечаем шаблоном №5 и пишем в «Общий чат»."""

ТЕКСТЫ = {
    "ru": {
        "привет": "<b>Поддержка AMBERRY</b>\n\n"
                  "Опишите вопрос одним сообщением - можно приложить "
                  "скриншот или чек. Менеджер ответит здесь же, обычно "
                  "в течение 15 минут.\n\n"
                  "Чтобы решили быстрее:\n"
                  "• что случилось и когда;\n"
                  "• если про оплату - сумму и скриншот чека.",
        "принято": "Обращение принято. Менеджер ответит здесь в течение "
                   "15 минут - можно дописать детали и прислать "
                   "скриншоты, всё придёт в одно обращение.",
        "закрыто": "Обращение закрыто. Если остались вопросы - просто "
                   "напишите сюда.",
        "в_бот": "Открыть AMBERRY",
    },
    "en": {
        "привет": "<b>AMBERRY support</b>\n\n"
                  "Describe your question in one message - you can attach "
                  "a screenshot or a receipt. A manager will reply right "
                  "here, usually within 15 minutes.\n\n"
                  "To get it solved faster:\n"
                  "• what happened and when;\n"
                  "• for payments - the amount and a receipt screenshot.",
        "принято": "Request received. A manager will reply here within 15 "
                   "minutes - feel free to add details and screenshots, "
                   "everything goes into one request.",
        "закрыто": "Request closed. If you still have questions, just "
                   "write here.",
        "в_бот": "Open AMBERRY",
    },
}


def вид(msg):
    for к in МЕДИА:
        if к in msg:
            return к
    return None


def письмо_ли(msg):
    return bool(msg.get("text") or вид(msg) or msg.get("contact")
                or msg.get("location"))


def для_журнала(msg):
    """Строка для истории в админке: текст или «[фото] подпись»."""
    if msg.get("text"):
        return msg["text"]
    к = вид(msg)
    подпись = msg.get("caption") or ""
    return ("[%s] %s" % (ВИДЫ.get(к, "вложение"), подпись)).strip()


class Поддержка:
    def __init__(self, store, tg, группа=None, админы=(),
                 бот=brand.BOT.lstrip("@"), подд=brand.SUPPORT.lstrip("@"),
                 обложка=None, аватар=None):
        self.store = store
        self.tg = tg
        self._группа = int(группа) if группа else None
        self.админы = set(админы)
        self.бот = бот
        self.подд = подд
        self.обложка = обложка
        self.аватар = аватар
        self.напомнили = set()

    # ---------- группа ----------

    @property
    def группа(self):
        if self._группа:
            return self._группа
        з = self.store.настройка("группа")
        return int(з) if з else None

    def ссылка(self, thread_id):
        """Ссылка на ветку: t.me/c/<id без -100>/<ветка>."""
        г = str(self.группа or "")
        return "https://t.me/c/%s/%s" % (г[4:] if г.startswith("-100") else г,
                                         thread_id)

    def узнать_группу(self, chat, кто):
        """Первое сообщение владельца в форуме, где сидит бот, делает этот
        форум группой поддержки. Только от админа бота: иначе кто угодно
        добавил бы бота в свою группу и читал бы наших клиентов."""
        if self.группа or chat.get("type") != "supergroup":
            return False
        if not chat.get("is_forum") or кто not in self.админы:
            return False
        self.store.настройка_записать("группа", chat["id"])
        self.настроить()
        return True

    def настроить(self):
        """Служебные ветки, закрепы, название общего чата. Повторный
        вызов ничего не дублирует: номера веток помнит база."""
        г = self.группа
        if not г:
            return
        self.tg("editGeneralForumTopic", chat_id=г, name=ОБЩИЙ)
        if (self.аватар and os.path.exists(self.аватар)
                and not self.store.настройка("аватар.группа")):
            if self.tg("setChatPhoto", chat_id=г, файл=self.аватар).get("ok"):
                self.store.настройка_записать("аватар.группа", 1)
        for ключ, имя, иконка in СЛУЖЕБНЫЕ:
            есть = self.store.настройка(ключ)
            if есть:
                # Имя и иконку приводим к нынешним: ветки могли быть
                # созданы прежней версией, со значком в названии.
                self.tg("editForumTopic", chat_id=г,
                        message_thread_id=int(есть), name=имя,
                        icon_custom_emoji_id=иконка)
                continue
            о = self.tg("createForumTopic", chat_id=г, name=имя,
                        icon_custom_emoji_id=иконка)
            if not о.get("ok"):
                continue
            ветка = о["result"]["message_thread_id"]
            self.store.настройка_записать(ключ, ветка)
            if ключ == "ветка.правила":
                self._закрепить(ветка, ПРАВИЛА.format(подд=self.подд))
            elif ключ == "ветка.шаблоны":
                self._закрепить(ветка, "<b>Шаблоны ответов</b>\n\nВ ветке "
                                "клиента: <code>/t номер</code> - шаблон уйдёт "
                                "клиенту. Или скопируйте текст ниже.")
                for н, (назв, текст) in enumerate(ШАБЛОНЫ, 1):
                    self.tg("sendMessage", chat_id=г, message_thread_id=ветка,
                            parse_mode="HTML",
                            text="<b>%d. %s</b>\n<code>%s</code>" % (
                                н, html.escape(назв),
                                html.escape(текст.format(бот=self.бот))))
            elif ключ == "ветка.новые":
                self._закрепить(ветка, "Сюда бот пишет о каждом новом "
                                "обращении и о тех, что ждут ответа дольше "
                                "15 минут. Нажмите ссылку - откроется ветка "
                                "клиента.")

    def _закрепить(self, ветка, текст):
        о = self.tg("sendMessage", chat_id=self.группа, message_thread_id=ветка,
                    text=текст, parse_mode="HTML",
                    disable_web_page_preview=True)
        if о.get("ok"):
            self.tg("pinChatMessage", chat_id=self.группа,
                    message_id=о["result"]["message_id"],
                    disable_notification=True)

    def в_новые(self, текст):
        ветка = self.store.настройка("ветка.новые")
        if ветка and self.группа:
            self.tg("sendMessage", chat_id=self.группа,
                    message_thread_id=int(ветка), text=текст,
                    parse_mode="HTML", disable_web_page_preview=True)

    # ---------- клиент ----------

    def яз(self, u, код=None):
        я = (self.store.user(u) or {}).get("lang") or (код or "ru")[:2]
        return "ru" if я in ("ru", "uk", "be", "kk") else "en"

    def т(self, u, ключ, код=None):
        return ТЕКСТЫ[self.яз(u, код)][ключ]

    def клава_бота(self, u, код=None):
        return {"inline_keyboard": [[{
            "text": self.т(u, "в_бот", код),
            "url": "https://t.me/%s" % self.бот}]]}

    def привет(self, chat, u, код=None, откуда=None):
        if откуда and self.store.ветка(u):
            self.store.ветка_откуда(u, откуда)
        elif откуда:
            self._откуда = getattr(self, "_откуда", {})
            self._откуда[u] = откуда
        текст = self.т(u, "привет", код)
        клава = json.dumps(self.клава_бота(u, код))
        фото = self.store.настройка("обложка.file_id")
        if фото:
            о = self.tg("sendPhoto", chat_id=chat, photo=фото, caption=текст,
                        parse_mode="HTML", reply_markup=клава)
            if о.get("ok"):
                return
        if self.обложка and os.path.exists(self.обложка):
            о = self.tg("sendPhoto", chat_id=chat, файл=self.обложка,
                        caption=текст, parse_mode="HTML", reply_markup=клава)
            if о.get("ok"):
                ф = о["result"]["photo"][-1]["file_id"]
                self.store.настройка_записать("обложка.file_id", ф)
                return
        self.tg("sendMessage", chat_id=chat, text=текст, parse_mode="HTML",
                reply_markup=клава)

    def имя(self, кто):
        и = " ".join(x for x in (кто.get("first_name"), кто.get("last_name"))
                     if x).strip()
        return и or "Клиент"

    def название(self, u, состояние):
        в = self.store.ветка(u) or {}
        имя = в.get("имя") or "Клиент"
        ник = ("@" + в["username"]) if в.get("username") else "id %d" % u
        return ("%s · %s" % (имя, ник))[:128]

    def карточка(self, u):
        в = self.store.ветка(u) or {}
        ч = self.store.user(u)
        строки = ["<b>%s</b>" % html.escape(в.get("имя") or "Клиент")]
        if в.get("username"):
            строки.append("@%s" % html.escape(в["username"]))
        строки.append("id <code>%d</code>" % u)
        откуда = в.get("откуда") or ""
        база = self.store
        if откуда.startswith("p") and откуда[1:].isdigit():
            строки.append("Клиент копии партнёра %s" % откуда[1:])
            # Клиент копии живёт в базе партнёра, а не в нашей.
            путь = os.path.join(os.environ.get(
                "AMBERRY_PARTNERS_DIR", "/srv/amberry/partners"),
                откуда[1:], "amberry.db")
            if os.path.exists(путь):
                from store import Store
                база = Store(путь)
                ч = база.user(u)
        if ч:
            св = база.сводка(u)
            строки += [
                "",
                "Баланс: <b>%s</b> коинов" % база.balance(u),
                "Куплено коинов: %s" % св.get("куплено", 0),
                "Работ: %s · осечек: %s" % (св.get("работ", 0),
                                            св.get("осечек", 0)),
                "В боте с %s" % time.strftime(
                    "%d.%m.%Y", time.localtime(ч.get("created_at") or 0)),
            ]
            if ч.get("blocked"):
                строки.append("⚠️ Заблокирован в основном боте")
        else:
            строки += ["", "В боте AMBERRY не зарегистрирован"]
        return "\n".join(строки)

    def клава_карточки(self, u):
        return {"inline_keyboard": [[
            {"text": "✅ Закрыть", "callback_data": "sp:close:%d" % u},
            {"text": "🔄 Карточка", "callback_data": "sp:card:%d" % u}]]}

    def завести_ветку(self, u, кто):
        откуда = getattr(self, "_откуда", {}).pop(u, None)
        было = self.store.ветка(u) or {}
        self.store.ветка_записать(u, 0, self.имя(кто), кто.get("username"),
                                  откуда or было.get("откуда"))
        о = self.tg("createForumTopic", chat_id=self.группа,
                    name=self.название(u, "wait"),
                    icon_custom_emoji_id=ИКОНКА["wait"])
        if not о.get("ok"):
            return None
        ветка = о["result"]["message_thread_id"]
        self.store.ветка_записать(u, ветка, self.имя(кто), кто.get("username"),
                                  откуда or было.get("откуда"))
        self.tg("sendMessage", chat_id=self.группа, message_thread_id=ветка,
                text=self.карточка(u), parse_mode="HTML",
                reply_markup=json.dumps(self.клава_карточки(u)))
        return ветка

    def сменить(self, u, состояние):
        в = self.store.ветка(u)
        if not в or в["состояние"] == состояние:
            return
        self.store.ветка_состояние(u, состояние)
        if не_ветка(в):
            return
        self.tg("editForumTopic", chat_id=self.группа,
                message_thread_id=в["thread_id"],
                name=self.название(u, состояние),
                icon_custom_emoji_id=ИКОНКА[состояние])

    def от_клиента(self, msg):
        """Письмо клиента - в его ветку. Возвращает номер ветки."""
        u = msg["from"]["id"]
        кто = msg["from"]
        if not self.группа or not письмо_ли(msg):
            return None
        в = self.store.ветка(u)
        новое = not в or не_ветка(в) or в["состояние"] == "closed"
        # Ник и имя могли смениться - в названии ветки должны быть нынешние.
        if в and not не_ветка(в) and (в.get("username") != кто.get("username")
                                       or в.get("имя") != self.имя(кто)):
            self.store.ветка_записать(u, в["thread_id"], self.имя(кто),
                                      кто.get("username"), в.get("откуда"))
            self.store.ветка_состояние(u, в["состояние"])
        if not в or не_ветка(в):
            ветка = self.завести_ветку(u, кто)
            if not ветка:
                return None
        else:
            ветка = в["thread_id"]
            if в["состояние"] == "closed":
                self.tg("reopenForumTopic", chat_id=self.группа,
                        message_thread_id=ветка)
            self.сменить(u, "wait")

        о = self._копия_в_ветку(u, msg, ветка)
        if not о.get("ok") and self._ветки_нет(о):
            # Ветку удалили руками - заводим новую, письмо не теряем.
            ветка = self.завести_ветку(u, кто)
            if not ветка:
                return None
            новое = True
            о = self._копия_в_ветку(u, msg, ветка)
        if о.get("ok"):
            self.store.связь_записать(о["result"]["message_id"], u,
                                      msg["message_id"])
        self.store.поддержка_записать(u, "человек", для_журнала(msg))
        self.store.событие(u, "поддержка")
        if новое:
            self.tg("sendMessage", chat_id=u, text=self.т(u, "принято"))
            кратко = html.escape(для_журнала(msg))[:200]
            в = self.store.ветка(u) or {}
            self.в_новые("❗ <b>%s</b>%s\n«%s»\n<a href=\"%s\">Открыть ветку</a>"
                         % (html.escape(в.get("имя") or "Клиент"),
                            (" · @" + html.escape(в["username"]))
                            if в.get("username") else "",
                            кратко, self.ссылка(ветка)))
        else:
            self.tg("setMessageReaction", chat_id=u,
                    message_id=msg["message_id"],
                    reaction=json.dumps([{"type": "emoji", "emoji": "👀"}]))
        return ветка

    def _копия_в_ветку(self, u, msg, ветка):
        поля = {}
        ответ = (msg.get("reply_to_message") or {}).get("message_id")
        if ответ:
            г = self.store.связь_в_группе(u, ответ)
            if г:
                поля["reply_parameters"] = json.dumps(
                    {"message_id": г, "allow_sending_without_reply": True})
        return self.tg("copyMessage", chat_id=self.группа,
                       message_thread_id=ветка, from_chat_id=u,
                       message_id=msg["message_id"], **поля)

    @staticmethod
    def _ветки_нет(о):
        б = (о.get("description") or "").lower()
        return "thread" in б or "topic" in б

    # ---------- менеджер ----------

    def из_группы(self, msg):
        """Сообщение в группе. Письмо менеджера в ветке клиента - клиенту."""
        if msg.get("chat", {}).get("id") != self.группа:
            return
        ветка = msg.get("message_thread_id")
        if not ветка or not msg.get("is_topic_message"):
            return
        u = self.store.ветка_чья(ветка)
        if not u:
            return
        кто = msg.get("from") or {}
        # Анонимный админ пишет «от имени группы» - это тоже менеджер.
        от_группы = (msg.get("sender_chat") or {}).get("id") == self.группа
        if кто.get("is_bot") and not от_группы:
            return
        текст = (msg.get("text") or "").strip()
        if текст.startswith(ЗАМЕТКА):
            return
        if текст.startswith("/"):
            self.команда(u, ветка, текст)
            return
        if not письмо_ли(msg):
            return
        self.клиенту(u, ветка, msg)

    def команда(self, u, ветка, текст):
        сл = текст.split()
        к = сл[0].split("@")[0].lower()
        if к == "/close":
            self.закрыть(u)
        elif к == "/info":
            self.tg("sendMessage", chat_id=self.группа, message_thread_id=ветка,
                    text=self.карточка(u), parse_mode="HTML",
                    reply_markup=json.dumps(self.клава_карточки(u)))
        elif к == "/t":
            if len(сл) > 1 and сл[1].isdigit() and 1 <= int(сл[1]) <= len(ШАБЛОНЫ):
                т = ШАБЛОНЫ[int(сл[1]) - 1][1].format(бот=self.бот)
                self.текстом(u, т, ветка, эхо=True)
            else:
                список = "\n".join("<b>%d</b> - %s" % (н, html.escape(назв))
                                   for н, (назв, _) in enumerate(ШАБЛОНЫ, 1))
                self.tg("sendMessage", chat_id=self.группа,
                        message_thread_id=ветка, parse_mode="HTML",
                        text="Шаблоны: <code>/t номер</code>\n\n" + список)

    def клиенту(self, u, ветка, msg):
        поля = {}
        ответ = (msg.get("reply_to_message") or {}).get("message_id")
        if ответ:
            _, у_клиента = self.store.связь_у_клиента(ответ)
            if у_клиента:
                поля["reply_parameters"] = json.dumps(
                    {"message_id": у_клиента,
                     "allow_sending_without_reply": True})
        о = self.tg("copyMessage", chat_id=u, from_chat_id=self.группа,
                    message_id=msg["message_id"], **поля)
        if not о.get("ok"):
            self.не_дошло(ветка, о)
            return False
        self.store.связь_записать(msg["message_id"], u, о["result"]["message_id"])
        self.store.поддержка_записать(u, "мы", для_журнала(msg))
        self.сменить(u, "work")
        return True

    def текстом(self, u, текст, ветка=None, эхо=False):
        """Текстовый ответ клиенту: шаблон из ветки или ответ из админки.

        `эхо` - продублировать в ветку, чтобы менеджеры видели, что ушло:
        команда /t в ветке сама текста ответа не показывает, а ответ из
        админки в ветке иначе не виден вовсе.
        """
        о = self.tg("sendMessage", chat_id=u, text=текст)
        ветка = ветка or (self.store.ветка(u) or {}).get("thread_id")
        if not о.get("ok"):
            if ветка:
                self.не_дошло(ветка, о)
            return False, мёртв(о)
        self.store.поддержка_записать(u, "мы", текст)
        if ветка and эхо:
            э = self.tg("sendMessage", chat_id=self.группа,
                        message_thread_id=ветка,
                        text="↪️ Ушло клиенту:\n" + текст)
            if э.get("ok"):
                self.store.связь_записать(э["result"]["message_id"], u,
                                          о["result"]["message_id"])
        if self.store.ветка(u):
            в = self.store.ветка(u)
            if в["состояние"] == "closed" and ветка:
                self.tg("reopenForumTopic", chat_id=self.группа,
                        message_thread_id=ветка)
            self.сменить(u, "work")
        return True, False

    def не_дошло(self, ветка, о):
        почему = ("клиент заблокировал бота поддержки" if мёртв(о)
                  else (о.get("description") or "телеграм не принял")[:200])
        self.tg("sendMessage", chat_id=self.группа, message_thread_id=ветка,
                text="⚠️ Не доставлено: %s." % почему)

    def закрыть(self, u, сказать=True):
        в = self.store.ветка(u)
        if not в or в["состояние"] == "closed":
            return False
        self.сменить(u, "closed")
        self.store.поддержка_закрыть(u)
        if сказать:
            self.tg("sendMessage", chat_id=u, text=self.т(u, "закрыто"),
                    reply_markup=json.dumps(self.клава_бота(u)))
        if not не_ветка(в):
            self.tg("closeForumTopic", chat_id=self.группа,
                    message_thread_id=в["thread_id"])
        return True

    def кнопка(self, cb):
        д = cb.get("data") or ""
        м = cb.get("message") or {}
        if not д.startswith("sp:") or м.get("chat", {}).get("id") != self.группа:
            self.tg("answerCallbackQuery", callback_query_id=cb["id"])
            return
        _, что, кто = (д.split(":") + ["", ""])[:3]
        u = int(кто) if кто.isdigit() else 0
        if что == "close":
            закрыл = self.закрыть(u)
            self.tg("answerCallbackQuery", callback_query_id=cb["id"],
                    text="Закрыто" if закрыл else "Уже закрыто")
        elif что == "card":
            self.tg("editMessageText", chat_id=self.группа,
                    message_id=м.get("message_id"), text=self.карточка(u),
                    parse_mode="HTML",
                    reply_markup=json.dumps(self.клава_карточки(u)))
            self.tg("answerCallbackQuery", callback_query_id=cb["id"],
                    text="Обновлено")
        else:
            self.tg("answerCallbackQuery", callback_query_id=cb["id"])

    # ---------- разбор обновления ----------

    def обновление(self, upd):
        if upd.get("callback_query"):
            self.кнопка(upd["callback_query"])
            return
        мчм = upd.get("my_chat_member")
        if мчм:
            self.узнать_группу(мчм["chat"], (мчм.get("from") or {}).get("id"))
            return
        msg = upd.get("message")
        if not msg:
            return
        chat = msg.get("chat") or {}
        кто = (msg.get("from") or {}).get("id")
        if chat.get("type") == "private":
            текст = (msg.get("text") or "").strip()
            if текст.startswith("/start"):
                арг = текст.split(maxsplit=1)[1] if " " in текст else None
                self.привет(chat["id"], кто,
                            (msg.get("from") or {}).get("language_code"),
                            откуда=арг)
                return
            self.от_клиента(msg)
            return
        if chat.get("type") in ("group", "supergroup"):
            if self.узнать_группу(chat, кто):
                return
            if chat.get("id") != self.группа:
                # Чужая группа - нам там нечего делать и нечего читать.
                self.tg("leaveChat", chat_id=chat["id"])
                return
            self.из_группы(msg)

    def напомнить(self):
        """Кто ждёт ответа дольше нормы - одна строка в «Новые»."""
        for в in self.store.ветки_ждут(НОРМА_ОТВЕТА):
            ключ = (в["tg_id"], в["last_at"])
            if ключ in self.напомнили or не_ветка(в):
                continue
            self.напомнили.add(ключ)
            мин = int((time.time() - в["last_at"]) // 60)
            self.в_новые("⏰ Ждёт ответа %d мин: <b>%s</b> - "
                         "<a href=\"%s\">открыть ветку</a>"
                         % (мин, html.escape(в.get("имя") or "Клиент"),
                            self.ссылка(в["thread_id"])))


def не_ветка(в):
    return not в or not в.get("thread_id")


def мёртв(о):
    б = (о.get("description") or "").lower()
    return any(м in б for м in ("blocked", "deactivated", "chat not found",
                                "can't initiate"))
