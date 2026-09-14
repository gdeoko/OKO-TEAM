# -*- coding: utf-8 -*-
"""Полное чтение рабочего чата вместе с голосовыми и кружками.

Текст читаем как есть, голос скачиваем файлами: расшифровка отдельным шагом.
Запускать только при остановленной службе, предохранитель это проверяет.
"""
import asyncio, json, os, shutil, sys, collections
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from config import config
from core import tg_net
from pyrogram import Client
from predohranitel import проверить_или_выйти
проверить_или_выйти()

ACC = "acc4"
ФОРУМ = -1003575806235
В = "/tmp/oko_read_%s" % ACC
ГОЛОС = "/tmp/klaster_golos"
КУДА = "/tmp/rabochiy_chat_polnyy.json"
ВЕТКИ = {1: "General", 3: "Переговорная", 4: "Договор", 5: "Сайт", 6: "Визуал",
         7: "Прогресс", 8: "Аналитика", 9: "Публикация", 25: "Данные",
         55: "Заявки", 204: "МЕРОПРИЯТИЯ"}


async def main():
    os.makedirs(В, exist_ok=True)
    os.makedirs(ГОЛОС, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), "%s.session%s" % (ACC, к))
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(В, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=В, **tg_net.как_ходить(ACC))
    await app.start()
    все, голосовых = [], 0
    async for m in app.get_chat_history(ФОРУМ, limit=6000):
        ветка = getattr(m, "message_thread_id", None) or m.reply_to_message_id or 1
        вид = "текст"
        файл = ""
        if m.voice:
            вид = "голос"
        elif m.video_note:
            вид = "кружок"
        elif m.audio:
            вид = "аудио"
        elif m.photo:
            вид = "фото"
        elif m.document:
            вид = "документ"
        if вид in ("голос", "кружок", "аудио"):
            имя = "%s/%s_%s.%s" % (ГОЛОС, ветка, m.id, "ogg" if вид == "голос" else "mp4")
            try:
                await app.download_media(m, file_name=имя)
                файл = имя
                голосовых += 1
            except Exception as б:
                файл = "не скачалось: %s" % str(б)[:40]
        все.append({
            "id": m.id, "ветка": ветка, "имя_ветки": ВЕТКИ.get(ветка, str(ветка)),
            "дата": str(m.date), "вид": вид,
            "от": getattr(m.from_user, "username", "") or getattr(m.from_user, "first_name", ""),
            "текст": (m.text or m.caption or "").strip(),
            "файл": файл,
            "имя_файла": (m.document.file_name if m.document else ""),
            "длительность": getattr(m.voice or m.video_note or m.audio, "duration", 0)
                            if вид in ("голос", "кружок", "аудио") else 0,
        })
    await app.stop()
    json.dump(все, open(КУДА, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    по_виду = collections.Counter(с["вид"] for с in все)
    по_ветке = collections.Counter(с["имя_ветки"] for с in все)
    по_людям = collections.Counter(с["от"] for с in все)
    print("сообщений:", len(все), "| голосовых и кружков скачано:", голосовых)
    print("по виду:", dict(по_виду))
    print("по веткам:", dict(по_ветке))
    print("по людям:", dict(по_людям))

asyncio.run(main())
