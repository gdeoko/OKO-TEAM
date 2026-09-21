#!/usr/bin/env python3
"""Телеграм-бот генерации. Фото и видео по запросу, оплата коинами.

Запуск:
    export ROCKET_BOT_TOKEN=...      токен от BotFather
    export ROCKET_GPU_URL=...        адрес панели генерации
    export ROCKET_GPU_USER=rocket
    export ROCKET_GPU_PASS=...
    export ROCKET_ADMINS=123,456     кому доступна /stats
    python3 bot.py

Зависимости: requests. Больше ничего.
"""

import os, sys, time, json, uuid, threading, traceback
import requests

import archive
import pricing
import catalog
import места
import prompts
import payments
import emoji
import ui
import язык
from язык import t
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "brand-amberry"))
import brand
from store import Store, NotEnoughCoins
from gpu import Gpu, GpuError

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TOKEN}"
ADMINS = {int(x) for x in os.environ.get("ROCKET_ADMINS", "").replace(" ", "").split(",") if x}

# Кому коины не считаются. Список из окружения, через запятую: id или
# @username. Умолчание — владелец и админ бота: они проверяют варианты
# подряд, и без этого каждая проба стоила бы им коина.
БЕЗЛИМИТ = os.environ.get("ROCKET_UNLIMITED", "6547482131,ktodaniel")
store = Store(os.environ.get("ROCKET_DB", "rocket_bot.db"),
              безлимит=[x for x in БЕЗЛИМИТ.replace(" ", "").split(",") if x])
gpu = Gpu(os.environ.get("ROCKET_GPU_URL", ""),
          os.environ.get("ROCKET_GPU_USER", "rocket"),
          os.environ.get("ROCKET_GPU_PASS", ""))

# Какие обновления слушаем. pre_checkout_query обязателен: без него
# оплата звёздами отменяется через 10 секунд.
ОБНОВЛЕНИЯ = ["message", "edited_message", "callback_query",
              "pre_checkout_query", "shipping_query"]

# Сколько секунд ролика просить у панели. Ключ вида несёт длину, но
# читать её разбором строки в трёх местах — способ однажды разойтись.
СЕКУНДЫ = {"t2v_5": 5, "t2v_10": 10, "i2v_5": 5, "i2v_10": 10, "sound": 5}

# СКОЛЬКО ОСТАВЛЯТЬ ОТ ПРИСЛАННОГО СНИМКА, когда место не выбрано и
# обстановка должна быть та же.
#
# Это единственная настройка во всём боте, у которой нет правильного
# значения — есть только весы. Выше — вернее держится комната, лицо и
# сложение; ниже — охотнее уходит одежда. Промпт «оставь ту же комнату»
# при полном denoise не работает вовсе: стартовый латент стирается, и
# 21.09.2026 героиня без выбранного места оказалась в чужом помещении.
#
# Вынесено в переменную окружения нарочно: подбирать это надо глазами
# на живых генерациях, а не перевыкладывать бота ради одной цифры.
DENOISE_ФОН = max(0.3, min(1.0, float(os.environ.get("ROCKET_DENOISE_REF", "0.8"))))

# что пользователь делает прямо сейчас: tg_id -> {"kind":..., "фото":[...]}
waiting = {}
busy = set()          # у кого уже считается задание
lock = threading.Lock()


# ---------- телеграм ----------

def tg(method, **params):
    files = params.pop("_files", None)
    try:
        r = requests.post(f"{API}/{method}", data=params, files=files, timeout=60)
        j = r.json()
        if not j.get("ok"):
            print("TG:", method, j.get("description"), flush=True)
        return j
    except Exception as e:
        print("TG сбой:", method, str(e)[:150], flush=True)
        return {"ok": False}


def file_id_из(ответ):
    """Достаёт file_id из ответа на sendPhoto/sendAnimation/sendVideo.

    Им работу можно переслать человеку ещё раз бесплатно — файл уже у
    телеграма, заливать второй раз нечего. У фото приходит лесенка
    размеров, берём последний: он самый большой.
    """
    r = (ответ or {}).get("result") or {}
    for ключ in ("animation", "video", "document"):
        if isinstance(r.get(ключ), dict):
            return r[ключ].get("file_id")
    фото = r.get("photo")
    if isinstance(фото, list) and фото:
        return фото[-1].get("file_id")
    return None


def send(chat, text, kb=None, **kw):
    p = {"chat_id": chat, "text": text, "parse_mode": "HTML",
         "disable_web_page_preview": True, **kw}
    if kb:
        p["reply_markup"] = json.dumps(kb)
    return tg("sendMessage", **p)


def edit(chat, mid, text, kb=None):
    p = {"chat_id": chat, "message_id": mid, "text": text, "parse_mode": "HTML"}
    if kb:
        p["reply_markup"] = json.dumps(kb)
    return tg("editMessageText", **p)


def answer(cb_id, text=None):
    tg("answerCallbackQuery", callback_query_id=cb_id, text=text or "")


# ---------- экраны ----------

# Каталог стоит первым нарочно: описывать сцену словами умеет
# меньшинство, а платят все. Свой промпт остаётся рядом и бесплатно —
# у конкурента он заперт за подпиской.

def яз(u):
    """Язык человека. Спрашивается у базы на КАЖДОМ экране.

    Не кэшируется в памяти процесса: бот один, людей много, и кэш на
    модуле означал бы ответ на языке того, кто написал последним.
    Запрос дешёвый — одна строка по первичному ключу.
    """
    return store.язык(u)


