# -*- coding: utf-8 -*-
"""Пересобирает помесячный список промптов из свежего promts_new/gruppa_dobor.json.

Порядок и состав кадров берутся из уже лежащего promts_mesyac_N.json (он и есть
план съёмки месяца), а текст промпта подставляется свежий: так правка движка
доезжает до очереди, не перетасовывая очередь.

    python3 spisok_mesyaca.py 1 2 3
"""
import glob, io, json, os, sys

свежие = {}
for ф in sorted(glob.glob("promts_new/*.json")):
    свежие.update(json.load(io.open(ф, encoding="utf-8")))

for м in (sys.argv[1:] or ["1", "2", "3"]):
    путь = f"promts_mesyac_{м}.json"
    if not os.path.exists(путь):
        print(f"нет {путь}"); continue
    старый = json.load(io.open(путь, encoding="utf-8"))
    новый, пропало, поменялось = {}, [], 0
    for к, v in старый.items():
        if к in свежие:
            if свежие[к]["текст"] != v.get("текст"): поменялось += 1
            новый[к] = свежие[к]
        else:
            # Ключа нет в свежей сборке значит единицу из плана сняли: держать
            # её в списке съёмки нельзя, иначе очередь снимает то, что не сдаём.
            пропало.append(к)
    json.dump(новый, io.open(путь, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"месяц {м}: кадров {len(новый)}, обновлено текстов {поменялось}"
          + (f", убрано из съёмки {len(пропало)}" if пропало else ""))
