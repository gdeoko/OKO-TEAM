# -*- coding: utf-8 -*-
"""Поиск профильных чатов и каналов брокеров в Телеграме.

Только чтение: ищем публичные группы и каналы по запросам про недвижимость и
брокеров, смотрим размер и тип. Никуда не вступаем и никому не пишем, это
разведка перед сбором аудитории.
"""
import asyncio, json, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client
from pyrogram.raw import functions, types

ACC = "acc1"; ВРЕМЕНКА = "/tmp/oko_tg_poisk"

ЗАПРОСЫ = [
 "брокеры недвижимости", "риэлторы Москва", "коммерческая недвижимость",
 "аренда склада", "брокер коммерческой недвижимости", "недвижимость чат",
 "риэлторское сообщество", "склады аренда Москва", "производственные помещения",
 "агенты недвижимости", "брокеры Москва", "коммерция недвижимость чат",
]


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()

    найдено = {}
    for з in ЗАПРОСЫ:
        try:
            r = await app.invoke(functions.contacts.Search(q=з, limit=50))
        except Exception as беда:
            print(f"{з}: не вышло, {беда}", flush=True)
            await asyncio.sleep(3)
            continue
        for ч in r.chats:
            if not isinstance(ч, types.Channel):
                continue
            ключ = ч.username or str(ч.id)
            если_есть = найдено.get(ключ, {})
            найдено[ключ] = {
                "название": ч.title,
                "ник": ч.username or "",
                "id": ч.id,
                "группа": bool(getattr(ч, "megagroup", False)),
                "участников": getattr(ч, "participants_count", None) or если_есть.get("участников"),
                "запросы": sorted(set(если_есть.get("запросы", []) + [з])),
            }
        print(f"{з}: всего накопили {len(найдено)}", flush=True)
        await asyncio.sleep(2)

    # Уточняем размеры: в выдаче поиска их часто нет.
    for ключ, з in list(найдено.items()):
        if з["участников"] or not з["ник"]:
            continue
        try:
            ч = await app.get_chat(з["ник"])
            з["участников"] = getattr(ч, "members_count", None)
        except Exception:
            pass
        await asyncio.sleep(1)

    ряд = sorted(найдено.values(), key=lambda з: -(з["участников"] or 0))
    json.dump({"всего": len(ряд), "чаты": ряд},
              open("/opt/oko-poster/tg_chaty.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    группы = [з for з in ряд if з["группа"]]
    print(f"\nНАЙДЕНО каналов и групп: {len(ряд)}, из них групп: {len(группы)}")
    for з in ряд[:25]:
        вид = "группа" if з["группа"] else "канал"
        print(f"  {вид:7} @{з['ник'] or '—':28} {з['участников'] or '?':>8}  {з['название'][:44]}")
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
