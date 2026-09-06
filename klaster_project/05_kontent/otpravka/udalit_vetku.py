# -*- coding: utf-8 -*-
"""Удаляет свои сообщения из ветки рабочего чата, чтобы переслать пакет заново.

Клиент видит ленту согласования, и две версии одного месяца в одной ветке
читаются как беспорядок. Поэтому старую отправку убираем целиком, а чужие
сообщения не трогаем никогда.

    python3 udalit_vetku.py <id ветки> [--правда]

Без флага «--правда» только показывает, что собирается удалить.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents")
from config import config
from core import tg_net
from pyrogram import Client

ACC = "acc1"
ВРЕМЕНКА = "/tmp/oko_tg_del"
ФОРУМ = -1003575806235

ветка = int(sys.argv[1])
правда = "--правда" in sys.argv


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for край in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{край}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    я = await app.get_me()
    мои, чужих = [], 0
    async for m in app.get_chat_history(ФОРУМ, limit=1200):
        if getattr(m, "message_thread_id", None) != ветка:
            continue
        if m.from_user and m.from_user.id == я.id:
            мои.append(m.id)
        else:
            чужих += 1
    мои.sort()
    print(f"ветка {ветка}: моих сообщений {len(мои)}, чужих {чужих}")
    if not мои:
        await app.stop()
        return
    print(f"диапазон id: {мои[0]}..{мои[-1]}")
    if not правда:
        print("это показ без удаления, для удаления добавь --правда")
        await app.stop()
        return
    # Телеграм принимает не больше сотни идентификаторов за раз.
    убрано = 0
    for i in range(0, len(мои), 100):
        кусок = мои[i:i + 100]
        await app.delete_messages(ФОРУМ, кусок)
        убрано += len(кусок)
        await asyncio.sleep(2)
    print(f"удалено {убрано}")
    await app.stop()

asyncio.run(main())
