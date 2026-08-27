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
ПРЕДЕЛ_СООБЩЕНИЯ = 3800

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
            if о["кадры"]:
                if len(о["кадры"]) == 1:
                    await app.send_photo(ФОРУМ, о["кадры"][0], message_thread_id=ветка)
                else:
                    # медиагруппа кладётся пачками по десять: столько держит Telegram
                    for i in range(0, len(о["кадры"]), 10):
                        куски = о["кадры"][i:i + 10]
                        await app.send_media_group(
                            ФОРУМ, [InputMediaPhoto(к) for к in куски],
                            message_thread_id=ветка)
                        await asyncio.sleep(ПАУЗА)
            await asyncio.sleep(ПАУЗА)
            if о["статья"]:
                # статья уходит файлом: в сообщение она не помещается
                имя = f"/tmp/{о['имя']}.txt"
                io.open(имя, "w", encoding="utf-8").write(о["текст"])
                await app.send_document(ФОРУМ, имя, message_thread_id=ветка)
            elif о["текст"]:
                куски, текущий = [], ""
                for абзац in о["текст"].split("\n\n"):
                    if len(текущий) + len(абзац) + 2 > ПРЕДЕЛ_СООБЩЕНИЯ:
                        куски.append(текущий)
                        текущий = абзац
                    else:
                        текущий = (текущий + "\n\n" + абзац).strip()
                if текущий:
                    куски.append(текущий)
                for к in куски:
                    await app.send_message(ФОРУМ, развернуть(к), message_thread_id=ветка,
                                           parse_mode=ParseMode.HTML,
                                           disable_web_page_preview=True)
                    await asyncio.sleep(1)
            ушло += 1
            print(f"[{н}/{len(готовы)}] {о['имя'][:52]}")
            await asyncio.sleep(ПАУЗА)
        except Exception as e:
            print(f"[{н}/{len(готовы)}] СБОЙ {о['имя'][:44]}: {str(e)[:120]}")
    print(f"отправлено единиц: {ушло} из {len(готовы)}")
    await app.stop()

asyncio.run(main())
