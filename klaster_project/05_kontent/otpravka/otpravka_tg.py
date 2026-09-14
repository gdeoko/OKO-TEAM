# -*- coding: utf-8 -*-
"""Отправка пакета контента в ветку рабочего чата клиента.

Без сопроводительных текстов и объяснений: пост это картинка и текст,
карусель это все слайды и описание, статья это обложка и файл статьи.
Подпись в Telegram обрезается на 1024 знаках, поэтому текст идёт
отдельным сообщением следом за медиа.

    python3 otpravka_tg.py <папка пакета> <id ветки> [--проба]
"""
import asyncio, os, re, sys, shutil, glob
sys.path.insert(0, "/opt/oko-agents")
from config import config
from core import tg_net
sys.path.insert(0, "/opt/oko-poster")
from emodzi import развернуть
from pyrogram import Client
from pyrogram.types import InputMediaPhoto, InputMediaDocument
from pyrogram.enums import ParseMode

ACC = "acc1"
ВРЕМЕНКА = "/tmp/oko_tg_send"
ФОРУМ = -1003575806235
ПАУЗА = 3

папка = sys.argv[1]
ветка = int(sys.argv[2])
проба = "--проба" in sys.argv


def единицы(п):
    сп = []
    for д in sorted(os.listdir(п)):
        путь = os.path.join(п, д)
        if not os.path.isdir(путь):
            continue
        картинки = sorted(glob.glob(os.path.join(путь, "*.png")) +
                          glob.glob(os.path.join(путь, "*.jpg")))
        тексты = glob.glob(os.path.join(путь, "*.txt"))
        статья = any(os.path.basename(т) == "statya.txt" for т in тексты)
        текст = open(тексты[0], encoding="utf-8").read().strip() if тексты else ""
        сп.append({"имя": д, "картинки": картинки, "текст": текст,
                   "статья": статья, "файл": тексты[0] if тексты else ""})
    return сп


async def main():
    сп = единицы(папка)
    print(f"единиц в пакете: {len(сп)}")
    if проба:
        for е in сп:
            print(f"  {е['имя'][:50]:52} картинок {len(е['картинки'])}  знаков {len(е['текст'])}")
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
    for н, е in enumerate(сп, 1):
        try:
            if е["картинки"]:
                if len(е["картинки"]) == 1:
                    await app.send_photo(ФОРУМ, е["картинки"][0], message_thread_id=ветка)
                else:
                    # медиагруппа кладётся пачками по десять: столько держит Telegram
                    for i in range(0, len(е["картинки"]), 10):
                        куски = е["картинки"][i:i + 10]
                        await app.send_media_group(
                            ФОРУМ, [InputMediaPhoto(к) for к in куски],
                            message_thread_id=ветка)
                        await asyncio.sleep(ПАУЗА)
            await asyncio.sleep(ПАУЗА)
            if е["статья"]:
                await app.send_document(ФОРУМ, е["файл"], message_thread_id=ветка)
            elif е["текст"]:
                # длинный текст режем по абзацам, чтобы не упереться в предел сообщения
                куски, текущий = [], ""
                for абзац in е["текст"].split("\n\n"):
                    if len(текущий) + len(абзац) + 2 > 3800:
                        куски.append(текущий); текущий = абзац
                    else:
                        текущий = (текущий + "\n\n" + абзац).strip()
                if текущий: куски.append(текущий)
                for к in куски:
                    await app.send_message(ФОРУМ, развернуть(к), message_thread_id=ветка,
                                           parse_mode=ParseMode.HTML,
                                           disable_web_page_preview=True)
                    await asyncio.sleep(1)
            ушло += 1
            print(f"[{н}/{len(сп)}] {е['имя'][:46]}")
            await asyncio.sleep(ПАУЗА)
        except Exception as e:
            print(f"[{н}/{len(сп)}] СБОЙ {е['имя'][:40]}: {str(e)[:120]}")
    print(f"отправлено единиц: {ушло} из {len(сп)}")
    await app.stop()

asyncio.run(main())
