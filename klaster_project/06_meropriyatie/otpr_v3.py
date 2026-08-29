# -*- coding: utf-8 -*-
"""Финальная выкладка в ветку: тексты после правок и визуал по их фото.

Проверки перед отправкой: кадр на месте и не мельче 1400 точек, кадры не
повторяются между собой, тексты чистые по humanize, запрещённого слова нет,
такой подписи в ветке ещё не было. Импорт модуля ничего не отправляет.
"""
import asyncio, hashlib, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import humanize, tg_net
from PIL import Image
from pyrogram import Client
from pyrogram.enums import ParseMode
from teksty_v3 import ПОСТ_1, ПОСТ_2, ПОСТ_3

ACC = "acc1"; ФОРУМ = -1003575806235; ВЕТКА = 204; ВРЕМЕНКА = "/tmp/oko_v3"
ПАПКА = "/opt/oko-poster/klaster_gen_real"

ШАПКА = ("🔁 <b>Переделали по вашим замечаниям</b>\n\n"
         "Визуал сгенерирован по вашим же фотографиям: корпус с перфопанелями, "
         "производственный блок с колоннами, конференц-зал и двор с погрузкой. "
         "Объект узнаваемый, но снят как после завершения отделки, светло и без "
         "строительных лесов.\n\n"
         "Тексты переписал по вашему правилу: сначала проблема брокера, потом "
         "чем она оборачивается, и только потом приглашение. Конкретику по "
         "метрам убрал, слово «забираете» больше нигде не стоит.\n\n"
         "Скиньте, пожалуйста, ссылку на ILike.presentation, сверю тексты с их "
         "правилами и поправлю, если что-то расходится.")

ПАРЫ = [
 ("текст 1", ПОСТ_1, "real-1-fasad.png",
  "Кадр к посту 1 · Брокер-тур 2 сентября. Ваш корпус, вид с проезда."),
 ("текст 2", ПОСТ_2, "real-2-ceh.png",
  "Кадр к посту 2 · Кто владеет информацией, тот первым делает сделку."),
 ("текст 3", ПОСТ_3, None, None),
 (None, None, "real-4-zal.png",
  "Кадр к посту 4 · Сегодня в 11:00. Ваш конференц-зал."),
 (None, None, "real-5-dvor.png",
  "Кадр к посту 5 · Искусство или навык. Двор с погрузкой."),
]


def проверить():
    беды, хеши = [], {}
    for имя, текст, кадр, _ in ПАРЫ:
        if текст:
            d = humanize.check(текст)
            if not d["ok"]:
                беды.append(f"{имя}: язык {d['bad']}")
            if "забира" in текст.lower():
                беды.append(f"{имя}: запрещённое слово «забираете»")
        if кадр:
            п = os.path.join(ПАПКА, кадр)
            if not os.path.exists(п):
                беды.append(f"{кадр}: файла нет"); continue
            ш, в = Image.open(п).size
            if max(ш, в) < 1400:
                беды.append(f"{кадр}: {ш}x{в}, мелко")
            h = hashlib.md5(open(п, "rb").read()).hexdigest()
            if h in хеши:
                беды.append(f"{кадр}: повторяет {хеши[h]}")
            хеши[h] = кадр
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
    async for m in app.get_chat_history(ФОРУМ, limit=80):
        т = (m.caption or m.text or "").strip()
        if т:
            было.add(т[:60])

    async def послать_текст(текст, метка):
        чистый = текст.replace("<b>", "").replace("</b>", "").strip()
        if чистый[:60] in было:
            print(f"{метка}: уже есть, пропускаю"); return
        m = await app.send_message(ФОРУМ, текст, parse_mode=ParseMode.HTML,
                                   message_thread_id=ВЕТКА)
        print(f"{метка}: id {m.id}")
        await asyncio.sleep(3)

    await послать_текст(ШАПКА, "шапка")
    for метка, текст, кадр, подпись in ПАРЫ:
        if текст:
            await послать_текст(текст, метка)
        if кадр:
            if подпись[:60] in было:
                print(f"{кадр}: подпись уже есть, пропускаю"); continue
            m = await app.send_photo(ФОРУМ, os.path.join(ПАПКА, кадр), caption=подпись,
                                     parse_mode=ParseMode.HTML, message_thread_id=ВЕТКА)
            print(f"{кадр}: id {m.id}")
            await asyncio.sleep(3)
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
