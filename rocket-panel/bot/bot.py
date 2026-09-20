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
from store import Store, NotEnoughTokens
from gpu import Gpu, GpuError

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TOKEN}"
ADMINS = {int(x) for x in os.environ.get("ROCKET_ADMINS", "").replace(" ", "").split(",") if x}

store = Store(os.environ.get("ROCKET_DB", "rocket_bot.db"))
gpu = Gpu(os.environ.get("ROCKET_GPU_URL", ""),
          os.environ.get("ROCKET_GPU_USER", "rocket"),
          os.environ.get("ROCKET_GPU_PASS", ""))

# что пользователь делает прямо сейчас: tg_id -> {"kind":..., "photo":...}
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

MENU = kb([
    [("Фото", "m:photo"), ("Фото по образцу", "m:photo_ref")],
    [("Ролик", "m:video"), ("Оживить фото", "m:animate")],
    [("Баланс", "m:balance"), ("Пополнить", "m:buy")],
])


def greet(u):
    return (
        "<b>Здесь героини оживают.</b>\n\n"
        "Опиши словами, что хочешь увидеть — получишь фото или ролик.\n"
        "Можно прислать своё фото: поза, сцена и одежда меняются, лицо остаётся.\n\n"
        f"На старте дарю <b>{pricing.WELCOME_TOKENS} жетонов</b> — хватит попробовать.\n\n"
        f"Баланс: <b>{store.balance(u)} жетонов</b>"
    )


def price_list():
    lines = ["<b>Сколько стоит</b>\n"]
    for j in pricing.JOBS.values():
        lines.append(f"{j.title} — <b>{j.tokens}</b> жет. · {j.note}")
    for план, свойства in pricing.PLANS.items():
        лицо = " · лицо героини не плывёт" if свойства["лицо_держится"] else ""
        lines.append(f"\n<b>{план}</b> — {свойства['параллельно']} генерации разом · "
                     f"очередь {свойства['очередь']} · ролик до {свойства['макс_сек']} с · "
                     f"{свойства['качество']}{лицо}\n")
        for s in pricing.SUBS:
            if s["план"] != план:
                continue
            lines.append(f"{s['title'].split('|')[1].strip()} — <b>{s['rub']} ₽</b>"
                         f"  <i>+{s['tokens']} жет.</i>")
    lines.append("\n<b>Пакеты жетонов</b> — не сгорают никогда\n")
    for p in pricing.PACKS:
        total = pricing.pack_total(p["id"])
        bonus = f"  <i>+{p['bonus']} в подарок</i>" if p["bonus"] else ""
        lines.append(f"{total} жет. — {pricing.rub(p['usd'])} ₽{bonus}")
    return "\n".join(lines)


def buy_kb():
    rows = [[(f"{s['title']} — {s['rub']} ₽", f"sub:{s['id']}")]
            for s in pricing.SUBS]
    for p in pricing.PACKS:
        total = pricing.pack_total(p["id"])
        rows.append([(f"{total} жет. — {pricing.rub(p['usd'])} ₽", f"buy:{p['id']}")])
    rows.append([("Назад", "m:menu")])
    return kb(rows)


# ---------- генерация ----------

SIZES = {"photo": "vert", "photo_ref": "vert", "video": "vert", "animate": "vert"}


