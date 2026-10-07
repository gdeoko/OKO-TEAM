# -*- coding: utf-8 -*-
"""Коридор живой письменной ленты: снимаем с настоящих отраслевых каналов.

Профиль «сценарий» в tools.zhivost снят с озвучки роликов, и постам он не
годится: там даже числа цифрами считаются браком, хотя в постах наоборот.
Чтобы мерить наши посты честно, берём живые каналы про производство,
склады и промышленную недвижимость и считаем их ритм.
"""
import asyncio, json, os, re, statistics as st, sys
sys.path.insert(0, "/opt/oko-agents"); sys.path.insert(0, "/opt/oko-poster")
from config import config
from core import tg_net
from pyrogram import Client

from predohranitel import проверить_или_выйти
проверить_или_выйти()   # при живой службе подключаться нельзя

ACC = "acc4"
ЗАПРОСЫ = ["промышленная недвижимость", "склады аренда", "производство завод",
           "индустриальный парк", "аренда цеха", "склад логистика"]
КУДА = "/tmp/lenta_etalon.json"
# Каналы взяты из нашего же разбора конкурентов и смежных ниш: город,
# производство, недвижимость, стройка. Это письменные ленты, а не озвучка.
СПИСОК = ["varlamov", "tvzrru", "techzone1843", "stroyizhivi",
          "smirnov_real_estate", "smarent", "podzemnayamoskva", "mashnewstv",
          "kaketosdelano", "amo_blog", "ToBizru", "Promturist", "PROMETRO",
          "MoscowWalks", "Mashkov_D", "InvestFutureRu", "Igor_Rybakov",
          "Razborshik", "G0RDEEN", "ForumHouseTV", "KonstantinPro", "LOFTDIY"]


def метрики(т):
    т = re.sub(r"\s+", " ", т).strip()
    пред = [п.strip() for п in re.split(r"[.!?]+", т) if len(п.strip()) > 1]
    длины = [len(п.split()) for п in пред]
    if len(длины) < 4:
        return None
    сред = st.mean(длины); разброс = st.pstdev(длины)
    союзы = r"и|а|но|так|значит|потом|зато|причём|правда|только|ну|вот|да|кстати|хотя|поэтому|тут|там|теперь|сейчас|при этом|плюс"
    союзные = sum(1 for п in пред if re.match(r"^(%s)\b" % союзы, п, re.I))
    return dict(средняя=round(сред,1), разброс=round(разброс,1),
                разнобой=round(разброс/сред,2) if сред else 0,
                союзы=round(союзные/len(пред)*100),
                коротких=round(sum(1 for д in длины if д < 8)/len(длины)*100),
                предложений=len(пред))


async def main():
    app = Client(ACC, api_id=config.PYROGRAM_API_ID, api_hash=config.PYROGRAM_API_HASH,
                 workdir="/tmp/oko_chist_acc4", **tg_net.как_ходить(ACC))
    await app.start()
    каналы = {н: 1 for н in СПИСОК}
    print("каналов в эталоне:", len(каналы))
    свод, разбор = [], {}
    for ник in list(каналы):
        собрано = []
        try:
            async for m in app.get_chat_history(ник, limit=60):
                т = (m.text or m.caption or "").strip()
                if len(т) > 350:
                    м = метрики(т)
                    if м:
                        собрано.append(м)
            await asyncio.sleep(2)
        except Exception as б:
            print(ник, "не читается", str(б)[:50]); continue
        if len(собрано) >= 8:
            разбор[ник] = len(собрано)
            свод += собрано
            ср = round(st.mean([x["средняя"] for x in собрано]), 1)
            кр = round(st.mean([x["коротких"] for x in собрано]))
            print(f"{ник}: постов {len(собрано)}, средняя {ср}, коротких {кр}%")
    await app.stop()
    if свод:
        свод_итог = {}
        for к in ("средняя","разброс","разнобой","союзы","коротких"):
            зн = sorted(x[к] for x in свод)
            n = len(зн)
            свод_итог[к] = dict(медиана=round(st.median(зн),2),
                                низ=round(зн[int(n*0.10)],2),
                                верх=round(зн[int(n*0.90)],2))
        json.dump(dict(постов=len(свод), каналы=разбор, коридор=свод_итог),
                  open(КУДА,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\nПОСТОВ В ЭТАЛОНЕ:", len(свод))
        for к, v in свод_итог.items():
            print("  %-10s медиана %s, коридор %s-%s" % (к, v["медиана"], v["низ"], v["верх"]))

asyncio.run(main())
