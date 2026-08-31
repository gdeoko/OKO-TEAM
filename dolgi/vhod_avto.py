# -*- coding: utf-8 -*-
"""Вход в Телеграм одним процессом: запрашивает код, ждёт его в файле,
входит, при 2FA берёт пароль из файла, читает чат по долгам и выходит.
Сессия своя (vladelec), сессии службы не трогаются."""
import sys, os, json, asyncio
sys.path.insert(0, "/opt/oko-agents")
from config import config
from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded

TEL = "+79779955566"
BAZA = "/opt/oko-agents/data_runtime/dolgi"
FKOD = os.path.join(BAZA, ".kod")
FPAR = os.path.join(BAZA, ".parol")
SSL = "https://t.me/+ydd6oUeXJ38wODgy"
ZHDEM = 420   # сколько секунд ждём код


async def chitat(app):
    me = await app.get_me()
    print("аккаунт:", me.username, me.id, flush=True)
    res = {"me": me.username, "chat": None, "messages": [], "dialogs": []}
    async for d in app.get_dialogs(limit=500):
        c = d.chat
        res["dialogs"].append({"id": c.id, "type": str(c.type),
                               "title": c.title or "", "username": c.username or ""})
    print("диалогов:", len(res["dialogs"]), flush=True)
    tid = None
    try:
        ch = await app.get_chat(SSL)
        tid = getattr(ch, "id", None)
        print("чат по ссылке:", getattr(ch, "title", "?"), "| id:", tid, flush=True)
    except Exception as ex:
        print("ссылка не открылась:", type(ex).__name__, ex, flush=True)
    if tid:
        info = await app.get_chat(tid)
        res["chat"] = {"id": info.id, "title": info.title,
                       "members": getattr(info, "members_count", None)}
        async for m in app.get_chat_history(tid, limit=5000):
            t = m.text or m.caption or ""
            f = ""
            if m.document: f = getattr(m.document, "file_name", "файл")
            elif m.photo:  f = "фото"
            if not t and not f: continue
            res["messages"].append({
                "id": m.id, "date": str(m.date),
                "from": (m.from_user.username or m.from_user.first_name) if m.from_user else "",
                "text": t, "file": f})
        print("сообщений прочитано:", len(res["messages"]), flush=True)
    json.dump(res, open(os.path.join(BAZA, "tg_chat.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("готово, записано в tg_chat.json", flush=True)


async def main():
    for f in (FKOD, FPAR):
        pass
    if os.path.exists(FKOD):
        os.remove(FKOD)
    app = Client("vladelec", api_id=config.PYROGRAM_API_ID,
                 api_hash=config.PYROGRAM_API_HASH, workdir=BAZA, no_updates=True)
    await app.connect()

    # если уже авторизованы - сразу читаем
    try:
        me = await app.get_me()
        print("уже авторизованы:", me.username, flush=True)
        await chitat(app)
        await app.disconnect()
        return
    except Exception:
        pass

    r = await app.send_code(TEL)
    print("КОД ЗАПРОШЕН, жду его в файле .kod (до", ZHDEM, "секунд)", flush=True)
    kod = None
    for i in range(ZHDEM):
        if os.path.exists(FKOD):
            kod = open(FKOD).read().strip()
            if kod:
                break
        await asyncio.sleep(1)
    if not kod:
        print("код так и не появился", flush=True)
        await app.disconnect(); return
    print("код получен, вхожу", flush=True)
    try:
        u = await app.sign_in(TEL, r.phone_code_hash, kod)
        print("вошли:", getattr(u, "username", None), flush=True)
    except SessionPasswordNeeded:
        print("нужен облачный пароль, пробую варианты", flush=True)
        # ждём файл с паролями (по одному в строке), до 6 минут
        for _ in range(360):
            if os.path.exists(FPAR) and open(FPAR).read().strip():
                break
            await asyncio.sleep(1)
        varianty = [x.strip() for x in open(FPAR, encoding="utf-8").read().splitlines() if x.strip()]
        u = None
        for p in varianty:
            try:
                u = await app.check_password(p)
                print("вошли по паролю (вариант принят)", flush=True)
                break
            except Exception as ex:
                print("пароль не подошёл:", type(ex).__name__, flush=True)
        if not u:
            print("ни один пароль не подошёл", flush=True)
            await app.disconnect(); return
    except Exception as ex:
        print("не вошли:", type(ex).__name__, ex, flush=True)
        await app.disconnect(); return
    finally:
        if os.path.exists(FKOD):
            os.remove(FKOD)
    await chitat(app)
    await app.disconnect()

asyncio.run(main())
