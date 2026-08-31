# -*- coding: utf-8 -*-
"""Чтение чата по долгам аккаунтом владельца (acc1 @ktodaniel).
Запускать ТОЛЬКО при погашенной службе oko-agents (правило 6j).
Ничего не отправляет, только читает и складывает в файл."""
import sys, json, asyncio, os
sys.path.insert(0, "/opt/oko-agents")
from config import config
from pyrogram import Client

SSL = "https://t.me/+ydd6oUeXJ38wODgy"
OUT = "/opt/oko-agents/data_runtime/dolgi/tg_chat.json"

async def main():
    os.makedirs("/opt/oko-agents/data_runtime/dolgi", exist_ok=True)
    app = Client("acc1", api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=config.SESSIONS_DIR, no_updates=True)
    await app.start()
    me = await app.get_me()
    print("вошли как:", me.username, me.id)

    # 1. Ищем чат среди диалогов, чтобы не трогать инвайт-ссылку лишний раз
    target = None
    dialogs = []
    async for d in app.get_dialogs(limit=400):
        c = d.chat
        dialogs.append({"id": c.id, "type": str(c.type), "title": c.title or "",
                        "username": c.username or ""})
    print("всего диалогов:", len(dialogs))

    # 2. Пробуем открыть чат по ссылке
    try:
        ch = await app.get_chat(SSL)
        target = getattr(ch, "id", None)
        print("чат по ссылке:", getattr(ch, "title", "?"), "id:", target,
              "участник:" , target is not None)
    except Exception as e:
        print("по ссылке не открылся:", type(e).__name__, e)

    res = {"me": me.username, "dialogs": dialogs, "messages": [], "chat": None}

    if target:
        try:
            info = await app.get_chat(target)
            res["chat"] = {"id": info.id, "title": info.title,
                           "members": getattr(info, "members_count", None)}
            async for m in app.get_chat_history(target, limit=3000):
                if not (m.text or m.caption):
                    if m.document or m.photo:
                        res["messages"].append({
                            "id": m.id, "date": str(m.date),
                            "from": (m.from_user.username or m.from_user.first_name) if m.from_user else "",
                            "text": "", "file": getattr(m.document, "file_name", "фото/файл") if m.document else "фото"})
                    continue
                res["messages"].append({
                    "id": m.id, "date": str(m.date),
                    "from": (m.from_user.username or m.from_user.first_name) if m.from_user else "",
                    "text": (m.text or m.caption)})
            print("сообщений прочитано:", len(res["messages"]))
        except Exception as e:
            print("историю прочитать не вышло:", type(e).__name__, e)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print("записано в", OUT)
    await app.stop()

asyncio.run(main())
