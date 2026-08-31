# -*- coding: utf-8 -*-
"""Отдельный вход в Телеграм аккаунтом владельца НОВОЙ сессией.
Файл сессии свой (vladelec.session), сессии службы не трогаются,
поэтому гасить oko-agents не нужно.

  python3 vhod_tg.py kod            — запросить код
  python3 vhod_tg.py vhod 12345     — ввести код
  python3 vhod_tg.py parol СЛОВО    — ввести облачный пароль (если стоит 2FA)
  python3 vhod_tg.py chitat         — прочитать чат по долгам
"""
import sys, json, asyncio, os
sys.path.insert(0, "/opt/oko-agents")
from config import config
from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded, PhoneCodeInvalid, PhoneCodeExpired

TEL = "+79779955566"
BAZA = "/opt/oko-agents/data_runtime/dolgi"
SOST = os.path.join(BAZA, ".vhod.json")
SSL = "https://t.me/+ydd6oUeXJ38wODgy"


def klient():
    return Client("vladelec", api_id=config.PYROGRAM_API_ID,
                  api_hash=config.PYROGRAM_API_HASH,
                  workdir=BAZA, no_updates=True)


async def kod():
    app = klient()
    await app.connect()
    r = await app.send_code(TEL)
    json.dump({"hash": r.phone_code_hash}, open(SOST, "w"))
    await app.disconnect()
    print("Код отправлен на", TEL, "— тип:", str(r.type))
    print("Придёт в само приложение Телеграм (не СМС), если телефон в сети.")


async def vhod(code):
    app = klient()
    await app.connect()
    h = json.load(open(SOST))["hash"]
    try:
        u = await app.sign_in(TEL, h, code)
        print("вошли:", getattr(u, "username", None), getattr(u, "id", None))
    except SessionPasswordNeeded:
        print("НУЖЕН ОБЛАЧНЫЙ ПАРОЛЬ (2FA). Запусти: parol <слово>")
    except (PhoneCodeInvalid, PhoneCodeExpired) as e:
        print("код не подошёл:", type(e).__name__)
    await app.disconnect()


async def parol(p):
    app = klient()
    await app.connect()
    u = await app.check_password(p)
    print("вошли:", getattr(u, "username", None), getattr(u, "id", None))
    await app.disconnect()


async def chitat():
    app = klient()
    await app.start()
    me = await app.get_me()
    print("аккаунт:", me.username, me.id)
    res = {"me": me.username, "chat": None, "messages": [], "dialogs": []}

    async for d in app.get_dialogs(limit=500):
        c = d.chat
        res["dialogs"].append({"id": c.id, "type": str(c.type),
                               "title": c.title or "", "username": c.username or ""})
    print("диалогов:", len(res["dialogs"]))

    tid = None
    try:
        ch = await app.get_chat(SSL)
        tid = getattr(ch, "id", None)
        print("чат:", getattr(ch, "title", "?"), "| id:", tid)
        if tid is None:
            print("мы НЕ участник, доступен только предпросмотр:",
                  getattr(ch, "title", ""), getattr(ch, "members_count", ""))
    except Exception as ex:
        print("ссылка не открылась:", type(ex).__name__, ex)

    if tid:
        info = await app.get_chat(tid)
        res["chat"] = {"id": info.id, "title": info.title,
                       "members": getattr(info, "members_count", None)}
        async for m in app.get_chat_history(tid, limit=5000):
            t = m.text or m.caption or ""
            f = ""
            if m.document:
                f = getattr(m.document, "file_name", "файл")
            elif m.photo:
                f = "фото"
            if not t and not f:
                continue
            res["messages"].append({
                "id": m.id, "date": str(m.date),
                "from": (m.from_user.username or m.from_user.first_name) if m.from_user else "",
                "text": t, "file": f})
        print("сообщений:", len(res["messages"]))

    json.dump(res, open(os.path.join(BAZA, "tg_chat.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    await app.stop()
    print("записано в", os.path.join(BAZA, "tg_chat.json"))


k = sys.argv[1] if len(sys.argv) > 1 else ""
if k == "kod":      asyncio.run(kod())
elif k == "vhod":   asyncio.run(vhod(sys.argv[2]))
elif k == "parol":  asyncio.run(parol(sys.argv[2]))
elif k == "chitat": asyncio.run(chitat())
else: print(__doc__)