def меню(u=None):
    """Главное меню собирается КАЖДЫЙ раз, а не один при запуске:
    «Популярное» считается из базы и меняется само, названия кнопок
    владелец правит на странице каталога, а язык у каждого свой.
    Собранное однажды, оно застыло бы на всех трёх сразу."""
    return ui.главное_меню(catalog.популярная_категория(store),
                           яз(u) if u else "ru")


def greet(u, имя=None):
    return ui.шапка_главного(store.balance(u), имя, яз(u))


def price_list(u=None):
    я = яз(u) if u else "ru"
    lines = [t("оп.сколько_стоит", я), ""]
    for j in pricing.В_ПРОДАЖЕ:
        lines.append(t("оп.строка_вида_нота", я, что=язык.job_title(j, я),
                       цена=j.coins, символ=pricing.СИМВОЛ,
                       нота=язык.job_note(j, я)))
    lines.append("\n<i>" + t("оп.одна_цена", я) + "</i>")
    lines.append("\n" + t("оп.подписки_нет", я))
    # Цены пакетов в тексте НЕ повторяются: они стоят на кнопках прямо
    # под сообщением. Дважды одно и то же человек не читает — он
    # пролистывает, и пролистывает вместе с тем, что было важно.
    lines.append("\n" + t("оп.пакеты", я))
    return "\n".join(lines)


def buy_kb(u=None):
    return ui.меню_оплаты(яз(u) if u else "ru")


# ---------- генерация ----------



def _проход(kind, prompt, photos, на_тик=None, denoise=1.0):
    """Один проход по карте. Возвращает (имя файла, байты, секунды).

    Вынесено из run_job, потому что проходов бывает два: см. `цепочка`.
    """
    # steps=4 и cfg=1 — не опечатка. У второго поколения моделей
    # (Qwen-Rapid-AIO, wan2.2-rapid-mega-aio) ускорители встроены в
    # сборку, и обычные 26 шагов при cfg 4 их ЛОМАЮТ.
    params = {"prompt": prompt, "size": "vert",
              "steps": 4, "cfg": 1.0, "seed": 0,
              "neg": prompts.НЕГАТИВ, "denoise": denoise}
    сем = prompts.семейство(kind)
    if сем in ("t2i", "i2i"):
        params["mode"] = "photo"
    elif сем == "inpaint":
        params["mode"] = "inpaint"
    else:
        params["mode"] = "video"
        params["secs"] = СЕКУНДЫ.get(kind, 5)
    # Панель принимает список: у фото-по-фото до трёх референсов, у
    # видео первый кадр и необязательный последний.
    if photos:
        params["images"] = list(photos)
        params["image"] = photos[0]      # совместимость со старой панелью

    gid, _seed = gpu.start(**params)
    res = gpu.wait(gid, limit=900, on_tick=на_тик)
    files = res.get("files") or []
    if not files:
        raise GpuError("пустой результат")
    return files[0], gpu.fetch(files[0]), res.get("sec")


def run_job(chat, u, kind, prompt, photos=None, scene=None,
            цепочка=False, prompt_фото=None, denoise=1.0):
    """Считает задание и отдаёт результат. Крутится в отдельном потоке.

    `scene` — ключ сценария из каталога, если человек пришёл кнопкой.
    Из него считается «Популярное».

    `цепочка` — ВИДЕО ЧЕРЕЗ ПРОМЕЖУТОЧНОЕ ФОТО, и это не оптимизация, а
    единственный способ отдать то, за что заплачено.

        `WanImageToVideo.start_image` — БУКВАЛЬНО первый кадр ролика, а
        не подсказка. Ролик не может раздеть человека и не может
        перенести его в другое место: что пришло на вход, то и стоит в
        первом кадре. Отправив одетое фото прямо в видео, мы отдали бы
        одетый ролик — за полную цену.

    Поэтому проходов два: сперва фото по референсам (`prompt_фото`),
    потом оно же оживляется тем же сценарием. Человек этого не видит и
    платит ОДИН раз, по цене ролика: второй проход — наша кухня.
    Решение владельца 21.09.2026.
    """
    job = pricing.job(kind)
    я = яз(u)
    jid = uuid.uuid4().hex[:10]
    charged = False
    try:
        # В базу пишется РУССКОЕ название вида работы, а не то, что
        # видел человек: это наша бухгалтерия, и она обязана читаться
        # одинаково независимо от того, на каком языке сидел клиент.
        store.spend(u, job.coins, f"{job.title}", meta={"job": jid})
        charged = True
        store.job_start(jid, u, kind, prompt, job.coins, scene=scene)

        # Что показывать в ожидании. У ролика два прохода: сперва мы
        # раздеваем снимок фотографией, и человеку про это честно
        # написано — иначе первая минута выглядит как «считаю видео»,
        # хотя видео ещё и не начиналось.
        шаг = "кадр" if цепочка else ("видео" if prompts.семейство(kind).endswith("2v")
                                      else "фото")
        m = send(chat, ui.ожидание(шаг, 0, я))
        mid = m.get("result", {}).get("message_id")

        def tick(sec):
            # Раз в пять секунд, а не раз в десять: строка на экране
            # ожидания теперь живая, и десять секунд неподвижности она
            # читается как зависший бот.
            if mid and sec and sec % 5 == 0:
                edit(chat, mid, ui.ожидание(шаг, sec, я))

        if цепочка:
            # Первый проход. Его результат человеку НЕ отдаётся и в
            # архив не кладётся: это полуфабрикат, и «Мои работы»,
            # набитые промежуточными кадрами, только запутают.
            имя, кадр, _ = _проход("i2i", prompt_фото or prompt, photos, tick,
                                   denoise=denoise)
            шаг = "видео"
            if mid:
                edit(chat, mid, t("ген.кадр_готов", я))
            photos = [gpu.upload(имя, кадр)]

        # Второй проход оживляет НАШ кадр, а не присланный снимок:
        # обстановка в нём уже правильная, и гасить её нечем и незачем.
        файл, data, сек = _проход(kind, prompt, photos, tick,
                                  denoise=1.0 if цепочка else denoise)
        files = [файл]
        res = {"sec": сек}
        if mid:
            tg("deleteMessage", chat_id=chat, message_id=mid)

        # Сначала в архив, потом человеку. Именно в таком порядке:
        # диск наш, телеграм чужой, и если что-то упадёт между двумя
        # действиями — пусть у нас останется работа без отправки, а не
        # отправка без работы. Восстановить второе нечем.
        путь = None
        try:
            путь = archive.сохранить(u, jid, files[0], data)
        except OSError as e:
            print("АРХИВ не пишется:", str(e)[:200], flush=True)

        cap = t("ген.подпись", я, что=язык.job_title(job, я),
                сек=res.get("sec"),
                баланс=f"{store.balance(u)} {pricing.СИМВОЛ}")
        if files[0].lower().endswith((".webp", ".gif", ".mp4")):
            о = tg("sendAnimation", chat_id=chat, caption=cap,
                   _files={"animation": (files[0], data)})
        else:
            о = tg("sendPhoto", chat_id=chat, caption=cap,
                   _files={"photo": (files[0], data)})
        store.job_done(jid, file=files[0], path=путь,
                       tg_file_id=file_id_из(о), size=len(data))
        send(chat, t("гл.что_дальше", я), меню(u))

    except NotEnoughCoins as e:
        send(chat, t("ген.не_хватает", я, нужно=e.need, есть=e.have),
             ui.мало_коинов(я))
    except GpuError as e:
        if charged:
            store.refund(u, job.coins, f"осечка генерации: {str(e)[:80]}")
        store.job_done(jid, error=str(e)[:300])
        send(chat, t("ген.осечка", я, почему=str(e)[:200],
                     баланс=store.balance(u)), меню(u))
    except Exception as e:
        if charged:
            store.refund(u, job.coins, "внутренняя ошибка")
        store.job_done(jid, error=str(e)[:300])
        print("СБОЙ:", traceback.format_exc()[:800], flush=True)
        send(chat, t("ген.сломалось", я, баланс=store.balance(u)), меню(u))
    finally:
        with lock:
            busy.discard(u)


