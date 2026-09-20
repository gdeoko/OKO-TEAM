#!/usr/bin/env python3
"""Телеграм-бот генерации. Фото и видео по запросу, оплата жетонами.

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

import pricing
import catalog
import prompts
import emoji
import ui
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "brand-amberry"))
import brand
from store import Store, NotEnoughHearts
from gpu import Gpu, GpuError

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TOKEN}"
ADMINS = {int(x) for x in os.environ.get("ROCKET_ADMINS", "").replace(" ", "").split(",") if x}

store = Store(os.environ.get("ROCKET_DB", "rocket_bot.db"))
gpu = Gpu(os.environ.get("ROCKET_GPU_URL", ""),
          os.environ.get("ROCKET_GPU_USER", "rocket"),
          os.environ.get("ROCKET_GPU_PASS", ""))

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
        lines.append(f"{j.title} — <b>{j.hearts}</b> ♥ · {j.note}")
    lines.append("")
    for q in pricing.QUALITY[1:]:
        доп = f"+{q['hearts']} ♥" if q["hearts"] else "бесплатно"
        lines.append(f"{q['title']} — {доп}")
    lines.append("\n<b>Подписки нет.</b> Платишь только за то, что сделал: "
                 "ни абонентской платы, ни сгорающих остатков, "
                 "ни функций за замком.")
    lines.append("\n<b>Пакеты сердечек</b> — не сгорают никогда\n")
    for p in pricing.PACKS:
        lines.append(f"{p['hearts']} ♥ — <b>{p['rub']} ₽</b>"
                     f"  <s>{p['market_rub']} ₽ у других</s>")
    lines.append(f"\n<i>Сердечко стоит от {pricing.rub_per_heart('p7'):.0f} до "
                 f"{pricing.rub_per_heart('p1'):.0f} ₽ — смотря какой пакет.</i>")
    return "\n".join(lines)


def buy_kb():
    rows = []
    for p in pricing.PACKS:
        rows.append([(f"{p['hearts']} ♥ — {p['rub']} ₽", f"buy:{p['id']}")])
    rows.append([("Назад", "m:menu")])
    return kb(rows)


# ---------- генерация ----------



def run_job(chat, u, kind, prompt, photos=None):
    """Считает задание и отдаёт результат. Крутится в отдельном потоке."""
    job = pricing.job(kind)
    jid = uuid.uuid4().hex[:10]
    charged = False
    try:
        store.spend(u, job.hearts, f"{job.title}", meta={"job": jid})
        charged = True
        store.job_start(jid, u, kind, prompt, job.hearts)

        m = send(chat, f"Считаю {job.title.lower()}…")
        mid = m.get("result", {}).get("message_id")

        # steps=4 и cfg=1 — не опечатка. У второго поколения моделей
        # (Qwen-Rapid-AIO, wan2.2-rapid-mega-aio) ускорители встроены в
        # сборку, и обычные 26 шагов при cfg 4 их ЛОМАЮТ.
        params = {"prompt": prompt, "size": "vert",
                  "steps": 4, "cfg": 1.0, "seed": 0,
                  "neg": prompts.НЕГАТИВ}
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

        cap = f"{job.title} · {res.get('sec')} с · осталось {store.balance(u)} ♥"
        if files[0].lower().endswith((".webp", ".gif", ".mp4")):
            tg("sendAnimation", chat_id=chat, caption=cap,
               _files={"animation": (files[0], data)})
        else:
            tg("sendPhoto", chat_id=chat, caption=cap,
               _files={"photo": (files[0], data)})
        store.job_done(jid, file=files[0])
        send(chat, "Что дальше?", MENU)

    except NotEnoughHearts as e:
        send(chat, f"Не хватает жетонов: нужно <b>{e.need}</b>, есть <b>{e.have}</b>.", buy_kb())
    except GpuError as e:
        if charged:
            store.refund(u, job.hearts, f"осечка генерации: {str(e)[:80]}")
        store.job_done(jid, error=str(e)[:300])
        send(chat, f"Не получилось: {str(e)[:200]}\n\nЖетоны вернула — <b>{store.balance(u)}</b>.", MENU)
    except Exception as e:
        if charged:
            store.refund(u, job.hearts, "внутренняя ошибка")
        store.job_done(jid, error=str(e)[:300])
        print("СБОЙ:", traceback.format_exc()[:800], flush=True)
        send(chat, f"Что-то сломалось у меня. Жетоны вернула — <b>{store.balance(u)}</b>.", MENU)
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
    user, is_new = store.ensure_user(u, username, welcome=pricing.WELCOME_HEARTS,
                                     invited_by=invited_by)
    if is_new and invited_by:
        store.credit(invited_by, pricing.REFERRAL_INVITER, "welcome", f"привёл {u}")
        store.credit(u, pricing.REFERRAL_INVITEE, "welcome", "пришёл по приглашению")
        send(invited_by, f"По твоей ссылке пришёл человек. +{pricing.REFERRAL_INVITER} ♥.")
    # Нижнее меню и inline-кнопки нельзя повесить на одно сообщение:
    # Телеграм принимает только одну разметку. Поэтому сначала короткое
    # сообщение, которое ставит нижнее меню, следом — само приветствие.
    if is_new:
        send(chat, f"Добро пожаловать. Дарю "
                   f"<b>{emoji.баланс(pricing.WELCOME_HEARTS)}</b> на пробу.",
             ui.НИЖНЕЕ)
    send(chat, greet(u, username), MENU)


def on_text(chat, u, text):
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
    store.ensure_user(u, cb["from"].get("username"), welcome=pricing.WELCOME_HEARTS)

    if data == "m:menu":
        answer(cid); send(chat, "Что делаем?", MENU); return

    if data == "m:balance":
        answer(cid)
        h = store.history(u, 5)
        lines = [f"Баланс: <b>{store.balance(u)} сердечек</b>", ""]
        if h:
            lines.append("<b>Последние</b>")
            for j in h:
                mark = "ok" if j["state"] == "ok" else "сбой"
                lines.append(f"· {pricing.job(j['kind']).title} — {mark}")
        code = store.user(u)["ref_code"]
        me = os.environ.get("ROCKET_BOT_NAME", brand.BOT.lstrip("@"))
        lines.append(f"\nЗови друзей: <code>https://t.me/{me}?start={code}</code>")
        lines.append(f"За каждого — <b>{pricing.REFERRAL_INVITER}</b> ♥.")
        send(chat, "\n".join(lines), MENU); return

    if data == "m:buy":
        answer(cid); send(chat, price_list(), buy_kb()); return

    if data.startswith("buy:"):
        answer(cid, "Оплата скоро")
        p = pricing.pack(data.split(":", 1)[1])
        send(chat, f"Пакет <b>{p['hearts']} сердечек</b> за "
                   f"<b>{p['rub']} ₽</b>. Не сгорают.\n"
                   f"<i>У других тот же объём — {p['market_rub']} ₽.</i>\n\n"
                   "Приём оплаты ещё подключается — напиши в поддержку.", MENU)
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
        # и нажатием человек мог потратить сердечки в другом окне.
        sc = catalog.scene(data.split(":", 1)[1])
        есть = store.balance(u)
        if есть < sc.hearts:
            answer(cid, f"Нужно {sc.hearts} ♥, на балансе {есть}")
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
        send(chat, f"<b>{j.title}</b> — {j.hearts} ♥{хвост}\n\n"
                   "Опиши словами, что сделать. <b>По-английски.</b>", MENU)
        return

    answer(cid)


def on_update(up):
    if "callback_query" in up:
        on_callback(up["callback_query"]); return
    msg = up.get("message") or up.get("edited_message")
    if not msg:
        return
    chat = msg["chat"]["id"]; u = msg["from"]["id"]
    username = msg["from"].get("username")

    if "photo" in msg:
        store.ensure_user(u, username, welcome=pricing.WELCOME_HEARTS)
        on_photo(chat, u, msg["photo"][-1]["file_id"]); return

    text = (msg.get("text") or "").strip()
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        on_start(chat, u, username, parts[1] if len(parts) > 1 else None); return
    if text in ("/menu", "/help"):
        store.ensure_user(u, username, welcome=pricing.WELCOME_HEARTS)
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
                   f"Потрачено сердечек: {s['tokens_spent']}\n"
                   f"Карта: {free}/{total} ГБ свободно, очередь {q}")
        return

    store.ensure_user(u, username, welcome=pricing.WELCOME_HEARTS)
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
            r = requests.get(f"{API}/getUpdates",
                             params={"timeout": 30, "offset": offset}, timeout=45).json()
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
