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
import prompts
import payments
import emoji
import ui
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "brand-amberry"))
import brand
from store import Store, NotEnoughCoins
from gpu import Gpu, GpuError

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TOKEN}"
ADMINS = {int(x) for x in os.environ.get("ROCKET_ADMINS", "").replace(" ", "").split(",") if x}

store = Store(os.environ.get("ROCKET_DB", "rocket_bot.db"))
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


def kb(rows):
    return {"inline_keyboard": [[{"text": t, "callback_data": d} for t, d in row] for row in rows]}


# ---------- экраны ----------

# Каталог стоит первым нарочно: описывать сцену словами умеет
# меньшинство, а платят все. Свой промпт остаётся рядом и бесплатно —
# у конкурента он заперт за подпиской.
MENU = ui.главное_меню()
buy_kb = ui.меню_оплаты
price_list = ui.текст_оплаты


def greet(u, имя=None):
    return ui.шапка_главного(store.balance(u), имя)


def price_list():
    lines = ["<b>Сколько стоит</b>\n"]
    for j in pricing.JOBS.values():
        lines.append(f"{j.title} — <b>{j.coins}</b> {pricing.СИМВОЛ} · {j.note}")
    lines.append("")
    for q in pricing.QUALITY[1:]:
        доп = f"+{q['coins']} {pricing.СИМВОЛ}" if q["coins"] else "бесплатно"
        lines.append(f"{q['title']} — {доп}")
    lines.append("\n<b>Подписки нет.</b> Платишь только за то, что сделал: "
                 "ни абонентской платы, ни сгорающих остатков, "
                 "ни функций за замком.")
    lines.append("\n<b>Пакеты коинов</b> — не сгорают никогда\n")
    for p in pricing.PACKS:
        lines.append(f"{p['coins']} {pricing.СИМВОЛ} — <b>{p['rub']} ₽</b>"
                     f"  <s>{p['market_rub']} ₽ у других</s>")
    lines.append(f"\n<i>Коин стоит от {pricing.rub_per_coin('p7'):.0f} до "
                 f"{pricing.rub_per_coin('p1'):.0f} ₽ — смотря какой пакет.</i>")
    return "\n".join(lines)


def buy_kb():
    rows = []
    for p in pricing.PACKS:
        rows.append([(f"{p['coins']} {pricing.СИМВОЛ} — {p['rub']} ₽", f"buy:{p['id']}")])
    rows.append([("Назад", "m:menu")])
    return kb(rows)


# ---------- генерация ----------



