# -*- coding: utf-8 -*-
"""Скачиваем все вложения рабочего форума клиента для передачи проекта.
Складываем по веткам, имена делаем читаемыми, ведём опись."""
import asyncio, json, os, re, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client

ACC = "acc1"; ФОРУМ = -1003575806235
ВРЕМЕНКА = "/tmp/oko_read_dl"
КУДА = "/opt/oko-poster/peredacha/arhiv/chat"
ОПИСЬ = "/opt/oko-poster/peredacha/arhiv/chat_opis.json"


def чисто(s):
    s = re.sub(r'[^0-9A-Za-zА-Яа-яёЁ._ -]+', '_', s or '')
    return s.strip('_ ')[:80] or 'bez-imeni'


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    os.makedirs(КУДА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()

    темы = {}
    try:
        async for т in app.get_forum_topics(ФОРУМ):
            темы[т.id] = т.title
    except Exception as б:
        print("темы не читаются:", str(б)[:80], flush=True)

    опись = []
    взято = 0
    пропущено = 0
    async for m in app.get_chat_history(ФОРУМ):
        вид = None
        for поле in ("document", "video", "photo", "animation", "voice", "audio"):
            if getattr(m, поле, None):
                вид = поле; break
        if not вид:
            continue
        об = getattr(m, вид)
        ветка = темы.get(getattr(m, "message_thread_id", None), "General")
        папка = os.path.join(КУДА, чисто(ветка))
        os.makedirs(папка, exist_ok=True)
        имя = чисто(getattr(об, "file_name", "") or "")
        if not имя or имя == 'bez-imeni':
            расш = {"photo": "jpg", "video": "mp4", "animation": "mp4",
                    "voice": "ogg", "audio": "mp3"}.get(вид, "bin")
            имя = "%s_%d.%s" % (вид, m.id, расш)
        путь = os.path.join(папка, "%05d_%s" % (m.id, имя))
        if os.path.exists(путь) and os.path.getsize(путь) > 0:
            пропущено += 1
        else:
            try:
                await app.download_media(m, file_name=путь)
                взято += 1
            except Exception as б:
                print("не скачалось", m.id, str(б)[:60], flush=True)
                continue
        опись.append({"id": m.id, "когда": str(m.date)[:16], "ветка": ветка,
                      "кто": (m.from_user.username if m.from_user else ""),
                      "подпись": (m.caption or "")[:200],
                      "файл": os.path.relpath(путь, КУДА),
                      "байт": os.path.getsize(путь) if os.path.exists(путь) else 0})
        if (взято + пропущено) % 25 == 0:
            print("обработано:", взято + пропущено, flush=True)

    опись.reverse()
    json.dump({"всего": len(опись), "файлы": опись}, open(ОПИСЬ, "w"),
              ensure_ascii=False, indent=1)
    print("СКАЧАНО:", взято, "| уже было:", пропущено, "| в описи:", len(опись))
    print("ГОТОВО")
    await app.stop()

asyncio.run(main())
