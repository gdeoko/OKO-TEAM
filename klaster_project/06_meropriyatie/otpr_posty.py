# -*- coding: utf-8 -*-
"""Отправка пяти постов брокер-тура в ветку МЕРОПРИЯТИЯ рабочего чата.

Только текст: Даниэль просил тексты, картинки остаются на согласовании
отдельно. Перед каждой отправкой антидубль по последним сообщениям ветки,
чтобы при повторном запуске в чат не приехала вторая копия.
"""
import asyncio, hashlib, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from posty_final import ПОСТЫ
from pyrogram import Client
from pyrogram.enums import ParseMode

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204
ВРЕМЕНКА = "/tmp/oko_otpr_posty"

ШАПКА = ("💼 <b>Брокер-тур «Кластер»: пять текстов после ваших правок</b>\n\n"
         "Собрал всё, что вы написали в чате.\n\n"
         "Пост 3 в вашей редакции, слова про решение Правительства Москвы и "
         "статус технопарка сохранил.\n"
         "Пост 5 по вашему брифу: пять блоков, в каждом пять доводов, "
         "нумерация блоков и пунктов на месте, всего 25.\n"
         "Мощность везде «от 20 кВт с увеличением до 300 кВт» по правке Антона, "
         "нагрузка 5 т/м² на первом этаже и 1,2 на верхних.\n"
         "Слово «возражение» убрал, поставил «которые привлекут».\n\n"
         "Картинки к постам переснял светлыми и дневными, пришлю следом.")


def ключ(т):
    return hashlib.sha256(т[:400].encode()).hexdigest()[:16]


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
    async for m in app.get_chat_history(ФОРУМ, limit=120):
        т = (m.text or m.caption or "").strip()
        if т:
            было.add(ключ(т))

    очередь = [("шапка", ШАПКА)] + [(f"пост {п['ключ']}", п["текст"]) for п in ПОСТЫ]
    for имя, текст in очередь:
        # Сравниваем по чистому тексту: в чате разметки уже нет.
        чистый = текст.replace("<b>", "").replace("</b>", "").strip()
        if ключ(чистый) in было:
            print(f"{имя}: уже есть в ветке, пропускаю")
            continue
        m = await app.send_message(ФОРУМ, текст, parse_mode=ParseMode.HTML,
                                   message_thread_id=ВЕТКА,
                                   disable_web_page_preview=True)
        print(f"{имя}: отправлено id {m.id}")
        await asyncio.sleep(3)
    await app.stop()

asyncio.run(main())
