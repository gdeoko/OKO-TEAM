# -*- coding: utf-8 -*-
"""Полная чистка ветки Публикация: убираем ВСЁ наше, чужое не трогаем.

Запускать при остановленной службе. Сообщения клиента и руководства
остаются на месте, удаляются только наши публикации и служебные реплики.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from config import config
from core import tg_net
from pyrogram import Client
from predohranitel import проверить_или_выйти
проверить_или_выйти()

ACC = os.getenv("АКК", "acc4")
ФОРУМ = -1003575806235
ВЕТКА = int(os.getenv("ВЕТКА", "9"))
НАШИ = {"okohelp", "ktodaniel", "okomanager", "gdedaniel"}
УДАЛЯТЬ = os.getenv("УДАЛЯТЬ") == "да"
В = "/tmp/oko_clean_%s" % ACC


async def main():
    os.makedirs(В, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), "%s.session%s" % (ACC, к))
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(В, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=В, **tg_net.как_ходить(ACC))
    await app.start()
    под_нож, чужие = [], []
    async for m in app.get_chat_history(ФОРУМ, limit=3000):
        своя = (getattr(m, "message_thread_id", None) == ВЕТКА
                or m.reply_to_message_id == ВЕТКА)
        if not своя:
            continue
        ник = getattr(m.from_user, "username", "") or ""
        if ник in НАШИ:
            под_нож.append(m.id)
        else:
            чужие.append((m.id, " ".join((m.text or m.caption or "").split())[:70]))
    print("наших под нож: %d, чужих остаётся: %d" % (len(под_нож), len(чужие)))
    for и, т in чужие[:20]:
        print("   остаётся", и, т)
    if УДАЛЯТЬ and под_нож:
        for i in range(0, len(под_нож), 90):
            await app.delete_messages(ФОРУМ, под_нож[i:i + 90])
            await asyncio.sleep(2)
        print("удалено:", len(под_нож))
    await app.stop()

asyncio.run(main())