def run_job(chat, u, kind, prompt, photos=None):
    """Считает задание и отдаёт результат. Крутится в отдельном потоке."""
    job = pricing.job(kind)
    jid = uuid.uuid4().hex[:10]
    charged = False
    # Качество берётся из кабинета и стоит доплату с КАЖДОЙ работы.
    # Списываем одной суммой: два списания за одну кнопку человек читает
    # как «сняли дважды», сколько ни объясняй.
    кач = pricing.quality(store.quality(u))
    доплата = pricing.доплата_за_качество(kind, кач["id"])
    цена = job.coins + доплата
    try:
        store.spend(u, цена, f"{job.title}"
                    + (f" · {кач['title']}" if доплата else ""),
                    meta={"job": jid, "quality": кач["id"]})
        charged = True
        store.job_start(jid, u, kind, prompt, цена)

        m = send(chat, f"Считаю {job.title.lower()}…")
        mid = m.get("result", {}).get("message_id")

        # steps=4 и cfg=1 — не опечатка. У второго поколения моделей
        # (Qwen-Rapid-AIO, wan2.2-rapid-mega-aio) ускорители встроены в
        # сборку, и обычные 26 шагов при cfg 4 их ЛОМАЮТ.
        params = {"prompt": prompt, "size": "vert",
                  "steps": 4, "cfg": 1.0, "seed": 0,
                  "neg": prompts.НЕГАТИВ,
                  # `size` — это соотношение сторон (вертикаль), `quality`
                  # — разрешение. Две разные вещи, и раньше панели
                  # передавали только первую: 4K и 8K стояли в прайсе,
                  # продавались, но на картинку не влияли никак.
                  # 2K стоит ноль, но применяется — поэтому смотрим на
                  # применимость к виду работы, а не на доплату.
                  "quality": (кач["id"] if kind in pricing.КАЧЕСТВО_ПРИМЕНИМО
                              else "hd")}
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

        gid, seed = gpu.start(**params)

        def tick(sec):
            if mid and sec and sec % 10 == 0:
                edit(chat, mid, f"Считаю {job.title.lower()}… {sec} с")

        res = gpu.wait(gid, limit=900, on_tick=tick)
        files = res.get("files") or []
        if not files:
            raise GpuError("пустой результат")

        data = gpu.fetch(files[0])
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

        cap = f"{job.title} · {res.get('sec')} с · осталось {store.balance(u)} {pricing.СИМВОЛ}"
        if files[0].lower().endswith((".webp", ".gif", ".mp4")):
            о = tg("sendAnimation", chat_id=chat, caption=cap,
                   _files={"animation": (files[0], data)})
        else:
            о = tg("sendPhoto", chat_id=chat, caption=cap,
                   _files={"photo": (files[0], data)})
        store.job_done(jid, file=files[0], path=путь,
                       tg_file_id=file_id_из(о), size=len(data))
        send(chat, "Что дальше?", MENU)

    except NotEnoughCoins as e:
        send(chat, f"Не хватает коинов: нужно <b>{e.need}</b>, есть <b>{e.have}</b>.", buy_kb())
    except GpuError as e:
        if charged:
            store.refund(u, job.coins, f"осечка генерации: {str(e)[:80]}")
        store.job_done(jid, error=str(e)[:300])
        send(chat, f"Не получилось: {str(e)[:200]}\n\nКоины вернула — <b>{store.balance(u)}</b>.", MENU)
    except Exception as e:
        if charged:
            store.refund(u, job.coins, "внутренняя ошибка")
        store.job_done(jid, error=str(e)[:300])
        print("СБОЙ:", traceback.format_exc()[:800], flush=True)
        send(chat, f"Что-то сломалось у меня. Коины вернула — <b>{store.balance(u)}</b>.", MENU)
    finally:
        with lock:
            busy.discard(u)


def launch(chat, u, kind, prompt, photos=None):
    with lock:
        if u in busy:
            send(chat, "Одно задание уже считается. Дождись его, потом запускай следующее.")
            return
        busy.add(u)
    threading.Thread(target=run_job, args=(chat, u, kind, prompt, photos or []), daemon=True).start()


# ---------- разбор сообщений ----------

def on_start(chat, u, username, arg):
    invited_by = None
    if arg:
        inviter = store.by_ref_code(arg.strip())
        if inviter and inviter["tg_id"] != u:
            invited_by = inviter["tg_id"]
    user, is_new = store.ensure_user(u, username, welcome=pricing.WELCOME_COINS,
                                     invited_by=invited_by)
    if is_new and invited_by:
        store.credit(invited_by, pricing.REFERRAL_INVITER, "welcome", f"привёл {u}")
        store.credit(u, pricing.REFERRAL_INVITEE, "welcome", "пришёл по приглашению")
        send(invited_by, f"По твоей ссылке пришёл человек. +{pricing.REFERRAL_INVITER} {pricing.СИМВОЛ}.")
    # Нижнее меню и inline-кнопки нельзя повесить на одно сообщение:
    # Телеграм принимает только одну разметку. Поэтому сначала короткое
    # сообщение, которое ставит нижнее меню, следом — само приветствие.
    if is_new:
        send(chat, f"Добро пожаловать. Дарю "
                   f"<b>{emoji.баланс(pricing.WELCOME_COINS)}</b> на пробу.",
             ui.НИЖНЕЕ)
    send(chat, greet(u, username), MENU)