def run_job(chat, u, kind, prompt, photo_name=None):
    """Считает задание и отдаёт результат. Крутится в отдельном потоке."""
    job = pricing.job(kind)
    jid = uuid.uuid4().hex[:10]
    charged = False
    try:
        store.spend(u, job.tokens, f"{job.title}", meta={"job": jid})
        charged = True
        store.job_start(jid, u, kind, prompt, job.tokens)

        m = send(chat, f"Считаю {job.title.lower()}…")
        mid = m.get("result", {}).get("message_id")

        params = {"prompt": prompt, "size": SIZES.get(kind, "vert"),
                  "steps": 4, "cfg": 1.0, "seed": 0}
        if kind in ("photo", "photo_ref"):
            params["mode"] = "photo"
            if photo_name:
                params["image"] = photo_name
        else:
            params["mode"] = "video"
            params["secs"] = 2
            if photo_name:
                params["image"] = photo_name

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

        cap = f"{job.title} · {res.get('sec')} с · осталось {store.balance(u)} жет."
        if files[0].lower().endswith((".webp", ".gif", ".mp4")):
            tg("sendAnimation", chat_id=chat, caption=cap,
               _files={"animation": (files[0], data)})
        else:
            tg("sendPhoto", chat_id=chat, caption=cap,
               _files={"photo": (files[0], data)})
        store.job_done(jid, file=files[0])
        send(chat, "Что дальше?", MENU)

    except NotEnoughTokens as e:
        send(chat, f"Не хватает жетонов: нужно <b>{e.need}</b>, есть <b>{e.have}</b>.", buy_kb())
    except GpuError as e:
        if charged:
            store.refund(u, job.tokens, f"осечка генерации: {str(e)[:80]}")
        store.job_done(jid, error=str(e)[:300])
        send(chat, f"Не получилось: {str(e)[:200]}\n\nЖетоны вернула — <b>{store.balance(u)}</b>.", MENU)
    except Exception as e:
        if charged:
            store.refund(u, job.tokens, "внутренняя ошибка")
        store.job_done(jid, error=str(e)[:300])
        print("СБОЙ:", traceback.format_exc()[:800], flush=True)
        send(chat, f"Что-то сломалось у меня. Жетоны вернула — <b>{store.balance(u)}</b>.", MENU)
    finally:
        with lock:
            busy.discard(u)


def launch(chat, u, kind, prompt, photo_name=None):
    with lock:
        if u in busy:
            send(chat, "Одно задание уже считается. Дождись его, потом запускай следующее.")
            return
        busy.add(u)
    threading.Thread(target=run_job, args=(chat, u, kind, prompt, photo_name), daemon=True).start()


# ---------- разбор сообщений ----------

def on_start(chat, u, username, arg):
    invited_by = None
    if arg:
        inviter = store.by_ref_code(arg.strip())
        if inviter and inviter["tg_id"] != u:
            invited_by = inviter["tg_id"]
    user, is_new = store.ensure_user(u, username, welcome=pricing.WELCOME_TOKENS,
                                     invited_by=invited_by)
    if is_new and invited_by:
        store.credit(invited_by, pricing.REFERRAL_INVITER, "welcome", f"привёл {u}")
        store.credit(u, pricing.REFERRAL_INVITEE, "welcome", "пришёл по приглашению")
        send(invited_by, f"По твоей ссылке пришёл человек. +{pricing.REFERRAL_INVITER} жетонов.")
    send(chat, greet(u), MENU)


def on_text(chat, u, text):
    st = waiting.pop(u, None)
    if not st:
        send(chat, "Сначала выбери, что делаем.", MENU)
        return
    kind = st["kind"]
    if kind in ("photo_ref", "animate") and not st.get("photo"):
        waiting[u] = st
        send(chat, "Жду фото. Пришли картинку.")
        return
    launch(chat, u, kind, text.strip(), st.get("photo"))


def on_photo(chat, u, file_id):
    st = waiting.get(u)
    if not st or st["kind"] not in ("photo_ref", "animate"):
        send(chat, "Если хочешь работать с этим фото — выбери «Фото по образцу» или «Оживить фото».", MENU)
        return
    f = tg("getFile", file_id=file_id).get("result", {})
    path = f.get("file_path")
    if not path:
        send(chat, "Не смогла забрать фото, пришли ещё раз.")
        return
    data = requests.get(f"https://api.telegram.org/file/bot{TOKEN}/{path}", timeout=60).content
    try:
        name = gpu.upload("photo.jpg", data)
    except GpuError as e:
        send(chat, f"Не приняла фото: {str(e)[:150]}")
        return
    st["photo"] = name
    waiting[u] = st
    send(chat, "Фото принято. Теперь напиши, что с ним сделать — по-английски.")