def оживить(chat, u, старое, байты):
    """Готовый кадр -> ролик. Отдельно от launch, потому что снимок
    надо сперва залить на карту: в архиве он лежит у нас, а панель
    работает с файлами на своей стороне."""
    with lock:
        if u in busy:
            send(chat, t("ген.занято", яз(u)))
            return
    try:
        имя = gpu.upload(старое["file"] or "frame.png", байты)
    except GpuError as e:
        send(chat, t("ген.кадр_не_ушёл", яз(u), почему=str(e)[:150]))
        return
    # Промпт берём ТОТ ЖЕ: ролик должен продолжать этот кадр, а не
    # уводить в сторону. Обстановку менять не надо — она уже в кадре.
    launch(chat, u, "i2v_5", старое["prompt"] or "", [имя],
           scene=старое["scene"])


def launch(chat, u, kind, prompt, photos=None, scene=None,
           цепочка=False, prompt_фото=None, denoise=1.0):
    with lock:
        if u in busy:
            send(chat, t("ген.занято", яз(u)))
            return
        busy.add(u)
    threading.Thread(target=run_job,
                     args=(chat, u, kind, prompt, photos or [], scene),
                     kwargs={"цепочка": цепочка, "prompt_фото": prompt_фото,
                             "denoise": denoise},
                     daemon=True).start()


# ---------- разбор сообщений ----------

def on_start(chat, u, username, arg, lang=None):
    invited_by = None
    if arg:
        inviter = store.by_ref_code(arg.strip())
        if inviter and inviter["tg_id"] != u:
            invited_by = inviter["tg_id"]
    user, is_new = store.ensure_user(u, username, welcome=pricing.WELCOME_COINS,
                                     invited_by=invited_by, lang=lang)
    я = яз(u)
    if is_new and invited_by:
        store.credit(invited_by, pricing.REFERRAL_INVITER, "welcome", f"привёл {u}")
        store.credit(u, pricing.REFERRAL_INVITEE, "welcome", "пришёл по приглашению")
        # Приглашение уходит ПРИГЛАСИВШЕМУ — и на ЕГО языке, а не на
        # языке того, кто пришёл. Разные люди, разные настройки.
        send(invited_by, t("каб.пришёл_друг", яз(invited_by),
                           сколько=pricing.REFERRAL_INVITER,
                           символ=pricing.СИМВОЛ))
    # Нижнее меню и inline-кнопки нельзя повесить на одно сообщение:
    # Телеграм принимает только одну разметку. Поэтому сначала короткое
    # сообщение, которое ставит нижнее меню, следом — само приветствие.
    #
    # Клавиатуру ставим ВСЕГДА, а не только новичку. Она живёт в чате, и
    # пропасть может по причинам не из нашего кода: человек её закрыл,
    # телеграм переставил, чат пересоздался. /start — ровно то, что
    # жмут, когда «всё пропало», и он обязан чинить, а не здороваться.
    store.низ_устарел(u, НИЗ_ВЕРСИЯ)   # эта посылка её и ставит
    send(chat, t("гл.добро", я, подарок=emoji.баланс(pricing.WELCOME_COINS, я))
         if is_new else t("низ.вернул", я), ui.нижнее(я))
    send(chat, greet(u, username), меню(u))


