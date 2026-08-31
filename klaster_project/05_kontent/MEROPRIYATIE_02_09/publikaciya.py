# -*- coding: utf-8 -*-
"""Публикация постов брокер-тура в канал @radialnya и в бота.

Кнопка на посте канала — URL-кнопка «Участвовать», ведёт в бота. Её вправе
поставить админ-аккаунт (acc4/okohelp), права самого бота на канал для этого
не нужны: URL-кнопка не колбэк.

    python3 publikaciya.py <пост.json>

пост.json: {"акк": "acc4", "фото": "путь.png", "текст": "...", "кнопка": {...},
            "закреп": true, "в_бота_рассылка": false}
"""
import asyncio, io, json, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client
from pyrogram.enums import ParseMode
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton

КАНАЛ = -1001532539431
ВРЕМЕНКА = "/tmp/oko_pub"

def клава(данные):
    if not данные: return None
    ряды = []
    for ряд in данные:
        ряды.append([InlineKeyboardButton(к["text"], url=к["url"]) for к in ряд])
    return InlineKeyboardMarkup(ряды)

async def main():
    спец = json.load(io.open(sys.argv[1], encoding="utf-8"))
    acc = спец["акк"]
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{acc}.session{к}")
        if os.path.exists(и): shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(acc, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(acc))
    await app.start()
    км = клава(спец.get("кнопка"))
    if спец.get("фото"):
        m = await app.send_photo(КАНАЛ, спец["фото"], caption=спец["текст"],
                                 parse_mode=ParseMode.HTML, reply_markup=км)
    else:
        m = await app.send_message(КАНАЛ, спец["текст"], parse_mode=ParseMode.HTML,
                                   reply_markup=км, disable_web_page_preview=True)
    print("опубликовано в канал, id", m.id)
    if спец.get("закреп"):
        await app.pin_chat_message(КАНАЛ, m.id, disable_notification=False)
        print("закреплено")
    await app.stop()

asyncio.run(main())
