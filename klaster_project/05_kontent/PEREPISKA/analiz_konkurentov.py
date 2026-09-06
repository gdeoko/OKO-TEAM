# -*- coding: utf-8 -*-
"""Разбор конкурентов и смежного рынка прямо в Телеграме.

Берём каналы промышленной и складской недвижимости, брокерские каналы и
каналы самого клиента. С каждого снимаем посты и считаем, чем они живут:
длина, структура, цифры, источники, эмодзи, хуки, призывы.
"""
import asyncio, json, os, re, statistics as st, sys, collections
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from config import config
from core import tg_net
from pyrogram import Client
from predohranitel import проверить_или_выйти
проверить_или_выйти()

ЗАПРОСЫ = ["light industrial", "индустриальный парк", "складская недвижимость",
           "коммерческая недвижимость аренда", "производственные помещения",
           "промышленная недвижимость", "склады аренда москва", "брокер недвижимость"]
НАШИ = ["radialnya", "cluster17s1"]
КУДА = "/tmp/konkurenty_klaster.json"


def разбор(т):
    т = т.strip()
    предложения = [п.strip() for п in re.split(r"[.!?]+\s", т) if len(п.strip()) > 1]
    слова = т.split()
    абзацы = [а for а in т.split("\n") if а.strip()]
    return {
        "знаков": len(т),
        "слов": len(слова),
        "предложений": len(предложения),
        "абзацев": len(абзацы),
        "средняя фраза": round(st.mean([len(п.split()) for п in предложения]), 1) if предложения else 0,
        "цифр": len(re.findall(r"\d+", т)),
        "процентов": len(re.findall(r"%|процент", т)),
        "эмодзи": len(re.findall(r"[\U0001F300-\U0001FAFF☀-➿]", т)),
        "хештегов": len(re.findall(r"#\w+", т)),
        "ссылок": len(re.findall(r"https?://|t\.me/", т)),
        "жирный": т.count("**") // 2,
        "вопросов": т.count("?"),
        "источник": bool(re.search(r"по данным|источник|данные|исследовани|отчёт|аналитик", т, re.I)),
        "первая строка": " ".join(абзацы[0].split())[:120] if абзацы else "",
    }


async def main():
    app = Client("acc4", api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir="/tmp/oko_read_acc4", **tg_net.как_ходить("acc4"))
    await app.start()
    каналы = {}
    for з in ЗАПРОСЫ:
        try:
            async for ч in app.search_global(з, limit=20):
                c = ч.chat
                if c and c.type.name == "CHANNEL" and c.username:
                    каналы.setdefault(c.username, {"имя": c.title, "запрос": з})
        except Exception as б:
            print("поиск", з, str(б)[:50])
        await asyncio.sleep(2)
    for н in НАШИ:
        каналы.setdefault(н, {"имя": "канал клиента", "запрос": "наш"})
    print("каналов к разбору:", len(каналы), flush=True)

    итог = {}
    for ник, инфо in list(каналы.items())[:26]:
        посты = []
        try:
            async for m in app.get_chat_history(ник, limit=60):
                т = (m.text or m.caption or "").strip()
                if len(т) < 120:
                    continue
                р = разбор(т)
                р["просмотры"] = getattr(m, "views", 0) or 0
                р["дата"] = str(m.date)[:10]
                р["текст"] = " ".join(т.split())[:900]
                посты.append(р)
                if len(посты) >= 30:
                    break
        except Exception as б:
            print(ник, "мимо:", str(б)[:45]); continue
        if len(посты) >= 5:
            итог[ник] = {"имя": инфо["имя"], "посты": посты}
            ср = lambda к: round(st.mean([p[к] for p in посты]), 1)
            print("%-24s %-30s постов %2d | знаков %5.0f | фраза %4.1f | цифр %4.1f | эмодзи %4.1f | просмотры %6.0f" %
                  (ник, инфо["имя"][:28], len(посты), ср("знаков"), ср("средняя фраза"),
                   ср("цифр"), ср("эмодзи"), ср("просмотры")), flush=True)
        await asyncio.sleep(1.5)
    await app.stop()
    json.dump(итог, open(КУДА, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("сохранено каналов:", len(итог))

asyncio.run(main())
