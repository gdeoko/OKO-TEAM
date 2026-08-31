# -*- coding: utf-8 -*-
"""Чистка ветки Публикация перед новой выкладкой месяца.

Старый контент лежит двумя пачками: часть выложена с acc1 (@ktodaniel),
часть с acc4 (@okohelp). Убираем только публикации: фотографии и длинные
тексты постов. Короткие живые реплики и всё, что писал клиент, остаётся.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client

from predohranitel import проверить_или_выйти
проверить_или_выйти()   # при живой службе подключаться нельзя

ACC = os.getenv("АКК", "acc4")
ФОРУМ = -1003575806235
ВЕТКА = int(os.getenv("ВЕТКА", "9"))
ВРЕМЕНКА = f"/tmp/oko_chist_{ACC}"
НАШИ = {"okohelp", "ktodaniel", "okomanager", "gdedaniel"}
УДАЛЯТЬ = os.getenv("УДАЛЯТЬ") == "да"


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    под_нож, оставляем = [], []
    async for m in app.get_chat_history(ФОРУМ, limit=1500):
        своя = (getattr(m, "message_thread_id", None) == ВЕТКА
                or m.reply_to_message_id == ВЕТКА)
        if not своя:
            continue
        ник = getattr(m.from_user, "username", "") or ""
        текст = (m.caption or m.text or "").strip()
        if ник not in НАШИ:
            оставляем.append((m.id, "чужой"))
            continue
        файл = bool(m.photo or m.document or m.video or m.animation)
        публикация = файл or len(текст) > 200
        (под_нож if публикация else оставляем).append((m.id, текст[:40]))
    print(f"под нож {len(под_нож)}, остаётся {len(оставляем)}")
    for и, т in оставляем[:15]:
        print("  остаётся", и, т)
    if УДАЛЯТЬ and под_нож:
        иды = [и for и, _ in под_нож]
        for i in range(0, len(иды), 90):
            await app.delete_messages(ФОРУМ, иды[i:i+90])
            await asyncio.sleep(2)
        print(f"удалено {len(иды)}")
    await app.stop()

asyncio.run(main())
