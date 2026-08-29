# -*- coding: utf-8 -*-
"""Кадры на настоящих фото объекта и новый текст второго поста в ветку.

Проверки те же, что и всегда: файл на месте, кадр не мельче 1400 точек,
кадры не повторяются между собой, такой подписи в ветке ещё не было.
Импорт модуля ничего не отправляет.
"""
import asyncio, hashlib, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from PIL import Image
from post2_info import ТЕКСТ as ПОСТ2
from pyrogram import Client
from pyrogram.enums import ParseMode

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204; ВРЕМЕНКА = "/tmp/oko_real"
ПАПКА = "/opt/oko-poster/klaster_real"

ШАПКА = ("📸 <b>Переделали визуал на ваших фотографиях</b>\n\n"
         "Взяли вашу съёмку: фасад с перфопанелями, конференц-зал в двух ракурсах "
         "и переговорную. Ничего дорисованного, экран с вашим логотипом там, где он "
         "и стоит. От нас кадрирование, свет и подписи.\n\n"
         "Второй пост переписал под вашу мысль про информацию, текст следом.")

КАДРЫ = [
 ("post-1.jpg", "Кадр к посту 1 · Брокер-тур 2 сентября. Фасад корпуса, ваша съёмка."),
 ("post-2.jpg", "Кадр к посту 2 · Кто владеет информацией, тот первым делает сделку."),
 ("post-4.jpg", "Кадр к посту 4 · Сегодня в 11:00. Ваш конференц-зал."),
 ("post-5.jpg", "Кадр к посту 5 · Искусство или навык. Переговорная."),
]


def проверить():
    беды, хеши = [], {}
    for имя, _ in КАДРЫ:
        п = os.path.join(ПАПКА, имя)
        if not os.path.exists(п):
            беды.append(f"{имя}: файла нет"); continue
        ш, в = Image.open(п).size
        if max(ш, в) < 1400:
            беды.append(f"{имя}: {ш}x{в}, мелко")
        h = hashlib.md5(open(п, "rb").read()).hexdigest()
        if h in хеши:
            беды.append(f"{имя}: повторяет {хеши[h]}")
        хеши[h] = имя
    return беды


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
    async for m in app.get_chat_history(ФОРУМ, limit=60):
        т = (m.caption or m.text or "").strip()
        if т:
            было.add(т[:60])

    for имя, текст in [("шапка", ШАПКА), ("пост 2", ПОСТ2)]:
        чистый = текст.replace("<b>", "").replace("</b>", "").strip()
        if чистый[:60] in было:
            print(f"{имя}: уже есть, пропускаю"); continue
        m = await app.send_message(ФОРУМ, текст, parse_mode=ParseMode.HTML,
                                   message_thread_id=ВЕТКА)
        print(f"{имя}: id {m.id}")
        await asyncio.sleep(3)

    for имя, подпись in КАДРЫ:
        if подпись[:60] in было:
            print(f"{имя}: подпись уже есть, пропускаю"); continue
        m = await app.send_photo(ФОРУМ, os.path.join(ПАПКА, имя), caption=подпись,
                                 parse_mode=ParseMode.HTML, message_thread_id=ВЕТКА)
        print(f"{имя}: id {m.id}")
        await asyncio.sleep(3)
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
