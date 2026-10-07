# -*- coding: utf-8 -*-
"""Полная выгрузка рабочего форума клиента: все сообщения, все вложения,
имена файлов, размеры и прямые ссылки на сообщения. Для передачи проекта."""
import asyncio, json, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client

ACC = "acc1"; ФОРУМ = -1003575806235
ВРЕМЕНКА = "/tmp/oko_read_full"
ВЫХОД = "/tmp/klaster_chat_polnyi.json"
ССЫЛКА = "https://t.me/c/%d/%d" % (abs(ФОРУМ) - 1000000000000, 0)


def медиа_о(m):
    for поле in ("document", "video", "photo", "audio", "voice", "animation", "video_note", "sticker"):
        о = getattr(m, поле, None)
        if о is None:
            continue
        return {"вид": поле,
                "имя": getattr(о, "file_name", "") or "",
                "байт": getattr(о, "file_size", 0) or 0,
                "тип": getattr(о, "mime_type", "") or "",
                "id": getattr(о, "file_id", "") or ""}
    return None


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()

    темы = {}
    try:
        async for т in app.get_forum_topics(ФОРУМ):
            темы[т.id] = т.title
    except Exception as б:
        print("темы не читаются:", str(б)[:90])

    сообщения = []
    n = 0
    async for m in app.get_chat_history(ФОРУМ):
        кто = ""
        if m.from_user:
            кто = m.from_user.username or m.from_user.first_name or ""
        ветка = getattr(m, "message_thread_id", None)
        зап = {"id": m.id, "когда": str(m.date)[:16], "кто": кто,
               "ветка": темы.get(ветка, ветка),
               "текст": (m.text or m.caption or ""),
               "ссылка": "https://t.me/c/%d/%d" % (abs(ФОРУМ) - 1000000000000, m.id)}
        мд = медиа_о(m)
        if мд:
            зап["файл"] = мд
        сообщения.append(зап)
        n += 1
        if n % 500 == 0:
            print("прочитано:", n, flush=True)
    сообщения.reverse()
    файлов = [с for с in сообщения if "файл" in с]
    json.dump({"темы": темы, "сообщений": len(сообщения), "файлов": len(файлов),
               "сообщения": сообщения}, open(ВЫХОД, "w"), ensure_ascii=False, indent=1)
    print("ИТОГО тем:", len(темы), "| сообщений:", len(сообщения), "| файлов:", len(файлов))
    print("ГОТОВО")
    await app.stop()

asyncio.run(main())