def показать_работы(chat, u, сколько=5):
    """«Мои работы»: присылаем последние готовые ещё раз.

    Сначала пробуем telegram file_id — пересылка по нему бесплатна и
    мгновенна. Не вышло (телеграм файл забыл, а он имеет на это право)
    — поднимаем байты из нашего архива. Нет ни того, ни другого —
    честно говорим, что работа была, но показать нечем, вместо того
    чтобы делать вид, будто её не существовало.
    """
    работы = store.works(u, сколько)
    if not работы:
        send(chat, "Работ пока нет. Сделаем первую?", MENU)
        return
    send(chat, f"<b>Твои работы</b> — последние {len(работы)}")
    for j in работы:
        подпись = pricing.job(j["kind"]).title
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
        send(chat, f"· {подпись} — файл не сохранился, показать нечем.")
    send(chat, "Что дальше?", MENU)


def показать_кабинет(chat, u, имя=None):
    send(chat,
         ui.текст_кабинета(store.balance(u), store.сводка(u), store.quality(u), имя),
         ui.меню_кабинета(store.quality(u)))


def показать_баланс(chat, u):
    показать_кабинет(chat, u)


def позвать_друзей(chat, u):
    code = store.user(u)["ref_code"]
    me = os.environ.get("ROCKET_BOT_NAME", brand.BOT.lstrip("@"))
    send(chat,
         f"Зови друзей: <code>https://t.me/{me}?start={code}</code>\n"
         f"За каждого — <b>{pricing.REFERRAL_INVITER}</b> {pricing.СИМВОЛ}, "
         f"ему самому — <b>{pricing.REFERRAL_INVITEE}</b>.", MENU)


# Нижнее меню шлёт обычный текст, а не callback. Без этой таблицы все
# четыре кнопки падали в «Сначала выбери, что делаем» — клавиатура
# висела на экране и не делала ничего.
НИЖНИЕ_КНОПКИ = {
    "Создать":         lambda chat, u: send(chat, "Что делаем?", MENU),
    "Баланс":          показать_баланс,
    "Мои работы":      показать_работы,
    "Позвать друзей":  позвать_друзей,
}


def on_text(chat, u, text):
    кнопка = НИЖНИЕ_КНОПКИ.get(text.strip())
    if кнопка:
        waiting.pop(u, None)      # передумал на полпути — это нормально
        кнопка(chat, u)
        return

    st = waiting.pop(u, None)
    if not st:
        send(chat, "Сначала выбери, что делаем.", MENU)
        return
    kind = st["kind"]
    job = pricing.job(kind)
    if job.нужно_фото and not st.get("фото"):
        waiting[u] = st
        send(chat, ui.просьба_о_фото(job))
        return
    launch(chat, u, kind, text.strip(), st.get("фото") or [])


def on_photo(chat, u, file_id):
    """Приём снимка. Копим до максимума, который берёт модель.

    Копим, а не запускаем на первом: у фото-по-фото моделей до трёх
    референсов, и запуск на первом отбирал бы у человека остальные два
    молча."""
    st = waiting.get(u)
    if not st:
        send(chat, "Сначала выбери сценарий или режим.", MENU)
        return
    job = pricing.job(st["kind"])
    собрано = st.setdefault("фото", [])
    if len(собрано) >= job.макс_фото > 0:
        send(chat, f"Больше {job.макс_фото} модель не возьмёт.")
        return

    f = tg("getFile", file_id=file_id).get("result", {})
    path = f.get("file_path")
    if not path:
        send(chat, "Не смогла забрать фото, пришли ещё раз.")
        return
    data = requests.get(f"https://api.telegram.org/file/bot{TOKEN}/{path}", timeout=60).content
    try:
        name = gpu.upload(f"ref{len(собрано)+1}.jpg", data)
    except GpuError as e:
        send(chat, f"Не приняла фото: {str(e)[:150]}")
        return
    собрано.append(name)

    # Пришли из каталога — промпт готов. Набрали максимум — запускаем
    # сами, не заставляя жать лишнюю кнопку.
    if st.get("scene"):
        sc = catalog.scene(st["scene"])
        if len(собрано) >= job.макс_фото:
            waiting.pop(u, None)
            launch(chat, u, sc.job, sc.prompt, собрано)
            return
        send(chat, ui.просьба_о_фото(job, len(собрано)),
             ui.меню_сбора_фото(sc, len(собрано)))
        return

    send(chat, f"Снимков принято: {len(собрано)}. "
               "Теперь напиши, что с ними сделать — <b>по-английски</b>.")


