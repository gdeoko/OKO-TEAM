# -*- coding: utf-8 -*-
"""Отправка пакета в ветку рабочего чата по описи. Работает на сервере.

Опись собирается локально (manifest.py) и весит сотню килобайт, а кадры уже
лежат на сервере. Так по мосту не гоняются сотни мегабайт.

Что уходит клиенту: пост это кадр плюс текст, карусель это все слайды плюс
описание, статья это обложка плюс файл статьи. Никаких сопроводительных
пояснений, никаких служебных пометок.

    python3 otpravka_po_opisi.py <опись.json> <папка_кадров> <id ветки> [--проба]

Без флага «--проба» отправляет по-настоящему.
"""
import asyncio
import glob
import io
import json
import os
import shutil
import sys

sys.path.insert(0, "/opt/oko-agents")
sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from emodzi import развернуть
from pyrogram import Client
from pyrogram.enums import ParseMode
from pyrogram.types import InputMediaPhoto

ACC = "acc1"
ВРЕМЕНКА = "/tmp/oko_tg_opis"
ФОРУМ = -1003575806235
ПАУЗА = 3
ПРЕДЕЛ_ПОДПИСИ = 1024

опись_путь = sys.argv[1]
кадры_папка = sys.argv[2]
ветка = int(sys.argv[3])
проба = "--проба" in sys.argv


def кадры(ключ):
    """Файлы кадров по ключу: сам ключ или серия ключ-01, ключ-02."""
    if not ключ:
        return []
    один = os.path.join(кадры_папка, ключ + ".png")
    if os.path.exists(один):
        return [один]
    # Только двузначные номера слайдов: иначе к посту «P-20-moshchnost-schet»
    # прилипает баннер «P-20-moshchnost-schet-b», это отдельная единица плана,
    # и клиент получает под одним текстом две разные картинки.
    return sorted(glob.glob(os.path.join(кадры_папка, ключ + "-[0-9][0-9].png")))


def не_влезло(о, подписью):
    """Текст уходит отдельным файлом: статья или подпись длиннее предела."""
    return bool(о["текст"]) and not подписью


async def main():
    опись = json.load(io.open(опись_путь, encoding="utf-8"))
    готовы = []
    for о in опись:
        о["кадры"] = кадры(о["ключ"])
        готовы.append(о)
    полных = sum(1 for о in готовы if len(о["кадры"]) >= о["кадров_нужно"])
    print(f"единиц {len(готовы)}, с полным визуалом {полных}")
    if проба:
        for о in готовы:
            метка = "готово" if len(о["кадры"]) >= о["кадров_нужно"] else \
                    f"кадров {len(о['кадры'])} из {о['кадров_нужно']}"
            print(f"  {о['дата']:9} {о['тип']:9} {метка:18} {о['тема'][:56]}")
        return

    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for край in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{край}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    ушло = 0
    for н, о in enumerate(готовы, 1):
        try:
            # Единица идёт одним сообщением: кадр или все слайды карусели плюс
            # текст подписью. Подпись Телеграма держит 1024 знака, и если текст
            # длиннее, кадры уходят одним сообщением, а текст следом файлом.
            подписью = (not о["статья"] and о["текст"]
                        and len(о["текст"]) <= ПРЕДЕЛ_ПОДПИСИ)
            подпись = развернуть(о["текст"]) if подписью else None
            if о["кадры"]:
                if len(о["кадры"]) == 1:
                    await app.send_photo(ФОРУМ, о["кадры"][0], caption=подпись,
                                         parse_mode=ParseMode.HTML,
                                         message_thread_id=ветка)
                else:
                    # медиагруппа кладётся пачками по десять: столько держит Telegram
                    for i in range(0, len(о["кадры"]), 10):
                        куски = о["кадры"][i:i + 10]
                        медиа = [InputMediaPhoto(к) for к in куски]
                        if i == 0 and подпись:
                            медиа[0] = InputMediaPhoto(куски[0], caption=подпись,
                                                       parse_mode=ParseMode.HTML)
                        await app.send_media_group(ФОРУМ, медиа, message_thread_id=ветка)
                        await asyncio.sleep(ПАУЗА)
            await asyncio.sleep(ПАУЗА)
            if не_влезло(о, подписью):
                имя = f"/tmp/{о['имя']}.txt"
                io.open(имя, "w", encoding="utf-8").write(о["текст"])
                await app.send_document(ФОРУМ, имя, message_thread_id=ветка)
            ушло += 1
            print(f"[{н}/{len(готовы)}] {о['имя'][:52]}")
            await asyncio.sleep(ПАУЗА)
        except Exception as e:
            print(f"[{н}/{len(готовы)}] СБОЙ {о['имя'][:44]}: {str(e)[:120]}")
    print(f"отправлено единиц: {ушло} из {len(готовы)}")
    await app.stop()

asyncio.run(main())