def on_callback(cb):
    data = cb["data"]; chat = cb["message"]["chat"]["id"]
    u = cb["from"]["id"]; cid = cb["id"]
    store.ensure_user(u, cb["from"].get("username"), welcome=pricing.WELCOME_TOKENS)

    if data == "m:menu":
        answer(cid); send(chat, "Что делаем?", MENU); return

    if data == "m:balance":
        answer(cid)
        h = store.history(u, 5)
        lines = [f"Баланс: <b>{store.balance(u)} жетонов</b>"]
        active = store.sub_active(u)
        if active:
            row = store.user(u)
            left = max(0, (row["sub_until"] - int(time.time())) // 86400)
            lines.append(f"Подписка <b>{pricing.sub(active)['title']}</b> — "
                         f"{row['sub']} жет. в запасе, ещё {left} дн.")
        lines.append("")
        if h:
            lines.append("<b>Последние</b>")
            for j in h:
                mark = "ok" if j["state"] == "ok" else "сбой"
                lines.append(f"· {pricing.job(j['kind']).title} — {mark}")
        code = store.user(u)["ref_code"]
        me = os.environ.get("ROCKET_BOT_NAME", "bot")
        lines.append(f"\nЗови друзей: <code>https://t.me/{me}?start={code}</code>")
        lines.append(f"За каждого — <b>{pricing.REFERRAL_INVITER}</b> жетонов.")
        send(chat, "\n".join(lines), MENU); return

    if data == "m:buy":
        answer(cid); send(chat, price_list(), buy_kb()); return

    if data.startswith("buy:"):
        answer(cid, "Оплата скоро")
        p = pricing.pack(data.split(":", 1)[1])
        send(chat, f"Пакет <b>{pricing.pack_total(p['id'])} жетонов</b> за "
                   f"<b>{pricing.rub(p['usd'])} ₽</b>. Не сгорают.\n\n"
                   "Приём оплаты ещё подключается — напиши в поддержку.", MENU)
        return

    if data.startswith("sub:"):
        answer(cid, "Оплата скоро")
        s = pricing.sub(data.split(":", 1)[1])
        send(chat, f"<b>{s['title']}</b> — <b>{s['rub']} ₽</b>\n\n"
                   f"· {s['параллельно']} генерации одновременно\n"
                   f"· очередь {s['очередь']}\n"
                   f"· ролик до {s['макс_сек']} секунд\n"
                   + ("· лицо героини не плывёт между кадрами\n" if s["лицо_держится"] else "") +
                   f"· качество до {s['качество']}\n"
                   f"· {s['tokens']} жетонов в запас\n"
                   "<i>Жетоны запаса действуют, пока идёт подписка.</i>\n\n"
                   "Приём оплаты ещё подключается — напиши в поддержку.", MENU)
        return

    if data.startswith("m:"):
        kind = data.split(":", 1)[1]
        answer(cid)
        if kind == "video":
            kind = "video_2"
        if kind in ("photo_ref", "animate"):
            waiting[u] = {"kind": kind}
            send(chat, "Пришли фото, с которым работаем.")
        else:
            waiting[u] = {"kind": kind}
            j = pricing.job(kind)
            send(chat, f"<b>{j.title}</b> — {j.tokens} жет.\n\n"
                       "Опиши словами, что сгенерировать. <b>По-английски.</b>")
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
        store.ensure_user(u, username, welcome=pricing.WELCOME_TOKENS)
        on_photo(chat, u, msg["photo"][-1]["file_id"]); return

    text = (msg.get("text") or "").strip()
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        on_start(chat, u, username, parts[1] if len(parts) > 1 else None); return
    if text in ("/menu", "/help"):
        store.ensure_user(u, username, welcome=pricing.WELCOME_TOKENS)
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
                   f"Потрачено жетонов: {s['tokens_spent']}\n"
                   f"Карта: {free}/{total} ГБ свободно, очередь {q}")
        return

    store.ensure_user(u, username, welcome=pricing.WELCOME_TOKENS)
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