def показать_работы(chat, u, сколько=5):
    """«Мои работы»: присылаем последние готовые ещё раз.

    Сначала пробуем telegram file_id — пересылка по нему бесплатна и
    мгновенна. Не вышло (телеграм файл забыл, а он имеет на это право)
    — поднимаем байты из нашего архива. Нет ни того, ни другого —
    честно говорим, что работа была, но показать нечем, вместо того
    чтобы делать вид, будто её не существовало.
    """
    я = яз(u)
    работы = store.works(u, сколько)
    if not работы:
        send(chat, t("раб.пусто", я), меню(u))
        return
    send(chat, t("раб.список", я, сколько=len(работы)))
    for j in работы:
        подпись = язык.job_title(pricing.job(j["kind"]), я)
        видео = (j["file"] or "").lower().endswith((".webp", ".gif", ".mp4"))
        метод = "sendAnimation" if видео else "sendPhoto"
        поле = "animation" if видео else "photo"

        о = tg(метод, chat_id=chat, caption=подпись,
               **{поле: j["tg_file_id"]}) if j["tg_file_id"] else {"ok": False}
        if о.get("ok"):
            continue

        данные = archive.байты(j["path"])
        if данные:
            о = tg(метод, chat_id=chat, caption=подпись,
                   _files={поле: (j["file"] or "work", данные)})
            # Телеграм выдал новый file_id — запоминаем, чтобы в
            # следующий раз снова обойтись без заливки.
            if о.get("ok"):
                store.job_done(j["id"], file=j["file"], path=j["path"],
                               tg_file_id=file_id_из(о), size=j["size"])
                continue
        send(chat, t("раб.нет_файла", я, что=подпись))
    send(chat, t("гл.что_дальше", я), меню(u))


def показать_кабинет(chat, u, имя=None):
    я = яз(u)
    send(chat,
         ui.текст_кабинета(store.balance(u), store.сводка(u), имя, я),
         ui.меню_кабинета(я))


def показать_баланс(chat, u):
    показать_кабинет(chat, u)


def позвать_друзей(chat, u):
    """Готовое приглашение в одно нажатие.

    Раньше бот выдавал ссылку и предлагал человеку самому придумать,
    что к ней написать. Так реферальная программа не работает: писать
    текст про порно-бота своими словами неловко, и до отправки доходят
    единицы. Теперь текст написан за него, а кнопка открывает родной
    выбор чата с уже подставленным сообщением.
    """
    я = яз(u)
    code = store.user(u)["ref_code"]
    me = os.environ.get("ROCKET_BOT_NAME", brand.BOT.lstrip("@"))
    ссылка = f"https://t.me/{me}?start={code}"
    текст = t("пригл.текст", я, ссылка=ссылка,
              другу=f"{pricing.REFERRAL_INVITEE} {pricing.СИМВОЛ}")
    send(chat, "\n\n".join([
        t("пригл.заголовок", я),
        t("пригл.как", я, ему=f"{pricing.REFERRAL_INVITER} {pricing.СИМВОЛ}",
          другу=f"{pricing.REFERRAL_INVITEE} {pricing.СИМВОЛ}"),
        t("пригл.ссылка_моя", я, ссылка=ссылка),
    ]), ui.меню_приглашения(ссылка, текст, я))


# Нижнее меню шлёт обычный текст, а не callback. Без этой таблицы все
# четыре кнопки падали в «Сначала выбери, что делаем» — клавиатура
# висела на экране и не делала ничего.
ДЕЙСТВИЯ_НИЗА = {
    "низ.создать":  lambda chat, u: send(chat, t("гл.что_делаем", яз(u)), меню(u)),
    "низ.файлы":    показать_работы,
    "низ.кабинет":  показать_кабинет,
    "низ.пополнить": lambda chat, u: send(chat, price_list(u), buy_kb(u)),
}

# Узнаём кнопку на ЛЮБОМ из языков, а не только на текущем. Человек
# переключил язык — снизу до следующего сообщения висит старая
# клавиатура, и её нажатие обязано сработать, а не упасть в «сначала
# выбери, что делаем».
НИЖНИЕ_КНОПКИ = {t(ключ, я): действие
                 for ключ, действие in ДЕЙСТВИЯ_НИЗА.items()
                 for я in язык.ЯЗЫКИ}

# ПРЕЖНИЕ ПОДПИСИ. Reply-клавиатура живёт не в сообщении, а в чате: она
# остаётся у человека ровно такой, какой он её получил, пока бот не
# пришлёт новую. Владелец 21.09.2026 поменял четыре кнопки и не увидел
# перемены у себя — потому что у него на экране висела прежняя.
#
# Новую мы пришлём (`НИЗ_ВЕРСИЯ` ниже), но между его нажатием и нашим
# сообщением успевает пройти нажатие по старой кнопке. Оно обязано
# сработать, а не упасть в «сначала выбери, что делаем».
ПРЕЖНИЕ_НИЗА = {
    "Создать": "низ.создать",       "Create": "низ.создать",
    "Мои работы": "низ.файлы",      "My works": "низ.файлы",
    "Баланс": "низ.кабинет",        "Balance": "низ.кабинет",
    "Пополнить": "низ.пополнить",   "Top up": "низ.пополнить",
}
for _текст, _ключ in ПРЕЖНИЕ_НИЗА.items():
    НИЖНИЕ_КНОПКИ.setdefault(_текст, ДЕЙСТВИЯ_НИЗА[_ключ])

# Версия нижней клавиатуры. Меняется ВМЕСТЕ с подписями в `язык.СТРОКИ`
# — по ней бот понимает, что у человека внизу висит старьё, и присылает
# новую. Без этого правка подписей доходит только до тех, кто заново
# нажал /start.
НИЗ_ВЕРСИЯ = "2026-09-21-создать-файлы-кабинет-пополнить"


