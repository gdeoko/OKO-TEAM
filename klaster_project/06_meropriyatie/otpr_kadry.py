# -*- coding: utf-8 -*-
"""Пять кадров в ветку МЕРОПРИЯТИЯ, каждый со своей привязкой к посту.

Проверки перед отправкой:
  · файл на месте и не мельче 1400 точек по длинной стороне;
  · кадры не повторяются между собой (md5);
  · такой подписи в последних сообщениях ветки ещё не было;
  · запуск только напрямую, импорт ничего не отправляет.
"""
import asyncio, hashlib, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from PIL import Image
from pyrogram import Client
from pyrogram.enums import ParseMode

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204; ВРЕМЕНКА = "/tmp/oko_kadry"
ПАПКА = "/opt/oko-poster/klaster_svet"

КАДРЫ = [
 ("EV-01-svet-tur.png",
  "Кадр к посту 1 · Брокер-тур 2 сентября. Панорама парка днём, надпись с датой и местом."),
 ("EV-02-svet-blok.png",
  "Кадр к посту 2 · Вы заходите первым. Свободный блок изнутри, цифры по метражу, нагрузке и мощности."),
 ("EV-03-svet-krt.png",
  "Кадр к посту 3 · Ваш адрес вне зоны КРТ. Площадка сверху, граница участка обведена."),
 ("EV-04-svet-zal.png",
  "Кадр к посту 4 · Сегодня в 11:00. Новый конференц-зал, сбор с 10:40."),
 ("EV-05-svet-sdelki-v2.png",
  "Кадр к посту 5 · Искусство или навык. Подпись поправлена под вашу правку: пять блоков аргументов, без раскрытия."),
]


def проверить():
    беды, хеши = [], {}
    for имя, _ in КАДРЫ:
        п = os.path.join(ПАПКА, имя)
        if not os.path.exists(п):
            беды.append(f"{имя}: файла нет"); continue
        ш, в = Image.open(п).size
        if max(ш, в) < 1400:
            беды.append(f"{имя}: {ш}x{в}, это мелко")
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

    ушло = 0
    for имя, подпись in КАДРЫ:
        if подпись[:60] in было:
            print(f"{имя}: такая подпись уже есть, пропускаю"); continue
        m = await app.send_photo(ФОРУМ, os.path.join(ПАПКА, имя), caption=подпись,
                                 parse_mode=ParseMode.HTML, message_thread_id=ВЕТКА)
        ушло += 1
        print(f"{имя}: отправлен id {m.id}")
        await asyncio.sleep(3)
    print("итого кадров ушло:", ушло)
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
