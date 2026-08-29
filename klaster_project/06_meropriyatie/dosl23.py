# -*- coding: utf-8 -*-
"""Досылка переписанных текстов 2 и 3.

Прошлая проверка сравнивала первые 60 знаков и приняла новые тексты за
повтор: заголовки те же, а тело переписано целиком. Сравниваем полный текст.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client
from pyrogram.enums import ParseMode
from teksty_v3 import ПОСТ_2, ПОСТ_3

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204; ВРЕМЕНКА = "/tmp/oko_d23"


def чисто(т):
    return " ".join(т.replace("<b>", "").replace("</b>", "").split())


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    было = set()
    async for m in app.get_chat_history(ФОРУМ, limit=80):
        т = (m.caption or m.text or "").strip()
        if т:
            было.add(чисто(т))
    for метка, текст in [("текст 2", ПОСТ_2), ("текст 3", ПОСТ_3)]:
        if чисто(текст) in было:
            print(f"{метка}: полное совпадение уже в ветке, пропускаю"); continue
        m = await app.send_message(ФОРУМ, текст, parse_mode=ParseMode.HTML,
                                   message_thread_id=ВЕТКА)
        print(f"{метка}: отправлен id {m.id}")
        await asyncio.sleep(3)
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