def обновить_низ(chat, u, я):
    """Прислать нижнюю клавиатуру, если у человека висит прежняя.

    Отдельным коротким сообщением: Телеграм принимает на сообщение одну
    разметку, и подвесить reply-клавиатуру к экрану с inline-кнопками
    нельзя. Делается один раз на версию — дальше `store` помнит.
    """
    if not store.низ_устарел(u, НИЗ_ВЕРСИЯ):
        return
    send(chat, t("низ.обновлено", я), ui.нижнее(я))


def on_text(chat, u, text):
    обновить_низ(chat, u, яз(u))
    кнопка = НИЖНИЕ_КНОПКИ.get(text.strip())
    if кнопка:
        waiting.pop(u, None)      # передумал на полпути — это нормально
        кнопка(chat, u)
        return

    st = waiting.pop(u, None)
    if not st:
        send(chat, t("гл.сначала_выбери", яз(u)), меню(u))
        return
    kind = st["kind"]
    job = pricing.job(kind)
    if job.нужно_фото and not st.get("фото"):
        waiting[u] = st
        send(chat, ui.просьба_о_фото(job, яз=яз(u)))
        return
    пустить_своё(chat, u, kind, text.strip(), st.get("фото") or [])


def _место(ключ):
    """Ключ места -> место. Неизвестный ключ (старая кнопка из
    переписки, спрятанное место) откатывается к «как на твоём фото»:
    это всегда осмысленный кадр, а падение — нет."""
    if not ключ:
        return места.КАК_НА_ФОТО
    try:
        м = места.место(ключ)
    except KeyError:
        return места.КАК_НА_ФОТО
    return места.КАК_НА_ФОТО if catalog.скрыт(ключ) else м


def пустить_сценарий(chat, u, sc, фото, место=None):
    """Запуск кнопки каталога. Двухшаговость решает сам сценарий."""
    место = место or места.КАК_НА_ФОТО
    launch(chat, u, sc.job, sc.промпт(место=место), фото, scene=sc.key,
           цепочка=sc.двухшаговый, prompt_фото=sc.prompt_фото(место),
           denoise=DENOISE_ФОН if sc.фон_с_референса(место) else 1.0)


def пустить_своё(chat, u, kind, текст, фото):
    """Запуск своего промпта.

    Описание человека проходит тем же сборщиком, что и каталог, и к
    нему дописывается обязательная строка — иначе восемнадцать плюс
    выдаёт одетый кадр (см. prompts.свой). Видео идёт двумя проходами по
    той же причине, что и в каталоге: ролик не раздевает.
    """
    обяз = catalog.обязательная_строка()
    промпт = prompts.свой(текст, kind, обязательное=обяз)
    видео = prompts.семейство(kind) == "i2v"
    # Свой промпт идёт на полном denoise: человек описывает кадр
    # словами, и что он хотел сохранить со снимка — знает только он.
    launch(chat, u, kind, промпт, фото, цепочка=видео,
           prompt_фото=prompts.свой(текст, "i2i", обязательное=обяз))


def on_photo(chat, u, file_id):
    """Приём снимка. Копим до максимума, который берёт модель.

    Копим, а не запускаем на первом: у фото-по-фото моделей до трёх
    референсов, и запуск на первом отбирал бы у человека остальные два
    молча."""
    я = яз(u)
    st = waiting.get(u)
    if not st:
        send(chat, t("гл.сначала_сценарий", я), меню(u))
        return
    job = pricing.job(st["kind"])
    sc = catalog.scene(st["scene"]) if st.get("scene") else None
    # Сколько снимков брать, решает СЦЕНАРИЙ, а не вид работы: парной
    # сцене нужно ровно два, по одному на человека, при том же i2v_5.
    мин, макс = sc.фото_нужно if sc else job.фото_нужно
    собрано = st.setdefault("фото", [])
    if len(собрано) >= макс > 0:
        send(chat, t("фото.перебор", я, макс=макс))
        return

    f = tg("getFile", file_id=file_id).get("result", {})
    path = f.get("file_path")
    if not path:
        send(chat, t("фото.не_забрала", я))
        return
    data = requests.get(f"https://api.telegram.org/file/bot{TOKEN}/{path}", timeout=60).content
    try:
        name = gpu.upload(f"ref{len(собрано)+1}.jpg", data)
    except GpuError as e:
        send(chat, t("фото.не_приняла", я, почему=str(e)[:150]))
        return
    собрано.append(name)

    # Пришли из каталога — промпт готов. Набрали максимум — запускаем
    # сами, не заставляя жать лишнюю кнопку.
    if sc:
        if len(собрано) >= макс:
            м = _место(st.get("место"))
            waiting.pop(u, None)
            пустить_сценарий(chat, u, sc, собрано, м)
            return
        send(chat, ui.просьба_о_фото(job, len(собрано), sc.фото_нужно, я),
             ui.меню_сбора_фото(sc, len(собрано), я))
        return

    send(chat, t("фото.теперь_текст", я, сколько=len(собрано)))


