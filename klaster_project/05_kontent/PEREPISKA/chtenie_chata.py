# -*- coding: utf-8 -*-
"""Полное чтение рабочего чата клиента: все ветки, все сообщения.

Запускать ТОЛЬКО при остановленной службе (agents_stop), иначе второе
подключение убьёт сессию. Предохранитель это проверяет сам.
"""
import asyncio, json, os, shutil, sys, collections
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from config import config
from core import tg_net
from pyrogram import Client
from predohranitel import проверить_или_выйти
проверить_или_выйти()

ACC = os.getenv("АКК", "acc4")
ФОРУМ = -1003575806235
В = "/tmp/oko_read_%s" % ACC
КУДА = "/tmp/rabochiy_chat.json"
ВЕТКИ = {1: "General", 3: "Переговорная", 4: "Договор", 5: "Сайт", 6: "Визуал",
         7: "Прогресс", 8: "Аналитика", 9: "Публикация", 25: "Данные",
         55: "Заявки", 204: "МЕРОПРИЯТИЯ"}


async def main():
    os.makedirs(В, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), "%s.session%s" % (ACC, к))
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(В, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=В, **tg_net.как_ходить(ACC))
    await app.start()
    все = []
    async for m in app.get_chat_history(ФОРУМ, limit=4000):
        ветка = getattr(m, "message_thread_id", None) or m.reply_to_message_id or 1
        текст = (m.text or m.caption or "").strip()
        все.append({
            "id": m.id,
            "ветка": ветка,
            "имя_ветки": ВЕТКИ.get(ветка, str(ветка)),
            "дата": str(m.date),
            "от": getattr(m.from_user, "username", "") or getattr(m.from_user, "first_name", ""),
            "текст": текст,
            "фото": bool(m.photo),
            "файл": (m.document.file_name if m.document else ""),
        })
    await app.stop()
    json.dump(все, open(КУДА, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    по_веткам = collections.Counter("%s(%s)" % (с["имя_ветки"], с["ветка"]) for с in все)
    по_людям = collections.Counter(с["от"] for с in все)
    print("сообщений всего:", len(все))
    print("по веткам:", dict(по_веткам))
    print("по людям:", dict(по_людям))
    чужие = [с for с in все if с["от"] not in ("okohelp", "ktodaniel", "okomanager", "gdedaniel")]
    print("\nПОСЛЕДНИЕ 25 СООБЩЕНИЙ КЛИЕНТА:")
    for с in чужие[:25]:
        print("  [%s | %s | %s] %s" % (с["дата"][:16], с["имя_ветки"], с["от"],
                                        " ".join(с["текст"].split())[:170]))

asyncio.run(main())
