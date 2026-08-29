# -*- coding: utf-8 -*-
"""Выкладка пяти готовых публикаций: картинка и текст одним сообщением.

Даниэль: «картинка + текст сразу как надо». Значит в ветку уходит ровно то,
что выйдет в канале, а не отдельно кадры и отдельно тексты.

Перед отправкой отрабатывает publikacii.проверить(): длина подписи под лимит
Телеграма, запрещённое слово, язык наших текстов, размер и уникальность
кадров. Импорт модуля ничего не отправляет.
"""
import asyncio, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from publikacii import ПУБЛИКАЦИИ, проверить
from pyrogram import Client
from pyrogram.enums import ParseMode

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204; ВРЕМЕНКА = "/tmp/oko_pub"

ШАПКА = ("✅ <b>Готовые публикации, картинка и текст вместе</b>\n\n"
         "Собрал так, как выйдет в канале. Второй пост в вашей редакции слово в "
         "слово, пятый тоже. На кадре второго поста ваша формулировка «Ключи к "
         "успешным сделкам», на кадре зала ваш логотип на экране.\n\n"
         "Дальше по вашему слову ставим в канал и запускаем именные приглашения "
         "брокерам из вашего списка.")


async def main():
    беды = проверить()
    if беды:
        print("НЕ ОТПРАВЛЯЮ:"); [print("  ·", б) for б in беды]; return
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()

    было = set()
    async for m in app.get_chat_history(ФОРУМ, limit=40):
        т = (m.caption or m.text or "").strip()
        if т and m.photo:
            было.add(" ".join(т.split()))

    if " ".join(ШАПКА.replace("<b>", "").replace("</b>", "").split()) not in было:
        m = await app.send_message(ФОРУМ, ШАПКА, parse_mode=ParseMode.HTML,
                                   message_thread_id=ВЕТКА)
        print("шапка:", m.id)
        await asyncio.sleep(3)

    for п in ПУБЛИКАЦИИ:
        чистый = " ".join(п["текст"].replace("<b>", "").replace("</b>", "").split())
        if чистый in было:
            print(f"пост {п['ключ']}: такая публикация уже есть, пропускаю"); continue
        m = await app.send_photo(ФОРУМ, п["кадр"], caption=п["текст"],
                                 parse_mode=ParseMode.HTML, message_thread_id=ВЕТКА)
        print(f"пост {п['ключ']}: id {m.id}")
        await asyncio.sleep(3)
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