def on_callback(cb):
    data = cb["data"]; chat = cb["message"]["chat"]["id"]
    u = cb["from"]["id"]; cid = cb["id"]
    store.ensure_user(u, cb["from"].get("username"), welcome=pricing.WELCOME_COINS,
                      lang=язык.по_телеграму(cb["from"].get("language_code")))
    я = яз(u)
    # Владелец жмёт inline-кнопки, а не пишет текст, и прежняя нижняя
    # клавиатура иначе висела бы у него до первого набранного слова.
    обновить_низ(chat, u, я)

    if data == "m:menu":
        answer(cid); send(chat, t("гл.что_делаем", я), меню(u)); return

    if data == "m:lang":
        # Переключатель на два положения: языков ровно два, и отдельный
        # экран выбора из двух кнопок был бы лишним нажатием.
        answer(cid)
        новый = "en" if я == "ru" else "ru"
        store.сменить_язык(u, новый)
        # Нижняя клавиатура живёт в чате, а не в сообщении: не
        # переслать её здесь — и снизу навсегда останутся кнопки на
        # прежнем языке.
        store.низ_устарел(u, НИЗ_ВЕРСИЯ)   # эта посылка её и обновляет
        send(chat, t("каб.язык_сменён", новый), ui.нижнее(новый))
        показать_кабинет(chat, u, cb["from"].get("first_name"))
        return

    if data in ("m:balance", "m:cab"):
        answer(cid); показать_кабинет(chat, u, cb["from"].get("first_name")); return

    if data.startswith("anim:"):
        # «Оживить это»: берём готовый кадр из АРХИВА и делаем его
        # первым кадром ролика. Перезагружать ничего не нужно — файл
        # наш. Именно так и работает фото-в-видео: start_image это
        # буквально первый кадр, а не подсказка.
        answer(cid)
        старое = store.job(data.split(":", 1)[1])
        if not старое or старое["tg_id"] != u:
            send(chat, t("раб.не_найдена", я)); return
        байты = archive.байты(старое["path"])
        if not байты:
            send(chat, t("раб.нечем_оживить", я)); return
        оживить(chat, u, старое, байты); return

    if data == "m:works":
        answer(cid); показать_работы(chat, u); return

    if data == "m:ref":
        answer(cid); позвать_друзей(chat, u); return


    if data == "m:forget":
        answer(cid)
        send(chat, ui.текст_удаления(store.сводка(u), я),
             ui.меню_удаления(я)); return

    if data == "m:forget:yes":
        answer(cid)
        # Сначала файлы, потом база: упадём между — останутся строки без
        # файлов, что честнее, чем файлы без строк. Файл без строки в
        # базе не найдёт уже никто, и он просто займёт диск навсегда.
        try:
            archive.забыть_человека(u)
        except OSError as e:
            print("АРХИВ не чистится:", str(e)[:200], flush=True)
        итог = store.забыть(u)
        send(chat, t("уд.готово", я, работ=итог["работ"],
                     записей=итог["записей"]))
        return

    if data == "m:buy":
        answer(cid); send(chat, price_list(u), buy_kb(u)); return

    if data.startswith("buy:"):
        answer(cid)
        p = pricing.pack(data.split(":", 1)[1])
        send(chat, ui.текст_пакета(p, я), ui.меню_способов(p["id"], я))
        return

    if data.startswith("pay:stars:"):
        answer(cid)
        сч = payments.счёт_звёздами(data.rsplit(":", 1)[1])
        tg("sendInvoice", chat_id=chat, **{k: (json.dumps(v) if k == "prices" else v)
                                           for k, v in сч.items()})
        return

    if data.startswith("pay:crypto:"):
        pid = data.rsplit(":", 1)[1]
        try:
            сч = payments.счёт_криптой(pid, u)
        except payments.ОшибкаОплаты as e:
            answer(cid, t("оп.крипта_нет", я))
            send(chat, t("оп.крипта_не_настроена", я, почему=e),
                 ui.меню_способов(pid, я))
            return
        answer(cid)
        store.remember_invoice(u, сч["invoice_id"], pid)
        send(chat, t("оп.счёт", я, сумма=сч["usd"]),
             ui.клава([[ui.кнопка(t("кн.оплатить", я), url=сч["url"],
                                  иконка=emoji.КАРТА)],
                       [ui.кнопка(t("кн.проверь", я), f"chk:{сч['invoice_id']}")],
                       [ui.кнопка(t("кн.назад", я), "m:buy", emoji.ВЛЕВО)]]))
        return

    if data.startswith("chk:"):
        инв = data.split(":", 1)[1]
        try:
            статус = payments.проверить_счёт(инв)
        except payments.ОшибкаОплаты as e:
            answer(cid, t("оп.не_проверила", я)); return
        if статус != "paid":
            answer(cid, t("оп.ещё_не_пришла" if статус == "active"
                          else "оп.счёт_истёк", я))
            return
        зачислено = зачислить_крипту(u, инв)
        answer(cid, t("оп.зачислено" if зачислено else "оп.уже_зачислено", я))
        if зачислено:
            send(chat, t("оп.пришла", я, баланс=emoji.баланс(store.balance(u), я)),
                 меню(u))
        return

    # Кнопка из СТАРОГО сообщения может вести в пункт, убранный
    # владельцем вчера: телеграм хранит переписку вечно, и нажать её
    # могут в любой момент. Молча показать убранное нельзя — человек
    # заплатит за то, чего в боте уже нет.
    def убрано():
        answer(cid)
        send(chat, t("гл.убрано", я), меню(u))

    # Один переход на все уровни дерева: у «Соло» внутри есть ещё
    # разбивка, у «Группового» нет, и отдельные callback'ы на раздел и
    # подраздел означали бы третий — при следующей же правке дерева.
    if data.startswith("n:") or data.startswith("r:") or data.startswith("c:"):
        ключ = data.split(":", 1)[1]
        # «Популярное» живёт не в дереве, а в базе, и по ключу его там
        # нет: пересчитываем заново, иначе кнопка ведёт в ошибку.
        if ключ == "top":
            у = catalog.популярная_категория(store)
            if not у or not у.видимые:
                return убрано()
        else:
            try:
                у = catalog.узел(ключ)
            except KeyError:
                return убрано()
            if у.пустой:
                return убрано()
        answer(cid)
        send(chat, ui.текст_узла(у, я), ui.меню_узла(у, я))
        return

    if data.startswith("own:"):
        # Свой промпт: сначала референс, потом описание. Вид работы
        # определён подразделом — см. catalog.СВОБОДНЫЕ.
        answer(cid)
        под = catalog.узел(data.split(":", 1)[1])
        if под.скрыт:
            return убрано()
        kind = catalog.СВОБОДНЫЕ[под.key]
        waiting[u] = {"kind": kind, "фото": []}
        send(chat, ui.текст_своего_промпта(под, я), меню(u))
        return

    if data.startswith("sc:"):
        # «sc:ключ» или «sc:ключ:место» — вторая часть появляется, когда
        # человек выбрал обстановку и вернулся на экран сценария.
        части = data.split(":")
        sc = catalog.scene(части[1])
        if sc.скрыт:
            return убрано()
        м = _место(части[2]) if len(части) > 2 else места.КАК_НА_ФОТО
        answer(cid)
        send(chat, ui.шапка_сценария(sc, store.balance(u), я, м),
             ui.меню_сценария(sc, я, м))
        return

    if data.startswith("pl:"):
        sc = catalog.scene(data.split(":", 1)[1])
        if sc.скрыт:
            return убрано()
        answer(cid)
        send(chat, ui.текст_мест(sc, я), ui.меню_мест(sc, я))
        return

    if data.startswith("go:"):
        # Проверка баланса ЗДЕСЬ, а не на показе сценария: между показом
        # и нажатием человек мог потратить коины в другом окне.
        части = data.split(":")
        sc = catalog.scene(части[1])
        if sc.скрыт:
            return убрано()
        м = _место(части[2]) if len(части) > 2 else места.КАК_НА_ФОТО
        есть = store.balance(u)
        if есть < sc.coins:
            answer(cid, t("сц.мало_коинов", я,
                          цена=f"{sc.coins} {pricing.СИМВОЛ}", баланс=есть))
            send(chat, ui.текст_оплаты(я), ui.мало_коинов(я))
            return
        answer(cid)
        job = pricing.job(sc.job)
        waiting[u] = {"kind": sc.job, "scene": sc.key, "место": м.key,
                      "фото": []}
        send(chat, ui.просьба_о_фото(job, 0, sc.фото_нужно, я),
             ui.меню_сбора_фото(sc, 0, я))
        return

    if data.startswith("run:"):
        # Человек сказал «хватит», не добрав до максимума.
        sc = catalog.scene(data.split(":", 1)[1])
        if sc.скрыт:
            return убрано()
        st = waiting.get(u)
        собрано = (st or {}).get("фото") or []
        if len(собрано) < sc.фото_нужно[0]:
            answer(cid, t("фото.сколько_нести", я,
                          сколько=sc.фото_нужно[0])); return
        answer(cid)
        м = _место((st or {}).get("место"))
        waiting.pop(u, None)
        пустить_сценарий(chat, u, sc, собрано, м)
        return

    if data.startswith("undo:"):
        sc = catalog.scene(data.split(":", 1)[1])
        st = waiting.get(u)
        if st and st.get("фото"):
            st["фото"].pop()
        n = len(st["фото"]) if st else 0
        answer(cid, t("фото.убрала", я))
        send(chat, ui.просьба_о_фото(pricing.job(sc.job), n, sc.фото_нужно, я),
             ui.меню_сбора_фото(sc, n, я))
        return

    if data == "m:free":
        # Старая кнопка из сообщений, отправленных до перехода на три
        # раздела. Телеграм хранит их вечно, и нажать её могут завтра.
        answer(cid)
        у = catalog.узел("own")
        send(chat, ui.текст_узла(у, я), ui.меню_узла(у, я))
        return

    answer(cid)