def on_callback(cb):
    data = cb["data"]; chat = cb["message"]["chat"]["id"]
    u = cb["from"]["id"]; cid = cb["id"]
    store.ensure_user(u, cb["from"].get("username"), welcome=pricing.WELCOME_COINS)

    if data == "m:menu":
        answer(cid); send(chat, "Что делаем?", MENU); return

    if data in ("m:balance", "m:cab"):
        answer(cid); показать_кабинет(chat, u, cb["from"].get("first_name")); return

    if data == "m:works":
        answer(cid); показать_работы(chat, u); return

    if data == "m:ref":
        answer(cid); позвать_друзей(chat, u); return

    if data == "m:quality":
        answer(cid)
        send(chat, ui.текст_качества(), ui.меню_качества(store.quality(u))); return

    if data.startswith("q:"):
        qid = data.split(":", 1)[1]
        try:
            q = pricing.quality(qid)
        except KeyError:
            answer(cid, "Такого качества нет"); return
        store.set_quality(u, qid)
        answer(cid, f"Теперь {q['title']}")
        показать_кабинет(chat, u, cb["from"].get("first_name")); return

    if data == "m:forget":
        answer(cid)
        send(chat, ui.текст_удаления(store.сводка(u)), ui.меню_удаления()); return

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
        send(chat, f"Удалено: работ — <b>{итог['работ']}</b>, "
                   f"записей — <b>{итог['записей']}</b>.\n"
                   f"Файлы работ стёрты с диска.\n\n"
                   f"<i>/start заведёт всё заново, с нуля.</i>")
        return

    if data == "m:buy":
        answer(cid); send(chat, price_list(), buy_kb()); return

    if data.startswith("buy:"):
        answer(cid)
        p = pricing.pack(data.split(":", 1)[1])
        send(chat, ui.текст_пакета(p), ui.меню_способов(p["id"]))
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
            answer(cid, "Крипта пока недоступна")
            send(chat, f"Оплата криптой не настроена: {e}\n\n"
                       "Пока можно оплатить звёздами.", ui.меню_способов(pid))
            return
        answer(cid)
        store.remember_invoice(u, сч["invoice_id"], pid)
        send(chat, f"Счёт на <b>${сч['usd']}</b> создан. Живёт час.",
             ui.клава([[ui.кнопка("Оплатить", url=сч["url"], иконка=emoji.КАРТА)],
                       [ui.кнопка("Я оплатил, проверь", f"chk:{сч['invoice_id']}")],
                       [ui.кнопка("Назад", "m:buy", emoji.ВЛЕВО)]]))
        return

    if data.startswith("chk:"):
        инв = data.split(":", 1)[1]
        try:
            статус = payments.проверить_счёт(инв)
        except payments.ОшибкаОплаты as e:
            answer(cid, "Не смогла проверить"); return
        if статус != "paid":
            answer(cid, "Оплата ещё не пришла" if статус == "active" else "Счёт истёк")
            return
        зачислено = зачислить_крипту(u, инв)
        answer(cid, "Зачислено" if зачислено else "Уже зачислено раньше")
        if зачислено:
            send(chat, f"Оплата пришла. Баланс: "
                       f"<b>{emoji.баланс(store.balance(u))}</b>", MENU)
        return

    if data.startswith("c:"):
        answer(cid)
        cat = catalog.category(data.split(":", 1)[1])
        send(chat, ui.шапка_категории(cat), ui.меню_категории(cat))
        return

    if data.startswith("sc:"):
        answer(cid)
        sc = catalog.scene(data.split(":", 1)[1])
        send(chat, ui.шапка_сценария(sc, store.balance(u)), ui.меню_сценария(sc))
        return

    if data.startswith("go:"):
        # Проверка баланса ЗДЕСЬ, а не на показе сценария: между показом
        # и нажатием человек мог потратить коины в другом окне.
        sc = catalog.scene(data.split(":", 1)[1])
        есть = store.balance(u)
        if есть < sc.coins:
            answer(cid, f"Нужно {sc.coins} {pricing.СИМВОЛ}, на балансе {есть}")
            send(chat, ui.текст_оплаты(), ui.меню_оплаты())
            return
        answer(cid)
        job = pricing.job(sc.job)
        if not job.нужно_фото:
            launch(chat, u, sc.job, sc.prompt, [])
            return
        waiting[u] = {"kind": sc.job, "scene": sc.key, "фото": []}
        send(chat, ui.просьба_о_фото(job), ui.меню_сбора_фото(sc, 0))
        return

    if data.startswith("run:"):
        # Человек сказал «хватит», не добрав до максимума.
        sc = catalog.scene(data.split(":", 1)[1])
        st = waiting.get(u)
        if not st or not st.get("фото"):
            answer(cid, "Сначала пришли фото"); return
        answer(cid)
        waiting.pop(u, None)
        launch(chat, u, sc.job, sc.prompt, st["фото"])
        return

    if data.startswith("undo:"):
        sc = catalog.scene(data.split(":", 1)[1])
        st = waiting.get(u)
        if st and st.get("фото"):
            st["фото"].pop()
        n = len(st["фото"]) if st else 0
        answer(cid, "Убрала")
        send(chat, ui.просьба_о_фото(pricing.job(sc.job), n),
             ui.меню_сбора_фото(sc, n))
        return

    if data == "m:free":
        answer(cid)
        send(chat, ui.текст_своего_промпта(), ui.меню_своего_промпта())
        return

    if data.startswith("free:"):
        kind = data.split(":", 1)[1]
        j = pricing.job(kind)
        answer(cid)
        waiting[u] = {"kind": kind, "фото": []}
        хвост = ("\n\n" + ui.сколько_фото(j) + " Сначала фото, потом описание."
                 if j.нужно_фото else "")
        send(chat, f"<b>{j.title}</b> — {j.coins} {pricing.СИМВОЛ}{хвост}\n\n"
                   "Опиши словами, что сделать. <b>По-английски.</b>", MENU)
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
        send(chat, "Оплата прошла, но я не поняла, какой пакет. "
                   "Напиши в поддержку — разберёмся руками, деньги не пропадут.")
        print("ОПЛАТА БЕЗ ПАКЕТА:", u, оплата, flush=True)
        return
    # Идентификатор списания сохраняем ОБЯЗАТЕЛЬНО: без него звёзды
    # не вернуть, refundStarPayment требует именно его.
    store.credit(u, p["coins"], "paid", f"звёзды, пакет {p['id']}",
                 meta={"charge": оплата.get("telegram_payment_charge_id"),
                       "stars": оплата.get("total_amount")})
    send(chat, f"Спасибо. Зачислено <b>{emoji.баланс(p['coins'])}</b>.\n"
               f"Баланс: <b>{emoji.баланс(store.balance(u))}</b>", MENU)


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

    if "successful_payment" in msg:
        store.ensure_user(u, username, welcome=pricing.WELCOME_COINS)
        on_paid(chat, u, msg["successful_payment"]); return

    if "photo" in msg:
        store.ensure_user(u, username, welcome=pricing.WELCOME_COINS)
        on_photo(chat, u, msg["photo"][-1]["file_id"]); return

    text = (msg.get("text") or "").strip()
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        on_start(chat, u, username, parts[1] if len(parts) > 1 else None); return
    if text in ("/menu", "/help"):
        store.ensure_user(u, username, welcome=pricing.WELCOME_COINS)
        send(chat, "Что делаем?", MENU); return
    if text == "/prices":
        send(chat, price_list(), MENU); return
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

    store.ensure_user(u, username, welcome=pricing.WELCOME_COINS)
    on_text(chat, u, text)


def main():
    if not TOKEN:
        sys.exit("нет ROCKET_BOT_TOKEN")
    me = tg("getMe").get("result", {})
    print(f"бот @{me.get('username')} запущен", flush=True)
    if not gpu.alive():
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
