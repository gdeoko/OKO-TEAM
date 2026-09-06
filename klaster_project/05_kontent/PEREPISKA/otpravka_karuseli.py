# -*- coding: utf-8 -*-
"""Восемь слайдов карусели в ветку Публикация одной группой.

Слайды идут альбомом, чтобы клиент листал их так же, как будет листать
аудитория в Инстаграме. Подпись к альбому это описание публикации.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from config import config
from core import tg_net
from emo import обычные
from nedelya1_chast2 import ЕДИНИЦЫ as ч2
from pyrogram import Client
from pyrogram.enums import ParseMode
from pyrogram.types import InputMediaPhoto

ACC = os.getenv("АКК", "acc4")
ФОРУМ = -1003575806235
ВЕТКА = int(os.getenv("ВЕТКА", "9"))
ВРЕМЕНКА = f"/tmp/oko_kar_{ACC}"
КАДРЫ = "/opt/oko-poster/klaster_nedelya1"


async def main():
    карусель = [е for е in ч2 if е["код"] == "w1-05"][0]
    файлы = [f"{КАДРЫ}/K-01-{н}.png" for н in range(1, 9)]
    нет = [ф for ф in файлы if not os.path.exists(ф)]
    if нет:
        print("НЕ ОТПРАВЛЯЮ, нет слайдов:", нет); return

    подпись = ("<b>31.08 · Instagram · карусель 8 слайдов</b> · рубрика «Не снесут»\n\n"
               + обычные(карусель["текст"]) + "\n\n" + карусель["хештеги"])
    if len(подпись) > 1024:
        подпись = подпись[:1020] + "…"

    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    альбом = [InputMediaPhoto(ф, caption=подпись if н == 0 else None,
                              parse_mode=ParseMode.HTML)
              for н, ф in enumerate(файлы)]
    м = await app.send_media_group(ФОРУМ, альбом, message_thread_id=ВЕТКА)
    print("карусель отправлена, сообщений:", len(м))
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