def зачислить_крипту(u, invoice_id):
    """Зачисление по крипто-счёту. Возвращает, случилось ли начисление.

    Защита от двойного зачисления здесь обязательна: человек может
    нажать «я оплатил» десять раз, и вебхук придёт сверх того."""
    pid = store.take_invoice(u, invoice_id)
    if not pid:
        return False
    p = pricing.pack(pid)
    store.credit(u, p["coins"], "paid", f"крипта, пакет {pid}",
                 meta={"invoice": invoice_id})
    return True


def on_pre_checkout(q):
    """Ответить НАДО за 10 секунд, иначе Телеграм отменит платёж.

    Поэтому сначала отвечаем, и только потом что-либо делаем. Проверка
    payload — единственное, что успеваем: она не ходит в сеть."""
    try:
        payments.разобрать_payload(q.get("invoice_payload"))
        ок, ошибка = True, None
    except Exception as e:
        ок, ошибка = False, f"Не узнала пакет: {str(e)[:100]}"
    tg("answerPreCheckoutQuery", pre_checkout_query_id=q["id"],
       ok=ок, **({"error_message": ошибка} if ошибка else {}))


def on_paid(chat, u, оплата):
    """successful_payment: звёзды пришли, зачисляем коины."""
    try:
        p = payments.разобрать_payload(оплата.get("invoice_payload"))
    except payments.ОшибкаОплаты as e:
        send(chat, t("оп.пакет_не_узнан", яз(u)))
        print("ОПЛАТА БЕЗ ПАКЕТА:", u, оплата, flush=True)
        return
    # Идентификатор списания сохраняем ОБЯЗАТЕЛЬНО: без него звёзды
    # не вернуть, refundStarPayment требует именно его.
    store.credit(u, p["coins"], "paid", f"звёзды, пакет {p['id']}",
                 meta={"charge": оплата.get("telegram_payment_charge_id"),
                       "stars": оплата.get("total_amount")})
    я = яз(u)
    send(chat, t("оп.спасибо", я, сколько=emoji.баланс(p["coins"], я),
                 баланс=emoji.баланс(store.balance(u), я)), меню(u))


