# -*- coding: utf-8 -*-
"""Сбор живых участников профильных чатов: кто реально пишет, а не числится.

Списки участников Телеграм отдаёт частично, да и половина там мёртвые души.
Поэтому идём по истории сообщений и берём авторов: человек писал в чате про
коммерческую недвижимость, значит он в теме и его приглашение не удивит.

Ничего не отправляем, только читаем. Наши же аккаунты и боты отсеиваем.
"""
import asyncio, json, os, shutil, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client

ACC = "acc1"; ВРЕМЕНКА = "/tmp/oko_tg_sbor"
ГЛУБИНА = int(os.getenv("ГЛУБИНА", "3000"))

ЧАТЫ = ["kommercheskay", "gb_032", "Kommerch", "realestate_chat",
        "rieltory_moskva", "Ofisy_Moskva", "best_realtor", "chat_nedvizhimosti"]


async def main():
    os.makedirs(ВРЕМЕНКА, exist_ok=True)
    for к in ("", "-journal", "-wal", "-shm"):
        и = os.path.join(str(config.SESSIONS_DIR), f"{ACC}.session{к}")
        if os.path.exists(и):
            shutil.copy2(и, os.path.join(ВРЕМЕНКА, os.path.basename(и)))
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir=ВРЕМЕНКА, **tg_net.как_ходить(ACC))
    await app.start()
    я = await app.get_me()

    люди = {}
    for ник in ЧАТЫ:
        взято = 0
        try:
            async for m in app.get_chat_history(ник, limit=ГЛУБИНА):
                а = m.from_user
                if not а or а.is_bot or а.id == я.id:
                    continue
                взято += 1
                к = str(а.id)
                если = люди.get(к, {"сообщений": 0, "чаты": []})
                если["сообщений"] += 1
                если["ник"] = а.username or ""
                если["имя"] = " ".join(filter(None, [а.first_name, а.last_name]))[:60]
                если["id"] = а.id
                если["телефон"] = а.phone_number or ""
                если["premium"] = bool(getattr(а, "is_premium", False))
                if ник not in если["чаты"]:
                    если["чаты"].append(ник)
                если["последнее"] = m.date.strftime("%Y-%m-%d")
                люди[к] = если
        except Exception as беда:
            print(f"@{ник}: не прочитала, {str(беда)[:80]}", flush=True)
            continue
        print(f"@{ник}: сообщений {взято}, людей всего {len(люди)}", flush=True)
        await asyncio.sleep(4)

    ряд = sorted(люди.values(), key=lambda ч: -ч["сообщений"])
    json.dump({"всего": len(ряд), "люди": ряд},
              open("/opt/oko-poster/tg_ludi.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    с_ником = sum(1 for ч in ряд if ч["ник"])
    активных = sum(1 for ч in ряд if ч["сообщений"] >= 3)
    print(f"\nИТОГО людей: {len(ряд)} | с ником для связи: {с_ником} | "
          f"писавших от трёх раз: {активных}")
    await app.stop()


if __name__ == "__main__":
    asyncio.run(main())