def on_update(up):
    if "callback_query" in up:
        on_callback(up["callback_query"]); return
    if "pre_checkout_query" in up:
        on_pre_checkout(up["pre_checkout_query"]); return
    msg = up.get("message") or up.get("edited_message")
    if not msg:
        return
    chat = msg["chat"]["id"]; u = msg["from"]["id"]
    username = msg["from"].get("username")
    # Язык телеграма едет с КАЖДЫМ сообщением, но ставится только
    # новичку: `ensure_user` не перезаписывает уже выбранный, иначе
    # выбор человека отменялся бы при каждом нажатии.
    lang = язык.по_телеграму(msg["from"].get("language_code"))
    завести = lambda: store.ensure_user(u, username,
                                        welcome=pricing.WELCOME_COINS, lang=lang)

    if "successful_payment" in msg:
        завести()
        on_paid(chat, u, msg["successful_payment"]); return

    if "photo" in msg:
        завести()
        on_photo(chat, u, msg["photo"][-1]["file_id"]); return

    text = (msg.get("text") or "").strip()
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        on_start(chat, u, username, parts[1] if len(parts) > 1 else None,
                 lang=lang); return
    if text in ("/menu", "/help"):
        завести()
        send(chat, t("гл.что_делаем", яз(u)), меню(u)); return
    if text == "/prices":
        завести()
        send(chat, price_list(u), меню(u)); return
    if text == "/lang":
        завести()
        новый = "en" if яз(u) == "ru" else "ru"
        store.сменить_язык(u, новый)
        send(chat, t("каб.язык_сменён", новый), ui.нижнее(новый))
        send(chat, t("гл.что_делаем", новый), меню(u)); return
    if text == "/scenes":
        # Владельцу: где в каталоге ещё пусто. Без этого узнать, какие
        # сценарии он уже наполнил, можно только зайдя на сервер.
        if u not in ADMINS:
            send(chat, "Не для тебя."); return
        строки = ["<b>Сценарии</b>", ""]
        пусто = 0
        for р in catalog.РАЗДЕЛЫ:
            for c in р.подразделы:
                if not c.scenes:
                    continue
                строки.append(f"<b>{р.title} · {c.title}</b>")
                for s in c.scenes:
                    if s.скрыт:
                        строки.append(f"  <s>{s.key} — {s.title}</s>")
                    elif s.наполнен:
                        строки.append(f"  + {s.key} — {s.title}")
                    else:
                        пусто += 1
                        строки.append(f"  <i>· {s.key} — {s.title}</i>")
                строки.append("")
        видно = sum(1 for s in catalog.все_сценарии() if not s.скрыт)
        строки.append(f"Пусто: <b>{пусто}</b>, видно в боте: <b>{видно}</b> "
                      f"из {len(catalog.все_сценарии())}.")
        строки.append(f"<i>Заполняется на странице каталога: "
                      f"{os.environ.get('AMBERRY_ADMIN_URL', 'адрес в ДОСТУПАХ')}. "
                      f"Перезапускать бота не нужно.</i>")
        send(chat, "\n".join(строки)); return

    if text == "/stats":
        if u not in ADMINS:
            send(chat, "Не для тебя."); return
        s = store.stats()
        free, total, q = (None, None, 0)
        try: free, total, q = gpu.free_vram()
        except GpuError: pass
        send(chat, f"<b>Сводка</b>\n"
                   f"Людей: {s['users']}, платящих: {s['paying']}\n"
                   f"Генераций: {s['jobs_ok']} удачных, {s['jobs_err']} осечек\n"
                   f"Потрачено коинов: {s['coins_spent']}\n"
                   f"Карта: {free}/{total} ГБ свободно, очередь {q}")
        return

    завести()
    on_text(chat, u, text)


def main():
    if not TOKEN:
        sys.exit("нет ROCKET_BOT_TOKEN")
    me = tg("getMe").get("result", {})
    print(f"бот @{me.get('username')} запущен", flush=True)
    # Карта — не условие запуска. Она арендуется почасово, её берут под
    # нагрузку и возвращают; без неё бот обязан работать дальше: баланс,
    # пакеты, оплата, кабинет, архив и «Мои работы» от неё не зависят.
    # Генерация в это время отвечает осечкой и возвращает коины.
    if not gpu.настроена:
        print("карта не подключена: генерация выключена, остальное работает",
              flush=True)
    elif not gpu.alive():
        print("ВНИМАНИЕ: панель генерации не отвечает", flush=True)
    offset = None
    while True:
        try:
            # allowed_updates перечисляем ЯВНО. Документация: «If not
            # specified, the previous setting will be used» — то есть
            # однажды суженный где-то список останется суженным, и
            # pre_checkout_query перестанет приходить молча. Платежи
            # будут отваливаться без единой записи в журнале.
            r = requests.get(f"{API}/getUpdates",
                             params={"timeout": 30, "offset": offset,
                                     "allowed_updates": json.dumps(ОБНОВЛЕНИЯ)},
                             timeout=45).json()
            for up in r.get("result", []):
                offset = up["update_id"] + 1
                try:
                    on_update(up)
                except Exception:
                    print("ошибка разбора:", traceback.format_exc()[:600], flush=True)
        except Exception as e:
            print("опрос:", str(e)[:150], flush=True)
            time.sleep(3)


if __name__ == "__main__":
    main()
